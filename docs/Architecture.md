# Voice AI Math Tutor — System Architecture

## Project Overview

**What we're building:** A voice-first AI math tutor where student and AI collaborate on a shared visual canvas. The AI can see what the student draws, speak naturally, and add visual explanations to the canvas.

**Track:** Grok Voice  
**Team:** 2 people (Frontend / Backend split)  
**Timeline:** 48 hours  
**Primary Goal:** Win the track by demonstrating a novel, daily-use voice application

---

## Core Interaction Loop

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│    ┌─────────┐         ┌─────────┐         ┌─────────┐     │
│    │ Student │ ──────► │ Canvas  │ ◄────── │  Grok   │     │
│    │  Voice  │         │ (Shared)│         │  Voice  │     │
│    └─────────┘         └─────────┘         └─────────┘     │
│         │                   │                   │           │
│         │    "I'm stuck     │    Watches &      │           │
│         │     on this"      │    Annotates      │           │
│         │                   │                   │           │
│         └───────────────────┴───────────────────┘           │
│                             │                               │
│                      REAL-TIME SYNC                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**The loop:**

1. Student speaks or draws on canvas
2. System captures voice + canvas state
3. Grok processes both inputs together
4. Grok responds with voice + optional canvas actions
5. Canvas updates, student continues

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                  │
│                         (Your scope)                                │
│                                                                     │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐  │
│   │  Voice Panel  │  │    Canvas     │  │    State Manager      │  │
│   │               │  │   (tldraw)    │  │      (Zustand)        │  │
│   │ • Mic capture │  │               │  │                       │  │
│   │ • Audio play  │  │ • Drawing     │  │ • Voice state         │  │
│   │ • Orb UI      │  │ • AI shapes   │  │ • Canvas state        │  │
│   │ • Transcript  │  │ • Tools       │  │ • Conversation        │  │
│   └───────┬───────┘  └───────┬───────┘  └───────────┬───────────┘  │
│           │                  │                      │              │
│           └──────────────────┼──────────────────────┘              │
│                              │                                      │
│                      ┌───────▼───────┐                             │
│                      │   WebSocket   │                             │
│                      │    Client     │                             │
│                      └───────┬───────┘                             │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               │ Bidirectional
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                              │                                      │
│                      ┌───────▼───────┐                             │
│                      │   WebSocket   │          BACKEND            │
│                      │    Server     │      (Teammate scope)       │
│                      └───────┬───────┘                             │
│                              │                                      │
│   ┌──────────────────────────┼──────────────────────────────────┐  │
│   │                          │                                   │  │
│   │  ┌───────────────┐  ┌────▼────────┐  ┌───────────────────┐  │  │
│   │  │ Grok Voice    │  │  Session    │  │  Canvas State     │  │  │
│   │  │ Integration   │  │  Manager    │  │  Processor        │  │  │
│   │  │               │  │             │  │                   │  │  │
│   │  │ • Audio in    │  │ • Auth      │  │ • Summarization   │  │  │
│   │  │ • Audio out   │  │ • State     │  │ • Change detect   │  │  │
│   │  │ • Actions     │  │ • Memory    │  │ • Error detect    │  │  │
│   │  └───────┬───────┘  └─────────────┘  └───────────────────┘  │  │
│   │          │                                                   │  │
│   └──────────┼───────────────────────────────────────────────────┘  │
│              │                                                      │
│      ┌───────▼───────┐                                             │
│      │   Grok API    │                                             │
│      │   (xAI)       │                                             │
│      │               │                                             │
│      │ • Voice WS    │                                             │
│      │ • TTS/STT     │                                             │
│      └───────────────┘                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Responsibilities

### Voice Panel

| Responsibility | Details |
|----------------|---------|
| Microphone capture | Request permissions, capture audio stream |
| Audio playback | Play Grok's voice responses |
| Voice state management | Track: idle, listening, processing, speaking |
| Visual feedback | Orb animations, audio levels, waveform |
| Transcript display | Show conversation history |

### Canvas (tldraw)

