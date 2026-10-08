import type { Dispatch, SetStateAction, FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Headphones, Info, Mic, MicOff, Pause, Play, RotateCcw, Send, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { GDReport, PersonalityType, TranscriptEntry } from './types';
import ExactStitchFrame from './ExactStitchFrame';

type RoomLanguage = 'en';
type SpeechEngine = 'sarvam' | 'kokoro';
type Agent = { id: PersonalityType; name: string; role: string; hue: string; initials: string; voice: string };
type TopicOption = { label: string; topic: string };

interface StitchExperienceProps {
  screen: 'home' | 'setup' | 'room' | 'report';
  topic: string;
  topics: TopicOption[];
  customTopic: string;
  setCustomTopic: Dispatch<SetStateAction<string>>;
  setTopic: Dispatch<SetStateAction<string>>;
  selectedTopic: string;
  panel: Agent[];
  panelSize: number;
  setPanelSize: Dispatch<SetStateAction<number>>;
  format: string;
  setFormat: Dispatch<SetStateAction<string>>;
  language: RoomLanguage;
  setLanguage: Dispatch<SetStateAction<RoomLanguage>>;
  roomLanguages: Array<{ id: RoomLanguage; label: string; note: string }>;
  speechEngine: SpeechEngine;
  setSpeechEngine: Dispatch<SetStateAction<SpeechEngine>>;
  kokoroStatus: 'idle' | 'loading' | 'ready' | 'error';
  ttsProvider: 'sarvam' | 'openrouter' | 'gemini' | 'device';
  ttsAvailable: boolean;
  aiConnected: boolean;
  seconds: number;
  paused: boolean;
  setPaused: Dispatch<SetStateAction<boolean>>;
  speechOn: boolean;
  setSpeechOn: Dispatch<SetStateAction<boolean>>;
  transcript: TranscriptEntry[];
  interim: string;
  micState: 'idle' | 'listening' | 'unsupported' | 'error';
  micError: string;
  activeSpeaker: string;
  firstTurn: boolean;
  studentWords: number;
  totalWords: number;
  report: GDReport | null;
  reportLoading: boolean;
  onOpenRoom: (topic?: string, panelSize?: number) => void;
  onOpenSetup: () => void;
  onGoHome: () => void;
  onEndRoom: () => void;
  onReset: () => void;
  onStartListening: () => void;
  onStopListening: (resumeDiscussion?: boolean) => void;
  onInterruptAgents: () => void;
  onRespond: (text: string) => void;
}

const moderator: Agent = { id: 'moderator', name: 'Dr. Sharma', role: 'AI facilitator', hue: 'ink', initials: 'DS', voice: '' };
const student: Agent = { id: 'quiet_thinker', name: 'You', role: 'Your seat', hue: 'ink', initials: 'Y', voice: '' };
export default function StitchExperience(props: StitchExperienceProps) {
  const {
    screen, topic, topics, customTopic, setCustomTopic, setTopic, selectedTopic, panel, panelSize, setPanelSize,
    format, setFormat, language, setLanguage, roomLanguages, speechEngine, setSpeechEngine, kokoroStatus,
    ttsProvider, ttsAvailable, aiConnected, seconds, paused, setPaused, speechOn, setSpeechOn, transcript,
    interim, micState, micError, activeSpeaker, studentWords, totalWords, report, reportLoading,
    onOpenRoom, onOpenSetup, onGoHome, onEndRoom, onReset, onStartListening, onStopListening, onInterruptAgents, onRespond,
  } = props;
  const designScreen: string = screen;
  const lastTurn = transcript[transcript.length - 1];
  const turnAgent = lastTurn?.speakerId === 'moderator' ? moderator : lastTurn?.isStudent ? student : panel.find((agent) => agent.id === lastTurn?.speakerId);
  const activeName = micState === 'listening' || activeSpeaker === 'student'
    ? 'You have the floor'
    : activeSpeaker === 'thinking'
      ? 'The council is considering that'
      : activeSpeaker === 'moderator'
        ? 'Moderator speaking'
        : panel.find((agent) => agent.id === activeSpeaker)?.name || lastTurn?.speakerName || 'Room is ready';
  const providerLabel = speechEngine === 'kokoro' && language === 'en'
    ? kokoroStatus === 'loading' ? 'Kokoro is loading' : kokoroStatus === 'error' ? 'Using Sarvam fallback' : 'Kokoro · this device'
    : ttsAvailable
      ? ttsProvider === 'sarvam' ? 'Sarvam Bulbul voice' : ttsProvider === 'openrouter' ? 'Fish Audio fallback' : ttsProvider === 'gemini' ? 'Gemini voice' : 'Device voice'
      : aiConnected ? 'Device voice' : 'Demo responses';
  const timer = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const submitTurn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('student-turn') as HTMLInputElement | null;
    if (!input?.value.trim()) return;
    onRespond(input.value);
    input.value = '';
  };

  if (screen === 'home' || screen === 'setup' || screen === 'room') {
    return <ExactStitchFrame
      screen={screen}
      selectedTopic={selectedTopic}
      panelSize={panelSize}
      transcript={transcript}
      seconds={seconds}
      activeSpeaker={activeSpeaker}
      firstTurn={props.firstTurn}
      interim={interim}
      micError={micError}
      micState={micState}
      onOpenRoom={onOpenRoom}
      onOpenSetup={onOpenSetup}
      onGoHome={onGoHome}
      onReset={onReset}
      onEndRoom={onEndRoom}
      onStartListening={onStartListening}
      onStopListening={onStopListening}
      onRespond={onRespond}
      onSetTopic={setCustomTopic}
      onSetPanelSize={setPanelSize}
    />;
  }

  return (
    <div key={screen} className="editorial-app page-enter">
      <header className="editorial-header">
        <a className="editorial-brand" href="#" onClick={(event) => { event.preventDefault(); onReset(); }} aria-label="GD Arena home">
          <span>GD Arena</span><i>/</i><small>{designScreen === 'setup' ? 'SETUP' : designScreen === 'room' ? 'LIVE DISCOURSE' : 'SESSION BRIEF'}</small>
        </a>
        <nav className="editorial-steps" aria-label="Practice steps">
          <span className={designScreen === 'setup' ? 'current' : 'complete'}>{designScreen === 'setup' ? '01' : <Check size={13} />} Setup</span>
          <i />
          <span className={designScreen === 'room' ? 'current' : designScreen === 'report' ? 'complete' : ''}>{designScreen === 'report' ? <Check size={13} /> : '02'} Arena</span>
          <i />
          <span className={designScreen === 'report' ? 'current' : ''}>03 Brief</span>
        </nav>
        <div className="header-status">
          {designScreen === 'room' ? <><span className={`status-dot ${seconds < 60 ? 'urgent' : ''}`} /><span className="header-timer">{timer}</span><button className="timer-control" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Resume timer' : 'Pause timer'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button></> : <><span className="status-dot" /><span>{designScreen === 'report' ? 'COMPLETE' : 'READY'}</span></>}
        </div>
      </header>

      {designScreen === 'setup' && <main className="setup-zen">
        <section className="setup-intro-zen">
          <p className="eyebrow-zen"><span /> EIGHT MINUTES · ONE BETTER FIRST IMPRESSION</p>
          <h1>What do you want<br className="desktop-break" /> to discuss<span>?</span></h1>
          <p className="setup-subtitle">Choose a topic, gather your panel, and practise thinking out loud.</p>
        </section>

        <section className="setup-composer" aria-label="Set up a group discussion">
          <div className="topic-label"><span>CHOOSE A STARTING POINT</span><span>or write your own</span></div>
          <div className="topic-choices">
            {topics.map((item) => <button key={item.label} type="button" className={`topic-choice ${topic === item.topic && !customTopic ? 'selected' : ''}`} onClick={() => { setTopic(item.topic); setCustomTopic(''); }}>
              <span className="topic-choice-label">{item.label}</span><span className="topic-choice-copy">{item.topic}</span>{topic === item.topic && !customTopic && <Check size={15} />}
            </button>)}
          </div>
          <label className="custom-topic-zen"><span className="sr-only">Write a custom discussion topic</span><textarea value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder={topic} maxLength={120} rows={2} /><span className="custom-topic-icon"><ChevronDown size={16} /></span></label>

          <div className="setup-divider-zen" />
          <div className="settings-grid">
            <fieldset className="setting-field panel-setting">
              <legend>AI PARTICIPANTS</legend>
              <div className="participant-choice" aria-label="AI panel size">
                {[3, 4, 5].map((size) => <button key={size} type="button" aria-pressed={panelSize === size} className={panelSize === size ? 'selected' : ''} onClick={() => setPanelSize(size)}>{size}</button>)}
                <span>plus a moderator</span>
              </div>
            </fieldset>
            <label className="setting-field"><span>DISCUSSION FORMAT</span><span className="select-zen"><select value={format} onChange={(event) => setFormat(event.target.value)} aria-label="Discussion format"><option>Open discussion</option><option>Case-based</option><option>Controversial</option><option>Abstract</option></select><ChevronDown size={14} /></span></label>
            <label className="setting-field"><span>ROOM LANGUAGE</span><span className="select-zen"><select value={language} onChange={(event) => setLanguage(event.target.value as RoomLanguage)} aria-label="Room language">{roomLanguages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><ChevronDown size={14} /></span></label>
            <label className="setting-field"><span>AI VOICE</span><span className="select-zen"><select value={speechEngine} onChange={(event) => setSpeechEngine(event.target.value as SpeechEngine)} aria-label="AI voice engine"><option value="sarvam">Sarvam Bulbul</option><option value="kokoro">Kokoro · on this device</option></select><ChevronDown size={14} /></span></label>
          </div>

          <div className="setup-actions">
            <div className="avatar-preview" aria-label={`${panel.length} AI participants and one moderator`}>
              {panel.map((agent) => <Face key={agent.id} agent={agent} small />)}<Face agent={moderator} small />
            </div>
            <button type="button" className="begin-button" onClick={() => onOpenRoom()}>Begin deliberation <ArrowRight size={17} /></button>
          </div>
          <p className="setup-disclosure"><Info size={13} /> Your panel consists of AI participants. Transcripts are used to generate feedback. {speechEngine === 'kokoro' && language === 'en' ? 'Kokoro voice is generated on this device.' : providerLabel + ' is selected.'}</p>
        </section>
      </main>}

      {designScreen === 'room' && <main className="arena-main">
        <div className="arena-heading">
          <button className="quiet-back" onClick={onReset}><ArrowLeft size={15} /> Setup</button>
          <div className="arena-topic"><span className="eyebrow-zen"><span /> {format.toUpperCase()} · ENGLISH</span><h1>{selectedTopic}</h1><p>You and {panel.length} AI participants, with Dr. Sharma moderating.</p></div>
          <button className="finish-button" onClick={onEndRoom}>End session <ArrowRight size={15} /></button>
        </div>

        <section className="council-strip" aria-label="Discussion participants">
          <div className="council-strip-heading"><span>THE ROOM</span><span>{panel.length + 2} SEATS</span></div>
          <div className="council-list">
            <div className={`council-person ${micState === 'listening' || activeSpeaker === 'student' ? 'is-speaking' : ''}`}><Face agent={student} /><span className="council-name">You</span><span className="council-role">Your seat</span>{(micState === 'listening' || activeSpeaker === 'student') && <span className="speaking-pill">Speaking</span>}</div>
            {panel.map((agent) => <div key={agent.id} className={`council-person ${activeSpeaker === agent.id ? 'is-speaking' : ''}`}><Face agent={agent} /><span className="council-name">{agent.name}</span><span className="council-role">{agent.role}</span>{activeSpeaker === agent.id && <span className="speaking-pill">Speaking</span>}</div>)}
            <div className={`council-person ${activeSpeaker === 'moderator' ? 'is-speaking' : ''}`}><Face agent={moderator} /><span className="council-name">Dr. Sharma</span><span className="council-role">Moderator</span>{activeSpeaker === 'moderator' && <span className="speaking-pill">Speaking</span>}</div>
          </div>
        </section>

        <div className="arena-columns">
          <section className="focus-stage" aria-label="Current speaker">
            <div className="focus-stage-meta"><span className={`live-label ${activeSpeaker === 'thinking' ? 'thinking-label' : ''}`}><i />{activeSpeaker === 'thinking' ? 'THINKING' : 'LIVE DISCUSSION'}</span><span>{providerLabel}</span></div>
            <div className={`speaker-spotlight ${turnAgent?.hue || 'ink'}`}>
              <div className="spotlight-face"><Face agent={activeSpeaker === 'student' || micState === 'listening' ? student : (panel.find((agent) => agent.id === activeSpeaker) || turnAgent || moderator)} large /></div>
              <div className="spotlight-copy"><span className="speaker-label">{activeName}</span><p>{activeSpeaker === 'thinking' ? 'Listening to the room and gathering a response…' : lastTurn?.text || 'The moderator is opening the discussion.'}</p></div>
            </div>
            <div className="stage-topic"><span>DISCUSSION TOPIC</span><strong>{selectedTopic}</strong></div>
            <div className="talk-controls">
              {micState === 'unsupported' && <p className="voice-notice">Live speech recognition isn’t available in this browser. You can type your point below.</p>}
              {(micState === 'error' || micError) && <p className="voice-notice error">{micError || 'Speech recognition failed. Try again or type your response.'}</p>}
              <form className="turn-form" onSubmit={submitTurn}>
                <button type="button" className={`mic-action ${micState === 'listening' ? 'recording' : ''}`} onClick={micState === 'listening' ? () => onStopListening(true) : onStartListening} aria-label={micState === 'listening' ? 'Stop microphone and submit speech' : 'Speak your point'}>{micState === 'listening' ? <MicOff size={19} /> : <Mic size={19} />}</button>
                <input name="student-turn" aria-label="Your discussion point" onFocus={() => { if (activeSpeaker && activeSpeaker !== 'student') onInterruptAgents(); }} placeholder={micState === 'listening' ? 'Listening — speak your point…' : 'Add a point to the discussion…'} />
                <button type="submit" className="send-action" aria-label="Send your point"><Send size={17} /></button>
              </form>
              {interim && <div className="live-caption"><Mic size={13} /> {interim}<span>LIVE CAPTION</span></div>}
              <div className="talk-utilities"><button type="button" className={`sound-toggle ${speechOn ? 'enabled' : ''}`} onClick={() => setSpeechOn((value) => !value)}>{speechOn ? <Volume2 size={15} /> : <VolumeX size={15} />}{speechOn ? 'Voice on' : 'Voice off'}</button><span><Headphones size={14} /> AI participants will pause when you speak</span></div>
            </div>
          </section>

          <aside className="transcript-rail" aria-label="Discussion transcript">
            <div className="transcript-rail-top"><div><span>THE RECORD</span><strong>{transcript.length} turns</strong></div><span className="provider-tag">{providerLabel}</span></div>
            <div className="transcript-stream" aria-live="polite">
              {transcript.map((line) => {
                const agent = line.speakerId === 'moderator' ? moderator : line.isStudent ? student : panel.find((item) => item.id === line.speakerId) || moderator;
                return <article key={line.id} className={`record-turn ${line.isStudent ? 'student-turn' : ''} ${line.speakerId === 'moderator' ? 'moderator-turn' : ''}`}>
                  <div className="record-turn-head"><Face agent={agent} small /><span>{line.speakerName}</span><time>{formatTime(line.timestamp)}</time></div><p>{line.text}</p>
                </article>;
              })}
              {activeSpeaker === 'thinking' && <div className="waiting-note"><span /><span /><span /> Someone is gathering their thoughts</div>}
              {!transcript.length && <div className="record-empty"><CircleHelp size={18} /><p>Your discussion turns will appear here.</p></div>}
            </div>
          </aside>
        </div>
      </main>}

      {designScreen === 'report' && <main className="brief-main">
        <div className="brief-heading"><button className="quiet-back" onClick={onReset}><ArrowLeft size={15} /> New practice</button><span className="eyebrow-zen"><span /> SESSION COMPLETE</span></div>
        <section className="brief-title"><span className="brief-mark"><Sparkles size={20} /></span><h1>A clearer picture<br />of how you showed up.</h1><p>Specific moments from your discussion, so your next one feels more natural.</p></section>
        <div className="brief-summary">
          <article className="brief-card share-card"><span className="brief-card-label">YOUR SHARE OF THE ROOM</span><strong>{report?.studentSpeakingPercentage ?? (totalWords ? Math.round(studentWords / totalWords * 100) : 0)}<small>%</small></strong><p>{studentWords} of {totalWords} words · {transcript.filter((line) => line.isStudent).length} turns</p><div className="share-meter"><i style={{ width: `${report?.studentSpeakingPercentage ?? (totalWords ? Math.round(studentWords / totalWords * 100) : 0)}%` }} /></div></article>
          <article className="brief-card moment-card"><span className="brief-card-label">A MOMENT TO BUILD ON</span>{transcript.find((line) => line.isStudent) ? <><blockquote>“{transcript.find((line) => line.isStudent)?.text}”</blockquote><p>{report ? `Overall practice score: ${report.overallScore}/10` : 'Use this opening as a starting point for your next round.'}</p></> : <><strong className="empty-brief">Your first turn is still ahead.</strong><p>Try another round and begin with one clear point.</p></>}</article>
        </div>
        {reportLoading && <div className="brief-loading"><span /><span /><span /> Gathering transcript-backed feedback…</div>}
        {report && <section className="feedback-grid" aria-label="Feedback by skill">{Object.values(report.categories).map((category) => <article className="feedback-card" key={category.title}><div className="feedback-card-top"><strong>{category.title}</strong><span>{category.scoreOutOf10}/10</span></div><p>{category.feedback}</p>{category.citations.map((citation) => <blockquote key={`${citation.timestampMs}-${citation.quote}`}>“{citation.quote}”</blockquote>)}</article>)}</section>}
        <div className="brief-note"><Info size={15} /><p>{report ? 'Each note is grounded in your transcript. Keep what helps; treat it as a practice guide.' : 'Your transcript is available, but quote-linked coaching is not available for this session.'}</p></div>
        <button className="begin-button brief-again" onClick={onReset}><RotateCcw size={16} /> Practice another topic <ArrowRight size={16} /></button>
      </main>}

      <footer className="editorial-footer"><span>GD ARENA <i>·</i> PRACTICE MAKES PRESENCE</span><span>LISTEN CLOSELY. SPEAK CLEARLY.</span></footer>
    </div>
  );
}

function Face({ agent, small = false, large = false }: { agent: Agent; small?: boolean; large?: boolean }) {
  return <span className={`avatar avatar-${agent.hue} ${small ? 'avatar-small' : ''} ${large ? 'avatar-large' : ''}`} title={agent.name} aria-hidden="true"><i className="avatar-antenna" /><b>{agent.initials}</b><i className="avatar-eye left" /><i className="avatar-eye right" /><i className="avatar-mouth" /></span>;
}

function formatTime(value: number) {
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}
