import { useEffect, useRef, useState } from 'react';
import type { TranscriptEntry } from './types';

type Props = {
  screen: 'home' | 'setup' | 'room';
  selectedTopic: string;
  panelSize: number;
  transcript: TranscriptEntry[];
  seconds: number;
  activeSpeaker: string;
  micState: 'idle' | 'listening' | 'unsupported' | 'error';
  onOpenRoom: (topic?: string, panelSize?: number) => void;
  onOpenSetup: () => void;
  onGoHome: () => void;
  onReset: () => void;
  onEndRoom: () => void;
  onStartListening: () => void;
  onStopListening: (resumeDiscussion?: boolean) => void;
  onRespond: (text: string) => void;
  onSetTopic: (value: string) => void;
  onSetPanelSize: (value: number) => void;
};

const pad = (value: number) => value.toString().padStart(2, '0');
const fieldValue = (field: HTMLElement | null) => field && 'value' in field
  ? String((field as HTMLInputElement | HTMLTextAreaElement).value)
  : field?.textContent || '';
const clearField = (field: HTMLElement | null) => {
  if (!field) return;
  if ('value' in field) (field as HTMLInputElement | HTMLTextAreaElement).value = '';
  else field.textContent = '';
};

function syncLiveDocument(document: Document, props: Props) {
  if (props.screen === 'setup') {
    const back = document.querySelector<HTMLButtonElement>('button[aria-label="Return"]');
    if (back) back.onclick = (event) => { event.preventDefault(); props.onGoHome(); };
    return;
  }
  if (props.screen !== 'room') return;
  const send = () => {
    const field = document.querySelector('[contenteditable="true"], textarea, input[type="text"]') as HTMLElement | HTMLInputElement | null;
    const text = fieldValue(field);
    if (!text.trim()) return;
    props.onRespond(text.trim());
    clearField(field);
  };
  const sendButton = document.querySelector<HTMLButtonElement>('button[title="Send message"], button[aria-label="Send argument"]');
  if (sendButton) sendButton.onclick = (event) => { event.preventDefault(); send(); };
  const form = document.querySelector<HTMLFormElement>('footer form');
  if (form) form.onsubmit = (event) => { event.preventDefault(); send(); };
  const micButton = document.getElementById('mic-toggle-btn') || document.getElementById('zen-mute-btn');
  if (micButton) micButton.onclick = (event) => {
    event.preventDefault();
    if (props.micState === 'listening') props.onStopListening(true);
    else props.onStartListening();
  };
  const leaveButton = document.getElementById('btn-leave-arena') || document.querySelector<HTMLButtonElement>('button[aria-label="End Call"]');
  if (leaveButton) leaveButton.onclick = (event) => { event.preventDefault(); props.onEndRoom(); };
  const backButton = document.querySelector<HTMLButtonElement>('button[aria-label="Return"]');
  if (backButton) backButton.onclick = (event) => { event.preventDefault(); props.onReset(); };
  const last = props.transcript[props.transcript.length - 1];
  const originalTopics = [
    'Should artificial intelligence replace traditional university education?',
    'Should artificial intelligence replace traditional education?',
  ];
  const topic = document.querySelector('[data-gd-arena-topic]') || Array.from(document.querySelectorAll('main p, main span')).find((item) =>
    originalTopics.some((original) => item.textContent?.trim().startsWith(original)),
  );
  if (topic) topic.setAttribute('data-gd-arena-topic', 'true');
  if (topic) topic.textContent = props.selectedTopic;
  const timer = document.getElementById('session-countdown') || Array.from(document.querySelectorAll('header span')).find((item) =>
    /^\d{2}:\d{2}$/.test(item.textContent?.trim() || ''),
  );
  if (timer) timer.textContent = `${pad(Math.floor(props.seconds / 60))}:${pad(props.seconds % 60)}`;
  const activeSpeaker = props.micState === 'listening' ? 'student' : props.activeSpeaker;
  updateSpeakerStage(document, activeSpeaker, last?.text || 'The moderator is opening the discussion.');
  Array.from(document.querySelectorAll('span')).forEach((span) => {
    if (span.textContent?.trim() === '5 Listening') span.textContent = `${props.panelSize + 1} Listening`;
  });
  const listening = props.micState === 'listening';
  const desktopMicLabel = document.getElementById('mic-label');
  const desktopMicIcon = document.getElementById('mic-icon');
  const mobileMicLabel = document.getElementById('zen-mute-label');
  const mobileMicIcon = document.getElementById('zen-mute-icon');
  if (desktopMicLabel) desktopMicLabel.textContent = listening ? 'Listening on' : 'Join by voice';
  if (desktopMicIcon) desktopMicIcon.textContent = listening ? 'mic_off' : 'mic';
  if (mobileMicLabel) mobileMicLabel.textContent = listening ? 'Listening' : 'Muted';
  if (mobileMicIcon) mobileMicIcon.textContent = listening ? 'mic' : 'mic_off';
  if (desktopMicLabel) desktopMicLabel.setAttribute('title', listening ? 'Hands-free listening is on. Speak at any time. Headphones help prevent voice echo.' : 'Enable hands-free listening. Headphones help prevent voice echo.');
  const mobileCouncil = document.querySelector('.grid.grid-cols-5');
  const council = mobileCouncil || Array.from(document.querySelectorAll('main .flex.flex-wrap')).find((item) => item.children.length === 5);
  if (council) {
    const mobileLayout = Boolean(mobileCouncil);
    const moderator = Array.from(council.children).find((card) =>
      Array.from(card.querySelectorAll('span')).some((label) => label.textContent?.trim() === 'Moderator'),
    ) as HTMLElement | undefined;
    let members = Array.from(council.children).filter((item) => item !== moderator) as HTMLElement[];
    let extra = members.find((item) => item.dataset.gdArenaExtra === 'true');
    if (props.panelSize === 5 && !extra && members.length) {
      extra = members[members.length - 1].cloneNode(true) as HTMLElement;
      extra.dataset.gdArenaExtra = 'true';
      const name = Array.from(extra.querySelectorAll('span')).find((item) => item.textContent?.trim() === 'The Skeptic');
      if (name) name.textContent = 'The Connector';
      if (mobileLayout) council.append(extra);
      else if (moderator) council.insertBefore(extra, moderator);
    }
    if (extra && props.panelSize !== 5) extra.remove();
    members = Array.from(council.children).filter((item) => item !== moderator) as HTMLElement[];
    members.forEach((member, index) => { member.style.display = index < props.panelSize ? '' : 'none'; });
  }
}

