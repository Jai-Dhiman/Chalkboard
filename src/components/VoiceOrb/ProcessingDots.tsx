'use client';

export function ProcessingDots() {
  return (
    <div className="processing-dots">
      {[...Array(3)].map((_, i) => (
        <div 
          key={i}
          className="processing-dot"
          style={{
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      
      <style jsx>{`
        .processing-dots {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        
        .processing-dot {
          width: 8px;
          height: 8px;
          background: var(--accent-warning);
          border-radius: 50%;
          animation: pulse-dot 1s ease-in-out infinite;
        }
        
        @keyframes pulse-dot {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
