'use client';

import { cn } from '@/lib/cn';
import { TutorState } from '@/types';

export function TutorStatus({ state }: { state: TutorState }) {
  const getStatusText = () => {
    switch (state.type) {
      case 'idle':
        return 'Ready to help';
      case 'listening':
        return 'Listening...';
      case 'thinking':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking';
      case 'watching':
        return `Looking at ${state.focus}`;
      case 'drawing':
        return 'Adding to canvas...';
      default:
        return 'Ready';
    }
  };

  return (
    <div className={cn("tutor-status", `tutor-status--${state.type}`)}>
      <div className="tutor-status__indicator" />
      <span className="tutor-status__text">
        {getStatusText()}
      </span>
      
      <style jsx>{`
        .tutor-status {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          background: var(--voice-surface);
          font-size: var(--text-sm);
          color: var(--text-muted);
          white-space: nowrap;
        }

        .tutor-status__indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
          transition: background 0.3s ease;
          flex-shrink: 0;
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

        .tutor-status--drawing .tutor-status__indicator {
          background: var(--accent-primary);
          animation: pulse 0.6s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