const speakerDetails: Record<string, { name: string; role: string; card: string }> = {
  dominator: { name: 'Rohan', role: 'Confident starter', card: 'The Analyst' },
  data_driven: { name: 'Ananya', role: 'Evidence seeker', card: 'The Diplomat' },
  quiet_thinker: { name: 'Vikram', role: 'Quiet synthesizer', card: 'The Strategist' },
  wanderer: { name: 'Pooja', role: 'Creative tangent', card: 'The Skeptic' },
  connector: { name: 'Mira', role: 'Thoughtful connector', card: 'The Connector' },
  moderator: { name: 'Dr. Sharma', role: 'Moderator', card: 'Moderator' },
};

function updateSpeakerStage(document: Document, speakerId: string, quoteText: string) {
  const labels = Array.from(document.querySelectorAll('main span'));
  const nameNode = labels.find((node) => ['The Challenger', 'Dr. Sharma', 'Rohan', 'Ananya', 'Vikram', 'Pooja', 'Mira', 'You', 'The council is choosing a speaker'].includes(node.textContent?.trim() || ''));
  const stageCard = document.querySelector<HTMLElement>('.pink-speaker-glow') || (nameNode?.parentElement as HTMLElement | null);
  const speakerName = nameNode;
  const stageImage = (document.querySelector('.pink-speaker-glow [style*="background-image"]') || stageCard?.querySelector<HTMLElement>('[style*="background-image"]')) as HTMLElement | null;
  const quote = document.querySelector<HTMLElement>('main blockquote');
  const details = speakerDetails[speakerId];
  const resolvedName = speakerId === 'student' ? 'You' : speakerId === 'thinking' ? 'The council is choosing a speaker' : details?.name || 'Room is ready';
  const resolvedRole = speakerId === 'student' ? 'Your point' : speakerId === 'thinking' ? 'Listening to the room' : details?.role || 'AI participant';

  if (speakerName && speakerName.textContent?.trim() !== resolvedName) {
    speakerName.textContent = resolvedName;
    const parent = speakerName.parentElement;
    const secondary = speakerName.nextElementSibling as HTMLElement | null;
    if (secondary?.tagName === 'SPAN') secondary.textContent = resolvedRole;
    if (parent) {
      parent.classList.remove('gd-stage-arrive');
      void parent.offsetWidth;
      parent.classList.add('gd-stage-arrive');
    }
  }
  if (quote && quote.textContent !== `“${quoteText}”`) {
    quote.textContent = `“${quoteText}”`;
    quote.classList.remove('gd-quote-arrive');
    void quote.offsetWidth;
    quote.classList.add('gd-quote-arrive');
  }

  const council = document.querySelector('.grid.grid-cols-5') || Array.from(document.querySelectorAll('main .flex.flex-wrap')).find((item) => item.children.length >= 4);
  const cards = council ? Array.from(council.children) as HTMLElement[] : [];
  const sourceCard = cards.find((card) => Array.from(card.querySelectorAll('span')).some((span) => span.textContent?.trim() === details?.card));
  cards.forEach((card) => card.classList.toggle('gd-is-speaking', card === sourceCard && Boolean(details && speakerId !== 'moderator')));
  if (details && speakerId !== 'student' && speakerId !== 'thinking' && speakerId !== 'moderator' && sourceCard && stageImage) {
    const sourceImage = sourceCard.querySelector<HTMLElement>('[style*="background-image"]');
    if (sourceImage) {
      if (document.documentElement.dataset.gdActiveSpeaker !== speakerId) animateAvatarHandoff(document, sourceImage, stageImage, stageCard);
      stageImage.style.backgroundImage = sourceImage.style.backgroundImage;
      stageImage.style.backgroundPosition = sourceImage.style.backgroundPosition;
      stageImage.style.backgroundSize = sourceImage.style.backgroundSize;
      if (stageCard) stageCard.dataset.gdSpeakerId = speakerId;
    }
  }
  document.documentElement.dataset.gdActiveSpeaker = speakerId;

  const status = labels.find((node) => ['Speaking now', 'The Challenger · Speaking'].includes(node.textContent?.trim() || ''));
  if (status) status.textContent = speakerId === 'thinking' ? 'Choosing next speaker' : speakerId === 'student' ? 'Your turn' : 'Speaking now';
  const css = document.getElementById('gd-stage-motion-style') || document.createElement('style');
  css.id = 'gd-stage-motion-style';
  css.textContent = `
    @keyframes gd-stage-enter { from { opacity: .45; transform: translateY(12px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes gd-quote-enter { from { opacity: .35; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
    .gd-stage-arrive { animation: gd-stage-enter 460ms cubic-bezier(.2,.75,.25,1) both; }
    .gd-quote-arrive { animation: gd-quote-enter 380ms ease-out both; }
    .gd-is-speaking > div:first-child { border-color: rgba(236,72,153,.68)!important; box-shadow: 0 0 0 3px rgba(236,72,153,.10), 0 8px 24px rgba(236,72,153,.13)!important; transform: translateY(-3px); }
    .gd-is-speaking { transition: transform 360ms ease, filter 360ms ease; }
    .gd-avatar-flight { position: fixed!important; z-index: 99999!important; margin: 0!important; pointer-events: none!important; border-radius: 50%!important; box-shadow: 0 8px 28px rgba(236,72,153,.25)!important; transition: left 620ms cubic-bezier(.2,.75,.25,1), top 620ms cubic-bezier(.2,.75,.25,1), width 620ms cubic-bezier(.2,.75,.25,1), height 620ms cubic-bezier(.2,.75,.25,1), opacity 620ms ease!important; }
    @media (prefers-reduced-motion: reduce) { .gd-stage-arrive,.gd-quote-arrive { animation-duration: 1ms!important; } .gd-avatar-flight { transition-duration: 1ms!important; } }
  `;
  if (!css.isConnected) document.head.append(css);
}

