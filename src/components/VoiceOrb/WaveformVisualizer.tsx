'use client';

export function WaveformVisualizer() {
  return (
    <div className="waveform-visualizer">
      {[...Array(5)].map((_, i) => (
        <div 
          key={i}
          className="waveform-bar"
          style={{
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
      
      <style jsx>{`
        .waveform-visualizer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          height: 32px;
        }
        
        .waveform-bar {
          width: 3px;
          height: 8px;
          background: var(--accent-primary);
          border-radius: 2px;
          animation: waveform 0.6s ease-in-out infinite alternate;
        }
        
        @keyframes waveform {
          0% {
            height: 8px;
            opacity: 0.7;
          }
          100% {
            height: 24px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
