'use client';

import { useEffect, useState, useRef } from 'react';

interface AttentionCursorProps {
  x: number | null;
  y: number | null;
  label?: string;
  visible: boolean;
}

export function AttentionCursor({ x, y, label, visible }: AttentionCursorProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const prevPosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (x !== null && y !== null && visible) {
      // Trigger pulse animation when position changes
      const dx = Math.abs((x ?? 0) - prevPosition.current.x);
      const dy = Math.abs((y ?? 0) - prevPosition.current.y);

      if (dx > 5 || dy > 5) {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 600);
        prevPosition.current = { x, y };
        return () => clearTimeout(timer);
      }
    }
  }, [x, y, visible]);

  if (!visible || x === null || y === null) {
    return null;
  }

  return (
    <div
      className={`attention-cursor ${isAnimating ? 'attention-cursor--pulse' : ''}`}
      style={{
        left: x,
        top: y,
      }}
    >
      {/* Outer glow ring */}
      <div className="attention-cursor__outer-ring" />

      {/* Middle ring */}
      <div className="attention-cursor__middle-ring" />

      {/* Inner core */}
      <div className="attention-cursor__core" />

      {/* Crosshair lines */}
      <div className="attention-cursor__crosshair attention-cursor__crosshair--horizontal" />
      <div className="attention-cursor__crosshair attention-cursor__crosshair--vertical" />

      {/* Label */}
      {label && (
        <div className="attention-cursor__label">
          <span>{label}</span>
        </div>
      )}

      <style jsx>{`
        .attention-cursor {
          position: absolute;
          pointer-events: none;
          z-index: 1000;
          transform: translate(-50%, -50%);
          transition: left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                      top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .attention-cursor__outer-ring {
          position: absolute;
          width: 60px;
          height: 60px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          border: 2px solid rgba(99, 102, 241, 0.3);
          animation: outer-pulse 2s ease-in-out infinite;
        }

        .attention-cursor__middle-ring {
          position: absolute;
          width: 40px;
          height: 40px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          border: 2px solid rgba(99, 102, 241, 0.5);
          animation: middle-pulse 2s ease-in-out infinite 0.2s;
        }

        .attention-cursor__core {
          position: absolute;
          width: 16px;
          height: 16px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.9) 0%, rgba(99, 102, 241, 0.4) 100%);
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.6),
                      0 0 40px rgba(99, 102, 241, 0.3);
          animation: core-glow 1.5s ease-in-out infinite;
        }

        .attention-cursor__crosshair {
          position: absolute;
          background: rgba(99, 102, 241, 0.4);
        }

        .attention-cursor__crosshair--horizontal {
          width: 80px;
          height: 1px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
        }

        .attention-cursor__crosshair--vertical {
          width: 1px;
          height: 80px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
        }

        .attention-cursor__label {
          position: absolute;
          top: 45px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(28, 28, 30, 0.9);
          border: 1px solid rgba(99, 102, 241, 0.4);
          border-radius: 8px;
          padding: 6px 12px;
          white-space: nowrap;
          animation: label-fade-in 0.3s ease-out;
        }

        .attention-cursor__label span {
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          text-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
        }

        /* Pulse animation when arriving at new position */
        .attention-cursor--pulse .attention-cursor__outer-ring {
          animation: arrival-pulse 0.6s ease-out;
        }

        .attention-cursor--pulse .attention-cursor__core {
          animation: arrival-core 0.6s ease-out;
        }

        @keyframes outer-pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.5;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.8;
          }
        }

        @keyframes middle-pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.15);
            opacity: 0.9;
          }
        }

        @keyframes core-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.6),
                        0 0 40px rgba(99, 102, 241, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(99, 102, 241, 0.8),
                        0 0 60px rgba(99, 102, 241, 0.5);
          }
        }

        @keyframes arrival-pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.5;
          }
        }

        @keyframes arrival-core {
          0% {
            transform: translate(-50%, -50%) scale(0);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.3);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes label-fade-in {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
