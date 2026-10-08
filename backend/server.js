import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = Number(process.env.PORT || 4000);
const textModel = process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash';
const geminiTtsModel = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
const apiKey = process.env.GEMINI_API_KEY;
const sarvamApiKey = process.env.SARVAM_API_KEY;
const sarvamTtsModel = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const openRouterTtsModel = process.env.OPENROUTER_TTS_MODEL || 'fish-audio/s2.1-pro-free:free';
const genai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const parsedTtsDisabledUntil = Date.parse(process.env.GEMINI_TTS_DISABLED_UNTIL || '');
const ttsDisabledUntil = Number.isFinite(parsedTtsDisabledUntil) ? parsedTtsDisabledUntil : 0;
let ttsUnavailableUntil = 0;
const geminiTtsIsAvailable = () => Boolean(genai) && Date.now() >= ttsDisabledUntil && Date.now() >= ttsUnavailableUntil;
const ttsIsAvailable = () => Boolean(sarvamApiKey) || Boolean(openRouterApiKey) || geminiTtsIsAvailable();
const activeTtsProvider = () => sarvamApiKey ? 'sarvam' : openRouterApiKey ? 'openrouter' : geminiTtsIsAvailable() ? 'gemini' : 'device';
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('This website is not allowed to use the GD Arena API.'));
  },
}));
app.use(express.json({ limit: '128kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));

const agents = {
  dominator: {
    name: 'Rohan', voice: 'Fenrir', sarvamVoice: 'rohan', fishVoice: '79d0bd3e4e5444b18f7b6d89b5927bf1', fishStyle: '[confident, assertive, energetic]', style: 'conversational, assured, relaxed pace',
    persona: 'You speak up early, take clear positions, and challenge ideas respectfully. Do not dominate or talk over others.',
  },
  data_driven: {
    name: 'Ananya', voice: 'Kore', sarvamVoice: 'neha', fishVoice: '933563129e564b19a115bedd57b7406a', fishStyle: '[clear, thoughtful, precise]', style: 'conversational, thoughtful, precise',
    persona: 'You ask for examples and evidence. Never invent numbers, quotes, studies, or facts. Say when evidence is uncertain.',
  },
  quiet_thinker: {
    name: 'Vikram', voice: 'Charon', sarvamVoice: 'rahul', fishVoice: 'bf322df2096a46f18c579d0baa36f41d', fishStyle: '[gentle, reflective, unhurried]', style: 'conversational, gentle, unhurried',
    persona: 'You speak less often, but add a concise synthesis or a useful overlooked point when invited by the discussion.',
  },
  wanderer: {
    name: 'Pooja', voice: 'Leda', sarvamVoice: 'pooja', fishVoice: '9a9cf47702da476aa4629e2506d4a857', fishStyle: '[curious, expressive, warm]', style: 'conversational, curious, warm',
    persona: 'You offer a short, memorable analogy or wider angle, then connect it back to the topic.',
  },
  connector: {
    name: 'Mira', voice: 'Aoede', sarvamVoice: 'simran', fishVoice: 'e3cd384158934cc9a01029cd7d278634', fishStyle: '[warm, collaborative, friendly]', style: 'conversational, warm, collaborative',
    persona: 'You build on a specific previous point and connect different views. Do not simply agree with the latest speaker.',
  },
  moderator: {
    name: 'Dr. Sharma', voice: 'Orus', sarvamVoice: 'amit', fishVoice: '536d3a5e000945adb7038665781a4aca', fishStyle: '[composed, clear, reassuring]', style: 'conversational, composed, brief',
    persona: 'You are a neutral discussion moderator. Keep the room on topic, invite quieter speakers, and speak briefly.',
  },
};

const onlyString = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const getText = (response) => response?.text || '';

app.get('/health', (_request, response) => {
  response.json({ ok: true, aiConfigured: Boolean(genai), ttsAvailable: ttsIsAvailable(), ttsProvider: activeTtsProvider(), textModel, ttsModel: sarvamApiKey ? sarvamTtsModel : openRouterTtsModel });
});

app.post('/api/turn', async (request, response) => {
  const { topic, language = 'en', format = 'Open discussion', panel = [], transcript = [] } = request.body || {};
  if (!onlyString(topic, 240)) return response.status(400).json({ error: 'Add a topic under 240 characters.' });
  if (!Array.isArray(panel) || panel.length < 3 || panel.length > 5 || panel.some((id) => !agents[id] || id === 'moderator')) {
    return response.status(400).json({ error: 'Choose 3 to 5 known AI participants.' });
  }
  if (!Array.isArray(transcript) || transcript.length > 160) return response.status(400).json({ error: 'The transcript is too long.' });
  if (!genai) return response.status(503).json({ error: 'Gemini is not configured yet. The room can use its demo responses.' });

  const turns = transcript.slice(-16).map((turn) => ({
    speakerId: String(turn?.speakerId || '').slice(0, 32),
    speakerName: String(turn?.speakerName || '').slice(0, 48),
    text: String(turn?.text || '').slice(0, 900),
    isStudent: Boolean(turn?.isStudent),
  }));
  const languageGuidance = 'Speak in natural, conversational English only. Use a clear, relaxed Indian English accent; avoid robotic phrasing, Hindi, and code-switching.';
  const personaCards = panel.map((id) => ({ id, name: agents[id].name, traits: agents[id].persona }));
  const prompt = [
    'You are the turn manager for GD Arena, a student group discussion simulation.',
    'Choose exactly one available AI participant to speak next, then write only that participant’s short reply. The room should feel like a discussion among real students, not a queue of isolated answers.',
    `Topic: ${topic}`,
    `Discussion format: ${format}`,
    `Room language: ${languageGuidance}`,
    `Available personas: ${JSON.stringify(personaCards)}`,
    `Recent transcript: ${JSON.stringify(turns)}`,
    'If the most recent transcript turn is from the student, respond directly to a specific idea they just expressed: acknowledge or respectfully challenge that point before adding one useful thought. Never ignore the student and switch to an unrelated canned point. Otherwise, react to what another participant just said, disagree respectfully when natural, and let different personalities take the floor without waiting for the student after every reply. Avoid repeating the immediately previous AI speaker when another persona can contribute. Do not interrupt or write narration. Speak like a student in a real GD: one short, natural sentence of 12–18 words, with a hard maximum of 22 words. Keep it brief so it sounds quick in conversation. Never make up data or statistics.',
    'Return only a JSON object with speakerId, text, and replyToSpeakerId. speakerId must be one of the available ids. replyToSpeakerId must be a recent transcript speaker id or null.',
  ].join('\n');

  try {
    const result = await genai.models.generateContent({
      model: textModel,
      contents: prompt,
      config: { responseMimeType: 'application/json', maxOutputTokens: 180 },
    });
    const parsed = JSON.parse(getText(result));
    if (!panel.includes(parsed.speakerId) || !onlyString(parsed.text, 700)) throw new Error('Gemini returned an invalid speaker turn.');
    const replyToSpeakerId = turns.some((turn) => turn.speakerId === parsed.replyToSpeakerId) ? parsed.replyToSpeakerId : null;
    response.json({ speakerId: parsed.speakerId, speakerName: agents[parsed.speakerId].name, text: parsed.text.trim(), replyToSpeakerId });
  } catch (error) {
    console.error('Gemini turn request failed:', error instanceof Error ? error.message : 'unknown error');
    response.status(502).json({ error: 'The AI could not reply just now. Try again or continue with a demo response.' });
  }
});

app.post('/api/speech', async (request, response) => {
  const { text, speakerId = 'moderator' } = request.body || {};
  if (!onlyString(text, 700)) return response.status(400).json({ error: 'Speech text must be under 700 characters.' });
  if (!agents[speakerId]) return response.status(400).json({ error: 'Unknown speaker.' });
  if (sarvamApiKey) {
    try {
      const sarvamResponse = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: { 'api-subscription-key': sarvamApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          model: sarvamTtsModel,
          speaker: agents[speakerId].sarvamVoice,
          language_code: 'en-IN',
          speech_sample_rate: 24000,
          output_audio_codec: 'wav',
          temperature: 0.6,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      const result = await sarvamResponse.json().catch(() => ({}));
      const audio = Array.isArray(result.audios) ? result.audios[0] : '';
      if (!sarvamResponse.ok || !onlyString(audio, 4_000_000)) {
        throw new Error(`Sarvam TTS returned HTTP ${sarvamResponse.status}: ${String(result.error?.message || result.error || 'no audio').slice(0, 180)}`);
      }
      return response.json({ mimeType: 'audio/wav', audioBase64: audio, ttsProvider: 'sarvam' });
    } catch (error) {
      console.error('Sarvam speech request failed:', error instanceof Error ? error.message : 'unknown error');
      if (!openRouterApiKey && !geminiTtsIsAvailable()) {
        return response.status(502).json({ error: 'Sarvam voice could not generate this reply. Using your device voice instead.', code: 'tts_error' });
      }
    }
  }
  if (openRouterApiKey) {
    try {
      const fishResponse = await fetch('https://openrouter.ai/api/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openRouterApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: openRouterTtsModel,
          input: `${agents[speakerId].fishStyle} ${text.trim()}`,
          voice: agents[speakerId].fishVoice,
          response_format: 'mp3',
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!fishResponse.ok) throw new Error(`OpenRouter TTS returned HTTP ${fishResponse.status}: ${(await fishResponse.text()).slice(0, 240)}`);
      const audio = Buffer.from(await fishResponse.arrayBuffer()).toString('base64');
      if (!onlyString(audio, 4_000_000)) throw new Error('OpenRouter TTS returned no audio.');
      return response.json({ mimeType: fishResponse.headers.get('content-type') || 'audio/mpeg', audioBase64: audio, ttsProvider: 'openrouter' });
    } catch (error) {
      console.error('OpenRouter speech request failed:', error instanceof Error ? error.message : 'unknown error');
      if (!geminiTtsIsAvailable()) {
        return response.status(502).json({ error: 'Fish Audio could not generate this reply. Using your device voice instead.', code: 'tts_error' });
      }
    }
  }
  if (!geminiTtsIsAvailable()) return response.status(429).json({ error: 'AI voice is temporarily unavailable. Using your device voice instead.', code: 'tts_unavailable' });

  try {
    const persona = agents[speakerId];
    const interaction = await genai.interactions.create({
      model: geminiTtsModel,
      input: [{
        type: 'user_input',
        content: [{
          type: 'text',
          text: text.trim(),
          annotations: [{ type: 'speech_metadata', style: persona.style }],
        }],
      }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: persona.voice }] },
    });
    const audio = interaction.output_audio?.data;
    if (!audio) throw new Error('The speech model returned no audio.');
    response.json({ mimeType: 'audio/wav', audioBase64: audio, ttsProvider: 'gemini' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const isRateLimited = /429|rate.?limit|quota/i.test(message);
    const retry = message.match(/retry in\s+(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/i);
    const retryMs = retry ? ((Number(retry[1] || 0) * 3600 + Number(retry[2] || 0) * 60 + Number(retry[3] || 0)) * 1000) : 0;
    ttsUnavailableUntil = Date.now() + (retryMs || (isRateLimited ? 24 * 60 * 60 * 1000 : 60 * 1000));
    console.error('Gemini speech request failed:', message);
    response.status(isRateLimited ? 429 : 502).json({
      error: isRateLimited ? 'Gemini voice quota is unavailable. Using your device voice instead.' : 'Voice generation failed. Using your device voice instead.',
      code: isRateLimited ? 'tts_unavailable' : 'tts_error',
    });
  }
});

app.post('/api/report', async (request, response) => {
  const { topic, transcript = [] } = request.body || {};
  if (!onlyString(topic, 240)) return response.status(400).json({ error: 'Add a topic under 240 characters.' });
  if (!Array.isArray(transcript) || transcript.length > 160) return response.status(400).json({ error: 'The transcript is too long.' });
  if (!genai) return response.status(503).json({ error: 'Gemini is not configured yet. The room can show its transcript snapshot.' });

  const studentTurns = transcript.filter((turn) => turn?.isStudent && onlyString(turn.text, 900)).map((turn) => ({
    text: turn.text,
    timestampMs: Math.max(0, Number(turn.timestamp || 0) * 1000),
  }));
  const wordCount = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length;
  const studentWords = studentTurns.reduce((total, turn) => total + wordCount(turn.text), 0);
  const allWords = transcript.reduce((total, turn) => total + wordCount(turn?.text), 0);
  const categoryKeys = ['startingDiscussion', 'qualityOfIdeas', 'buildingOnOthers', 'listeningAndRespect', 'handlingInterruptions', 'endingStrongly'];
  const rubric = {
    startingDiscussion: 'Starting the discussion: opening clearly, framing the topic, or entering at a useful moment.',
    qualityOfIdeas: 'Quality of ideas: relevance, reasoning, examples, and clarity. Do not reward invented facts.',
    buildingOnOthers: 'Building on others: explicitly acknowledging and extending another speaker’s point.',
    listeningAndRespect: 'Listening and respect: responding to what was said, turn awareness, and respectful disagreement.',
    handlingInterruptions: 'Handling interruptions: regaining the floor calmly or yielding space appropriately.',
    endingStrongly: 'Ending strongly: summarizing the discussion or leaving a clear final contribution.',
  };
  const fallbackFeedback = studentTurns.length === 0 ? {
    startingDiscussion: 'No student turn was captured, so there is no opening contribution to assess.',
    qualityOfIdeas: 'No student turn was captured, so there are no ideas to assess yet.',
    buildingOnOthers: 'No student turn was captured, so the transcript cannot show how you build on others.',
    listeningAndRespect: 'No student turn was captured, so listening and respectful response cannot be assessed.',
    handlingInterruptions: 'No student turn was captured, so interruption handling cannot be assessed.',
    endingStrongly: 'No student turn was captured, so there is no closing contribution to assess.',
  } : {
    startingDiscussion: 'You joined after the moderator opened the room; try opening with a clear position and one brief reason.',
    qualityOfIdeas: 'Your point is on topic; add a concrete example or supporting reason to make it more persuasive.',
    buildingOnOthers: 'This short session gives limited evidence of how you acknowledge and extend another participant’s point.',
    listeningAndRespect: 'A short session gives limited evidence of listening across the discussion; make your links to others’ points explicit.',
    handlingInterruptions: 'No clear interruption appears in this transcript, so this skill was not fully tested.',
    endingStrongly: 'The transcript does not show a closing summary from you; finish with a concise takeaway when the discussion ends.',
  };
  const prompt = [
    'You are an honest group-discussion coach. Assess only the student turns in the provided transcript.',
    `Topic: ${topic}`,
    `Student turns: ${JSON.stringify(studentTurns)}`,
    `Other turns for context: ${JSON.stringify(transcript.filter((turn) => !turn?.isStudent).slice(-30).map((turn) => ({ speakerName: turn.speakerName, text: turn.text, timestamp: turn.timestamp })))}`,
    `Assess these categories: ${JSON.stringify(rubric)}`,
    'Return only JSON with overallScore, categories, missedOpportunities. Each category needs scoreOutOf10 from 0 to 10, concise feedback, and citations array with exact quote, context, and timestampMs. When student turns exist, include at least one citation for every category; copy a complete sentence verbatim if needed. Quotes must be copied verbatim from one of the student turns. Never invent quotes, events, or statistics. If evidence is insufficient, say so briefly and cite the closest student moment as limited evidence. missedOpportunities must be a short list grounded in the transcript.',
  ].join('\n');

  try {
    const result = await genai.models.generateContent({
      model: textModel,
      contents: prompt,
      config: { responseMimeType: 'application/json', maxOutputTokens: 1400 },
    });
    const parsed = JSON.parse(getText(result));
    const categories = Object.fromEntries(categoryKeys.map((key) => {
      const category = parsed.categories?.[key] || {};
      const citations = Array.isArray(category.citations) ? category.citations.flatMap((citation) => {
        const quote = typeof citation?.quote === 'string' ? citation.quote : '';
        const sourceTurn = studentTurns.find((turn) => turn.text.includes(quote) && quote.length > 0);
        if (!sourceTurn) return [];
        return [{ quote, context: String(citation.context || '').slice(0, 240), timestampMs: sourceTurn.timestampMs }];
      }).slice(0, 3) : [];
      if (citations.length === 0 && studentTurns.length > 0) {
        const sourceTurn = key === 'endingStrongly' ? studentTurns.at(-1) : studentTurns[0];
        const quote = sourceTurn.text.slice(0, 180);
        citations.push({
          quote,
          context: `Exact transcript excerpt used as evidence for ${rubric[key].split(':')[0].toLowerCase()}.`,
          timestampMs: sourceTurn.timestampMs,
        });
      }
      const score = Number(category.scoreOutOf10);
      const feedback = onlyString(category.feedback, 600) ? category.feedback.trim() : fallbackFeedback[key];
      return [key, { title: rubric[key].split(':')[0], scoreOutOf10: Number.isFinite(score) ? Math.max(0, Math.min(10, Math.round(score))) : 0, feedback, citations }];
    }));
    const overallScore = Math.round(categoryKeys.reduce((total, key) => total + categories[key].scoreOutOf10, 0) / categoryKeys.length);
    const missedOpportunities = Array.isArray(parsed.missedOpportunities) ? parsed.missedOpportunities.filter((item) => onlyString(item, 240)).slice(0, 4) : [];
    response.json({ overallScore, studentSpeakingPercentage: allWords ? Math.round((studentWords / allWords) * 100) : 0, categories, missedOpportunities });
  } catch (error) {
    console.error('Gemini report request failed:', error instanceof Error ? error.message : 'unknown error');
    response.status(502).json({ error: 'The report could not be generated. Your transcript is still available.' });
  }
});

app.use((error, _request, response, _next) => {
  if (error?.message?.includes('not allowed')) return response.status(403).json({ error: error.message });
  console.error('Unhandled API error:', error instanceof Error ? error.message : 'unknown error');
  response.status(500).json({ error: 'Something went wrong.' });
});

app.listen(port, '0.0.0.0', () => console.log(`GD Arena API listening on ${port}`));
