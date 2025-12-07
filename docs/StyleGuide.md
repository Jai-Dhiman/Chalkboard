# Voice AI Math Tutor — Frontend Architecture

## Design Philosophy

**Aesthetic Direction: "Calm Confidence"**

Think: A patient teacher's desk — warm, focused, unhurried. The UI should feel like a *safe space to make mistakes* while learning. Not flashy, not gamified, not sterile. **Quietly beautiful.**

**The One Memorable Thing:** When Grok speaks, the entire UI breathes — subtle ambient responses that make voice feel *present* in the space, not just audio playing.

---

## Design System

### Color Palette

```css
:root {
  /* Canvas — where learning happens */
  --canvas-bg: #FDFCFA;           /* Warm off-white, like quality paper */
  --canvas-grid: #F0EDE8;          /* Subtle grid lines */
  
  /* Voice Panel — where Grok lives */
  --voice-bg: #1C1C1E;             /* Deep charcoal */
  --voice-surface: #2C2C2E;        /* Elevated surface */
  --voice-glow: rgba(99, 102, 241, 0.4);  /* Indigo glow when speaking */
  
  /* Accents */
  --accent-primary: #6366F1;       /* Indigo — Grok's color */
  --accent-success: #34D399;       /* Mint — correct/encouraging */
  --accent-warning: #FBBF24;       /* Amber — gentle attention */
  --accent-error: #F87171;         /* Soft red — errors */
  
  /* Text */
  --text-primary: #1F2937;         /* Near black */
  --text-secondary: #6B7280;       /* Muted */
  --text-inverse: #F9FAFB;         /* On dark backgrounds */
  --text-muted: #9CA3AF;
  
  /* Math-specific */
  --math-ink: #1E3A5F;             /* Deep blue for equations */
  --math-annotation: #6366F1;      /* Indigo for tutor annotations */
  --math-student: #374151;         /* Student's work */
  
  /* Shadows & Depth */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.12);
  --shadow-glow: 0 0 40px var(--voice-glow);
}
```

### Typography

```css
/* 
 * Display: Fraunces — warm, friendly, slightly quirky serifs
 * Body: DM Sans — clean, geometric, excellent readability
 * Math: JetBrains Mono — clear monospace for equations
 */

@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
  
  /* Scale */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 2rem;        /* 32px */
}
```

### Spacing

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.5rem;    /* 24px */
  --space-6: 2rem;      /* 32px */
  --space-8: 3rem;      /* 48px */
  --space-10: 4rem;     /* 64px */
}
```

### Border Radius

```css
:root {
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;
}
```

---

## Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Header                                      │
│  Logo                                    Problem Selector    Settings   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                                                                         │
│                                                                         │
│                         CANVAS AREA                                     │
│                      (tldraw instance)                                  │
│                                                                         │
│                    The main workspace where                             │
│                    student + AI collaborate                             │
│                                                                         │
│                                                                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         VOICE PANEL                                     │
│                                                                         │
│     Transcript        [  Voice Orb  ]        Tutor Status              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

```css
/* Mobile-first, but optimized for tablet/desktop (primary use case) */
--bp-sm: 640px;
--bp-md: 768px;
--bp-lg: 1024px;
--bp-xl: 1280px;
```

---

## Component Hierarchy

```
App
├── Header
│   ├── Logo
│   ├── ProblemSelector (dropdown)
│   └── SettingsButton
│
├── CanvasArea
│   ├── TldrawCanvas
│   │   ├── Custom Tools (equation, step-diagram)
│   │   └── AI Cursor (shows where Grok is "looking")
│   ├── CanvasToolbar (floating)
│   └── ZoomControls
│
├── VoicePanel
│   ├── TranscriptFeed (left)
│   ├── VoiceOrb (center) ← THE HERO ELEMENT
│   └── TutorStatus (right)
│
└── Overlays
    ├── OnboardingModal
    ├── HintToast
    └── CelebrationEffect
```

---

## Core Components

### 1. VoiceOrb — The Hero Element

The voice orb is the emotional center of the app. It should feel *alive*.

**States:**

- `idle` — Subtle breathing animation, waiting
- `listening` — Expands slightly, ripple effect, shows user's audio levels
- `processing` — Gentle pulse, thinking
- `speaking` — Organic waveform animation, Grok is present
- `interrupted` — Quick fade, user took over

```tsx
// components/VoiceOrb/VoiceOrb.tsx

interface VoiceOrbProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking' | 'interrupted';
  audioLevel?: number; // 0-1, for visualization
  onPress: () => void;
}

