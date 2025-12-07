import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header/Header';
import { TutorCanvas } from './components/TutorCanvas/TutorCanvas';
import { VoicePanel } from './components/VoicePanel/VoicePanel';
import { LandingPage } from './components/LandingPage/LandingPage';
import { CelebrationEffect } from './components/CelebrationEffect/CelebrationEffect';
import { useTutorStore } from './stores/tutorStore';
import { audioService } from './lib/audioService';
import { wsManager } from './lib/wsManager';
import './styles/globals.css';

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const hasConnected = useRef(false);
  const celebration = useTutorStore((state) => state.celebration);
  const clearCelebration = useTutorStore((state) => state.clearCelebration);

  // Handle landing page start - detect sample rate first, then connect
  const handleStart = useCallback(async () => {
    try {
      // Request microphone permission to detect sample rate
      await audioService.requestMicrophonePermission();

      // Create a temporary AudioContext to get native sample rate
      const tempContext = new AudioContext();
      const sampleRate = tempContext.sampleRate;
      tempContext.close();

      console.log(`[App] Detected native sample rate: ${sampleRate}Hz`);

      // Set sample rate before connecting
      wsManager.setSampleRate(sampleRate);

      // Now show the app and connect
      setShowLanding(false);
    } catch (error) {
      console.error('[App] Failed to get microphone permission:', error);
      // Still allow starting, will use default sample rate
      setShowLanding(false);
    }
  }, []);

  // Connect to WebSocket when app loads (after landing page)
  useEffect(() => {
    if (!showLanding && !hasConnected.current) {
      hasConnected.current = true;
      useTutorStore.getState().connect();
    }

    // Only disconnect on actual unmount, not on re-renders
    return () => {
      // Don't disconnect during hot reload
    };
  }, [showLanding]);

  if (showLanding) {
    return <LandingPage onStart={handleStart} />;
  }

  return (
    <div className="tutor-app">
      <Header />

      <main className="tutor-main">
        <TutorCanvas />
      </main>

      <VoicePanel />

      {/* Celebration confetti effect */}
      <CelebrationEffect
        trigger={celebration.active}
        onComplete={clearCelebration}
      />
      
      <style jsx>{`
        .tutor-app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
          background: #1a1a1a;
          overflow: hidden;
        }

        .tutor-app > * {
          animation: reveal 0.6s ease-out both;
        }

        .tutor-app > :nth-child(1) { animation-delay: 0ms; }
        .tutor-app > :nth-child(2) { animation-delay: 100ms; }
        .tutor-app > :nth-child(3) { animation-delay: 200ms; }

        .tutor-main {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

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

        @media (max-width: 768px) {
          .tutor-main {
            /* No padding needed */
          }
        }
      `}</style>
    </div>
  );
}
