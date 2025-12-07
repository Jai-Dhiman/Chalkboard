'use client';

import { BookOpen, Settings } from 'lucide-react';
import { ConnectionStatus } from '../ConnectionStatus/ConnectionStatus';

export function Header() {
  return (
    <header className="header">
      <div className="header__logo">
        <BookOpen className="header__logo-icon" />
        <span className="header__logo-text">Grok Math Tutor</span>
      </div>

      <div className="header__center">
        <select className="header__problem-selector">
          <option>Quadratic Equations</option>
          <option>Linear Functions</option>
          <option>Trigonometry</option>
          <option>Calculus Basics</option>
        </select>
      </div>

      <div className="header__actions">
        <ConnectionStatus />
        <button className="header__settings" aria-label="Settings">
          <Settings className="w-5 h-5" />
        </button>
      </div>
      
      <style jsx>{`
        .header {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-4) var(--space-6);
          background: var(--canvas-bg);
          border-bottom: 1px solid var(--canvas-grid);
        }

        .header__logo {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .header__logo-icon {
          width: 24px;
          height: 24px;
          color: var(--accent-primary);
        }

        .header__logo-text {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .header__center {
          justify-self: center;
        }

        .header__problem-selector {
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          border: 1px solid var(--canvas-grid);
          background: white;
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: var(--text-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .header__problem-selector:hover {
          border-color: var(--accent-primary);
          box-shadow: var(--shadow-sm);
        }

        .header__problem-selector:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .header__actions {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .header__settings {
          padding: var(--space-2);
          border-radius: var(--radius-md);
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header__settings:hover {
          background: var(--canvas-grid);
          color: var(--text-primary);
        }

        @media (max-width: 768px) {
          .header {
            grid-template-columns: auto 1fr auto;
            padding: var(--space-3);
          }

          .header__center {
            justify-self: start;
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .header__problem-selector {
            width: 100%;
          }
        }
      `}</style>
    </header>
  );
}
