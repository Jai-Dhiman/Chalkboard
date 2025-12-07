export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'interrupted';

export type TutorState =
  | { type: 'idle' }
  | { type: 'listening' }
  | { type: 'thinking' }
  | { type: 'speaking'; message?: string }
  | { type: 'watching'; focus: string }
  | { type: 'drawing' };

export interface Message {
  id: string;
  role: 'student' | 'tutor';
  content: string;
  timestamp: Date;
  isOptimistic?: boolean;
}

// Connection Status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Screenshot bounds info for coordinate transformation
export interface ScreenshotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  padding: number;
}

// WebSocket Message Types - Frontend to Backend
export type WSClientMessage =
  | { type: 'VOICE_START'; screenshot?: string; screenshotBounds?: ScreenshotBounds }  // Screenshot sent at start so Grok has context before VAD commits
  | { type: 'VOICE_AUDIO'; audio: string }
  | { type: 'VOICE_END' }
  | { type: 'TEXT_MESSAGE'; text: string }
  | { type: 'CANVAS_UPDATE'; shapes: TldrawShapeData[]; summary: string; screenshot?: string; screenshotBounds?: ScreenshotBounds }
  | { type: 'CANVAS_CHANGE'; added: TldrawShapeData[]; modified: TldrawShapeData[]; deleted: string[] };

// WebSocket Message Types - Backend to Frontend
export type WSServerMessage =
  | { type: 'VOICE_STATE'; state: 'idle' | 'listening' | 'processing' | 'speaking' }
  | { type: 'VOICE_AUDIO'; audio: string }
  | { type: 'VOICE_TRANSCRIPT'; role: 'student' | 'tutor'; text: string }
  | { type: 'CANVAS_COMMAND'; command: CanvasCommand }
  | { type: 'TUTOR_STATUS'; status: 'thinking' | 'watching' | 'drawing' }
  | { type: 'CELEBRATE'; intensity?: 'small' | 'big' }
  | { type: 'SESSION_READY' }
  | { type: 'CLEAR_CHECK_CONTEXT' }
  | { type: 'ERROR'; code: string; message: string };

// Canvas Command Types
export type CanvasCommand =
  | { action: 'ADD_SHAPE'; shape: TldrawShapeData }
  | { action: 'ADD_ANIMATED_TEXT'; text: string; x: number; y: number; color?: string; size?: string }
  | { action: 'UPDATE_SHAPE'; shapeId: string; updates: Partial<TldrawShapeData> }
  | { action: 'DELETE_SHAPE'; shapeId: string }
  | { action: 'HIGHLIGHT'; shapeIds: string[] }
  | { action: 'PAN_TO'; x: number; y: number }
  | { action: 'ATTENTION_TO'; x: number; y: number; label?: string }
  | { action: 'CLEAR_ATTENTION' }
  | { action: 'CLEAR_CANVAS' };

// tldraw Shape Data (serializable)
export interface TldrawShapeData {
  id: string;
  type: string;
  x: number;
  y: number;
  props: Record<string, unknown>;
}
