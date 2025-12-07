'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Tldraw, Editor, createShapeId, DefaultColorStyle, TLComponents } from 'tldraw';
import 'tldraw/tldraw.css';
import { useTutorStore } from '@/stores/tutorStore';
import { debounce } from '@/lib/debounce';
import { captureCanvasScreenshotWithBounds } from '@/lib/canvasUtils';
import { AttentionCursor } from '@/components/AttentionCursor/AttentionCursor';
import type { TldrawShapeData } from '@/types';

// Hide unnecessary tldraw UI components for cleaner interface
const tldrawComponents: TLComponents = {
  MenuPanel: null,        // Hide left sidebar menu
  NavigationPanel: null,  // Hide zoom/navigation controls
  PageMenu: null,         // Hide page selector
  ActionsMenu: null,      // Hide actions dropdown
  DebugMenu: null,        // Hide debug menu
  HelpMenu: null,         // Hide help menu
  // Keep: Toolbar (bottom), StylePanel (for colors/styles)
  // StylePanel is kept by default
};

export function TutorCanvas() {
  const send = useTutorStore((state) => state.send);
  const setEditorRef = useTutorStore((state) => state.setEditorRef);
  const setLatestCanvasScreenshot = useTutorStore((state) => state.setLatestCanvasScreenshot);
  const voiceState = useTutorStore((state) => state.voiceState);
  const connectionStatus = useTutorStore((state) => state.connectionStatus);
  const attention = useTutorStore((state) => state.attention);
  const isAIDrawing = useTutorStore((state) => state.isAIDrawing);
  const editorRef = useRef<Editor | null>(null);

  // Debounced screenshot capture for AI vision
  const captureScreenshotDebounced = useMemo(
    () =>
      debounce(async (editor: Editor) => {
        const result = await captureCanvasScreenshotWithBounds(editor);
        setLatestCanvasScreenshot(result?.dataUrl ?? null, result?.bounds ? { ...result.bounds, padding: result.padding } : undefined);
        console.log('[Canvas] Screenshot captured:', result ? 'yes' : 'empty canvas', result?.bounds ? `bounds: (${result.bounds.x.toFixed(0)}, ${result.bounds.y.toFixed(0)})` : '');
      }, 500),
    [setLatestCanvasScreenshot]
  );

  // Debounced canvas update sender (for WebSocket backend)
  // Note: We use refs to get current state values to avoid stale closure issues
  const connectionStatusRef = useRef(connectionStatus);
  connectionStatusRef.current = connectionStatus;

  const isAIDrawingRef = useRef(isAIDrawing);
  isAIDrawingRef.current = isAIDrawing;

  const sendCanvasUpdate = useMemo(
    () =>
      debounce(async (editor: Editor) => {
        // Use ref to get current connection status (avoids stale closure)
        if (connectionStatusRef.current !== 'connected') {
          console.log('[Canvas] Skipping update - not connected:', connectionStatusRef.current);
          return;
        }

        const shapes = editor.getCurrentPageShapes();
        const shapesJson: TldrawShapeData[] = shapes.map((shape) => ({
          id: shape.id,
          type: shape.type,
          x: shape.x,
          y: shape.y,
          props: shape.props as Record<string, unknown>,
        }));

        // Capture fresh screenshot with bounds for this update
        const result = await captureCanvasScreenshotWithBounds(editor);

        console.log('[Canvas] Sending CANVAS_UPDATE with', shapes.length, 'shapes, screenshot:', !!result);
        send({
          type: 'CANVAS_UPDATE',
          shapes: shapesJson,
          summary: `Canvas has ${shapes.length} shapes`,
          screenshot: result?.dataUrl ?? undefined,
          screenshotBounds: result?.bounds ? { ...result.bounds, padding: result.padding } : undefined,
        });
      }, 800),  // Increased debounce to 800ms to reduce vision API load
    [send]
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
            // Skip updates if AI is currently drawing (to avoid feedback loop)
            if (isAIDrawingRef.current) {
              console.log('[Canvas] Skipping update - AI is drawing');
              return;
            }
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
        <Tldraw
          onMount={handleMount}
          components={tldrawComponents}
        />
      </div>

      {/* Grok's attention cursor overlay */}
      <AttentionCursor
        x={attention.x}
        y={attention.y}
        label={attention.label}
        visible={attention.visible}
      />

      <style jsx>{`
        .tutor-canvas {
          position: relative;
          flex: 1;
          background: #1a1a1a;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.5s ease;
        }

        .tutor-canvas--voice-active {
          box-shadow: 0 0 60px rgba(99, 102, 241, 0.1);
        }
      `}</style>

      {/* Global styles for tldraw customization */}
      <style jsx global>{`
        /* Hide tldraw license watermark for cleaner demo */
        .tl-watermark_SEE-LICENSE {
          display: none !important;
        }

        /* Style the toolbar to match dark theme */
        .tlui-toolbar {
          background: rgba(28, 28, 30, 0.95) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 12px !important;
          backdrop-filter: blur(12px);
        }

        .tlui-toolbar__inner {
          gap: 2px;
        }

        /* Style toolbar buttons - exclude style panel to preserve color swatches */
        .tlui-toolbar .tlui-button {
          color: rgba(255, 255, 255, 0.8) !important;
        }

        .tlui-toolbar .tlui-button:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }

        .tlui-toolbar .tlui-button[data-state="selected"],
        .tlui-toolbar .tlui-button[aria-pressed="true"] {
          background: rgba(99, 102, 241, 0.3) !important;
          color: #fff !important;
        }

        /* Style panel button text (not icons/colors) */
        .tlui-style-panel .tlui-button__label {
          color: rgba(255, 255, 255, 0.8);
        }

        /* Style panel (color/style picker) */
        .tlui-style-panel {
          background: rgba(28, 28, 30, 0.95) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 12px !important;
          backdrop-filter: blur(12px);
        }

        .tlui-style-panel__wrapper {
          background: rgba(28, 28, 30, 0.95) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 12px !important;
        }

        /* Style the top right area (contains StylePanel when shapes are selected) */
        .tlui-layout__top__right {
          /* Keep visible for StylePanel access */
        }

        /* Hide quick actions but keep StylePanel */
        .tlui-quick-actions {
          display: none !important;
        }
      `}</style>
    </div>
  );
}

// Export utility for creating shape IDs
export { createShapeId };
