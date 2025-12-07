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
          color: 'rgba(255, 255, 255, 0.5)',
          fontStyle: 'italic',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
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
            `transcript-message--${msg.role}`,
            msg.isOptimistic && "transcript-message--optimistic"
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
          justify-content: flex-start;
          height: 80px;
          padding: var(--space-2) var(--space-3);
          background: rgba(0, 0, 0, 0.4);
          border-radius: var(--radius-md);
          backdrop-filter: blur(8px);
        }

        .transcript-feed {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          max-height: 80px;
          overflow-y: auto;
          padding: var(--space-2) var(--space-3);
          background: rgba(0, 0, 0, 0.4);
          border-radius: var(--radius-md);
          backdrop-filter: blur(8px);

          /* Fade at top */
          mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            black 15%,
            black 100%
          );
          -webkit-mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            black 15%,
            black 100%
          );
        }

        .transcript-message {
          animation: fade-in-up 0.3s ease-out both;
        }

        .transcript-message--tutor {
          color: #a5b4fc;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .transcript-message--student {
          color: rgba(255, 255, 255, 0.7);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .transcript-message--optimistic {
          opacity: 0.5;
          animation: pulse-opacity 1.5s ease-in-out infinite;
        }

        .transcript-message--optimistic .transcript-message__content {
          font-style: italic;
        }

        @keyframes pulse-opacity {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        .transcript-message__role {
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.8;
          display: block;
          margin-bottom: 2px;
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