export function VoiceOrb({ state, audioLevel = 0, onPress }: VoiceOrbProps) {
  return (
    <button 
      onClick={onPress}
      className={cn(
        "voice-orb",
        `voice-orb--${state}`
      )}
      aria-label={state === 'listening' ? 'Stop listening' : 'Start talking'}
    >
      {/* Outer glow ring */}
      <div className="voice-orb__glow" />
      
      {/* Main orb */}
      <div className="voice-orb__core">
        {state === 'speaking' && <WaveformVisualizer />}
        {state === 'listening' && <AudioLevelRing level={audioLevel} />}
        {state === 'processing' && <ProcessingDots />}
        {state === 'idle' && <MicrophoneIcon />}
      </div>
      
      {/* Ripple effect on interaction */}
      <div className="voice-orb__ripple" />
    </button>
  );
}
```

**CSS Animation (the magic):**

```css
.voice-orb {
  --orb-size: 80px;
  --glow-color: var(--accent-primary);
  
  position: relative;
  width: var(--orb-size);
  height: var(--orb-size);
  border-radius: var(--radius-full);
  background: var(--voice-surface);
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.voice-orb:hover {
  transform: scale(1.05);
}

/* Idle: subtle breathing */
.voice-orb--idle .voice-orb__core {
  animation: breathe 4s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.02); opacity: 1; }
}

/* Listening: expanded, active */
.voice-orb--listening {
  --orb-size: 96px;
}

.voice-orb--listening .voice-orb__glow {
  opacity: 1;
  animation: pulse-glow 1.5s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { 
    box-shadow: 0 0 20px var(--glow-color), 0 0 40px var(--glow-color); 
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 30px var(--glow-color), 0 0 60px var(--glow-color); 
    transform: scale(1.1);
  }
}

/* Speaking: alive, organic movement */
.voice-orb--speaking .voice-orb__core {
  animation: speak-pulse 0.15s ease-in-out infinite alternate;
}

.voice-orb--speaking .voice-orb__glow {
  opacity: 1;
  background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%);
  animation: glow-breathe 2s ease-in-out infinite;
}

@keyframes speak-pulse {
  from { transform: scale(1); }
  to { transform: scale(1.03); }
}
```

---

### 2. TranscriptFeed

Shows the conversation flow — who said what.

```tsx
// components/TranscriptFeed/TranscriptFeed.tsx

interface Message {
  id: string;
  role: 'student' | 'tutor';
  content: string;
  timestamp: Date;
}

export function TranscriptFeed({ messages }: { messages: Message[] }) {
  const feedRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to latest
  useEffect(() => {
    feedRef.current?.scrollTo({ 
      top: feedRef.current.scrollHeight, 
      behavior: 'smooth' 
    });
  }, [messages]);
  
  return (
    <div className="transcript-feed" ref={feedRef}>
      {messages.map((msg, i) => (
        <div 
          key={msg.id}
          className={cn(
            "transcript-message",
            `transcript-message--${msg.role}`
          )}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <span className="transcript-message__role">
            {msg.role === 'tutor' ? 'Grok' : 'You'}
          </span>
          <p className="transcript-message__content">{msg.content}</p>
        </div>
      ))}
    </div>
  );
}
```

```css
.transcript-feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 120px;
  overflow-y: auto;
  padding: var(--space-4);
  
  /* Fade at top */
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 20%,
    black 100%
  );
}

.transcript-message {
  animation: fade-in-up 0.3s ease-out both;
}

.transcript-message--tutor {
  color: var(--accent-primary);
}

.transcript-message--student {
  color: var(--text-muted);
}

.transcript-message__role {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
}

