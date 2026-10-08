import { useEffect, useRef, useState } from 'react';
import type { TranscriptEntry } from './types';

type Props = {
  screen: 'setup' | 'room';
  selectedTopic: string;
  panelSize: number;
  transcript: TranscriptEntry[];
  seconds: number;
  micState: 'idle' | 'listening' | 'unsupported' | 'error';
  onOpenRoom: (topic?: string, panelSize?: number) => void;
  onReset: () => void;
  onEndRoom: () => void;
  onStartListening: () => void;
  onStopListening: (resumeDiscussion?: boolean) => void;
  onSetTopic: (value: string) => void;
  onSetPanelSize: (value: number) => void;
};

const pad = (value: number) => value.toString().padStart(2, '0');

function syncLiveDocument(document: Document, props: Props) {
  if (props.screen !== 'room') return;
  const last = props.transcript[props.transcript.length - 1];
  const quote = document.querySelector('main blockquote');
  if (quote && last) quote.textContent = `“${last.text}”`;
  const topic = Array.from(document.querySelectorAll('main p, main span')).find((item) =>
    item.textContent?.trim().startsWith('Should artificial intelligence replace traditional university education?'),
  );
  if (topic) topic.textContent = props.selectedTopic;
  const timer = document.getElementById('session-countdown');
  if (timer) timer.textContent = `${pad(Math.floor(props.seconds / 60))}:${pad(props.seconds % 60)}`;
  const speakerName = props.micState === 'listening' ? 'You' : last?.speakerName || 'The Challenger';
  Array.from(document.querySelectorAll('span')).forEach((span) => {
    const text = span.textContent?.trim();
    if (text === 'The Challenger') span.textContent = speakerName;
    if (text === 'The Challenger · Speaking') span.textContent = `${speakerName} · Speaking`;
    if (text === 'Speaking now') span.textContent = props.micState === 'listening' ? 'Your turn' : 'Speaking now';
    if (text === '5 Listening') span.textContent = `${props.panelSize + 1} Listening`;
  });
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
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const template = props.screen === 'setup'
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
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button) return;
      if (props.screen === 'setup' && (button.id === 'begin-btn' || button.id === 'launch-arena-btn')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const field = document.getElementById('topic-input') as HTMLTextAreaElement | null;
        const desktopCount = Array.from(document.querySelectorAll<HTMLButtonElement>('.participant-opt')).find((item) => item.className.includes('font-medium'));
        const mobileCount = Array.from(document.querySelectorAll<HTMLButtonElement>('.count-item')).find((item) => item.className.includes('font-semibold'));
        const count = Number(desktopCount?.dataset.val || mobileCount?.dataset.count || 4);
        props.onSetTopic(field?.value.trim() || 'Should artificial intelligence replace traditional university education?');
        props.onSetPanelSize(count);
        props.onOpenRoom(field?.value.trim() || 'Should artificial intelligence replace traditional university education?', count);
        return;
      }
      if (props.screen === 'room' && (button.id === 'btn-leave-arena' || button.getAttribute('aria-label') === 'End Call')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        props.onEndRoom();
        return;
      }
      if (props.screen === 'room' && button.getAttribute('aria-label') === 'Return') {
        event.preventDefault();
        event.stopImmediatePropagation();
        props.onReset();
        return;
      }
      if (props.screen === 'room' && (button.id === 'mic-toggle-btn' || button.id === 'zen-mute-btn')) {
        if (props.micState === 'listening') props.onStopListening(true);
        else props.onStartListening();
      }
    }, true);
    syncLiveDocument(document, props);
  };

  return <iframe
    key={template}
    ref={frame}
    src={template}
    title={props.screen === 'setup' ? 'GD Arena setup' : 'GD Arena live discussion'}
    allow="microphone"
    onLoad={onFrameLoad}
    style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', border: 0, zIndex: 50, background: '#fcfaf7' }}
  />;
}
