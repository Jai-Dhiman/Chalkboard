'use client';

import { useState, useCallback, FormEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useVoice } from '@/hooks/useVoice';
import { useMathTutor } from '@/hooks/useMathTutor';
import { GlassVoiceButton } from '../GlassVoiceButton';
import { TranscriptFeed } from '../TranscriptFeed/TranscriptFeed';
import { TutorStatus } from '../TutorStatus/TutorStatus';

export function VoicePanel() {
  const [textInput, setTextInput] = useState('');
  const { submitRequest, isProcessing, isConfigured } = useMathTutor();

  const {
    voiceState,
    messages,
    tutorState,
    audioLevel,
    toggleVoice,
  } = useVoice();

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!textInput.trim() || isProcessing) return;

      const request = textInput.trim();
      setTextInput('');

      try {
        await submitRequest(request);
      } catch {
        // Error already handled in hook
      }
    },
    [textInput, isProcessing, submitRequest]
  );

  return (
    <div className="voice-panel">
      <div className="voice-panel__left">
        <TranscriptFeed messages={messages} />
      </div>

      <div className="voice-panel__center">
        <GlassVoiceButton
          state={voiceState}
          audioLevel={audioLevel}
          onPress={toggleVoice}
        />
        <span className="voice-panel__hint">
          {voiceState === 'idle' ? 'Tap to talk' : ''}
        </span>

        <form onSubmit={handleSubmit} className="voice-panel__input-form">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={isConfigured ? "Try: Create 4 quadratic equations" : "Set VITE_GROK_API_KEY in .env"}
            className="voice-panel__input"
            disabled={isProcessing || !isConfigured}
          />
          <button
            type="submit"
            className="voice-panel__send"
            aria-label="Send"
            disabled={isProcessing || !isConfigured}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>

      <div className="voice-panel__right">
        <TutorStatus state={tutorState} />
      </div>

      <style jsx>{`
        .voice-panel {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-4) var(--space-6);
          background: var(--voice-bg);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .voice-panel__left {
          justify-self: start;
          max-width: 300px;
          width: 100%;
        }

        .voice-panel__center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
        }

        .voice-panel__hint {
          font-size: var(--text-xs);
          color: var(--text-muted);
          opacity: 0.6;
          transition: opacity 0.3s ease;
        }

        .voice-panel__input-form {
          display: flex;
          gap: var(--space-2);
          width: 100%;
          max-width: 320px;
        }

        .voice-panel__input {
          flex: 1;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: var(--voice-surface);
          color: var(--text-inverse);
          font-family: var(--font-body);
          font-size: var(--text-sm);
          outline: none;
          transition: border-color 0.2s ease;
        }

        .voice-panel__input::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }

        .voice-panel__input:focus {
          border-color: var(--accent-primary);
        }

        .voice-panel__send {
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          border: none;
          background: var(--accent-primary);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s ease;
        }

        .voice-panel__send:hover:not(:disabled) {
          opacity: 0.9;
        }

        .voice-panel__send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .voice-panel__input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .voice-panel__right {
          justify-self: end;
        }

        @media (max-width: 768px) {
          .voice-panel {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto;
            gap: var(--space-3);
            padding: var(--space-3);
          }

          .voice-panel__left,
          .voice-panel__right {
            justify-self: center;
            max-width: 100%;
          }

          .voice-panel__input-form {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
