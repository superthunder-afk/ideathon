import { useEffect, useRef, useState } from 'react';
import type { TranscriptEntry } from './types';

type Props = {
  screen: 'home' | 'setup' | 'room';
  selectedTopic: string;
  panelSize: number;
  transcript: TranscriptEntry[];
  seconds: number;
  activeSpeaker: string;
  firstTurn: boolean;
  interim: string;
  speechLoading: boolean;
  micError: string;
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
  syncFirstTurnPrompt(document, props);
  syncLiveTranscript(document, props);
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
  updateSpeakerStage(document, props.activeSpeaker, last?.text || (props.firstTurn ? 'You have the floor. Share your opening point when you are ready.' : 'The moderator is opening the discussion.'));
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

function syncFirstTurnPrompt(document: Document, props: Props) {
  let prompt = document.querySelector<HTMLElement>('[data-gd-first-turn-prompt]');
  if (!prompt) {
    prompt = document.createElement('aside');
    prompt.dataset.gdFirstTurnPrompt = 'true';
    prompt.setAttribute('role', 'status');
    prompt.setAttribute('aria-live', 'polite');
    const copy = document.createElement('div');
    copy.innerHTML = '<strong>You’re up first</strong><span data-gd-prompt-copy></span>';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Dismiss first turn reminder');
    close.onclick = () => { if (prompt) prompt.dataset.dismissed = 'true'; };
    prompt.append(copy, close);
    document.body.append(prompt);
  }
  const copy = prompt.querySelector<HTMLElement>('[data-gd-prompt-copy]');
  if (copy) {
    copy.textContent = props.micState === 'listening'
      ? 'Speak your opening point. Your words will appear below; the AI panel will answer when you finish.'
      : props.micError
        ? 'The mic did not start. Use the text box below, or try the mic again.'
        : 'Speak or type an opening point. The AI panel is listening and will answer when you finish.';
  }
  prompt.style.display = props.firstTurn && prompt.dataset.dismissed !== 'true' ? 'flex' : 'none';
  const styles = document.getElementById('gd-live-room-ui-style') || document.createElement('style');
  styles.id = 'gd-live-room-ui-style';
  styles.textContent = `
    [data-gd-first-turn-prompt] { position:fixed; z-index:9999; top:14px; right:18px; width:min(390px,calc(100vw - 28px)); display:flex; align-items:flex-start; gap:14px; padding:13px 14px; border:1px solid rgba(159,60,22,.16); border-radius:12px; background:rgba(255,255,255,.97); color:#352b27; box-shadow:0 10px 35px rgba(55,35,26,.12); font:12px/1.5 Inter,system-ui,sans-serif; animation:gd-prompt-enter 240ms ease-out both; }
    [data-gd-first-turn-prompt] > div { display:flex; flex-direction:column; gap:2px; }
    [data-gd-first-turn-prompt] strong { color:#9f3c16; font-size:12px; }
    [data-gd-first-turn-prompt] button { flex:0 0 22px; border:0; background:transparent; color:#857a75; font:20px/1 system-ui,sans-serif; cursor:pointer; }
    [data-gd-discussion-lower] { width:min(1040px,calc(100% - 32px)); display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:18px; align-items:start; margin:18px auto 0; text-align:left; font:13px/1.5 Inter,system-ui,sans-serif; }
    [data-gd-live-chat] { max-height:148px; overflow:auto; padding:10px 12px; border-top:1px solid rgba(138,114,106,.22); text-align:left; font:12px/1.45 Inter,system-ui,sans-serif; scrollbar-width:thin; }
    [data-gd-speaking-prompts] { display:flex; flex-direction:column; gap:10px; padding:16px; border:1px solid rgba(138,114,106,.2); border-radius:14px; background:rgba(255,255,255,.82); color:#62534c; box-shadow:0 5px 18px rgba(55,35,26,.045); }
    [data-gd-prompts-title] { color:#9f3c16; font-size:11px; font-weight:700; letter-spacing:.1em; }
    [data-gd-prompts-hint] { margin-top:-6px; color:#85766e; font-size:11px; }
    [data-gd-prompt-item] { width:100%; padding:11px 12px; border:1px solid rgba(138,114,106,.11); border-radius:10px; background:#f8f4f1; color:#55463e; text-align:left; font:13px/1.45 Inter,system-ui,sans-serif; cursor:pointer; transition:background 160ms ease,border-color 160ms ease,transform 160ms ease; }
    [data-gd-prompt-item]:hover { background:#f4eae5; border-color:rgba(159,60,22,.24); transform:translateY(-1px); }
    [data-gd-prompt-item]:focus-visible { outline:2px solid #9f3c16; outline-offset:2px; }
    [data-gd-chat-turn] { padding:8px 10px; margin:5px 0; border-radius:9px; background:#f6f3f2; color:#453a35; }
    [data-gd-chat-turn][data-student="true"] { background:#f9eee8; margin-left:22px; }
    [data-gd-chat-name] { display:block; margin-bottom:2px; color:#9f3c16; font-size:10px; font-weight:650; }
    [data-gd-chat-turn][data-student="true"] [data-gd-chat-name] { color:#6d5a4b; }
    [data-gd-chat-draft] { border:1px dashed rgba(159,60,22,.3); background:#fffaf7; color:#78665c; font-style:italic; }
    [data-gd-chat-draft] [data-gd-chat-name] { color:#9f3c16; }
    [data-gd-voice-loading] { display:flex; align-items:center; gap:8px; width:max-content; padding:7px 10px; margin:7px 0 3px 10px; color:#85766e; font:11px/1.3 Inter,system-ui,sans-serif; }
    [data-gd-voice-spinner] { width:12px; height:12px; flex:none; border:1.5px solid rgba(159,60,22,.18); border-top-color:#9f3c16; border-radius:50%; animation:gd-voice-spin 720ms linear infinite; }
    @keyframes gd-voice-spin { to { transform:rotate(360deg); } }
    @media(prefers-reduced-motion:reduce) { [data-gd-voice-spinner] { animation:none; border-top-color:#9f3c16; border-right-color:#9f3c16; } }
    @keyframes gd-prompt-enter { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
    @media(max-width:640px) { [data-gd-first-turn-prompt] { top:8px; right:10px; } [data-gd-discussion-lower] { grid-template-columns:1fr; gap:12px; } [data-gd-live-chat] { max-height:120px; font-size:11px; } [data-gd-speaking-prompts] { display:grid; grid-template-columns:1fr; gap:8px; padding:14px; } }
  `;
  if (!styles.isConnected) document.head.append(styles);
}

function syncLiveTranscript(document: Document, props: Props) {
  const quote = document.querySelector('main blockquote');
  const host = quote?.parentElement;
  if (!host) return;
  let lower = host.querySelector<HTMLElement>('[data-gd-discussion-lower]');
  if (!lower) {
    lower = document.createElement('section');
    lower.dataset.gdDiscussionLower = 'true';
    const chatPanel = document.createElement('div');
    chatPanel.dataset.gdChatPanel = 'true';
    const chat = document.createElement('div');
    chat.dataset.gdLiveChat = 'true';
    chat.setAttribute('role', 'log');
    chat.setAttribute('aria-label', 'Live discussion transcript');
    chat.setAttribute('aria-live', 'polite');
    chatPanel.append(chat);
    const aside = document.createElement('aside');
    aside.dataset.gdSpeakingPrompts = 'true';
    const title = document.createElement('span');
    title.dataset.gdPromptsTitle = 'true';
    title.textContent = 'TRY SAYING';
    aside.append(title);
    const hint = document.createElement('span');
    hint.dataset.gdPromptsHint = 'true';
    hint.textContent = 'Based on the latest turn · click to use';
    aside.append(hint);
    for (const phrase of getSpeakingPrompts(props.transcript, props.selectedTopic)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.dataset.gdPromptItem = 'true';
      item.textContent = phrase;
      item.setAttribute('aria-label', `Use suggestion: ${phrase}`);
      item.onclick = () => {
        const field = document.querySelector<HTMLElement>('[contenteditable="true"], textarea, input[type="text"]');
        if (!field) return;
        const suggestion = item.textContent || '';
        if ('value' in field) (field as HTMLInputElement | HTMLTextAreaElement).value = suggestion;
        else field.textContent = suggestion;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.focus();
      };
      aside.append(item);
    }
    lower.append(chatPanel, aside);
    host.append(lower);
  }
  const chat = lower.querySelector<HTMLElement>('[data-gd-live-chat]');
  if (!chat) return;
  const turns = props.transcript.slice(-5);
  const key = `${turns.map((turn) => `${turn.id}:${turn.text}`).join('|')}|${props.interim}|${props.micState}|${props.speechLoading}|${props.selectedTopic}`;
  if (chat.dataset.renderKey === key) return;
  chat.dataset.renderKey = key;
  chat.replaceChildren();
  const prompts = lower.querySelector<HTMLElement>('[data-gd-speaking-prompts]');
  if (prompts) {
    const items = prompts.querySelectorAll<HTMLButtonElement>('[data-gd-prompt-item]');
    const suggestions = getSpeakingPrompts(props.transcript, props.selectedTopic);
    items.forEach((item, index) => {
      item.textContent = suggestions[index] || '';
      item.setAttribute('aria-label', `Use suggestion: ${suggestions[index] || ''}`);
    });
  }
  for (const turn of turns) {
    const row = document.createElement('article');
    row.dataset.gdChatTurn = 'true';
    row.dataset.student = String(turn.isStudent);
    const name = document.createElement('span');
    name.dataset.gdChatName = 'true';
    name.textContent = turn.isStudent ? 'You' : turn.speakerName;
    const text = document.createElement('span');
    text.textContent = turn.text;
    row.append(name, text);
    chat.append(row);
  }
  if (props.interim.trim() && props.micState === 'listening') {
    const row = document.createElement('article');
    row.dataset.gdChatTurn = 'true';
    row.dataset.gdStudent = 'true';
    row.dataset.gdChatDraft = 'true';
    const name = document.createElement('span');
    name.dataset.gdChatName = 'true';
    name.textContent = 'You · LIVE TRANSCRIPT';
    const text = document.createElement('span');
    text.textContent = props.interim;
    row.append(name, text);
    chat.append(row);
  }
  if (props.speechLoading && turns.length > 0 && !turns[turns.length - 1].isStudent) {
    const row = document.createElement('div');
    row.dataset.gdVoiceLoading = 'true';
    row.setAttribute('role', 'status');
    row.setAttribute('aria-live', 'polite');
    const spinner = document.createElement('span');
    spinner.dataset.gdVoiceSpinner = 'true';
    spinner.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = 'Preparing voice…';
    row.append(spinner, label);
    chat.append(row);
  }
  chat.scrollTop = chat.scrollHeight;
  chat.style.display = turns.length || props.interim.trim() ? 'block' : 'none';
}

function getSpeakingPrompts(transcript: TranscriptEntry[], topic: string) {
  const latest = transcript[transcript.length - 1];
  const latestAi = [...transcript].reverse().find((turn) => !turn.isStudent);
  const excerpt = (turn: TranscriptEntry | undefined) => {
    if (!turn?.text.trim()) return '';
    const cleaned = turn.text.trim().replace(/^[“"']|[”"']$/g, '').replace(/[.!?]+$/, '');
    const words = cleaned.split(/\s+/);
    const fragment = words.slice(0, 7).join(' ');
    return fragment.length > 54 ? `${fragment.slice(0, 51).trimEnd()}…` : fragment;
  };
  if (latest?.isStudent) {
    const fragment = excerpt(latest);
    return [
      fragment ? `Add a real example to your point about “${fragment}”…` : 'Add a real example to support your point…',
      'What might someone who disagrees say, and how would you answer?',
      'Who is most affected by this idea, and why?',
    ];
  }
  if (latestAi) {
    const name = latestAi.speakerName || 'the last speaker';
    const fragment = excerpt(latestAi);
    return [
      `I agree with ${name} because…`,
      fragment ? `Could you explain what you mean by “${fragment}”?` : 'Could you give a concrete example of that?',
      `Building on ${name}’s point, how could that work in practice?`,
    ];
  }
  const topicFragment = topic.trim().replace(/[.!?]+$/, '');
  return [
    `My view on “${topicFragment || 'this topic'}” is…`,
    'A real example that shaped my view is…',
    'A fair counterargument might be…',
  ];
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
  const nameNode = document.querySelector<HTMLElement>('[data-gd-speaker-name]')
    || labels.find((node) => ['The Challenger', 'Dr. Sharma', 'Dr. Sharma · Moderator', 'Rohan', 'Ananya', 'Vikram', 'Pooja', 'Mira', 'You', 'Room is ready', 'The council is choosing a speaker'].includes(node.textContent?.trim() || '')) as HTMLElement | undefined;
  nameNode?.setAttribute('data-gd-speaker-name', 'true');
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
  cards.forEach((card) => card.classList.toggle('gd-is-speaking', card === sourceCard && Boolean(details)));
  if (details && speakerId !== 'student' && speakerId !== 'thinking' && sourceCard && stageImage) {
    const sourceImage = sourceCard.querySelector<HTMLElement>('[style*="background-image"]');
    if (sourceImage) {
      const stageImageFrame = stageImage.parentElement as HTMLElement | null;
      if (stageImageFrame) {
        const frameSize = stageImageFrame.getBoundingClientRect();
        if (frameSize.width < 32 || frameSize.height < 32) {
          stageImageFrame.style.width = '88px';
          stageImageFrame.style.height = '88px';
          stageImageFrame.style.flexShrink = '0';
        }
      }
      if (document.documentElement.dataset.gdActiveSpeaker !== speakerId) animateAvatarHandoff(document, sourceImage, stageImage, stageCard);
      stageImage.textContent = '';
      stageImage.style.background = '';
      stageImage.style.display = '';
      stageImage.style.placeItems = '';
      stageImage.style.color = '';
      stageImage.style.font = '';
      stageImage.style.backgroundImage = sourceImage.style.backgroundImage;
      stageImage.style.backgroundPosition = sourceImage.style.backgroundPosition;
      stageImage.style.backgroundSize = sourceImage.style.backgroundSize;
      if (stageCard) stageCard.dataset.gdSpeakerId = speakerId;
    }
  } else if (speakerId === 'student' && stageImage) {
    const stageImageFrame = stageImage.parentElement as HTMLElement | null;
    if (stageImageFrame) {
      const frameSize = stageImageFrame.getBoundingClientRect();
      if (frameSize.width < 32 || frameSize.height < 32) {
        stageImageFrame.style.width = '88px';
        stageImageFrame.style.height = '88px';
        stageImageFrame.style.flexShrink = '0';
      }
    }
    stageImage.textContent = 'You';
    stageImage.style.backgroundImage = 'none';
    stageImage.style.background = 'linear-gradient(140deg, #dbeafe, #f5e9ff)';
    stageImage.style.display = 'grid';
    stageImage.style.placeItems = 'center';
    stageImage.style.color = '#6644a6';
    stageImage.style.font = '600 18px Inter, sans-serif';
  }
  document.documentElement.dataset.gdActiveSpeaker = speakerId;

  const status = document.querySelector<HTMLElement>('[data-gd-speaker-status]')
    || labels.find((node) => ['Speaking now', 'Choosing next speaker', 'The Challenger · Speaking', 'Your turn', 'Listening for your point', 'Room is ready'].includes(node.textContent?.trim() || '')) as HTMLElement | undefined;
  status?.setAttribute('data-gd-speaker-status', 'true');
  if (status) status.textContent = speakerId === 'thinking' ? 'Choosing next speaker' : speakerId === 'student' ? 'Your turn' : speakerId ? 'Speaking now' : 'Next speaker soon';
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
  }, [props.screen, props.selectedTopic, props.panelSize, props.transcript, props.seconds, props.micState, props.activeSpeaker, props.firstTurn, props.interim, props.speechLoading, props.micError, mobile]);

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
