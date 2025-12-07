import { create } from 'zustand';
import { createShapeId, toRichText, type Editor, type TLShapeId } from 'tldraw';
import type {
  VoiceState,
  TutorState,
  Message,
  ConnectionStatus,
  WSServerMessage,
  CanvasCommand,
  WSClientMessage,
} from '@/types';
import { audioService } from '@/lib/audioService';
import { wsManager } from '@/lib/wsManager';
import { textToStrokesAsync, strokesToSegments } from '@/lib/handwriting';
import { animateDrawShape } from '@/lib/strokeAnimation';

interface TutorStoreState {
  // Voice State
  voiceState: VoiceState;
  audioLevel: number;

  // Tutor State
  tutorState: TutorState;

  // Messages
  messages: Message[];

  // Connection
  connectionStatus: ConnectionStatus;

  // Canvas Reference (for external access)
  editorRef: Editor | null;

  // Live canvas screenshot (updated on canvas changes)
  latestCanvasScreenshot: string | null;
}

interface TutorStoreActions {
  // Voice Actions
  setVoiceState: (state: VoiceState) => void;
  setAudioLevel: (level: number) => void;

  // Tutor Actions
  setTutorState: (state: TutorState) => void;

  // Message Actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;

  // Connection Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  connect: () => void;
  disconnect: () => void;
  send: (message: WSClientMessage) => void;

  // Canvas Actions
  setEditorRef: (editor: Editor | null) => void;
  clearCanvas: () => void;
  setLatestCanvasScreenshot: (screenshot: string | null) => void;

  // Handle Server Messages
  handleServerMessage: (message: WSServerMessage) => void;

  // Reset
  reset: () => void;
}

type TutorStore = TutorStoreState & TutorStoreActions;

const initialState: TutorStoreState = {
  voiceState: 'idle',
  audioLevel: 0,
  tutorState: { type: 'idle' },
  messages: [],
  connectionStatus: 'disconnected',
  editorRef: null,
  latestCanvasScreenshot: null,
};

export const useTutorStore = create<TutorStore>()((set, get) => {
  // Set up WebSocket handlers once
  wsManager.setHandlers(
    (message) => get().handleServerMessage(message),
    (status) => set({ connectionStatus: status })
  );

  return {
    ...initialState,

    // Actions
    setVoiceState: (voiceState) => set({ voiceState }),
    setAudioLevel: (audioLevel) => set({ audioLevel }),
    setTutorState: (tutorState) => set({ tutorState }),

    addMessage: (msg) =>
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            ...msg,
          },
        ],
      })),

    clearMessages: () => set({ messages: [] }),
    setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

    connect: () => wsManager.connect(),
    disconnect: () => wsManager.disconnect(),
    send: (message) => wsManager.send(message),

    setEditorRef: (editorRef) => set({ editorRef }),

    clearCanvas: () => {
      const editor = get().editorRef;
      if (editor) {
        const shapeIds = editor.getCurrentPageShapeIds();
        editor.deleteShapes([...shapeIds]);
      }
      // Clear the screenshot too since canvas is now empty
      set({ latestCanvasScreenshot: null });
    },

    setLatestCanvasScreenshot: (latestCanvasScreenshot) => set({ latestCanvasScreenshot }),

    handleServerMessage: (message) => {
      const { addMessage, setVoiceState, setTutorState, editorRef } = get();

      switch (message.type) {
        case 'VOICE_STATE':
          setVoiceState(message.state);
          break;

        case 'VOICE_TRANSCRIPT':
          // For student messages, find and replace the optimistic placeholder
          if (message.role === 'student') {
            set((state) => {
              // Find the last optimistic student message
              const optimisticIndex = state.messages.findLastIndex(
                (m) => m.role === 'student' && m.isOptimistic
              );

              if (optimisticIndex >= 0) {
                // Replace optimistic message with real content
                const newMessages = [...state.messages];
                newMessages[optimisticIndex] = {
                  ...newMessages[optimisticIndex],
                  content: message.text,
                  isOptimistic: false,
                };
                return { messages: newMessages };
              }

              // No optimistic message found, add normally
              return {
                messages: [
                  ...state.messages,
                  {
                    id: crypto.randomUUID(),
                    timestamp: new Date(),
                    role: message.role,
                    content: message.text,
                  },
                ],
              };
            });
          } else {
            // Tutor messages are added normally
            addMessage({ role: message.role, content: message.text });
          }
          break;

        case 'TUTOR_STATUS':
          setTutorState({ type: message.status });
          break;

        case 'CANVAS_COMMAND':
          if (editorRef) {
            handleCanvasCommand(editorRef, message.command);
          }
          break;

        case 'VOICE_AUDIO':
          // Play audio through the audio service
          audioService.playAudio(message.audio);
          break;

        case 'ERROR':
          console.error(`[WebSocket Error] ${message.code}: ${message.message}`);
          break;
      }
    },

    reset: () => set(initialState),
  };
});

async function handleCanvasCommand(editor: Editor, command: CanvasCommand): Promise<void> {
  try {
    switch (command.action) {
      case 'ADD_ANIMATED_TEXT': {
        const { text, x, y, color = 'white', size = 'm' } = command;

        // Convert text to strokes using handwriting font
        const result = await textToStrokesAsync(text, 2.5);
        if (result.strokes.length === 0) {
          // Fallback to instant text if conversion fails
          console.warn('[Canvas] Handwriting conversion failed, falling back to instant text');
          const shapeId = createShapeId();
          editor.createShape({
            id: shapeId,
            type: 'text',
            x,
            y,
            props: {
              richText: toRichText(text),
              color,
              size,
              font: 'draw',
              autoSize: true,
            },
          });
          return;
        }

        // Convert to tldraw segment format
        const segments = strokesToSegments(result.strokes);

        // Create draw shape with empty segments
        const shapeId = createShapeId();
        editor.createShape({
          id: shapeId,
          type: 'draw',
          x,
          y,
          props: {
            segments: [],
            color,
            size,
            isComplete: false,
          },
        });

        // Animate the shape
        console.log('[Canvas] Starting handwriting animation for:', text);
        await animateDrawShape(editor, shapeId, segments, { color, size });
        console.log('[Canvas] Handwriting animation complete');
        break;
      }

      case 'ADD_SHAPE': {
        // Generate a proper tldraw shape ID
        const shapeId = createShapeId();

        // For text shapes, convert text prop to richText format
        let props = command.shape.props;
        if (command.shape.type === 'text' && props.text) {
          const { text, ...restProps } = props as { text: string; [key: string]: unknown };
          props = {
            ...restProps,
            richText: toRichText(text),
            autoSize: true,
          };
        }

        editor.createShape({
          id: shapeId,
          type: command.shape.type,
          x: command.shape.x,
          y: command.shape.y,
          props,
        });
        console.log('[Canvas] Created shape:', shapeId, command.shape.type);
        break;
      }

      case 'UPDATE_SHAPE':
        editor.updateShape({
          id: command.shapeId as TLShapeId,
          ...command.updates,
        });
        break;

      case 'DELETE_SHAPE':
        editor.deleteShape(command.shapeId as TLShapeId);
        break;

      case 'HIGHLIGHT':
        editor.select(...(command.shapeIds as TLShapeId[]));
        break;

      case 'PAN_TO':
        editor.centerOnPoint({ x: command.x, y: command.y });
        break;
    }
  } catch (error) {
    console.error('[Canvas] Error handling command:', error, command);
  }
}
