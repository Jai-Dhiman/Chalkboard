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
  ScreenshotBounds,
} from '@/types';
import { audioService } from '@/lib/audioService';
import { wsManager } from '@/lib/wsManager';

// Attention cursor state for visual focus
interface AttentionState {
  x: number | null;
  y: number | null;
  label?: string;
  visible: boolean;
}

// Celebration state
interface CelebrationState {
  active: boolean;
  intensity: 'small' | 'big';
}

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
  sessionReady: boolean; // True when backend Grok session is ready for audio

  // Canvas Reference (for external access)
  editorRef: Editor | null;

  // Live canvas screenshot (updated on canvas changes)
  latestCanvasScreenshot: string | null;
  latestScreenshotBounds: ScreenshotBounds | null;

  // Flag to track when AI is drawing (to avoid triggering user change detection)
  isAIDrawing: boolean;

  // Attention cursor for visual focus
  attention: AttentionState;

  // Celebration effect
  celebration: CelebrationState;
}

interface TutorStoreActions {
  // Voice Actions
  setVoiceState: (state: VoiceState) => void;
  setAudioLevel: (level: number) => void;

  // Tutor Actions
  setTutorState: (state: TutorState) => void;

  // Message Actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateOptimisticMessage: (content: string) => void;
  clearMessages: () => void;
  clearCheckContext: () => void;

  // Connection Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  connect: () => void;
  disconnect: () => void;
  send: (message: WSClientMessage) => void;

  // Canvas Actions
  setEditorRef: (editor: Editor | null) => void;
  clearCanvas: () => void;
  setLatestCanvasScreenshot: (screenshot: string | null, bounds?: ScreenshotBounds) => void;

  // Attention Actions
  setAttention: (x: number, y: number, label?: string) => void;
  clearAttention: () => void;

  // Celebration Actions
  triggerCelebration: (intensity?: 'small' | 'big') => void;
  clearCelebration: () => void;

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
  sessionReady: false,
  editorRef: null,
  latestCanvasScreenshot: null,
  latestScreenshotBounds: null,
  isAIDrawing: false,
  attention: {
    x: null,
    y: null,
    label: undefined,
    visible: false,
  },
  celebration: {
    active: false,
    intensity: 'big',
  },
};

export const useTutorStore = create<TutorStore>()((set, get) => {
  // Set up WebSocket handlers once
  wsManager.setHandlers(
    (message) => get().handleServerMessage(message),
    (status) => {
      set({ connectionStatus: status });
      // Reset sessionReady when disconnected
      if (status !== 'connected') {
        set({ sessionReady: false });
      }
    }
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

    updateOptimisticMessage: (content) =>
      set((state) => {
        // Find the last optimistic student message
        const optimisticIndex = state.messages.findLastIndex(
          (m) => m.role === 'student' && m.isOptimistic
        );

        if (optimisticIndex >= 0) {
          const newMessages = [...state.messages];
          newMessages[optimisticIndex] = {
            ...newMessages[optimisticIndex],
            content,
          };
          return { messages: newMessages };
        }

        return state;
      }),

    clearMessages: () => set({ messages: [] }),

    clearCheckContext: () =>
      set((state) => {
        // Keep only student messages and the most recent tutor message (if it's not check-related)
        // This clears old "checking your work" feedback when a new check is started
        const studentMessages = state.messages.filter((m) => m.role === 'student');
        return { messages: studentMessages };
      }),
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

    setLatestCanvasScreenshot: (latestCanvasScreenshot, latestScreenshotBounds) => set({ latestCanvasScreenshot, latestScreenshotBounds: latestScreenshotBounds ?? null }),

    setAttention: (x, y, label) =>
      set({
        attention: { x, y, label, visible: true },
      }),

    clearAttention: () =>
      set({
        attention: { x: null, y: null, label: undefined, visible: false },
      }),

    triggerCelebration: (intensity = 'big') =>
      set({
        celebration: { active: true, intensity },
      }),

    clearCelebration: () =>
      set({
        celebration: { active: false, intensity: 'big' },
      }),

    handleServerMessage: (message) => {
      const { addMessage, setVoiceState, setTutorState, editorRef } = get();

      switch (message.type) {
        case 'VOICE_STATE':
          // In click-to-talk mode, frontend controls listening/processing states
          // Backend sends speaking/idle states when Grok responds
          if (message.state === 'speaking') {
            setVoiceState('speaking');
            setTutorState({ type: 'speaking' });
          } else if (message.state === 'idle') {
            // Grok finished speaking, ready for next input
            setVoiceState('idle');
            setTutorState({ type: 'idle' });
          }
          // Ignore listening/processing from backend - frontend controls these
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
            // Note: Celebrations are triggered via explicit CELEBRATE messages from the backend
            // when Grok uses the celebrate() tool, not via keyword matching
          }
          break;

        case 'TUTOR_STATUS':
          setTutorState({ type: message.status });
          break;

        case 'CANVAS_COMMAND':
          handleCanvasCommand(
            editorRef,
            message.command,
            {
              setAttention: get().setAttention,
              clearAttention: get().clearAttention,
            },
            (isDrawing: boolean) => set({ isAIDrawing: isDrawing })
          );
          break;

        case 'VOICE_AUDIO':
          // Play audio through the audio service
          audioService.playAudio(message.audio);
          break;

        case 'CELEBRATE':
          // Explicit celebration command from backend
          get().triggerCelebration(message.intensity || 'big');
          break;

        case 'SESSION_READY':
          // Backend Grok session is ready for audio streaming
          console.log('[WebSocket] Session ready, can start audio streaming');
          set({ sessionReady: true });
          break;

        case 'CLEAR_CHECK_CONTEXT':
          // Clear old tutor messages when a new check is started
          // This prevents stale "wrong answer" feedback from showing when user corrects their work
          console.log('[WebSocket] Clearing check context - removing old tutor messages');
          get().clearCheckContext();
          break;

        case 'ERROR':
          console.error(`[WebSocket Error] ${message.code}: ${message.message}`);
          break;
      }
    },

    reset: () => set(initialState),
  };
});

