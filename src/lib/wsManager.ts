import type { WSClientMessage, WSServerMessage } from '@/types';

const WS_BASE_URL = import.meta.env.DEV
  ? 'ws://localhost:8080/ws'
  : 'wss://chalkboard-api-production.up.railway.app/ws';

type MessageHandler = (message: WSServerMessage) => void;
type StatusHandler = (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private messageHandler: MessageHandler | null = null;
  private statusHandler: StatusHandler | null = null;
  private isConnecting = false;
  private sampleRate: number | null = null;

  setHandlers(onMessage: MessageHandler, onStatus: StatusHandler) {
    this.messageHandler = onMessage;
    this.statusHandler = onStatus;
  }

  setSampleRate(rate: number) {
    this.sampleRate = rate;
    console.log(`[WSManager] Sample rate set to ${rate}Hz`);
  }

  connect() {
    // Prevent duplicate connections
    if (this.ws || this.isConnecting) {
      console.log('[WSManager] Already connected or connecting, skipping');
      return;
    }

    this.isConnecting = true;

    // Build URL with sample rate if available
    let wsUrl = WS_BASE_URL;
    if (this.sampleRate) {
      wsUrl += `?sampleRate=${this.sampleRate}`;
    }

    console.log('[WSManager] Connecting to', wsUrl);
    this.statusHandler?.('connecting');

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WSManager] Connected');
      this.isConnecting = false;
      this.statusHandler?.('connected');
    };

    ws.onmessage = (event) => {
      const message: WSServerMessage = JSON.parse(event.data);
      this.messageHandler?.(message);
    };

    ws.onerror = (error) => {
      console.error('[WSManager] Error:', error);
      this.isConnecting = false;
      this.statusHandler?.('error');
    };

    ws.onclose = () => {
      console.log('[WSManager] Disconnected');
      this.ws = null;
      this.isConnecting = false;
      this.statusHandler?.('disconnected');

      // Attempt reconnection after 3 seconds
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, 3000);
    };

    this.ws = ws;
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnecting = false;
    this.statusHandler?.('disconnected');
  }

  send(message: WSClientMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WSManager] Cannot send - not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
