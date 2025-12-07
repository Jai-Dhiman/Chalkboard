'use client';

import { useTutorStore } from '@/stores/tutorStore';

export function ConnectionStatus() {
  const connectionStatus = useTutorStore((state) => state.connectionStatus);

  const statusConfig = {
    connected: { color: 'var(--accent-success)', label: 'Connected' },
    connecting: { color: 'var(--accent-warning)', label: 'Connecting' },
    disconnected: { color: 'var(--text-muted)', label: 'Disconnected' },
    error: { color: 'var(--accent-error)', label: 'Error' },
  };

  const { color, label } = statusConfig[connectionStatus];

  return (
    <div className="connection-status">
      <div className="connection-status__indicator" style={{ background: color }} />
      <span className="connection-status__text">{label}</span>

      <style jsx>{`
        .connection-status {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          color: rgba(255, 255, 255, 0.8);
        }

        .connection-status__indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .connection-status__text {
          min-width: 70px;
          font-weight: 500;
          letter-spacing: 0.01em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
