'use client';

import { Settings } from 'lucide-react';
import { ConnectionStatus } from '../ConnectionStatus/ConnectionStatus';
import { TutorStatus } from '../TutorStatus/TutorStatus';
import { useVoice } from '@/hooks/useVoice';

export function Header() {
  const { tutorState } = useVoice();

  return (
    <header className="header">
      <div className="header__logo">
        <span className="header__logo-text">Chalkboard</span>
      </div>

      <div className="header__actions">
        <TutorStatus state={tutorState} />
        <ConnectionStatus />
        <button className="header__settings" aria-label="Settings">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <style jsx>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-2) var(--space-6);
          background: url('/header.png') center/cover no-repeat;
          background-color: #1a1a1a;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          position: relative;
        }

        .header__logo {
          display: flex;
          align-items: center;
        }

        .header__logo-text {
          font-family: var(--font-display);
          font-size: 1.5rem;
          color: var(--text-inverse);
          letter-spacing: 0.02em;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        }

        .header__actions {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .header__settings {
          padding: var(--space-2);
          border-radius: var(--radius-md);
          border: none;
          background: rgba(0, 0, 0, 0.3);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.8;
        }

        .header__settings:hover {
          background: rgba(0, 0, 0, 0.5);
          color: var(--text-inverse);
          opacity: 1;
        }

        @media (max-width: 768px) {
          .header {
            padding: var(--space-3) var(--space-4);
          }

          .header__logo-text {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </header>
  );
}
