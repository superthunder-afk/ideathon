import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Command, Headphones, Info, Mic, MicOff, MoreHorizontal, Pause, Play, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import type { GDReport, PersonalityType, TranscriptEntry } from './types';

type Agent = { id: PersonalityType; name: string; role: string; hue: string; initials: string; voice: string };
type SpeechResultEvent = Event & { results: SpeechRecognitionResultList };
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

const demoReplies = [
  { agent: 'data_driven' as PersonalityType, text: 'I agree that convenience matters, but we should separate short-term efficiency from long-term impact. What kind of work are we talking about, and who benefits from the change?' },
  { agent: 'quiet_thinker' as PersonalityType, text: 'Building on that point, I think the transition matters as much as the outcome. A gradual approach with training could make this less of an either-or question.' },
  { agent: 'wanderer' as PersonalityType, text: 'That reminds me of how calculators changed classrooms. The tool did not remove the need to understand maths; it changed which skills mattered most.' },
  { agent: 'dominator' as PersonalityType, text: 'Let me push back a little. If we wait until there is no risk, we may miss real improvements. We should compare the cost of acting with the cost of doing nothing.' },
  { agent: 'connector' as PersonalityType, text: 'I hear two useful ideas here: move carefully, but do not freeze. Maybe the common ground is to measure outcomes and keep a human fallback.' },
];