interface AttentionHandlers {
  setAttention: (x: number, y: number, label?: string) => void;
  clearAttention: () => void;
}

async function handleCanvasCommand(
  editor: Editor | null,
  command: CanvasCommand,
  attentionHandlers: AttentionHandlers,
  setAIDrawing: (isDrawing: boolean) => void
): Promise<void> {
  try {
    // Handle attention commands (don't need editor)
    if (command.action === 'ATTENTION_TO') {
      attentionHandlers.setAttention(command.x, command.y, command.label);
      console.log('[Canvas] Attention moved to:', command.x, command.y, command.label);
      return;
    }

    if (command.action === 'CLEAR_ATTENTION') {
      attentionHandlers.clearAttention();
      console.log('[Canvas] Attention cleared');
      return;
    }

    // All other commands require the editor
    if (!editor) {
      console.warn('[Canvas] No editor available for command:', command.action);
      return;
    }

    // Mark that AI is drawing (so TutorCanvas doesn't trigger user change detection)
    setAIDrawing(true);

    switch (command.action) {
      case 'ADD_ANIMATED_TEXT': {
        const { text, x, y, color = 'white', size = 'm' } = command;
        const shapeId = createShapeId();

        // Create text shape with empty content
        editor.createShape({
          id: shapeId,
          type: 'text',
          x,
          y,
          props: {
            richText: toRichText(''),
            color,
            size,
            font: 'draw',
            autoSize: true,
          },
        });

        // Animate character by character
        console.log('[Canvas] Starting text animation for:', text);
        for (let i = 1; i <= text.length; i++) {
          editor.updateShape({
            id: shapeId,
            type: 'text',
            props: { richText: toRichText(text.slice(0, i)) },
          });
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        console.log('[Canvas] Text animation complete');
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

      case 'CLEAR_CANVAS': {
        const shapeIds = editor.getCurrentPageShapeIds();
        editor.deleteShapes([...shapeIds]);
        console.log('[Canvas] Canvas cleared');
        break;
      }
    }
  } catch (error) {
    console.error('[Canvas] Error handling command:', error, command);
  } finally {
    // Always reset the AI drawing flag after a short delay
    // (delay allows tldraw's store listener to fire first)
    setTimeout(() => setAIDrawing(false), 100);
  }
}
