'use client';

import { useVoice } from '@/hooks/useVoice';
import { GlassVoiceButton } from '../GlassVoiceButton';
import { TranscriptFeed } from '../TranscriptFeed/TranscriptFeed';

export function VoicePanel() {
  const {
    voiceState,
    messages,
    audioLevel,
    toggleVoice,
  } = useVoice();

  return (
    <div className="voice-panel">
      <div className="voice-panel__left">
        <TranscriptFeed messages={messages} />
      </div>

      <div className="voice-panel__center">
        {/* Subtle glow background for visual focus */}
        <div className="voice-panel__orb-glow" />
        <GlassVoiceButton
          state={voiceState}
          audioLevel={audioLevel}
          onPress={toggleVoice}
        />
      </div>

      <div className="voice-panel__right">
        {/* Empty for balance */}
      </div>

      <style jsx>{`
        .voice-panel {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: var(--space-4);
          padding: 0 var(--space-6);
          height: 120px;
          background-image: url('/footer.png');
          background-position: center bottom;
          background-size: cover;
          background-repeat: no-repeat;
          background-color: #2a2520;
          position: relative;
        }

        .voice-panel__left {
          justify-self: start;
          max-width: 350px;
          width: 100%;
          z-index: 2;
        }

        .voice-panel__center {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
        }

        .voice-panel__orb-glow {
          position: absolute;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: radial-gradient(
            ellipse at center,
            rgba(99, 102, 241, 0.2) 0%,
            rgba(99, 102, 241, 0.08) 40%,
            transparent 70%
          );
          pointer-events: none;
          z-index: 0;
        }

        .voice-panel__right {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          z-index: 2;
        }

        @media (max-width: 768px) {
          .voice-panel {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto;
            gap: var(--space-2);
            padding: var(--space-2);
            height: auto;
            align-items: center;
          }

          .voice-panel__left,
          .voice-panel__right {
            justify-self: center;
            max-width: 100%;
          }

          .voice-panel__right {
            flex-direction: row;
            justify-content: center;
          }

          .voice-panel__orb-glow {
            width: 80px;
            height: 80px;
          }
        }
      `}</style>
    </div>
  );
}
