import { useState, useCallback } from 'react';
import { createShapeId, type Editor } from 'tldraw';
import { generateProblems, type TextShapeData } from '@/lib/mathTutor';
import { useTutorStore } from '@/stores/tutorStore';

// Get API key from Vite env
const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY as string;

/**
 * Convert plain text to TLRichText format (TipTap document)
 * Note: Empty text nodes are not allowed in TipTap, so empty strings
 * create a paragraph with no content array
 */
function textToRichText(text: string) {
  // Empty text needs a paragraph with no content (not empty text node)
  if (!text) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    };
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

/**
 * Erase canvas with a satisfying animation
 * Fades out shapes then deletes them
 */
async function eraseCanvasWithAnimation(editor: Editor): Promise<void> {
  const shapeIds = [...editor.getCurrentPageShapeIds()];

  if (shapeIds.length === 0) return;

  console.log('[Animation] Erasing', shapeIds.length, 'shapes');

  // Animate opacity fade (using selection flash as visual cue)
  editor.select(...shapeIds);
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Delete in batches for visual effect
  const batchSize = 3;
  for (let i = 0; i < shapeIds.length; i += batchSize) {
    const batch = shapeIds.slice(i, i + batchSize);
    editor.deleteShapes(batch);
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  // Ensure selection is cleared
  editor.selectNone();

  // Small pause before new content
  await new Promise((resolve) => setTimeout(resolve, 200));
}

/**
 * Add text shapes with a typing animation effect
 */
async function addTextShapesWithAnimation(
  editor: Editor,
  shapes: TextShapeData[]
): Promise<void> {
  for (const shape of shapes) {
    try {
      const shapeId = createShapeId();
      const fullText = shape.text;

      // Create the text shape with empty richText initially
      editor.createShape({
        id: shapeId,
        type: 'text',
        x: shape.x,
        y: shape.y,
        props: {
          color: shape.props.color,
          size: shape.props.size,
          font: shape.props.font,
          textAlign: shape.props.textAlign,
          autoSize: shape.props.autoSize,
          scale: shape.props.scale,
          richText: textToRichText(''),
        },
      });

      // Animate typing effect - add characters progressively
      const charsPerFrame = 1; // Characters to add per frame
      const frameDelay = 50; // ms between frames

      for (let i = 0; i <= fullText.length; i += charsPerFrame) {
        const partialText = fullText.slice(0, i);
        editor.updateShape({
          id: shapeId,
          type: 'text',
          props: {
            richText: textToRichText(partialText),
          },
        });
        await new Promise((resolve) => setTimeout(resolve, frameDelay));
      }

      // Ensure final text is complete
      editor.updateShape({
        id: shapeId,
        type: 'text',
        props: {
          richText: textToRichText(fullText),
        },
      });

      // Small delay between shapes
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error('[Animation] Error adding text shape:', err, shape.text);
    }
  }
}

export function useMathTutor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMessage = useTutorStore((state) => state.addMessage);
  const setTutorState = useTutorStore((state) => state.setTutorState);
  const editorRef = useTutorStore((state) => state.editorRef);
  const latestCanvasScreenshot = useTutorStore((state) => state.latestCanvasScreenshot);

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
        // Use cached canvas screenshot (captured on canvas changes)
        console.log('[MathTutor] Submitting with screenshot:', latestCanvasScreenshot ? `yes (${latestCanvasScreenshot.length} chars)` : 'no');
        const result = await generateProblems(userRequest, GROK_API_KEY, latestCanvasScreenshot, editorRef);

        // Switch to drawing state
        setTutorState({ type: 'drawing' });

        // Clear canvas if AI requested it (user asked for new/different problems)
        if (editorRef && result.clearCanvas) {
          console.log('[MathTutor] Clearing canvas before new content');
          await eraseCanvasWithAnimation(editorRef);
        }

        // Add shapes to canvas with typing animation
        if (editorRef && result.shapes.length > 0) {
          await addTextShapesWithAnimation(editorRef, result.shapes);
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
    [addMessage, setTutorState, editorRef, latestCanvasScreenshot]
  );

  return {
    submitRequest,
    isProcessing,
    error,
    isConfigured: !!GROK_API_KEY,
  };
}
