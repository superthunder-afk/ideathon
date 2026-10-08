# GD Arena — Problem Statement 2

## What it does

GD Arena lets students practise a timed group discussion with AI participants who have distinct discussion roles. It transcribes the student's speech and produces a post-session report with feedback linked to transcript excerpts. This project addresses Problem Statement 2, GD Arena.

## Done / Left / Plan

### Done

- Room setup supports suggested or custom topics, a panel of 3–5 AI participants, and open, case-based, controversial, or abstract formats.
- A moderator opens the discussion and an eight-minute timer structures the session.
- Browser speech recognition displays the student's words as captions. Participants take sequential turns, can refer to earlier contributions, and their speech can be interrupted by the student.
- The Analyst, Diplomat, Strategist, Skeptic, and Connector have separate role instructions. Sarvam Bulbul speech is the primary hosted voice service; Fish Audio through OpenRouter and browser speech are fallbacks where configured or available.
- The report covers starting, idea quality, building on others, listening, interruptions, and ending strongly. Its feedback is tied to excerpts found in the transcript.
- Setup tells students that the panel is AI and that the transcript is used to prepare feedback. No account is required, and session data is held in browser memory rather than saved as a history.

### Left

- A formal closing round where each AI participant gives a short final takeaway before the moderator ends the room. At present, ending a session proceeds to the report without that round.
- The speech-recognition path is English-only and depends on the browser's Web Speech API; browser and operating-system support varies.
- Friends in the same live room, saved progress across sessions, Hindi-English or regional-language rooms, fishbowl mode, and real-time coaching nudges are not implemented.
- Full cross-browser and mobile-device checks, including denied microphone, network loss, and provider failure, still need to be completed before the final demo.

### Plan for the remaining build time

1. Add the closing round and ensure its transcript entries are included in the report.
2. Rehearse the complete setup → discussion → interruption → closing → report flow, then check microphone denial, connection loss, and AI/TTS failure recovery.
3. Check the deployed app on a phone and in Chrome and Brave, fix any blockers, and update this section to match the final build.

## Architecture and why

- **Frontend:** React, TypeScript, and Vite provide a small static web app deployed on Vercel.
- **Speech input:** the browser's Web Speech API handles recognition and captions. Browser support and audio handling depend on the browser implementation.
- **Discussion turns:** the frontend sends the topic, format, panel, language setting, and session transcript to an Express API on Railway. The backend uses Gemini through Google's GenAI SDK to produce one participant turn at a time. Serial turns keep voices from overlapping and let the client stop current playback when the student interrupts; this is request/response turn-taking, not a WebSocket audio stream.
- **Speech output:** the backend can call Sarvam Bulbul for speech and OpenRouter/Fish Audio as a fallback. Browser speech is also available as a fallback. Kokoro is included as an optional browser-side voice path; it can require additional device resources and is not the hosted primary voice.
- **Data:** there is no database in the current build. The transcript and report are session-scoped in browser memory; the backend receives discussion text to generate turns and feedback. Supabase is not currently used.

## What we added

- Four discussion formats and a custom-topic option make practice usable for more than one kind of GD prompt.
- The live transcript, interruptible voice playback, and conversation-aware speaking suggestions help a student follow and re-enter the discussion.
- Distinct participant roles and transcript-linked report excerpts make feedback more specific than a generic score.

## How to run it

Requirements: Node.js and npm. Copy the example files locally and add your own provider keys; never commit those local files.

1. Start the API in one terminal:

   ```powershell
   cd backend
   npm install
   Copy-Item .env.example .env
   # Edit .env: add GEMINI_API_KEY; add SARVAM_API_KEY and/or OPENROUTER_API_KEY for hosted voices.
   # Set FRONTEND_ORIGINS=http://localhost:5173 for local development.
   npm run dev
   ```

2. Start the frontend in another terminal:

   ```powershell
   cd frontend
   npm install
   Copy-Item .env.example .env.local
   npm run dev
   ```

3. Open the Vite URL printed in the terminal (normally `http://localhost:5173`). Allow microphone access and use a browser that supports the Web Speech API. Without a Gemini key, the app may use its fallback discussion responses, but the full AI discussion and report require the configured AI service. Hosted speech also requires the corresponding provider key.

**Live URL:** [https://gd-arena-pathakharsh9971-9088.vercel.app/](https://gd-arena-pathakharsh9971-9088.vercel.app/). No login or test account is required.

## Tools and AI used

- React, TypeScript, Vite, Express, and the Google GenAI SDK.
- Gemini generates discussion turns and report feedback. Sarvam Bulbul is the primary hosted text-to-speech service; Fish Audio via OpenRouter and browser speech provide configured fallbacks. Kokoro is an optional local/browser voice path.
- Speech recognition uses the browser Web Speech API. The recognized transcript is sent to the backend for AI discussion and feedback; the browser's own handling of microphone audio depends on its implementation.
- The setup screen identifies the other participants as AI and explains the transcript's feedback use. No user account or persistent session history is collected.

## Who it is for

GD Arena is for students preparing for campus placements and other selection processes that include group discussions. They can return to practise different topics and review their session report; progress is not currently saved between sessions.