| Responsibility | Details |
|----------------|---------|
| Student drawing | Freehand, shapes, text input |
| AI-generated content | Receive and render shapes from backend |
| State serialization | Convert canvas to JSON for backend |
| Change detection | Notify when student modifies canvas |
| Tool management | Pen, shapes, eraser, select |

### State Manager

| Responsibility | Details |
|----------------|---------|
| Voice state | Current mode, audio levels |
| Tutor state | What Grok is doing (listening, thinking, etc.) |
| Conversation | Message history with timestamps |
| Canvas reference | Current canvas state for quick access |
| Connection status | WebSocket health |

### WebSocket Client

| Responsibility | Details |
|----------------|---------|
| Connection management | Connect, reconnect, heartbeat |
| Message routing | Route incoming messages to appropriate handlers |
| Audio streaming | Send mic audio, receive Grok audio |
| Canvas sync | Send canvas updates, receive AI actions |

---

## Backend Responsibilities

### Grok Voice Integration

| Responsibility | Details |
|----------------|---------|
| Audio streaming | Bidirectional audio with Grok Voice API |
| Action parsing | Extract canvas commands from Grok responses |
| Voice activity detection | Know when user/Grok is speaking |
| Interruption handling | Stop Grok when user starts speaking |

### Session Manager

| Responsibility | Details |
|----------------|---------|
| Session state | Track conversation context per user |
| Memory | Store student profile, past interactions |
| System prompt | Build context-aware prompts |

### Canvas State Processor

| Responsibility | Details |
|----------------|---------|
| Summarization | Convert canvas JSON to text description |
| Change detection | Identify what student added/modified |
| Error detection | Spot potential math mistakes |
| Action generation | Create canvas commands for AI responses |

---

## Data Flow

### Student Speaks

```
Student speaks
      │
      ▼
┌─────────────┐
│ Mic capture │ (Frontend)
└──────┬──────┘
       │ Audio stream
       ▼
┌─────────────┐
│  WebSocket  │ (Frontend → Backend)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Grok Voice  │ (Backend)
│    API      │
└──────┬──────┘
       │ Transcript + Intent
       ▼
┌─────────────┐
│  Session    │ (Backend)
│  Manager    │ Add canvas context, build prompt
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Grok Voice  │ (Backend)
│  Response   │
└──────┬──────┘
       │ Audio + Actions
       ▼
┌─────────────┐
│  WebSocket  │ (Backend → Frontend)
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│ Audio     │  │ Canvas    │  │ Transcript│
│ Playback  │  │ Update    │  │ Update    │
└───────────┘  └───────────┘  └───────────┘
```

### Student Draws

```
Student draws on canvas
         │
         ▼
┌─────────────────┐
│ Canvas onChange │ (Frontend)
└────────┬────────┘
         │ Debounced (300ms)
         ▼
┌─────────────────┐
│ Serialize state │ (Frontend)
└────────┬────────┘
         │ JSON
         ▼
┌─────────────────┐
│   WebSocket     │ (Frontend → Backend)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Canvas State    │ (Backend)
│ Processor       │ Summarize, detect changes
└────────┬────────┘
         │ Text summary
         ▼
┌─────────────────┐
│ Session Context │ (Backend)
│ Updated         │ Ready for next voice interaction
└─────────────────┘
```

---

## Voice States

```
                    ┌──────────┐
        ┌──────────►│   IDLE   │◄──────────┐
        │           └────┬─────┘           │
        │                │                 │
        │         User taps orb            │
        │                │                 │
        │                ▼                 │
        │          ┌───────────┐           │
        │          │ LISTENING │           │
        │          └─────┬─────┘           │
        │                │                 │
        │    User stops speaking           │
        │                │                 │
        │                ▼                 │
        │         ┌────────────┐           │
        │         │ PROCESSING │           │
        │         └──────┬─────┘           │
        │                │                 │
        │       Grok starts responding     │
        │                │                 │
        │                ▼                 │
   User starts     ┌──────────┐      Grok finishes
   speaking        │ SPEAKING │      speaking
        │          └────┬─────┘           │
        │               │                 │
        │               ▼                 │
        │        ┌─────────────┐          │
        └────────┤ INTERRUPTED ├──────────┘
                 └─────────────┘
```

