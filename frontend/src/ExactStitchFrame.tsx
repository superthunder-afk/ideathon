import { useEffect, useRef, useState } from 'react';
import type { TranscriptEntry } from './types';

type Props = {
  screen: 'home' | 'setup' | 'room';
  selectedTopic: string;
  panelSize: number;
  transcript: TranscriptEntry[];
  seconds: number;
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
  const quote = document.querySelector('main blockquote');
  if (quote && last) quote.textContent = `“${last.text}”`;
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
  const speakerName = props.micState === 'listening' ? 'You' : last?.speakerName || 'The Challenger';
  Array.from(document.querySelectorAll('span')).forEach((span) => {
    const text = span.textContent?.trim();
    if (text === 'The Challenger') span.textContent = speakerName;
    if (text === 'The Challenger · Speaking') span.textContent = `${speakerName} · Speaking`;
    if (text === 'Speaking now') span.textContent = props.micState === 'listening' ? 'Your turn' : 'Speaking now';
    if (text === '5 Listening') span.textContent = `${props.panelSize + 1} Listening`;
  });
  const listening = props.micState === 'listening';
  const desktopMicLabel = document.getElementById('mic-label');
  const desktopMicIcon = document.getElementById('mic-icon');
  const mobileMicLabel = document.getElementById('zen-mute-label');
  const mobileMicIcon = document.getElementById('zen-mute-icon');
  if (desktopMicLabel) desktopMicLabel.textContent = listening ? 'Stop speaking' : 'Mute Mic';
  if (desktopMicIcon) desktopMicIcon.textContent = listening ? 'mic_off' : 'mic';
  if (mobileMicLabel) mobileMicLabel.textContent = listening ? 'Listening' : 'Muted';
  if (mobileMicIcon) mobileMicIcon.textContent = listening ? 'mic' : 'mic_off';
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
  }, [props.screen, props.selectedTopic, props.panelSize, props.transcript, props.seconds, props.micState, mobile]);

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
