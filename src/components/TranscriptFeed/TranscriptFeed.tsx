'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { Message } from '@/types';

export function TranscriptFeed({ messages }: { messages: Message[] }) {
  const feedRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to latest
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ 
        top: feedRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
    }
  }, [messages]);
  
  if (messages.length === 0) {
    return (
      <div className="transcript-empty">
        <p style={{ 
          fontSize: 'var(--text-sm)', 
          color: 'var(--text-muted)',
          fontStyle: 'italic'
        }}>
          Conversation will appear here...
        </p>
      </div>
    );
  }
  
  return (
    <div className="transcript-feed" ref={feedRef}>
      {messages.map((msg, i) => (
        <div 
          key={msg.id}
          className={cn(
            "transcript-message",
            `transcript-message--${msg.role}`
          )}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <span className="transcript-message__role">
            {msg.role === 'tutor' ? 'Grok' : 'You'}
          </span>
          <p className="transcript-message__content">{msg.content}</p>
        </div>
      ))}
      
      <style jsx>{`
        .transcript-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 120px;
        }

        .transcript-feed {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          max-height: 120px;
          overflow-y: auto;
          padding: var(--space-4);
          
          /* Fade at top */
          mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            black 20%,
            black 100%
          );
          -webkit-mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            black 20%,
            black 100%
          );
        }

        .transcript-message {
          animation: fade-in-up 0.3s ease-out both;
        }

        .transcript-message--tutor {
          color: var(--accent-primary);
        }

        .transcript-message--student {
          color: var(--text-muted);
        }

        .transcript-message__role {
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.6;
          display: block;
          margin-bottom: var(--space-1);
        }

        .transcript-message__content {
          font-size: var(--text-sm);
          line-height: 1.5;
          margin: 0;
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
