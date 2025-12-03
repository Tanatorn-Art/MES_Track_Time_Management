'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketConfig {
  url: string;
  enabled: boolean;
  reconnectInterval?: number; // ms, default 3000
  heartbeatInterval?: number; // ms, default 30000
}

interface UseWebSocketReturn {
  data: unknown;
  isConnected: boolean;
  error: string | null;
  send: (message: string | object) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(config: WebSocketConfig | null): UseWebSocketReturn {
  const [data, setData] = useState<unknown>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearTimers();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearTimers]);

  const connect = useCallback(() => {
    if (!config?.url || !config.enabled) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(config.url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected:', config.url);
        setIsConnected(true);
        setError(null);

        // Start heartbeat to keep connection alive
        const heartbeat = config.heartbeatInterval || 30000;
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, heartbeat);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setData(parsed);
        } catch {
          // If not JSON, store as string
          setData(event.data);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        clearTimers();

        // Auto reconnect if enabled and not manually closed
        if (config.enabled && event.code !== 1000) {
          const reconnectDelay = config.reconnectInterval || 3000;
          console.log(`Reconnecting in ${reconnectDelay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnected(false);
    }
  }, [config, clearTimers]);

  const send = useCallback((message: string | object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg = typeof message === 'string' ? message : JSON.stringify(message);
      wsRef.current.send(msg);
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  // Connect when config changes
  useEffect(() => {
    if (config?.enabled && config?.url) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [config?.url, config?.enabled, connect, disconnect]);

  return { data, isConnected, error, send, connect, disconnect };
}
