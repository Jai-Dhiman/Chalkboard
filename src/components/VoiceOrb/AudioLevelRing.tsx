'use client';

interface AudioLevelRingProps {
  level: number; // 0-1
}

export function AudioLevelRing({ level }: AudioLevelRingProps) {
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - level * circumference;

  return (
    <svg width="64" height="64" className="audio-level-ring">
      <circle
        cx="32"
        cy="32"
        r="32"
        fill="none"
        stroke="var(--accent-primary)"
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
          transition: 'stroke-dashoffset 0.1s ease',
        }}
      />
      
      <style jsx>{`
        .audio-level-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          opacity: 0.6;
        }
      `}</style>
    </svg>
  );
}