function animateAvatarHandoff(document: Document, source: HTMLElement, target: HTMLElement, stageCard: HTMLElement | null) {
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width || !to.width) return;
  const flight = document.createElement('div');
  flight.className = 'gd-avatar-flight';
  flight.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;background-image:${source.style.backgroundImage};background-position:${source.style.backgroundPosition};background-size:${source.style.backgroundSize};background-repeat:no-repeat;`;
  document.body.append(flight);
  target.style.transition = 'opacity 180ms ease';
  target.style.opacity = '0';
  if (stageCard) stageCard.style.setProperty('--gd-stage-handoff', '1');
  requestAnimationFrame(() => {
    flight.style.left = `${to.left}px`;
    flight.style.top = `${to.top}px`;
    flight.style.width = `${to.width}px`;
    flight.style.height = `${to.height}px`;
    flight.style.opacity = '.86';
  });
  window.setTimeout(() => { flight.remove(); target.style.opacity = '1'; if (stageCard) stageCard.style.removeProperty('--gd-stage-handoff'); }, 620);
}

export default function ExactStitchFrame(props: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const template = props.screen === 'home'
    ? mobile ? '/stitch/home-mobile.html' : '/stitch/home-desktop.html'
    : props.screen === 'setup'
      ? mobile ? '/stitch/setup-mobile.html' : '/stitch/setup-desktop.html'
      : mobile ? '/stitch/live-mobile.html' : '/stitch/live-desktop.html';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const document = frame.current?.contentDocument;
    if (document) syncLiveDocument(document, props);
  }, [props.screen, props.selectedTopic, props.panelSize, props.transcript, props.seconds, props.micState, props.activeSpeaker, mobile]);

  const onFrameLoad = () => {
    const document = frame.current?.contentDocument;
    if (!document) return;
    document.addEventListener('click', (event) => {
      const current = propsRef.current;
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      const link = target?.closest('a');
      if (current.screen === 'home' && (link?.dataset.path === 'try-it-out' || /try\s+(live\s+discussion|it live)/i.test(`${button?.textContent || ''} ${link?.textContent || ''}`))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        current.onOpenSetup();
        return;
      }
      if (!button) return;
      if (current.screen === 'room' && (
        button.matches('button[title="Send message"], button[aria-label="Send argument"]')
        || button.getAttribute('title')?.trim() === 'Send message'
        || button.getAttribute('aria-label') === 'Send argument'
      )) {
        const field = document.querySelector('[contenteditable="true"], textarea, input[type="text"]') as HTMLElement | HTMLInputElement | null;
        const text = fieldValue(field);
        event.preventDefault();
        event.stopImmediatePropagation();
        if (text.trim()) {
          current.onRespond(text.trim());
          clearField(field);
        }
        return;
      }
      if (current.screen === 'setup' && (button.id === 'begin-btn' || button.id === 'launch-arena-btn')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const field = document.getElementById('topic-input') as HTMLTextAreaElement | null;
        const desktopCount = Array.from(document.querySelectorAll<HTMLButtonElement>('.participant-opt')).find((item) => item.className.includes('font-medium'));
        const mobileCount = Array.from(document.querySelectorAll<HTMLButtonElement>('.count-item')).find((item) => item.className.includes('font-semibold'));
        const count = Number(desktopCount?.dataset.val || mobileCount?.dataset.count || 4);
        const topic = field?.value.trim() || 'Should artificial intelligence replace traditional university education?';
        current.onSetTopic(topic);
        current.onSetPanelSize(count);
        current.onOpenRoom(topic, count);
        return;
      }
    }, true);
    const bind = (selector: string, eventName: 'click' | 'submit', handler: (event: Event) => void) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element || element.dataset.gdArenaBound === 'true') return;
      element.dataset.gdArenaBound = 'true';
      element.addEventListener(eventName, handler, true);
    };
    bind('button[title="Send message"], button[aria-label="Send argument"]', 'click', (event) => {
      const current = propsRef.current;
      event.preventDefault();
      event.stopImmediatePropagation();
      const field = document.querySelector('[contenteditable="true"], textarea, input[type="text"]') as HTMLElement | HTMLInputElement | null;
      const text = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.value : field?.textContent || '';
      if (!text.trim()) return;
      current.onRespond(text.trim());
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = '';
      else if (field) field.textContent = '';
    });
    bind('footer form', 'submit', (event) => {
      const current = propsRef.current;
      event.preventDefault();
      event.stopImmediatePropagation();
      const form = event.currentTarget as HTMLFormElement;
      const field = form.querySelector('[contenteditable="true"], textarea, input[type="text"]') as HTMLElement | HTMLInputElement | null;
      const text = fieldValue(field);
      if (text.trim()) current.onRespond(text.trim());
      clearField(field);
    });
    syncLiveDocument(document, propsRef.current);
  };

  return <iframe
    key={template}
    ref={frame}
    src={template}
    title={props.screen === 'home' ? 'GD Arena home' : props.screen === 'setup' ? 'GD Arena setup' : 'GD Arena live discussion'}
    allow="microphone"
    onLoad={onFrameLoad}
    style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', border: 0, zIndex: 50, background: '#fcfaf7', animation: 'stitch-frame-enter 260ms ease-out both' }}
  />;
}
