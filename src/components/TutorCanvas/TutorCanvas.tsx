'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Tldraw, Editor, createShapeId, DefaultColorStyle, TLComponents } from 'tldraw';
import 'tldraw/tldraw.css';
import { useTutorStore } from '@/stores/tutorStore';
import { debounce } from '@/lib/debounce';
import { captureCanvasScreenshot } from '@/lib/canvasUtils';
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
      debounce(async (editor: Editor) => {
        if (connectionStatus !== 'connected') return;

        const shapes = editor.getCurrentPageShapes();
        const shapesJson: TldrawShapeData[] = shapes.map((shape) => ({
          id: shape.id,
          type: shape.type,
          x: shape.x,
          y: shape.y,
          props: shape.props as Record<string, unknown>,
        }));

        // Capture fresh screenshot for this update
        const screenshot = await captureCanvasScreenshot(editor);

        send({
          type: 'CANVAS_UPDATE',
          shapes: shapesJson,
          summary: `Canvas has ${shapes.length} shapes`,
          screenshot: screenshot ?? undefined,
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
        <Tldraw
          onMount={handleMount}
          components={tldrawComponents}
        />
      </div>

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

        /* Style toolbar buttons */
        .tlui-button {
          color: rgba(255, 255, 255, 0.8) !important;
        }

        .tlui-button:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }

        .tlui-button[data-state="selected"],
        .tlui-button[aria-pressed="true"] {
          background: rgba(99, 102, 241, 0.3) !important;
          color: #fff !important;
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

        /* Hide the quick actions (duplicate, delete etc) floating panel */
        .tlui-layout__top__right {
          display: none !important;
        }
      `}</style>
    </div>
  );
}

// Export utility for creating shape IDs
export { createShapeId };
