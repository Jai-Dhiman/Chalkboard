import { useState, useCallback } from 'react';
import { createShapeId } from 'tldraw';
import { generateProblems } from '@/lib/mathTutor';
import { useTutorStore } from '@/stores/tutorStore';

// Get API key from Vite env
const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY as string;

export function useMathTutor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMessage = useTutorStore((state) => state.addMessage);
  const setTutorState = useTutorStore((state) => state.setTutorState);
  const editorRef = useTutorStore((state) => state.editorRef);

  const submitRequest = useCallback(
    async (userRequest: string) => {
      if (!userRequest.trim()) return;

      if (!GROK_API_KEY) {
        setError('VITE_GROK_API_KEY not set in environment');
        throw new Error('VITE_GROK_API_KEY not set. Add it to your .env file.');
      }

      setError(null);
      setIsProcessing(true);

      // Show student message
      addMessage({ role: 'student', content: userRequest });
      setTutorState({ type: 'thinking' });

      try {
        const result = await generateProblems(userRequest, GROK_API_KEY);

        // Switch to drawing state
        setTutorState({ type: 'drawing' });

        // Add shapes to canvas
        if (editorRef) {
          for (const shape of result.shapes) {
            const shapeId = createShapeId();
            editorRef.createShape({
              id: shapeId,
              type: shape.type,
              x: shape.x,
              y: shape.y,
              props: shape.props,
            });
          }
        }

        // Add tutor explanation
        addMessage({ role: 'tutor', content: result.explanation });

        // Return to idle
        setTutorState({ type: 'idle' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        addMessage({ role: 'tutor', content: `Sorry, I encountered an error: ${message}` });
        setTutorState({ type: 'idle' });
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [addMessage, setTutorState, editorRef]
  );

  return {
    submitRequest,
    isProcessing,
    error,
    isConfigured: !!GROK_API_KEY,
  };
}
