import { useEffect, useRef, useCallback } from 'react';
import { useTutorStore } from '@/stores/tutorStore';
import { MockWebSocket } from '@/lib/mockWebSocket';
import type { WSClientMessage, WSServerMessage } from '@/types';

const WS_URL = 'ws://localhost:8080';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | MockWebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMockMode = useTutorStore((state) => state.isMockMode);
  const setConnectionStatus = useTutorStore((state) => state.setConnectionStatus);
  const handleServerMessage = useTutorStore((state) => state.handleServerMessage);

  const connect = useCallback(() => {
    // Don't reconnect if already connected
    if (wsRef.current) {
      return;
    }

    setConnectionStatus('connecting');

    if (isMockMode) {
      // Use mock WebSocket
      const mockWs = new MockWebSocket();

      mockWs.onopen = () => {
        setConnectionStatus('connected');
        console.log('[MockWebSocket] Connected');
      };

      mockWs.onmessage = (event: { data: string }) => {
        const message: WSServerMessage = JSON.parse(event.data);
        handleServerMessage(message);
      };

      mockWs.onclose = () => {
        setConnectionStatus('disconnected');
        wsRef.current = null;
      };

      wsRef.current = mockWs;
      return;
    }

    // Real WebSocket connection
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnectionStatus('connected');
      console.log('[WebSocket] Connected');
    };

    ws.onmessage = (event) => {
      const message: WSServerMessage = JSON.parse(event.data);
      handleServerMessage(message);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      wsRef.current = null;

      // Attempt reconnection after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    wsRef.current = ws;
  }, [isMockMode, setConnectionStatus, handleServerMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('disconnected');
  }, [setConnectionStatus]);

  const send = useCallback((message: WSClientMessage) => {
    if (!wsRef.current) {
      throw new Error('WebSocket is not connected');
    }

    wsRef.current.send(JSON.stringify(message));
  }, []);

  const isConnected = useCallback(() => {
    return wsRef.current !== null;
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Reconnect when mock mode changes
  useEffect(() => {
    disconnect();
    // Small delay to ensure cleanup
    const timeout = setTimeout(() => {
      connect();
    }, 100);

    return () => clearTimeout(timeout);
  }, [isMockMode, connect, disconnect]);

  return { send, connect, disconnect, isConnected };
}