---

## Canvas State Management

### What Gets Sent to Backend

| Data | When | Purpose |
|------|------|---------|
| Full canvas JSON | On significant change | Complete context |
| Change delta | On every change | Real-time awareness |
| Screenshot | On request / periodically | Visual context for Grok |

### What Backend Sends to Frontend

| Data | When | Purpose |
|------|------|---------|
| Shape commands | When Grok wants to draw | Add/modify canvas elements |
| Highlight commands | When Grok references something | Visual attention |
| Clear commands | When starting fresh | Reset canvas |

### Canvas Command Types

```
ADD_SHAPE      → Create new element (text, arrow, shape)
UPDATE_SHAPE   → Modify existing element
DELETE_SHAPE   → Remove element
HIGHLIGHT      → Temporarily emphasize element(s)
PAN_TO         → Move viewport to location
```

---

## The "Wow" Feature: Proactive Interruption

### Concept

Grok watches the canvas in real-time and can speak up **before** the student finishes — like a real tutor looking over your shoulder.

### Architecture for Proactive Mode

```
┌─────────────────────────────────────────────────────────────┐
│                     PROACTIVE LOOP                          │
│                                                             │
│   Canvas changes (debounced 500ms)                          │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────────┐                                       │
│   │ Quick Analysis  │  "Is this worth commenting on?"       │
│   │ (Lightweight)   │                                       │
│   └────────┬────────┘                                       │
│            │                                                │
│            ▼                                                │
│      ┌─────────┐     No                                     │
│      │ Notable?├─────────► Continue watching                │
│      └────┬────┘                                            │
│           │ Yes                                             │
│           ▼                                                 │
│   ┌─────────────────┐                                       │
│   │ Generate Voice  │  "Hold on — let me point out..."     │
│   │ Interruption    │                                       │
│   └────────┬────────┘                                       │
│            │                                                │
│            ▼                                                │
│   ┌─────────────────┐                                       │
│   │ Push to Frontend│  Audio + optional highlight          │
│   └─────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Trigger Conditions

- Student appears to be making a common error
- Student is stuck (no canvas changes for 10+ seconds)
- Student wrote something Grok can build on
- Student is going down a productive path (encouragement)

---

## Technology Decisions

### Frontend

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 14 (App Router) | Fast setup, good DX, easy deployment |
| Canvas | tldraw | Best React canvas library, AI-ready, good API |
| State | Zustand | Simple, performant, no boilerplate |
| Styling | CSS Modules + CSS Variables | No build complexity, full control |
| WebSocket | Native WebSocket | Simple, no library needed |
| Audio | Web Audio API | Native, full control over streams |

### Backend (Teammate Reference)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Node.js or Python | Both have Grok SDK support |
| WebSocket | ws (Node) or websockets (Python) | Standard, reliable |
| Voice | Grok Voice WebSocket API | Native integration, low latency |

---

## API Contract (Frontend ↔ Backend)

### WebSocket Messages: Frontend → Backend

```
VOICE_START
  → Start capturing user audio
  
VOICE_AUDIO
  → { audio: base64 chunk }
  
VOICE_END
  → User stopped speaking
  
CANVAS_UPDATE
  → { shapes: [...], summary: "..." }
  
CANVAS_CHANGE
  → { added: [...], modified: [...], deleted: [...] }
```

### WebSocket Messages: Backend → Frontend

```
VOICE_STATE
  → { state: "listening" | "processing" | "speaking" }
  
VOICE_AUDIO
  → { audio: base64 chunk }
  
VOICE_TRANSCRIPT
  → { role: "student" | "tutor", text: "..." }
  
CANVAS_COMMAND
  → { type: "ADD_SHAPE", shape: {...} }
  → { type: "HIGHLIGHT", shapeIds: [...] }
  
TUTOR_STATUS
  → { status: "thinking" | "watching" | "drawing" }
  
ERROR
  → { code: "...", message: "..." }
