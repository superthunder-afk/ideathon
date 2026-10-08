# GD Arena - Live Voice-First AI Group Discussion Room

**Problem Statement 2: GD Arena**

## What it does
GD Arena is a voice-first web application designed for campus placement and competitive exam aspirants to practice realistic Group Discussions (GDs) on-demand. Students enter a simulated room alongside a moderator and 3 to 5 AI participants—each driven by distinct behavioral personalities (The Dominator, The Data-Driven Analyst, The Diplomat, and The Topic Wanderer)—who converse naturally with each other, allow realistic interruptions, and generate an evidence-backed feedback report with direct quote citations upon completion.

---

## Done / Left / Plan

### Done
- [x] Initial repository architecture, coding guidelines, and directory scaffolding.
- [x] Detailed specification for multi-agent personality archetypes and moderator rules.
- [x] Project schema definitions for room state, live transcript entries, interruption events, and evaluation metrics.
- [x] `.env.example` and baseline environment configuration.

### Left (Next 16 Hours)
- [ ] Voice streaming integration (Web Speech API / real-time STT and multi-voice TTS playback).
- [ ] Dynamic turn-taking and natural interruption arbitration engine.
- [ ] Real-time discussion room UI with participant avatars, audio waveforms, and live captions.
- [ ] Post-session evaluation generator linking rubrics (listening, opening, body language/interruption handling, idea depth) to exact timestamped quotes.
- [ ] Silent real-time nudges and Hinglish/English mixed mode support.
- [ ] Production deployment to a publicly accessible URL.

### Plan to Finish
- **Hours 1–4**: Core room setup, audio input/output pipeline, and multi-agent prompt orchestration.
- **Hours 5–8**: Conversational turn-taking mechanics, pause threshold tuning, and interruption handling.
- **Hours 9–12**: Interactive discussion room UI, participant speaking indicators, and silent pacing nudges.
- **Hours 13–15**: Post-GD analytical scorecard generation with verbatim quote anchors and missed opening suggestions.
- **Hour 16**: Final QA, edge-case testing (denied microphone, API timeouts), README polish, and live cloud deployment.

---

## Architecture and Why

```
                 +--------------------------------------------+
                 |          Frontend (React / Vite)           |
                 | - Audio Streaming & Visualizers            |
                 | - Real-time Live Captions & Nudges         |
                 | - Room Setup & Comprehensive Scorecard UI  |
                 +---------------------+----------------------+
                                       |
                   WebSockets / SSE / Audio Streams
                                       |
                 +---------------------v----------------------+
                 |         Orchestration & State Engine       |
                 | - Turn-Taking Arbiter (Pause & Interruption)|
                 | - Moderator & Timer Controller             |
                 | - Multi-Persona Dispatcher                 |
                 +---------------------+----------------------+
                                       |
                 +---------------------v----------------------+
                 |             AI & Speech Services           |
                 | - Low-Latency LLM for Dynamic Dialogue     |
                 | - Multi-Voice TTS (Unique Persona Voices)  |
                 | - Diagnostic Evaluator with Quote Matcher  |
                 +--------------------------------------------+
```

### Key Technical Choices
- **Fast Multimodal / Low-Latency LLM Inference**: Conversation turn-taking requires sub-second response pacing so AI participants feel conversational rather than turn-blocked.
- **Distinct AI Agent Personalities**: Each AI participant runs on dedicated system instructions defining their assertiveness, speaking frequency, agreeableness, and analytical depth.
- **Client-Side Pause & Speech Detection**: Enables instant interruption detection—when the student starts talking, ongoing AI audio playback immediately ducks/cancels.
- **Deterministic Transcript-Anchored Rubric**: Evaluator model extracts strict JSON linking every piece of qualitative advice to an exact quoted sentence from the session.

---

## What We Added
- **Silent Real-Time Nudges**: Subtle on-screen prompts (e.g., *"You haven't contributed in 3 minutes"*, *"Great opportunity to summarize"*) helping students take the floor without breaking immersion.
- **"What You Could Have Said" Replay**: Analyzes missed transition opportunities in the transcript and demonstrates strong alternative entries.
- **Hinglish & Regional Discussion Modes**: Supports natural code-switching commonly observed in college campus GDs across India.
- **Accessibility by Design**: Full live captions, high-contrast indicators for active speakers, and adjustable AI response pacing.

---

## How to Run It

### Prerequisites
- Node.js (v18+ recommended)
- Modern web browser with microphone permissions enabled

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/superthunder-afk/ideathon.git
   cd ideathon
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Add your API keys inside .env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173` in your browser.

### Live URL
- *(Deployment link will be updated here prior to build freeze)*

---

## Tools and AI Used
- **Language & Frameworks**: TypeScript, React, Vite, Tailwind CSS
- **AI Models & APIs**: Google Gemini API (for conversational intelligence, persona modeling, and post-GD evaluation)
- **Speech Technologies**: Web Audio API, Web Speech API / TTS Audio synthesis
- **AI Transparency**: An explicit visual badge and disclaimer notice inform users before and during the session: *"All room co-participants are AI-simulated personas for training purposes."*

---

## Who It Is For
- **Campus Placement Aspirants**: College students preparing for competitive placement filtering rounds where GD is an elimination step.
- **MBA & Competitive Exam Applicants**: Candidates preparing for CAT, XAT, and B-school interviews.
- **Placement & Soft-Skill Cells**: Academic institutions seeking a scalable, zero-marginal-cost training room for their batches.
Students return because every session delivers fresh topics, dynamic opponent personalities, and measurable progress tracking.