.transcript-message__content {
  font-size: var(--text-sm);
  line-height: 1.5;
  margin: 0;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

### 3. TutorStatus

Shows what Grok is currently doing — creates a sense of presence.

```tsx
// components/TutorStatus/TutorStatus.tsx

type TutorState = 
  | { type: 'idle' }
  | { type: 'listening' }
  | { type: 'thinking' }
  | { type: 'speaking'; message?: string }
  | { type: 'watching'; focus: string }
  | { type: 'drawing' };

export function TutorStatus({ state }: { state: TutorState }) {
  const statusText = {
    idle: 'Ready to help',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Speaking',
    watching: `Looking at ${state.type === 'watching' ? state.focus : ''}`,
    drawing: 'Adding to canvas...',
  };

  return (
    <div className={cn("tutor-status", `tutor-status--${state.type}`)}>
      <div className="tutor-status__indicator" />
      <span className="tutor-status__text">
        {statusText[state.type]}
      </span>
    </div>
  );
}
```

```css
.tutor-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  background: var(--voice-surface);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.tutor-status__indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: background 0.3s ease;
}

.tutor-status--listening .tutor-status__indicator {
  background: var(--accent-success);
  animation: pulse 1s ease-in-out infinite;
}

.tutor-status--speaking .tutor-status__indicator {
  background: var(--accent-primary);
  animation: pulse 0.5s ease-in-out infinite;
}

.tutor-status--thinking .tutor-status__indicator {
  background: var(--accent-warning);
  animation: pulse 0.8s ease-in-out infinite;
}

.tutor-status--watching .tutor-status__indicator {
  background: var(--accent-primary);
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}
```

---

### 4. Canvas Integration (tldraw)

```tsx
// components/TutorCanvas/TutorCanvas.tsx

'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { Editor } from 'tldraw';

// Must dynamic import to avoid SSR issues
const Tldraw = dynamic(
  () => import('tldraw').then((mod) => mod.Tldraw),
  { ssr: false }
);

interface TutorCanvasProps {
  onCanvasChange?: (elements: any[]) => void;
}

export function TutorCanvas({ onCanvasChange }: TutorCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  
  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor);
    
    // Subscribe to changes
    editor.store.listen((entry) => {
      if (entry.source === 'user') {
        const shapes = editor.getCurrentPageShapes();
        onCanvasChange?.(shapes);
      }
    });
  }, [onCanvasChange]);

  return (
    <div className="tutor-canvas">
      <Tldraw
        onMount={handleMount}
        hideUi={false}
        components={{
          // Custom components can be added here
        }}
      />
      
      {/* Floating toolbar overlay */}
      <div className="tutor-canvas__toolbar">
        <CanvasToolbar editor={editor} />
      </div>
    </div>
  );
}
```

```css
.tutor-canvas {
  position: relative;
  flex: 1;
  background: var(--canvas-bg);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

/* Override tldraw defaults for our aesthetic */
.tutor-canvas .tl-background {
  background-color: var(--canvas-bg) !important;
}

.tutor-canvas .tl-grid {
  opacity: 0.3;
}

.tutor-canvas__toolbar {
  position: absolute;
  bottom: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
}
```

---

### 5. VoicePanel (Container)

```tsx
// components/VoicePanel/VoicePanel.tsx

export function VoicePanel() {
  const { 
    voiceState, 
    messages, 
    tutorState,
    audioLevel,
    toggleVoice 
  } = useVoice();

  return (
    <div className="voice-panel">
      <div className="voice-panel__transcript">
        <TranscriptFeed messages={messages} />
      </div>
      
      <div className="voice-panel__orb">
        <VoiceOrb 
          state={voiceState}
          audioLevel={audioLevel}
          onPress={toggleVoice}
        />
        <span className="voice-panel__hint">
          {voiceState === 'idle' ? 'Tap to talk' : ''}
        </span>
      </div>
      
      <div className="voice-panel__status">
        <TutorStatus state={tutorState} />
      </div>
    </div>
  );
}
```

```css
.voice-panel {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  background: var(--voice-bg);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.voice-panel__transcript {
  justify-self: start;
  max-width: 300px;
}

.voice-panel__orb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.voice-panel__hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  opacity: 0.6;
}

.voice-panel__status {
  justify-self: end;
}
```

---

## Page Layout

```tsx
// app/page.tsx

export default function TutorPage() {
  return (
    <div className="tutor-app">
      <Header />
      
      <main className="tutor-main">
        <TutorCanvas />
      </main>
      
      <VoicePanel />
    </div>
  );
}
```

```css
.tutor-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh; /* Mobile viewport fix */
  background: var(--canvas-bg);
  overflow: hidden;
}

.tutor-main {
  flex: 1;
  padding: var(--space-4);
  padding-bottom: 0;
  min-height: 0; /* Flex child overflow fix */
}
```

---

## Micro-interactions & Polish

### 1. Page Load Animation

```css
/* Staggered reveal on load */
.tutor-app > * {
  animation: reveal 0.6s ease-out both;
}

.tutor-app > :nth-child(1) { animation-delay: 0ms; }
.tutor-app > :nth-child(2) { animation-delay: 100ms; }
.tutor-app > :nth-child(3) { animation-delay: 200ms; }

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 2. Canvas Ambient Response

When Grok speaks, the canvas subtly responds:

```css
/* Apply to canvas wrapper when voice is speaking */
.tutor-canvas--voice-active {
  box-shadow: 
    var(--shadow-md),
    0 0 60px rgba(99, 102, 241, 0.1);
  transition: box-shadow 0.5s ease;
}
```

### 3. Success Celebration

```tsx
// components/CelebrationEffect/CelebrationEffect.tsx

export function CelebrationEffect({ show }: { show: boolean }) {
  if (!show) return null;
  
  return (
    <div className="celebration">
      {/* Confetti particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div 
          key={i} 
          className="celebration__particle"
          style={{
            '--delay': `${i * 50}ms`,
            '--x': `${Math.random() * 100}%`,
            '--rotation': `${Math.random() * 360}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
```

---

## File Structure

```
src/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
│
├── components/
│   ├── Header/
│   │   ├── Header.tsx
│   │   └── Header.css
│   │
│   ├── VoicePanel/
│   │   ├── VoicePanel.tsx
│   │   └── VoicePanel.css
│   │
│   ├── VoiceOrb/
│   │   ├── VoiceOrb.tsx
│   │   ├── VoiceOrb.css
│   │   ├── WaveformVisualizer.tsx
│   │   └── AudioLevelRing.tsx
│   │
│   ├── TranscriptFeed/
│   │   ├── TranscriptFeed.tsx
│   │   └── TranscriptFeed.css
│   │
│   ├── TutorStatus/
│   │   ├── TutorStatus.tsx
│   │   └── TutorStatus.css
│   │
│   ├── TutorCanvas/
│   │   ├── TutorCanvas.tsx
│   │   ├── TutorCanvas.css
│   │   └── CanvasToolbar.tsx
│   │
│   └── ui/
│       ├── Button.tsx
│       └── Icon.tsx
│
├── hooks/
│   ├── useVoice.ts           # Voice state management
│   ├── useCanvas.ts          # Canvas state + summarization
│   └── useWebSocket.ts       # Connection to backend
│
├── lib/
│   ├── cn.ts                 # classNames utility
│   └── constants.ts
│
├── stores/
│   └── tutorStore.ts         # Zustand store
│
└── types/
    └── index.ts
```

---

## MVP vs Nice-to-Have

### MVP (Build First — Hours 0-24)

- [ ] Basic layout (header, canvas, voice panel)
- [ ] tldraw canvas integration (default tools)
- [ ] VoiceOrb with state animations
- [ ] Mock voice states (simulate listening/speaking)
- [ ] Static transcript feed
- [ ] Tutor status indicator
- [ ] Design system applied (colors, typography)

### Nice-to-Have (Hours 24-40)

- [ ] Real Grok Voice integration
- [ ] Audio level visualization on orb
- [ ] Waveform visualizer when speaking
- [ ] Canvas ambient glow when AI speaks
- [ ] AI cursor showing where Grok is "looking"
- [ ] Proactive interruption (AI speaks mid-draw)
- [ ] Celebration effects on correct answers
- [ ] Problem selector dropdown
- [ ] Settings panel

### Polish Pass (Hours 40-48)

- [ ] Page load animations
- [ ] Transition refinements
- [ ] Mobile responsiveness check
- [ ] Demo flow hardening
- [ ] Loading states
- [ ] Error states

---

## Quick Start Commands

```bash
# Create Next.js app
npx create-next-app@latest voice-math-tutor --typescript --tailwind --eslint --app

# Install dependencies
cd voice-math-tutor
npm install tldraw zustand

# Add Google Fonts to layout.tsx or use next/font
# Start dev server
npm run dev
```

---

## Design Principles Checklist

Before calling any component "done":

- [ ] **Typography**: Using Fraunces + DM Sans, not defaults?
- [ ] **Color**: Using our palette, not arbitrary values?
- [ ] **Spacing**: Using spacing scale, not random pixels?
- [ ] **Animation**: Has appropriate motion, not static?
- [ ] **States**: All states designed (hover, active, disabled, loading)?
- [ ] **Accessibility**: Proper aria labels, focus states?
- [ ] **Polish**: Would I be proud to show this to judges?

---

## The "Wow" Moment Reminder

When judges see this, they should feel:

1. **"This looks professional"** — Not a hackathon throwaway
2. **"The voice feels alive"** — The orb animations make Grok feel present
3. **"I want to use this"** — Calm, inviting, not intimidating

The one thing they'll remember: **"The one where the AI felt like it was actually there, watching and helping."**

---

Good luck. Build something beautiful. 🎨
