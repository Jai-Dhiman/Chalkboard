'use client';

import { cn } from '@/lib/cn';
import { VoiceState } from '@/types';
import { WaveformVisualizer } from './WaveformVisualizer';
import { AudioLevelRing } from './AudioLevelRing';
import { ProcessingDots } from './ProcessingDots';
import { Mic } from 'lucide-react';

interface VoiceOrbProps {
  state: VoiceState;
  audioLevel?: number;
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
        {(state === 'idle' || state === 'interrupted') && (
          <Mic className="w-8 h-8" style={{ color: 'var(--text-inverse)' }} />
        )}
      </div>
      
      {/* Ripple effect on interaction */}
      <div className="voice-orb__ripple" />
      
      <style jsx>{`
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
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .voice-orb:hover {
          transform: scale(1.05);
        }

        .voice-orb__glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          border-radius: var(--radius-full);
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .voice-orb__core {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }

        .voice-orb__ripple {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          border-radius: var(--radius-full);
          opacity: 0;
          pointer-events: none;
        }

        .voice-orb:active .voice-orb__ripple {
          animation: ripple 0.6s ease-out;
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
            transform: translate(-50%, -50%) scale(1);
          }
          50% { 
            box-shadow: 0 0 30px var(--glow-color), 0 0 60px var(--glow-color); 
            transform: translate(-50%, -50%) scale(1.1);
          }
        }

        /* Processing: gentle pulse */
        .voice-orb--processing .voice-orb__core {
          animation: gentle-pulse 1.5s ease-in-out infinite;
        }

        @keyframes gentle-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
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

        @keyframes glow-breathe {
          0%, 100% { 
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1.2);
          }
          50% { 
            opacity: 0.9;
            transform: translate(-50%, -50%) scale(1.4);
          }
        }

        @keyframes ripple {
          0% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(2);
            box-shadow: 0 0 0 2px var(--accent-primary);
          }
        }
      `}</style>
    </button>
  );
}
