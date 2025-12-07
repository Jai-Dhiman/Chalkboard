import { create } from 'zustand';
import { createShapeId, type Editor, type TLShapeId } from 'tldraw';
import type {
  VoiceState,
  TutorState,
  Message,
  ConnectionStatus,
  WSServerMessage,
  CanvasCommand,
} from '@/types';

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

  // Mock Mode
  isMockMode: boolean;
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

  // Canvas Actions
  setEditorRef: (editor: Editor | null) => void;

  // Handle Server Messages
  handleServerMessage: (message: WSServerMessage) => void;

  // Mock Mode
  setMockMode: (enabled: boolean) => void;

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
  isMockMode: true,
};

export const useTutorStore = create<TutorStore>()((set, get) => ({
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
  setEditorRef: (editorRef) => set({ editorRef }),

  handleServerMessage: (message) => {
    const { addMessage, setVoiceState, setTutorState, editorRef } = get();

    switch (message.type) {
      case 'VOICE_STATE':
        setVoiceState(message.state);
        break;

      case 'VOICE_TRANSCRIPT':
        addMessage({ role: message.role, content: message.text });
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
        // Audio playback handled in audioService
        break;

      case 'ERROR':
        console.error(`[WebSocket Error] ${message.code}: ${message.message}`);
        break;
    }
  },

  setMockMode: (isMockMode) => set({ isMockMode }),

  reset: () => set(initialState),
}));

function handleCanvasCommand(editor: Editor, command: CanvasCommand): void {
  try {
    switch (command.action) {
      case 'ADD_SHAPE': {
        // Generate a proper tldraw shape ID
        const shapeId = createShapeId();

        editor.createShape({
          id: shapeId,
          type: command.shape.type,
          x: command.shape.x,
          y: command.shape.y,
          props: command.shape.props,
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
