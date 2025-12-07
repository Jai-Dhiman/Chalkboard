import { useCallback, useEffect, useRef } from 'react';
import { useTutorStore } from '@/stores/tutorStore';
import { useWebSocket } from './useWebSocket';
import { audioService } from '@/lib/audioService';

export function useVoice() {
  const { send } = useWebSocket();
  const isRecordingRef = useRef(false);

  const voiceState = useTutorStore((state) => state.voiceState);
  const tutorState = useTutorStore((state) => state.tutorState);
  const audioLevel = useTutorStore((state) => state.audioLevel);
  const messages = useTutorStore((state) => state.messages);
  const setVoiceState = useTutorStore((state) => state.setVoiceState);
  const setAudioLevel = useTutorStore((state) => state.setAudioLevel);
  const setTutorState = useTutorStore((state) => state.setTutorState);
  const connectionStatus = useTutorStore((state) => state.connectionStatus);

  const startListening = useCallback(async () => {
    if (isRecordingRef.current) {
      return;
    }

    if (connectionStatus !== 'connected') {
      console.warn('Cannot start listening: WebSocket not connected');
      return;
    }

    try {
      await audioService.requestMicrophonePermission();

      setVoiceState('listening');
      setTutorState({ type: 'listening' });
      isRecordingRef.current = true;

      send({ type: 'VOICE_START' });

      await audioService.startCapture(
        (level) => setAudioLevel(level),
        (chunk) => {
          // Only send audio chunks if still recording
          if (isRecordingRef.current) {
            send({ type: 'VOICE_AUDIO', audio: chunk });
          }
        }
      );
    } catch (error) {
      console.error('Failed to start listening:', error);
      setVoiceState('idle');
      setTutorState({ type: 'idle' });
      isRecordingRef.current = false;
      throw error;
    }
  }, [send, setVoiceState, setTutorState, setAudioLevel, connectionStatus]);

  const stopListening = useCallback(() => {
    if (!isRecordingRef.current) {
      return;
    }

    audioService.stopCapture();
    isRecordingRef.current = false;

    send({ type: 'VOICE_END' });
    setVoiceState('processing');
    setTutorState({ type: 'thinking' });
  }, [send, setVoiceState, setTutorState]);

  const toggleVoice = useCallback(() => {
    if (voiceState === 'idle') {
      startListening();
    } else if (voiceState === 'listening') {
      stopListening();
    }
  }, [voiceState, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        audioService.stopCapture();
        isRecordingRef.current = false;
      }
    };
  }, []);

  return {
    voiceState,
    tutorState,
    audioLevel,
    messages,
    toggleVoice,
    startListening,
    stopListening,
  };
}
