import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header/Header';
import { TutorCanvas } from './components/TutorCanvas/TutorCanvas';
import { VoicePanel } from './components/VoicePanel/VoicePanel';
import { LandingPage } from './components/LandingPage/LandingPage';
import { useTutorStore } from './stores/tutorStore';
import './styles/globals.css';

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const hasConnected = useRef(false);

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
    return <LandingPage onStart={() => setShowLanding(false)} />;
  }

  return (
    <div className="tutor-app">
      <Header />

      <main className="tutor-main">
        <TutorCanvas />
      </main>

      <VoicePanel />
      
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
