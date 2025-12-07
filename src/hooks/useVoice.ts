import { useCallback, useEffect, useRef } from 'react';
import { useTutorStore } from '@/stores/tutorStore';
import { audioService } from '@/lib/audioService';

export function useVoice() {
  const isRecordingRef = useRef(false);

  const voiceState = useTutorStore((state) => state.voiceState);
  const tutorState = useTutorStore((state) => state.tutorState);
  const audioLevel = useTutorStore((state) => state.audioLevel);
  const messages = useTutorStore((state) => state.messages);
  const setVoiceState = useTutorStore((state) => state.setVoiceState);
  const setAudioLevel = useTutorStore((state) => state.setAudioLevel);
  const setTutorState = useTutorStore((state) => state.setTutorState);
  const connectionStatus = useTutorStore((state) => state.connectionStatus);
  const send = useTutorStore((state) => state.send);
  const addMessage = useTutorStore((state) => state.addMessage);

  const startListening = useCallback(async () => {
    if (isRecordingRef.current) {
      console.log('[Voice] Already recording, skipping');
      return;
    }

    if (connectionStatus !== 'connected') {
      console.warn('[Voice] Cannot start listening: WebSocket not connected');
      return;
    }

    try {
      console.log('[Voice] Requesting microphone permission...');
      await audioService.requestMicrophonePermission();
      console.log('[Voice] Microphone permission granted');

      setVoiceState('listening');
      setTutorState({ type: 'listening' });
      isRecordingRef.current = true;

      console.log('[Voice] Sending VOICE_START');
      send({ type: 'VOICE_START' });

      let chunkCount = 0;
      await audioService.startCapture(
        (level) => setAudioLevel(level),
        (chunk) => {
          // Only send audio chunks if still recording
          if (isRecordingRef.current) {
            chunkCount++;
            if (chunkCount <= 3 || chunkCount % 50 === 0) {
              console.log(`[Voice] Sending audio chunk #${chunkCount}, size: ${chunk.length}`);
            }
            send({ type: 'VOICE_AUDIO', audio: chunk });
          }
        }
      );
      console.log('[Voice] Audio capture started');
    } catch (error) {
      console.error('[Voice] Failed to start listening:', error);
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

    // Add optimistic user message (will be updated when backend sends transcript)
    addMessage({
      role: 'student',
      content: '...',
      isOptimistic: true,
    });

    send({ type: 'VOICE_END' });
    setVoiceState('processing');
    setTutorState({ type: 'thinking' });
  }, [send, setVoiceState, setTutorState, addMessage]);

  const toggleVoice = useCallback(() => {
    const isRecording = isRecordingRef.current;
    console.log('[Voice] toggleVoice called, isRecording:', isRecording, 'voiceState:', voiceState);

    if (!isRecording) {
      // Start recording
      startListening();
    } else {
      // Stop recording
      stopListening();
    }
  }, [startListening, stopListening, voiceState]);

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
