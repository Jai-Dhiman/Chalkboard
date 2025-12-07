'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Tldraw, Editor, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import { useTutorStore } from '@/stores/tutorStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { debounce } from '@/lib/debounce';
import type { TldrawShapeData } from '@/types';

export function TutorCanvas() {
  const { send } = useWebSocket();
  const setEditorRef = useTutorStore((state) => state.setEditorRef);
  const voiceState = useTutorStore((state) => state.voiceState);
  const connectionStatus = useTutorStore((state) => state.connectionStatus);
  const editorRef = useRef<Editor | null>(null);

  // Debounced canvas update sender
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

      // Listen to store changes from user actions
      editor.store.listen(
        (entry) => {
          if (entry.source === 'user') {
            sendCanvasUpdate(editor);
          }
        },
        { scope: 'document', source: 'user' }
      );
    },
    [setEditorRef, sendCanvasUpdate]
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
      <Tldraw onMount={handleMount} inferDarkMode={false} />

      <style jsx>{`
        .tutor-canvas {
          position: relative;
          flex: 1;
          background: var(--canvas-bg);
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

        .tutor-canvas :global(.tl-background) {
          background-color: var(--canvas-bg) !important;
        }

        .tutor-canvas :global(.tl-container) {
          height: 100%;
        }
      `}</style>
    </div>
  );
}

// Export utility for creating shape IDs
export { createShapeId };
