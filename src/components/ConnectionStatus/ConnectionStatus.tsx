'use client';

import { useTutorStore } from '@/stores/tutorStore';

export function ConnectionStatus() {
  const connectionStatus = useTutorStore((state) => state.connectionStatus);
  const isMockMode = useTutorStore((state) => state.isMockMode);
  const setMockMode = useTutorStore((state) => state.setMockMode);

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
      <span className="connection-status__text">
        {isMockMode ? 'Mock' : label}
      </span>
      <button
        onClick={() => setMockMode(!isMockMode)}
        className="connection-status__toggle"
        title={isMockMode ? 'Switch to real WebSocket' : 'Switch to mock mode'}
      >
        {isMockMode ? 'Real' : 'Mock'}
      </button>

      <style jsx>{`
        .connection-status {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-1) var(--space-2);
          background: rgba(0, 0, 0, 0.03);
          border-radius: var(--radius-sm);
          font-size: var(--text-xs);
          color: var(--text-secondary);
        }

        .connection-status__indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .connection-status__text {
          min-width: 60px;
        }

        .connection-status__toggle {
          padding: var(--space-1) var(--space-2);
          background: transparent;
          border: 1px solid var(--canvas-grid);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          font-size: var(--text-xs);
          font-family: var(--font-body);
          transition: all 0.2s ease;
        }

        .connection-status__toggle:hover {
          background: var(--canvas-grid);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
