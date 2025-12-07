'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Tldraw, Editor, createShapeId, DefaultColorStyle } from 'tldraw';
import 'tldraw/tldraw.css';
import { useTutorStore } from '@/stores/tutorStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { debounce } from '@/lib/debounce';
import { captureCanvasScreenshot } from '@/lib/mathTutor';
import type { TldrawShapeData } from '@/types';

export function TutorCanvas() {
  const { send } = useWebSocket();
  const setEditorRef = useTutorStore((state) => state.setEditorRef);
  const setLatestCanvasScreenshot = useTutorStore((state) => state.setLatestCanvasScreenshot);
  const voiceState = useTutorStore((state) => state.voiceState);
  const connectionStatus = useTutorStore((state) => state.connectionStatus);
  const editorRef = useRef<Editor | null>(null);

  // Debounced screenshot capture for AI vision
  const captureScreenshotDebounced = useMemo(
    () =>
      debounce(async (editor: Editor) => {
        const screenshot = await captureCanvasScreenshot(editor);
        setLatestCanvasScreenshot(screenshot);
        console.log('[Canvas] Screenshot captured:', screenshot ? 'yes' : 'empty canvas');
      }, 500),
    [setLatestCanvasScreenshot]
  );

  // Debounced canvas update sender (for WebSocket backend)
  const sendCanvasUpdate = useMemo(
    () =>
      debounce((editor: Editor) => {
        if (connectionStatus !== 'connected') return;

        const shapes = editor.getCurrentPageShapes();
        const shapesJson: TldrawShapeData[] = shapes.map((shape) => ({
          id: shape.id,
          type: shape.type,
          x: shape.x,
          y: shape.y,
          props: shape.props as Record<string, unknown>,
        }));

        send({
          type: 'CANVAS_UPDATE',
          shapes: shapesJson,
          summary: `Canvas has ${shapes.length} shapes`,
        });
      }, 300),
    [send, connectionStatus]
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      setEditorRef(editor);

      // Set default color to white for chalkboard aesthetic
      editor.setStyleForNextShapes(DefaultColorStyle, 'white');

      // Force dark mode by setting user preferences
      editor.user.updateUserPreferences({ colorScheme: 'dark' });

      // Listen to store changes from user actions
      editor.store.listen(
        (entry) => {
          if (entry.source === 'user') {
            console.log('[Canvas] User change detected, triggering screenshot capture');
            sendCanvasUpdate(editor);
            captureScreenshotDebounced(editor);
          }
        },
        { scope: 'document', source: 'user' }
      );

      // Also capture initial screenshot if canvas already has content
      const initialShapes = editor.getCurrentPageShapes();
      if (initialShapes.length > 0) {
        console.log('[Canvas] Initial shapes detected, capturing screenshot');
        captureScreenshotDebounced(editor);
      }
    },
    [setEditorRef, sendCanvasUpdate, captureScreenshotDebounced]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      setEditorRef(null);
    };
  }, [setEditorRef]);

  // Determine if canvas should have voice-active styling
  const isVoiceActive = voiceState === 'speaking';

  return (
    <div
      className={`tutor-canvas ${isVoiceActive ? 'tutor-canvas--voice-active' : ''}`}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <Tldraw onMount={handleMount} />
      </div>

      <style jsx>{`
        .tutor-canvas {
          position: relative;
          flex: 1;
          background: #1a1a1a;
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.5s ease;
        }

        .tutor-canvas--voice-active {
          box-shadow:
            var(--shadow-md),
            0 0 60px rgba(99, 102, 241, 0.15);
        }
      `}</style>
    </div>
  );
}

// Export utility for creating shape IDs
export { createShapeId };
