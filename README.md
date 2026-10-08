# GD Arena

GD Arena is a voice-first group discussion practice room for students preparing for campus placements. It is built for **Problem Statement 2**: students choose a topic, practise with distinct AI personas, and receive a transcript-based report.

## Done / Left / Plan

- **Done:** Azisly-inspired setup and room UI; custom topics; 3–5 personas; timer; browser speech input; continuous AI discussion; transcript-based coaching; Gemini discussion replies; Fish Audio speech synthesis with persona-specific delivery styles.
- **Current deployment:** Vercel serves the frontend and Railway runs the API. `OPENROUTER_API_KEY` and `GEMINI_API_KEY` are backend-only secrets.
- **Next:** Test live mic and spoken turn-taking with the team; add a database only if the team decides to save sessions or user accounts.

## Architecture and why

This is one GitHub repo with separately deployable apps:

- `frontend/` is a React + TypeScript app built with Vite. Vercel serves its static `dist/` output over HTTPS.
- `backend/` is a small Express API. Railway serves health, turn-generation, and speech-generation endpoints. Gemini generates discussion turns and reports; Fish Audio S2.1 Pro Free via OpenRouter speaks them. Both API keys stay server-side and are never bundled into the browser.
- `frontend/.env.example` documents the public API URL. `backend/.env.example` documents the server-only Gemini key and model settings.

The frontend uses browser speech recognition for mic input and falls back to typed turns. It asks the API for one next speaker at a time while the discussion is running. Fish Audio receives a distinct delivery-style direction for each participant and moderator; Gemini TTS and device speech remain fallbacks. No session data is saved to a database in this MVP, so Supabase is not required.

The current Gemini free tier can use submitted content to improve Google products. The app should tell students before they share speech or transcript content; they should avoid names and sensitive details.

## What we added

- A responsive white interface using Azisly's blue accent and neutral palette.
- GD setup for AI & society, campus life, business, abstract, and custom topics.
- Five separate AI participant profiles and an AI moderator.
- Transcript, timer, captions, mic and text input, spoken replies, and a basic session report.
- A rate-limited API with input checks, restricted CORS, Gemini turn selection, and Fish Audio TTS through OpenRouter.
- A demo fallback so the room still opens before an API key is configured.

## How to run it

Requirements: Node.js 20 or newer.

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Backend, in another terminal:

```bash
cd backend
npm ci
copy .env.example .env
npm run dev
```

Add a Google AI Studio key to `backend/.env` for Gemini replies and an OpenRouter key for Fish Audio speech. Never use a `VITE_` variable for either key. Use a current Chrome or Brave browser for speech recognition and playback; if mic access is denied or unavailable, type a response instead.

## Hosting configuration

### Vercel frontend

- Root directory: `frontend`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL` = the Railway public API origin

### Railway backend

- Root directory: `/backend`
- Start command: `npm start`
- Health check: `/health`
- Variables: `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_TTS_MODEL`, `FRONTEND_ORIGINS`, `GEMINI_TEXT_MODEL`, `GEMINI_TTS_MODEL`
- Set `FRONTEND_ORIGINS` to the deployed Vercel site origin(s), comma-separated.

Railway's Free plan has a small monthly usage credit. Do not upgrade the workspace or add paid resources for this hackathon app.

## Tools and AI used

- React, TypeScript, Vite, Express, and Lucide icons.
- Google GenAI JavaScript SDK for server-side Gemini discussion and report generation.
- Fish Audio S2.1 Pro Free through OpenRouter for server-side speech synthesis, with persona-specific delivery directions.
- Browser `SpeechRecognition` / `webkitSpeechRecognition` for the current mic prototype.
- Vercel for the frontend and Railway for the API; Supabase is intentionally deferred until persistent user data is needed.

## Who it is for

Students who want a low-pressure place to practise campus-placement group discussions before a real GD round.

## Secrets

Never commit API keys, passwords, `.env`, or `.env.local`. Commit only `.env.example` placeholders. Store `GEMINI_API_KEY` and `OPENROUTER_API_KEY` in the local backend environment file for development and in Railway's private environment variables for the hosted API. Never expose them as `VITE_` or `NEXT_PUBLIC_` variables.
