import { useEffect, useRef, useState } from 'react';
import type { KokoroTTS } from 'kokoro-js';
import type { GDReport, PersonalityType, TranscriptEntry } from './types';
import StitchExperience from './StitchExperience';

type Agent = { id: PersonalityType; name: string; role: string; hue: string; initials: string; voice: string };
type SpeechResultEvent = Event & { results: SpeechRecognitionResultList; resultIndex?: number };
type SpeechErrorEvent = Event & { error?: string; message?: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const agents: Agent[] = [
  { id: 'dominator', name: 'Rohan', role: 'The confident starter', hue: 'lime', initials: 'R', voice: 'en-IN' },
  { id: 'data_driven', name: 'Ananya', role: 'The evidence seeker', hue: 'blue', initials: 'A', voice: 'en-IN' },
  { id: 'quiet_thinker', name: 'Vikram', role: 'The quiet synthesizer', hue: 'lavender', initials: 'V', voice: 'en-IN' },
  { id: 'wanderer', name: 'Pooja', role: 'The creative tangent', hue: 'peach', initials: 'P', voice: 'en-IN' },
  { id: 'connector', name: 'Mira', role: 'The thoughtful connector', hue: 'rose', initials: 'M', voice: 'en-IN' },
];

const topics = [
  { label: 'AI & society', topic: 'Should AI replace repetitive human jobs?' },
  { label: 'Campus life', topic: 'Is attendance more important than learning?' },
  { label: 'Business', topic: 'Can a company be profitable and ethical?' },
  { label: 'Abstract', topic: 'Does silence communicate more than words?' },
];
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
type RoomLanguage = 'en';
const roomLanguages: Array<{ id: RoomLanguage; label: string; note: string }> = [
  { id: 'en', label: 'English', note: 'English discussion' },
];
type SpeechEngine = 'sarvam' | 'kokoro';
const kokoroVoices = {
  dominator: 'am_fenrir', data_driven: 'af_kore', quiet_thinker: 'am_michael',
  wanderer: 'af_bella', connector: 'af_sarah', moderator: 'bm_george',
} as const;

function makeFallbackReply(panel: Agent[], transcript: TranscriptEntry[], turn: number) {
  const lastTurn = transcript[transcript.length - 1];
  const lastStudent = [...transcript].reverse().find((line) => line.isStudent);
  const speaker = panel.find((agent) => agent.id !== lastTurn?.speakerId) || panel[turn % Math.max(1, panel.length)];
  if (lastTurn?.isStudent && lastStudent) {
    const point = lastStudent.text.trim().replace(/[.!?]+$/, '').split(/\s+/).slice(0, 7).join(' ');
    return {
      speakerId: speaker.id,
      speakerName: speaker.name,
      text: `Your point about ${point} makes sense. What support would help people who might be left out?`,
    };
  }
  const previousName = lastTurn?.speakerName || 'the previous speaker';
  return {
    speakerId: speaker.id,
    speakerName: speaker.name,
    text: `Building on ${previousName}’s point, how would that work in practice?`,
  };
}

function App() {
  const [screen, setScreen] = useState<'home' | 'setup' | 'room' | 'report'>('home');
  const [topic, setTopic] = useState(topics[0].topic);
  const [customTopic, setCustomTopic] = useState('');
  const [panelSize, setPanelSize] = useState(4);
  const [format, setFormat] = useState('Open discussion');
  const [language, setLanguage] = useState<RoomLanguage>('en');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [micState, setMicState] = useState<'idle' | 'listening' | 'unsupported' | 'error'>('idle');
  const [micError, setMicError] = useState('');
  const [interim, setInterim] = useState('');
  const [firstTurn, setFirstTurn] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState('moderator');
  const [seconds, setSeconds] = useState(8 * 60);
  const [paused, setPaused] = useState(false);
  const [speechOn, setSpeechOn] = useState(true);
  const [speechLoading, setSpeechLoading] = useState(false);
  const [speechEngine, setSpeechEngine] = useState<SpeechEngine>('sarvam');
  const [kokoroStatus, setKokoroStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [aiConnected, setAiConnected] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<'sarvam' | 'openrouter' | 'gemini' | 'device'>('device');
  const [report, setReport] = useState<GDReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const autoListenRef = useRef(false);
  const studentSpeechActiveRef = useRef(false);
  const interimSpeechRef = useRef('');
  const pendingFinalSpeechRef = useRef('');
  const userSpeechTimeoutRef = useRef<number | null>(null);
  const finalSpeechTimeoutRef = useRef<number | null>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const kokoroRef = useRef<KokoroTTS | null>(null);
  const kokoroPromiseRef = useRef<Promise<KokoroTTS> | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const sessionTopicRef = useRef(topics[0].topic);
  const sessionPanelRef = useRef<Agent[]>(agents.slice(0, 4));
  const discussionTokenRef = useRef(0);
  const turnAbortRef = useRef<AbortController | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const playbackDoneRef = useRef<(() => void) | null>(null);
  const secondsRef = useRef(seconds);
  const roomActiveRef = useRef(screen === 'room');
  const ttsAvailableRef = useRef(false);
  secondsRef.current = seconds;
  roomActiveRef.current = screen === 'room';

  const selectedTopic = customTopic.trim() || topic;
  const panel = agents.slice(0, panelSize);
  const studentWords = transcript.filter((line) => line.isStudent).reduce((sum, line) => sum + line.text.trim().split(/\s+/).filter(Boolean).length, 0);
  const totalWords = transcript.reduce((sum, line) => sum + line.text.trim().split(/\s+/).filter(Boolean).length, 0);

  useEffect(() => {
    if (screen !== 'room' || paused) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [screen, paused]);

  useEffect(() => {
    if (screen === 'room' && seconds === 0) { stopListening(); interruptAgents(); }
  }, [screen, seconds]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript, interim]);

  useEffect(() => {
    if (!API_BASE_URL) return;
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
      .then((result) => result.ok ? result.json() : null)
      .then((status) => {
        setAiConnected(Boolean(status?.aiConfigured));
        const voiceAvailable = Boolean(status?.ttsAvailable);
        ttsAvailableRef.current = voiceAvailable;
        setTtsAvailable(voiceAvailable);
        setTtsProvider(status?.ttsProvider === 'sarvam' || status?.ttsProvider === 'openrouter' || status?.ttsProvider === 'gemini' ? status.ttsProvider : 'device');
      })
      .catch(() => { setAiConnected(false); ttsAvailableRef.current = false; setTtsAvailable(false); setTtsProvider('device'); });
    return () => controller.abort();
  }, []);

  useEffect(() => () => {
    recognition.current?.stop();
    if (userSpeechTimeoutRef.current !== null) window.clearTimeout(userSpeechTimeoutRef.current);
    if (finalSpeechTimeoutRef.current !== null) window.clearTimeout(finalSpeechTimeoutRef.current);
    window.speechSynthesis?.cancel();
    remoteAudio.current?.pause();
    audioSourceRef.current?.stop();
    void audioContextRef.current?.close();
  }, []);

  const addEntry = (entry: TranscriptEntry) => {
    transcriptRef.current = [...transcriptRef.current, entry];
    setTranscript(transcriptRef.current);
  };
  const interruptAgents = () => {
    discussionTokenRef.current += 1;
    setSpeechLoading(false);
    turnAbortRef.current?.abort();
    speechAbortRef.current?.abort();
    playbackDoneRef.current?.();
    playbackDoneRef.current = null;
    window.speechSynthesis?.cancel();
    remoteAudio.current?.pause();
    audioSourceRef.current?.stop();
    audioSourceRef.current = null;
    if (remoteAudio.current) remoteAudio.current.src = '';
    setActiveSpeaker('');
    return discussionTokenRef.current;
  };
  const unlockAudio = () => {
    if (!window.AudioContext) return;
    const context = audioContextRef.current || new window.AudioContext();
    audioContextRef.current = context;
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
  };
  const speak = async (text: string, speakerId: string, token: number) => {
    if (token !== discussionTokenRef.current) return false;
    const controller = new AbortController();
    speechAbortRef.current = controller;
    const waitForPlayback = () => new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (playbackDoneRef.current === finish) playbackDoneRef.current = null;
        controller.signal.removeEventListener('abort', finish);
        resolve();
      };
      playbackDoneRef.current = finish;
      controller.signal.addEventListener('abort', finish, { once: true });
    });
    window.speechSynthesis?.cancel();
    remoteAudio.current?.pause();
    if (speechOn && ((speechEngine === 'kokoro' && language === 'en') || (ttsAvailableRef.current && API_BASE_URL))) {
      if (speechEngine === 'kokoro' && language === 'en') {
        try {
          let kokoro = kokoroRef.current;
          if (!kokoro) {
            setKokoroStatus('loading');
            if (!kokoroPromiseRef.current) {
              kokoroPromiseRef.current = import('kokoro-js').then(({ KokoroTTS: Kokoro }) => Kokoro.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'wasm' }));
            }
            kokoro = await kokoroPromiseRef.current;
            kokoroRef.current = kokoro;
            setKokoroStatus('ready');
          }
          const generated = await kokoro.generate(text, { voice: kokoroVoices[speakerId as keyof typeof kokoroVoices] || 'af_heart' });
          if (controller.signal.aborted || token !== discussionTokenRef.current) return false;
          const context = audioContextRef.current || new window.AudioContext();
          audioContextRef.current = context;
          if (context.state === 'suspended') await context.resume();
          const buffer = await context.decodeAudioData(await generated.toBlob().arrayBuffer());
          if (controller.signal.aborted || token !== discussionTokenRef.current) return false;
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          audioSourceRef.current = source;
          setActiveSpeaker(speakerId);
          const playback = waitForPlayback();
          const finishPlayback = playbackDoneRef.current;
          source.onended = () => {
            if (audioSourceRef.current === source) audioSourceRef.current = null;
            if (token === discussionTokenRef.current) setActiveSpeaker('thinking');
            finishPlayback?.();
          };
          setSpeechLoading(false);
          source.start();
          await playback;
          return token === discussionTokenRef.current;
        } catch {
          if (controller.signal.aborted) return false;
          kokoroPromiseRef.current = null;
          kokoroRef.current = null;
          setKokoroStatus('error');
          setSpeechEngine('sarvam');
          /* Keep the room moving if this browser cannot load or run Kokoro. */
        }
      }
      if (ttsAvailableRef.current && API_BASE_URL) {
        try {
          const requestController = new AbortController();
          const cancelRequest = () => requestController.abort();
          controller.signal.addEventListener('abort', cancelRequest, { once: true });
          const timeout = window.setTimeout(() => requestController.abort(), 15000);
          let response: Response;
          try {
            response = await fetch(`${API_BASE_URL}/api/speech`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, speakerId, language }),
              signal: requestController.signal,
            });
          } finally {
            window.clearTimeout(timeout);
            controller.signal.removeEventListener('abort', cancelRequest);
          }
          if (response.ok) {
            const result = await response.json();
            if (result.ttsProvider === 'sarvam' || result.ttsProvider === 'openrouter' || result.ttsProvider === 'gemini') {
              setTtsProvider(result.ttsProvider);
            }
            const context = audioContextRef.current;
            if (context) {
              if (context.state === 'suspended') await context.resume();
              const bytes = Uint8Array.from(atob(result.audioBase64), (character) => character.charCodeAt(0));
              const buffer = await context.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
              if (controller.signal.aborted || token !== discussionTokenRef.current) return false;
              const source = context.createBufferSource();
              source.buffer = buffer;
              source.connect(context.destination);
              audioSourceRef.current = source;
              setActiveSpeaker(speakerId);
              const playback = waitForPlayback();
              const finishPlayback = playbackDoneRef.current;
              source.onended = () => {
                if (audioSourceRef.current === source) audioSourceRef.current = null;
                if (token === discussionTokenRef.current) setActiveSpeaker('thinking');
                finishPlayback?.();
              };
              setSpeechLoading(false);
              source.start();
              await playback;
            } else {
              const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
              remoteAudio.current = audio;
              setActiveSpeaker(speakerId);
              const playback = waitForPlayback();
              const finishPlayback = playbackDoneRef.current;
              audio.onended = () => {
                if (token === discussionTokenRef.current) setActiveSpeaker('thinking');
                finishPlayback?.();
              };
              audio.onerror = () => finishPlayback?.();
              setSpeechLoading(false);
              await audio.play();
              await playback;
            }
            return token === discussionTokenRef.current;
          }
          ttsAvailableRef.current = false;
          setTtsAvailable(false);
        } catch {
          if (controller.signal.aborted) return false;
          ttsAvailableRef.current = false;
          setTtsAvailable(false);
          /* Fall back to the browser voice if the speech API is unavailable. */
        }
      }
    }
    if (controller.signal.aborted || token !== discussionTokenRef.current) return false;
    if (!speechOn) {
      setSpeechLoading(false);
      const playback = waitForPlayback();
      const finishPlayback = playbackDoneRef.current;
      window.setTimeout(() => finishPlayback?.(), Math.max(1100, text.trim().split(/\s+/).length * 260));
      await playback;
      return token === discussionTokenRef.current;
    }
    if (!('speechSynthesis' in window)) {
      setSpeechLoading(false);
      const playback = waitForPlayback();
      const finishPlayback = playbackDoneRef.current;
      setTimeout(() => finishPlayback?.(), Math.max(1100, text.trim().split(/\s+/).length * 260));
      await playback;
      return token === discussionTokenRef.current;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    let voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      await Promise.race([
        new Promise<void>((resolve) => window.speechSynthesis.addEventListener('voiceschanged', () => resolve(), { once: true })),
        new Promise<void>((resolve) => window.setTimeout(resolve, 500)),
      ]);
      voices = window.speechSynthesis.getVoices();
    }
    if (controller.signal.aborted || token !== discussionTokenRef.current) return false;
    utterance.lang = 'en-IN';
    const targetPrefix = 'en';
    const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(targetPrefix));
    const voiceCandidates = (matchingVoices.length ? matchingVoices : voices.filter((voice) => voice.lang.toLowerCase().startsWith('en')))
      .sort((first, second) => Number(/natural|neural|online|enhanced/i.test(second.name)) - Number(/natural|neural|online|enhanced/i.test(first.name)));
    const index = agents.findIndex((agent) => agent.id === speakerId);
    if (voiceCandidates.length) utterance.voice = voiceCandidates[Math.max(0, index) % voiceCandidates.length];
    utterance.rate = speakerId === 'dominator' ? 1.04 : speakerId === 'quiet_thinker' ? 0.94 : speakerId === 'wanderer' ? 1.03 : 0.98;
    utterance.pitch = speakerId === 'wanderer' ? 1.1 : speakerId === 'data_driven' ? 0.96 : speakerId === 'quiet_thinker' ? 0.97 : 1;
    utterance.onstart = () => setActiveSpeaker(speakerId);
    const playback = waitForPlayback();
    const finishPlayback = playbackDoneRef.current;
    utterance.onend = () => {
      if (token === discussionTokenRef.current) setActiveSpeaker('thinking');
      finishPlayback?.();
    };
    utterance.onerror = () => finishPlayback?.();
    setSpeechLoading(false);
    window.speechSynthesis.speak(utterance);
    await playback;
    return token === discussionTokenRef.current;
  };

  const runDiscussion = async (token: number, topicOverride = selectedTopic, panelOverride = panel) => {
    let fallbackTurn = 0;
    let aiFailedThisRun = false;
    while (token === discussionTokenRef.current && roomActiveRef.current && secondsRef.current > 0) {
      setActiveSpeaker('thinking');
      let reply: { speakerId: PersonalityType; speakerName: string; text: string } | null = null;
      try {
        if (aiConnected && !aiFailedThisRun && API_BASE_URL) {
          const controller = new AbortController();
          turnAbortRef.current = controller;
          const timeout = window.setTimeout(() => controller.abort(), 12000);
          try {
            const response = await fetch(`${API_BASE_URL}/api/turn`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
              body: JSON.stringify({ topic: topicOverride, language, panel: panelOverride.map((agent) => agent.id), transcript: transcriptRef.current }),
            });
            if (!response.ok) throw new Error('AI turn unavailable');
            reply = await response.json();
          } finally {
            window.clearTimeout(timeout);
          }
        }
      } catch {
        if (token !== discussionTokenRef.current) return;
        aiFailedThisRun = true;
      }
      if (token !== discussionTokenRef.current) return;
      if (!reply) {
        const available = agents.filter((agent) => panelOverride.some((selected) => selected.id === agent.id));
        if (!available.length) return;
        reply = makeFallbackReply(available, transcriptRef.current, fallbackTurn);
        fallbackTurn += 1;
      }
      if (reply) {
        const aiLine: TranscriptEntry = { id: crypto.randomUUID(), timestamp: 8 * 60 - secondsRef.current, speakerId: reply.speakerId, speakerName: reply.speakerName, text: reply.text, isStudent: false };
        addEntry(aiLine);
        setSpeechLoading(speechOn);
        const completed = await speak(aiLine.text, aiLine.speakerId, token);
        if (!completed) return;
        await new Promise((resolve) => window.setTimeout(resolve, 950));
      }
    }
  };
  const markStudentSpeech = () => {
    if (!studentSpeechActiveRef.current) {
      studentSpeechActiveRef.current = true;
      interruptAgents();
      setActiveSpeaker('student');
    }
    if (userSpeechTimeoutRef.current !== null) window.clearTimeout(userSpeechTimeoutRef.current);
    userSpeechTimeoutRef.current = window.setTimeout(() => {
      if (!studentSpeechActiveRef.current || !roomActiveRef.current) return;
      studentSpeechActiveRef.current = false;
      const draft = interimSpeechRef.current.trim();
      const finalDraft = pendingFinalSpeechRef.current.trim();
      setInterim('');
      interimSpeechRef.current = '';
      pendingFinalSpeechRef.current = '';
      if (draft || finalDraft) void respond([finalDraft, draft].filter(Boolean).join(' '));
      else setActiveSpeaker('student');
    }, 8000);
  };
  const clearStudentSpeech = () => {
    studentSpeechActiveRef.current = false;
    interimSpeechRef.current = '';
    pendingFinalSpeechRef.current = '';
    if (userSpeechTimeoutRef.current !== null) window.clearTimeout(userSpeechTimeoutRef.current);
    userSpeechTimeoutRef.current = null;
    if (finalSpeechTimeoutRef.current !== null) window.clearTimeout(finalSpeechTimeoutRef.current);
    finalSpeechTimeoutRef.current = null;
  };
  const openRoom = (topicOverride?: string, panelSizeOverride?: number) => {
    unlockAudio();
    sessionTopicRef.current = topicOverride?.trim() || selectedTopic;
    sessionPanelRef.current = agents.slice(0, panelSizeOverride ?? panelSize);
    interruptAgents();
    transcriptRef.current = [];
    setTranscript([]); setInterim(''); interimSpeechRef.current = ''; pendingFinalSpeechRef.current = ''; setFirstTurn(true);
    setSeconds(8 * 60); secondsRef.current = 8 * 60; setPaused(false); setScreen('room'); roomActiveRef.current = true; setActiveSpeaker('student');
    /* Begin is a deliberate user gesture, so start hands-free speech capture here. */
    startListening();
  };

  const respond = async (studentText: string) => {
    if (!studentText.trim()) return;
    clearStudentSpeech();
    setFirstTurn(false);
    unlockAudio();
    const token = interruptAgents();
    const studentLine: TranscriptEntry = { id: crypto.randomUUID(), timestamp: 8 * 60 - secondsRef.current, speakerId: 'student', speakerName: 'You', text: studentText.trim(), isStudent: true };
    addEntry(studentLine);
    void runDiscussion(token, sessionTopicRef.current, sessionPanelRef.current);
  };

  const startListening = () => {
    unlockAudio();
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) { setMicError(''); setMicState('unsupported'); return; }
    try {
      autoListenRef.current = true;
      setMicError('');
      const instance = new Constructor();
      instance.continuous = true; instance.interimResults = true;
      instance.lang = 'en-IN';
      instance.onresult = (event) => {
        if (!autoListenRef.current) return;
        const finalParts: string[] = []; const interimParts: string[] = [];
        const firstChangedResult = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
        for (let i = firstChangedResult; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript?.trim();
          if (!text) continue;
          if (result.isFinal) finalParts.push(text);
          else interimParts.push(text);
        }
        const finalText = finalParts.join(' ').replace(/\s+/g, ' ').trim();
        const interimText = interimParts.join(' ').replace(/\s+/g, ' ').trim();
        if (finalText) {
          const pending = pendingFinalSpeechRef.current.trim();
          const normalizedPending = pending.toLocaleLowerCase();
          const normalizedFinal = finalText.toLocaleLowerCase();
          pendingFinalSpeechRef.current = normalizedFinal.startsWith(normalizedPending) && pending
            ? finalText
            : pending && !normalizedPending.endsWith(normalizedFinal) ? `${pending} ${finalText}` : pending || finalText;
        }
        interimSpeechRef.current = interimText;
        const pending = pendingFinalSpeechRef.current.trim();
        const visibleDraft = interimText.toLocaleLowerCase().startsWith(pending.toLocaleLowerCase()) && pending
          ? interimText
          : [pending, interimText].filter(Boolean).join(' ');
        setInterim(visibleDraft);
        if (interimText || finalText) markStudentSpeech();
        if (finalText) {
          if (finalSpeechTimeoutRef.current !== null) window.clearTimeout(finalSpeechTimeoutRef.current);
          finalSpeechTimeoutRef.current = window.setTimeout(() => {
            const spokenTurn = pendingFinalSpeechRef.current.trim();
            pendingFinalSpeechRef.current = '';
            interimSpeechRef.current = '';
            setInterim('');
            finalSpeechTimeoutRef.current = null;
            if (spokenTurn) void respond(spokenTurn);
          }, 1050);
        }
      };
      instance.onerror = (event) => {
        const messages: Record<string, string> = {
          'not-allowed': 'The browser blocked microphone access. Check this site’s permission and your device privacy settings, then reload.',
          'service-not-allowed': 'This browser cannot reach its speech recognition service. Try Chrome with Google speech services enabled, or type your response.',
          'audio-capture': 'No microphone is available to the browser. Check that your mic is connected and not in use by another app.',
          network: 'Speech recognition could not connect. Check your internet connection, then try again.',
          'no-speech': 'I didn’t hear speech. Try again and speak a little closer to the microphone.',
          aborted: 'Speech recognition stopped. Tap the microphone to try again.',
        };
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(event.error || '')) {
          autoListenRef.current = false;
          clearStudentSpeech();
        }
        setMicError(messages[event.error || ''] || event.message || `Speech recognition failed${event.error ? ` (${event.error})` : ''}. Try Chrome or type your response.`);
        setMicState(event.error === 'no-speech' || event.error === 'aborted' ? 'idle' : 'error');
        setInterim('');
        interimSpeechRef.current = '';
      };
      instance.onend = () => {
        if (autoListenRef.current && roomActiveRef.current) {
          window.setTimeout(() => {
            if (!autoListenRef.current || !roomActiveRef.current) return;
            try { instance.start(); setMicState('listening'); }
            catch { setMicState('error'); }
          }, 220);
        } else setMicState((state) => state === 'listening' ? 'idle' : state);
      };
      recognition.current = instance; instance.start(); setMicState('listening');
    } catch { autoListenRef.current = false; setMicState('error'); }
  };

  const stopListening = (_resumeDiscussion = false) => {
    const draft = [pendingFinalSpeechRef.current.trim(), interimSpeechRef.current.trim()].filter(Boolean).join(' ');
    autoListenRef.current = false;
    clearStudentSpeech();
    recognition.current?.stop(); setMicState('idle'); setMicError(''); setInterim('');
    if (draft && roomActiveRef.current) void respond(draft);
  };
  const endRoom = async () => {
    stopListening(); interruptAgents(); roomActiveRef.current = false; setScreen('report'); setReport(null);
    if (!aiConnected || !API_BASE_URL || transcript.length < 2) return;
    setReportLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: selectedTopic, transcript }),
      });
      if (!response.ok) throw new Error('Report unavailable');
      setReport(await response.json());
    } catch { setAiConnected(false); }
    finally { setReportLoading(false); }
  };
  const reset = () => { stopListening(); interruptAgents(); roomActiveRef.current = false; transcriptRef.current = []; setTranscript([]); setReport(null); setReportLoading(false); setScreen('setup'); setMicState('idle'); };
  return (
    <StitchExperience
      screen={screen}
      topic={topic}
      topics={topics}
      customTopic={customTopic}
      setCustomTopic={setCustomTopic}
      setTopic={setTopic}
      selectedTopic={selectedTopic}
      panel={panel}
      panelSize={panelSize}
      setPanelSize={setPanelSize}
      format={format}
      setFormat={setFormat}
      language={language}
      setLanguage={setLanguage}
      roomLanguages={roomLanguages}
      speechEngine={speechEngine}
      setSpeechEngine={setSpeechEngine}
      kokoroStatus={kokoroStatus}
      ttsProvider={ttsProvider}
      ttsAvailable={ttsAvailable}
      aiConnected={aiConnected}
      seconds={seconds}
      paused={paused}
      setPaused={setPaused}
      speechOn={speechOn}
      setSpeechOn={setSpeechOn}
      speechLoading={speechLoading}
      transcript={transcript}
      interim={interim}
      micState={micState}
      micError={micError}
      activeSpeaker={activeSpeaker}
      firstTurn={firstTurn}
      studentWords={studentWords}
      totalWords={totalWords}
      report={report}
      reportLoading={reportLoading}
      onOpenRoom={openRoom}
      onOpenSetup={() => setScreen('setup')}
      onGoHome={() => setScreen('home')}
      onEndRoom={endRoom}
      onReset={reset}
      onStartListening={startListening}
      onStopListening={stopListening}
      onInterruptAgents={interruptAgents}
      onRespond={respond}
    />
  );
}

export default App;
