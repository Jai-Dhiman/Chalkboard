import { useCallback, useEffect, useRef } from 'react';
import { useTutorStore } from '@/stores/tutorStore';
import { audioService } from '@/lib/audioService';
import { captureCanvasScreenshotWithBounds } from '@/lib/canvasUtils';

export function useVoice() {
  const isRecordingRef = useRef(false);

  const voiceState = useTutorStore((state) => state.voiceState);
  const tutorState = useTutorStore((state) => state.tutorState);
  const audioLevel = useTutorStore((state) => state.audioLevel);
  const messages = useTutorStore((state) => state.messages);
  const editorRef = useTutorStore((state) => state.editorRef);
  const setVoiceState = useTutorStore((state) => state.setVoiceState);
  const setAudioLevel = useTutorStore((state) => state.setAudioLevel);
  const setTutorState = useTutorStore((state) => state.setTutorState);
  const sessionReady = useTutorStore((state) => state.sessionReady);
  const send = useTutorStore((state) => state.send);
  const addMessage = useTutorStore((state) => state.addMessage);
  const updateOptimisticMessage = useTutorStore((state) => state.updateOptimisticMessage);

  // Start listening (click to talk)
  const startListening = useCallback(async () => {
    if (isRecordingRef.current) {
      console.log('[Voice] Already recording, skipping');
      return;
    }

    if (!sessionReady) {
      console.warn('[Voice] Cannot start listening: Session not ready');
      return;
    }

    try {
      console.log('[Voice] Requesting microphone permission...');
      await audioService.requestMicrophonePermission();
      console.log('[Voice] Microphone permission granted');

      setVoiceState('listening');
      setTutorState({ type: 'listening' });
      isRecordingRef.current = true;

      // Add optimistic user message while recording
      addMessage({
        role: 'student',
        content: 'Listening...',
        isOptimistic: true,
      });

      // Capture screenshot BEFORE starting voice so Grok has canvas context
      // This is critical because server-side VAD may commit audio before VOICE_END
      let screenshot: string | undefined;
      let screenshotBounds: { x: number; y: number; width: number; height: number; padding: number } | undefined;
      if (editorRef) {
        console.log('[Voice] Capturing canvas screenshot for voice context...');
        const result = await captureCanvasScreenshotWithBounds(editorRef);
        if (result) {
          screenshot = result.dataUrl;
          screenshotBounds = { ...result.bounds, padding: result.padding };
          console.log('[Voice] Screenshot captured, sending with VOICE_START, bounds:', result.bounds);
        }
      }

      console.log('[Voice] Sending VOICE_START');
      send({ type: 'VOICE_START', screenshot, screenshotBounds });

      let chunkCount = 0;
      await audioService.startCapture(
        (level) => setAudioLevel(level),
        (chunk) => {
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
  }, [send, setVoiceState, setTutorState, setAudioLevel, sessionReady, addMessage, editorRef]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (!isRecordingRef.current) {
      return;
    }

    console.log('[Voice] Stopping recording');
    audioService.stopCapture();
    isRecordingRef.current = false;

    // Update optimistic message to processing state
    updateOptimisticMessage('...');

    // Note: Screenshot was already sent with VOICE_START
    // This is necessary because server-side VAD commits audio before we get here
    send({ type: 'VOICE_END' });
    setVoiceState('processing');
    setTutorState({ type: 'thinking' });
  }, [send, setVoiceState, setTutorState, updateOptimisticMessage]);

  // Toggle voice recording
  const toggleVoice = useCallback(() => {
    const isRecording = isRecordingRef.current;
    console.log('[Voice] toggleVoice called, isRecording:', isRecording, 'voiceState:', voiceState);

    if (!isRecording) {
      startListening();
    } else {
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