function App() {
  const [screen, setScreen] = useState<'setup' | 'room' | 'report'>('setup');
  const [topic, setTopic] = useState(topics[0].topic);
  const [customTopic, setCustomTopic] = useState('');
  const [panelSize, setPanelSize] = useState(4);
  const [format, setFormat] = useState('Open discussion');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [micState, setMicState] = useState<'idle' | 'listening' | 'unsupported' | 'error'>('idle');
  const [micError, setMicError] = useState('');
  const [interim, setInterim] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState('moderator');
  const [seconds, setSeconds] = useState(8 * 60);
  const [paused, setPaused] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(0);
  const [speechOn, setSpeechOn] = useState(true);
  const [aiConnected, setAiConnected] = useState(false);
  const [report, setReport] = useState<GDReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
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
    transcriptEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript, interim]);

  useEffect(() => {
    if (!API_BASE_URL) return;
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
      .then((result) => result.ok ? result.json() : null)
      .then((status) => setAiConnected(Boolean(status?.aiConfigured)))
      .catch(() => setAiConnected(false));
    return () => controller.abort();
  }, []);

  useEffect(() => () => {
    recognition.current?.stop();
    window.speechSynthesis?.cancel();
    remoteAudio.current?.pause();
  }, []);

  const addEntry = (entry: TranscriptEntry) => setTranscript((lines) => [...lines, entry]);
  const speak = async (text: string, speakerId: string) => {
    if (!speechOn) return;
    window.speechSynthesis?.cancel();
    remoteAudio.current?.pause();
    if (aiConnected && API_BASE_URL) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/speech`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, speakerId }),
        });
        if (response.ok) {
          const result = await response.json();
          const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
          remoteAudio.current = audio;
          setActiveSpeaker(speakerId);
          audio.onended = () => setActiveSpeaker('');
          await audio.play();
          return;
        }
      } catch { /* Fall back to the browser voice if the speech API is unavailable. */ }
    }
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('en-in'));
    const index = agents.findIndex((agent) => agent.id === speakerId);
    const voiceCandidates = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
    if (indianVoice) utterance.voice = indianVoice;
    else if (voiceCandidates.length) utterance.voice = voiceCandidates[Math.max(0, index) % voiceCandidates.length];
    utterance.rate = speakerId === 'dominator' ? 1.06 : speakerId === 'quiet_thinker' ? 0.92 : 0.98;
    utterance.pitch = speakerId === 'wanderer' ? 1.14 : speakerId === 'data_driven' ? 0.92 : 1;
    utterance.onstart = () => setActiveSpeaker(speakerId);
    utterance.onend = () => setActiveSpeaker('');
    window.speechSynthesis.speak(utterance);
  };

  const openRoom = () => {
    const opening: TranscriptEntry = {
      id: crypto.randomUUID(), timestamp: 0, speakerId: 'moderator', speakerName: 'Dr. Sharma · Moderator',
      text: `Welcome, everyone. Today we are discussing: “${selectedTopic}”. Keep your points concise, listen to each other, and make space for different views. You have eight minutes. Who would like to open?`, isStudent: false,
    };
    setTranscript([opening]); setSeconds(8 * 60); setPaused(false); setScreen('room'); setActiveSpeaker('moderator');
    speak(opening.text, 'moderator');
  };

  const respond = async (studentText: string) => {
    if (!studentText.trim()) return;
    const studentLine: TranscriptEntry = { id: crypto.randomUUID(), timestamp: 8 * 60 - seconds, speakerId: 'student', speakerName: 'You', text: studentText.trim(), isStudent: true };
    addEntry(studentLine);
    setActiveSpeaker('thinking');
    if (aiConnected && API_BASE_URL) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/turn`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: selectedTopic, language: 'en-hi', panel: panel.map((agent) => agent.id), transcript: [...transcript, studentLine] }),
        });
        if (!response.ok) throw new Error('AI turn unavailable');
        const reply = await response.json();
        const aiLine: TranscriptEntry = { id: crypto.randomUUID(), timestamp: 8 * 60 - seconds, speakerId: reply.speakerId, speakerName: reply.speakerName, text: reply.text, isStudent: false };
        addEntry(aiLine); void speak(aiLine.text, aiLine.speakerId); return;
      } catch { setAiConnected(false); }
    }
    window.setTimeout(() => {
      const available = demoReplies.filter((reply) => panel.some((agent) => agent.id === reply.agent));
      const reply = available[currentAgent % available.length];
      setCurrentAgent((value) => value + 1);
      const agent = agents.find((item) => item.id === reply.agent)!;
      const aiLine: TranscriptEntry = { id: crypto.randomUUID(), timestamp: 8 * 60 - seconds, speakerId: agent.id, speakerName: agent.name, text: reply.text, isStudent: false };
      addEntry(aiLine); speak(aiLine.text, agent.id);
    }, 450);
  };

  const startListening = () => {
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) { setMicError(''); setMicState('unsupported'); return; }
    try {
      setMicError('');
      const instance = new Constructor();
      instance.continuous = false; instance.interimResults = true; instance.lang = 'en-IN';
      instance.onresult = (event) => {
        let finalText = ''; let interimText = '';
        for (let i = event.results.length - 1; i >= 0; i -= 1) {
          const result = event.results[i];
          if (result.isFinal) finalText = result[0].transcript;
          else interimText = result[0].transcript;
        }
        setInterim(interimText);
        if (finalText) { setInterim(''); setMicState('idle'); respond(finalText); }
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
        setMicError(messages[event.error || ''] || event.message || `Speech recognition failed${event.error ? ` (${event.error})` : ''}. Try Chrome or type your response.`);
        setMicState(event.error === 'no-speech' || event.error === 'aborted' ? 'idle' : 'error');
        setInterim('');
      };
      instance.onend = () => { setMicState((state) => state === 'listening' ? 'idle' : state); };
      recognition.current = instance; instance.start(); setMicState('listening');
    } catch { setMicState('error'); }
  };

  const stopListening = () => { recognition.current?.stop(); setMicState('idle'); setMicError(''); setInterim(''); };
  const endRoom = async () => {
    stopListening(); window.speechSynthesis?.cancel(); remoteAudio.current?.pause(); setScreen('report'); setReport(null);
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
  const reset = () => { stopListening(); window.speechSynthesis?.cancel(); remoteAudio.current?.pause(); setTranscript([]); setReport(null); setReportLoading(false); setScreen('setup'); setMicState('idle'); setCurrentAgent(0); };
  const formatTime = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); reset(); }} aria-label="GD Arena home">
          <span className="brand-mark"><span /><span /><span /></span><span>gd<span className="brand-dot">.</span>arena</span>
        </a>
        <div className="topbar-right"><span className="prototype-label"><i /> LIVE PRACTICE PROTOTYPE</span><button className="help-button" title="About this demo"><Info size={17} /></button></div>
      </header>

      {screen === 'setup' && <section className="setup-page">
        <div className="setup-intro">
          <p className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT GD STARTS HERE</p>
          <h1>Practice out loud.<br /><em>Show up ready.</em></h1>
          <p className="intro-copy">A room full of different perspectives, ready when you are. Find your voice before the real room.</p>
          <div className="intro-proof"><div className="mini-avatars">{agents.slice(0, 4).map((agent) => <Avatar key={agent.id} agent={agent} small />)}</div><span>AI participants · Honest feedback after</span></div>
          <div className="session-stats"><div><strong>08</strong><span>MINUTES</span></div><div><strong>05</strong><span>PERSONALITIES</span></div><div><strong>01</strong><span>REAL YOU</span></div></div>
        </div>

        <section className="setup-card" aria-labelledby="setup-heading">
          <div className="card-topline"><div><span className="step-label">01 <span>/</span> SET UP YOUR ROOM</span><h2 id="setup-heading">Pick a topic to get started</h2></div><div className="sparkle-chip"><Sparkles size={15} /></div></div>
          <div className="field-label">CHOOSE A TOPIC <span>or write your own</span></div>
          <div className="topic-grid">{topics.map((item, index) => <button key={item.label} className={`topic-option ${topic === item.topic && !customTopic ? 'selected' : ''}`} onClick={() => { setTopic(item.topic); setCustomTopic(''); }}><span className={`topic-icon t${index}`}>{['✳', '⌂', '↗', '◌'][index]}</span><span><strong>{item.label}</strong><small>{item.topic}</small></span>{topic === item.topic && !customTopic && <Check size={16} className="topic-check" />}</button>)}</div>
          <label className="custom-topic"><span className="sr-only">Custom discussion topic</span><input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Or type a custom topic…" maxLength={120} /><Command size={15} /></label>
          <div className="setup-divider" />
          <div className="field-row"><div><div className="field-label">DISCUSSION FORMAT</div><p className="field-note">The moderator will guide the room.</p></div><label className="select-wrap"><select value={format} onChange={(event) => setFormat(event.target.value)}><option>Open discussion</option><option>Case-based</option><option>Controversial</option><option>Abstract</option></select><ChevronDown size={15} /></label></div>
          <div className="setup-divider compact" />
          <div className="field-row panel-row"><div><div className="field-label">AI PANEL SIZE</div><p className="field-note">Choose who joins the room.</p></div><div className="stepper"><button onClick={() => setPanelSize((size) => Math.max(3, size - 1))} disabled={panelSize <= 3} aria-label="Remove AI participant">−</button><strong>{panelSize}</strong><span>agents</span><button onClick={() => setPanelSize((size) => Math.min(5, size + 1))} disabled={panelSize >= 5} aria-label="Add AI participant">+</button></div></div>
          <div className="agent-strip">{panel.map((agent) => <Avatar key={agent.id} agent={agent} />)}<span className="mod-badge">+ MOD</span></div>
          <button className="start-button" onClick={openRoom}><span>Enter the practice room</span><ArrowRight size={18} /></button>
          <p className="disclosure"><Info size={13} /> AI participants are AI. Browser speech is used in demo mode; Gemini free-tier content may be used to improve Google products.</p>
        </section>
      </section>}

      {screen === 'room' && <section className="room-page">
        <div className="room-heading"><button className="back-button" onClick={reset}><ArrowLeft size={17} /> Setup</button><div className="room-heading-copy"><span className="step-label">YOUR PRACTICE ROOM</span><h1>{selectedTopic}</h1><p>{format} <span>·</span> You + {panel.length} AI participants + moderator</p></div><div className={`timer ${seconds < 60 ? 'timer-low' : ''}`}><Clock3 size={16} /><span>{formatTime(seconds)}</span><button onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Resume timer' : 'Pause timer'}>{paused ? <Play size={13} /> : <Pause size={13} />}</button></div></div>
        <div className="room-layout">
          <aside className="participants-panel"><div className="section-heading"><span>IN THE ROOM</span><MoreHorizontal size={18} /></div><div className="participant-list">
            <div className={`participant-card student-card ${activeSpeaker === 'student' || micState === 'listening' ? 'speaking' : ''}`}><Avatar agent={{ id: 'quiet_thinker', name: 'You', role: 'Your seat', hue: 'ink', initials: 'Y', voice: '' }} /><div className="participant-info"><strong>You</strong><span>Your seat</span></div><span className={`presence ${micState === 'listening' ? 'listening' : ''}`} /></div>
            {panel.map((agent) => <div className={`participant-card ${activeSpeaker === agent.id ? 'speaking' : ''}`} key={agent.id}><Avatar agent={agent} /><div className="participant-info"><strong>{agent.name}</strong><span>{agent.role}</span></div><span className={`presence ${activeSpeaker === agent.id ? 'talking' : ''}`} /></div>)}
            <div className={`participant-card moderator-card ${activeSpeaker === 'moderator' ? 'speaking' : ''}`}><div className="moderator-avatar">DS</div><div className="participant-info"><strong>Dr. Sharma</strong><span>AI moderator</span></div><span className="presence" /></div>
          </div><div className="room-note"><span className="note-icon"><Headphones size={15} /></span><p>Each person has a distinct point of view. Let them finish, then jump in when you have something to add.</p></div><div className="speech-toggle"><span><Volume2 size={15} /> Spoken replies</span><button className={`toggle ${speechOn ? 'on' : ''}`} onClick={() => setSpeechOn((value) => !value)} aria-label="Toggle spoken replies"><i /></button></div></aside>

          <section className="discussion-panel"><div className="discussion-toolbar"><div><span className="live-dot" /> <strong>LIVE DISCUSSION</strong><span className="toolbar-sep">·</span><span>{transcript.filter((line) => line.isStudent).length} of your turns</span></div><span className="demo-chip">{aiConnected ? 'GEMINI VOICE' : 'DEMO RESPONSES'}</span></div><div className="transcript" aria-live="polite">{transcript.map((line) => { const agent = agents.find((item) => item.id === line.speakerId); return <article key={line.id} className={`transcript-message ${line.isStudent ? 'student-message' : ''}`}><div className="message-avatar">{agent ? <Avatar agent={agent} small /> : <div className="moderator-avatar tiny">DS</div>}</div><div className="message-body"><div className="message-meta"><strong>{line.speakerName}</strong>{line.speakerId === 'moderator' && <span className="role-pill">MODERATOR</span>}<time>{formatTime(line.timestamp)}</time></div><p>{line.text}</p></div></article>; })}{interim && <div className="interim-caption"><Mic size={14} /> {interim}<span>Listening…</span></div>}{activeSpeaker === 'thinking' && <div className="thinking"><span /><span /><span /> Someone is gathering their thoughts</div>}<div ref={transcriptEnd} /></div><div className="talk-bar">{micState === 'unsupported' && <p className="mic-notice">Live browser speech recognition is unavailable here. Try the latest Chrome or Brave, or use the text box for now.</p>}{micState === 'error' && <p className="mic-notice error">{micError || 'Speech recognition failed. Try Chrome or type your response.'}</p>}{micError && micState === 'idle' && <p className="mic-notice error">{micError}</p>}<div className="input-row"><button className={`mic-button ${micState === 'listening' ? 'recording' : ''}`} onClick={micState === 'listening' ? stopListening : startListening} aria-label={micState === 'listening' ? 'Stop microphone' : 'Start microphone'}>{micState === 'listening' ? <MicOff size={18} /> : <Mic size={18} />}</button><input id="typed-turn" placeholder={micState === 'listening' ? 'Listening — speak your point…' : 'Or type a point to join the discussion…'} onKeyDown={(event) => { if (event.key === 'Enter') { const input = event.currentTarget; void respond(input.value); input.value = ''; } }} /><button className="send-button" aria-label="Send message" onClick={() => { const input = document.getElementById('typed-turn') as HTMLInputElement; if (input.value.trim()) { void respond(input.value); input.value = ''; } }}><ArrowRight size={18} /></button></div><div className="input-hint"><span><span className="shortcut">SPACE</span> Hold to speak <i>·</i> or type your response</span><button onClick={endRoom}>End session <ArrowRight size={13} /></button></div></div></section>
        </div>
      </section>}

      {screen === 'report' && <section className="report-page">
        <div className="report-top"><button className="back-button" onClick={reset}><ArrowLeft size={17} /> New practice</button><span className="step-label">SESSION COMPLETE</span></div>
        <div className="report-title"><span className="report-icon"><Sparkles size={22} /></span><p className="eyebrow">YOUR PRACTICE REPORT</p><h1>Good work showing up.</h1><p>Here’s a snapshot of how you participated. Use it as a starting point, not a verdict.</p></div>
        <div className="report-grid">
          <div className="report-card"><span className="report-card-label">YOUR SHARE OF THE ROOM</span><strong>{report?.studentSpeakingPercentage ?? (totalWords ? Math.round(studentWords / totalWords * 100) : 0)}<small>%</small></strong><p>{studentWords} of {totalWords} words across {transcript.filter((line) => line.isStudent).length} turns</p><div className="share-bar"><i style={{ width: `${report?.studentSpeakingPercentage ?? (totalWords ? Math.round(studentWords / totalWords * 100) : 0)}%` }} /></div></div>
          <div className="report-card"><span className="report-card-label">A MOMENT TO BUILD ON</span>{transcript.find((line) => line.isStudent) ? <><blockquote>“{transcript.find((line) => line.isStudent)?.text}”</blockquote><p>{report ? `Your overall practice score: ${report.overallScore}/10. Review the evidence-linked notes below.` : 'Use this moment as a starting point for your next round.'}</p></> : <><strong className="empty-report">Your first turn is still ahead.</strong><p>Try one more round and jump in with a short opening point.</p></>}</div>
        </div>
        {reportLoading && <div className="report-loading">Preparing quote-linked feedback…</div>}
        {report && <section className="feedback-grid" aria-label="Feedback by skill">{Object.values(report.categories).map((category) => <article className="feedback-card" key={category.title}><div className="feedback-card-top"><strong>{category.title}</strong><span>{category.scoreOutOf10}/10</span></div><p>{category.feedback}</p>{category.citations.map((citation) => <blockquote key={`${citation.timestampMs}-${citation.quote}`}>“{citation.quote}”</blockquote>)}</article>)}</section>}
        <div className="report-foot"><Info size={15} /><p>{report ? 'Feedback is based on the transcript. Quotes were checked against your exact words.' : 'This is a transcript-based demo snapshot. Connect Gemini to generate feedback with checked transcript quotes.'}</p></div>
        <button className="start-button report-again" onClick={reset}><RotateCcw size={16} /><span>Practice another topic</span><ArrowRight size={18} /></button>
      </section>}      <footer className="page-footer"><span>GD ARENA <i>·</i> PRACTICE MAKES PRESENCE</span><span>VOICE-FIRST GD PRACTICE <span className="footer-flower">✳</span></span></footer>
    </main>
  );
}

function Avatar({ agent, small = false }: { agent: Agent; small?: boolean }) {
  return <span className={`avatar avatar-${agent.hue} ${small ? 'avatar-small' : ''}`} title={agent.name}><i className="avatar-antenna" /><b>{agent.initials}</b><i className="avatar-eye left" /><i className="avatar-eye right" /><i className="avatar-mouth" /></span>;
}

export default App;
