'use client';

import { Settings } from 'lucide-react';
import { ConnectionStatus } from '../ConnectionStatus/ConnectionStatus';

export function Header() {
  return (
    <header className="header">
      <div className="header__logo">
        <span className="header__logo-text">Chalkboard</span>
      </div>

      <div className="header__actions">
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
          padding: var(--space-4) var(--space-6);
          background: #1a1a1a;
          border-bottom: 1px solid #2a2a2a;
        }

        .header__logo {
          display: flex;
          align-items: center;
        }

        .header__logo-text {
          font-family: var(--font-display);
          font-size: 2rem;
          color: var(--text-inverse);
          letter-spacing: 0.02em;
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
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header__settings:hover {
          background: #2a2a2a;
          color: #f9fafb;
        }

        @media (max-width: 768px) {
          .header {
            padding: var(--space-3);
          }

          .header__logo-text {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </header>
  );
}
