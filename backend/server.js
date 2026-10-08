import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = Number(process.env.PORT || 4000);
const textModel = process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash';
const ttsModel = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
const apiKey = process.env.GEMINI_API_KEY;
const genai = apiKey ? new GoogleGenAI({ apiKey }) : null;
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
app.use(express.json({ limit: '32kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));

const agents = {
  dominator: {
    name: 'Rohan', voice: 'Fenrir', style: 'confident, energetic and clear',
    persona: 'You speak up early, take clear positions, and challenge ideas respectfully. Do not dominate or talk over others.',
  },
  data_driven: {
    name: 'Ananya', voice: 'Kore', style: 'calm, thoughtful and precise',
    persona: 'You ask for examples and evidence. Never invent numbers, quotes, studies, or facts. Say when evidence is uncertain.',
  },
  quiet_thinker: {
    name: 'Vikram', voice: 'Charon', style: 'measured, gentle and reflective',
    persona: 'You speak less often, but add a concise synthesis or a useful overlooked point when invited by the discussion.',
  },
  wanderer: {
    name: 'Pooja', voice: 'Leda', style: 'curious, warm and imaginative',
    persona: 'You offer a short, memorable analogy or wider angle, then connect it back to the topic.',
  },
  connector: {
    name: 'Mira', voice: 'Aoede', style: 'warm, composed and collaborative',
    persona: 'You build on a specific previous point and connect different views. Do not simply agree with the latest speaker.',
  },
  moderator: {
    name: 'Dr. Sharma', voice: 'Orus', style: 'neutral, composed and encouraging',
    persona: 'You are a neutral discussion moderator. Keep the room on topic, invite quieter speakers, and speak briefly.',
  },
};

const onlyString = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const getText = (response) => response?.text || '';

app.get('/health', (_request, response) => {
  response.json({ ok: true, aiConfigured: Boolean(genai), textModel, ttsModel });
});

app.post('/api/turn', async (request, response) => {
  const { topic, language = 'en-hi', panel = [], transcript = [] } = request.body || {};
  if (!onlyString(topic, 240)) return response.status(400).json({ error: 'Add a topic under 240 characters.' });
  if (!Array.isArray(panel) || panel.length < 3 || panel.length > 5 || panel.some((id) => !agents[id] || id === 'moderator')) {
    return response.status(400).json({ error: 'Choose 3 to 5 known AI participants.' });
  }
  if (!Array.isArray(transcript) || transcript.length > 80) return response.status(400).json({ error: 'The transcript is too long.' });
  if (!genai) return response.status(503).json({ error: 'Gemini is not configured yet. The room can use its demo responses.' });

  const turns = transcript.slice(-16).map((turn) => ({
    speakerId: String(turn?.speakerId || '').slice(0, 32),
    speakerName: String(turn?.speakerName || '').slice(0, 48),
    text: String(turn?.text || '').slice(0, 900),
    isStudent: Boolean(turn?.isStudent),
  }));
  const personaCards = panel.map((id) => ({ id, name: agents[id].name, traits: agents[id].persona }));
  const prompt = [
    'You are the turn manager for GD Arena, a student group discussion simulation.',
    'Choose exactly one available AI participant to speak next, then write only that participant’s short reply.',
    `Topic: ${topic}`,
    `Room language: ${language === 'en-hi' ? 'English mixed naturally with conversational Hindi (Hinglish); follow the language the student uses and do not force translations.' : 'English'}`,
    `Available personas: ${JSON.stringify(personaCards)}`,
    `Recent transcript: ${JSON.stringify(turns)}`,
    'Avoid repeating the immediately previous AI speaker when another persona can contribute. Respond to another person where relevant. Do not interrupt or write narration. Keep it to one or two sentences. Never make up data or statistics.',
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
  if (!genai) return response.status(503).json({ error: 'Gemini voice is not configured. The browser can speak this turn.' });

  try {
    const persona = agents[speakerId];
    const interaction = await genai.interactions.create({
      model: ttsModel,
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
    response.json({ mimeType: 'audio/wav', audioBase64: audio });
  } catch (error) {
    console.error('Gemini speech request failed:', error instanceof Error ? error.message : 'unknown error');
    response.status(502).json({ error: 'Voice generation failed. Use the browser voice instead.' });
  }
});

app.post('/api/report', async (request, response) => {
  const { topic, transcript = [] } = request.body || {};
  if (!onlyString(topic, 240)) return response.status(400).json({ error: 'Add a topic under 240 characters.' });
  if (!Array.isArray(transcript) || transcript.length > 80) return response.status(400).json({ error: 'The transcript is too long.' });
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
  const prompt = [
    'You are an honest group-discussion coach. Assess only the student turns in the provided transcript.',
    `Topic: ${topic}`,
    `Student turns: ${JSON.stringify(studentTurns)}`,
    `Other turns for context: ${JSON.stringify(transcript.filter((turn) => !turn?.isStudent).slice(-30).map((turn) => ({ speakerName: turn.speakerName, text: turn.text, timestamp: turn.timestamp })))}`,
    `Assess these categories: ${JSON.stringify(rubric)}`,
    'Return only JSON with overallScore, categories, missedOpportunities. Each category needs scoreOutOf10 from 0 to 10, concise feedback, and citations array with exact quote, context, and timestampMs. Quotes must be copied verbatim from one of the student turns. Never invent quotes, events, or statistics. If evidence is insufficient, say so briefly and return no citation for that category. missedOpportunities must be a short list grounded in the transcript.',
  ].join('\n');

  try {
    const result = await genai.models.generateContent({
      model: textModel,
      contents: prompt,
      config: { responseMimeType: 'application/json', maxOutputTokens: 900 },
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
      const score = Number(category.scoreOutOf10);
      const feedback = onlyString(category.feedback, 600) ? category.feedback.trim() : 'There is not enough evidence in this session to assess this point yet.';
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