```

---

## MVP Scope (Hours 0-24)

### Must Have

- [ ] Basic layout: Header, Canvas, Voice Panel
- [ ] tldraw canvas with default drawing tools
- [ ] Voice orb with visual state changes (mock states OK)
- [ ] WebSocket connection to backend
- [ ] Send canvas state to backend on change
- [ ] Receive and play audio from backend
- [ ] Display conversation transcript
- [ ] Tutor status indicator

### Acceptance Criteria

- User can draw on canvas
- User can tap orb to "talk" (even if mocked)
- Canvas changes are sent to backend
- Audio from backend plays through speakers
- UI feels polished and intentional

---

## Nice-to-Have Features (Hours 24-40)

### High Impact

- [ ] **Proactive interruption** — AI comments before user finishes
- [ ] **Audio level visualization** — Orb responds to voice volume
- [ ] **AI cursor** — Show where Grok is "looking" on canvas
- [ ] **Mermaid diagrams** — AI generates step-by-step visuals

### Medium Impact

- [ ] Waveform visualization when Grok speaks
- [ ] Canvas glow effect when AI is engaged
- [ ] Problem selector (pre-loaded math problems)
- [ ] Celebration effect on correct answers

### Lower Priority

- [ ] Settings panel (voice speed, etc.)
- [ ] Session persistence
- [ ] Multiple voice options
- [ ] Keyboard shortcuts

---

## Demo Script Alignment

The architecture must support these three demo moments:

### Moment 1: "The Collaborator" (30s)

**Requirement:** User speaks, AI responds with voice

- WebSocket voice streaming works
- Transcript updates in real-time
- Voice orb animates correctly

### Moment 2: "The Visual Explainer" (30s)

**Requirement:** AI generates diagram while explaining

- Backend sends CANVAS_COMMAND with shapes
- Frontend renders shapes smoothly
- Voice and visuals are synchronized

### Moment 3: "The Proactive Tutor" (30s) — THE WOW

**Requirement:** AI interrupts mid-drawing with insight

- Canvas changes stream to backend continuously
- Backend can push voice without user prompt
- Frontend handles unexpected audio gracefully

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|------------|-------|
| Grok Voice API issues | Test early, have fallback audio clips | Backend |
| Canvas performance | Limit shape count, debounce updates | Frontend |
| WebSocket drops | Auto-reconnect, show status to user | Frontend |
| Audio doesn't play | Require user interaction first (browser policy) | Frontend |
| Demo fails live | Pre-record video backup | Both |

---

## Communication Protocol

### Between Teammates

| Checkpoint | When | Topics |
|------------|------|--------|
| API contract lock | Hour 4 | Finalize message formats |
| First integration | Hour 12 | End-to-end voice working |
| Feature freeze | Hour 24 | Decide what ships |
| Integration testing | Hour 30 | Full flow testing |
| Demo rehearsal | Hour 42 | Practice presentation |

### Slack Check-ins

- Every 3 hours minimum
- Immediate if blocked
- Share screen recordings of progress

---

## Success Metrics

### Technical

- [ ] Voice round-trip < 1 second
- [ ] Canvas updates render < 100ms
- [ ] No crashes during 5-minute demo
- [ ] WebSocket stays connected for 30+ minutes

### Demo

- [ ] All three moments work reliably
- [ ] UI looks professional, not hacky
- [ ] Proactive interruption lands at least once
- [ ] Judges understand the concept in < 15 seconds

### Track Criteria

- [ ] "Would people use this every day?" → Study sessions, yes
- [ ] "Novel use of Grok Voice?" → Proactive visual tutoring, yes

---

## Quick Reference

### Frontend URLs

- Dev: `http://localhost:3000`
- Canvas component: `/components/TutorCanvas`
- Voice component: `/components/VoicePanel`

### Backend URLs (Teammate)

- WebSocket: `ws://localhost:8080`
- Health check: `http://localhost:8080/health`

### Key Files to Coordinate

- `types/messages.ts` — Shared message types
- `hooks/useWebSocket.ts` — Connection logic
- `stores/tutorStore.ts` — State shape

---

*Last updated: Pre-hackathon*
*Next update: Hour 4 (API contract lock)*
