'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Block } from '../types/dashboard';

// ประเภทข้อมูลสำหรับ Collaboration
export interface RemoteUser {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedBlockId: string | null;
  lastActivity: number;
}

export interface CollaborationMessage {
  type: 'join' | 'leave' | 'cursor' | 'select' | 'block-move' | 'block-resize' | 'block-update' | 'sync-request' | 'sync-response';
  userId: string;
  userName: string;
  userColor: string;
  payload?: unknown;
  timestamp: number;
}

interface UseCollaborationConfig {
  wsUrl: string;
  enabled: boolean;
  dashboardId: string;
  userName?: string;
  onRemoteBlockUpdate?: (block: Block) => void; // Callback when remote user updates a block
}

interface UseCollaborationReturn {
  remoteUsers: RemoteUser[];
  isConnected: boolean;
  localUserId: string;
  localUserColor: string;
  // Actions to broadcast
  broadcastCursor: (x: number, y: number) => void;
  broadcastSelect: (blockId: string | null) => void;
  broadcastBlockMove: (block: Block) => void;
  broadcastBlockResize: (block: Block) => void;
  broadcastBlockUpdate: (block: Block) => void;
}

// สุ่มสี่สำหรับผู้ใช้
const USER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getRandomUserName(): string {
  const names = ['User', 'Designer', 'Editor', 'Builder', 'Creator'];
  const num = Math.floor(Math.random() * 1000);
  return `${names[Math.floor(Math.random() * names.length)]}${num}`;
}

export function useCollaboration(config: UseCollaborationConfig): UseCollaborationReturn {
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const localUserIdRef = useRef<string>(generateUserId());
  const localUserColorRef = useRef<string>(getRandomColor());
  const localUserNameRef = useRef<string>(config.userName || getRandomUserName());

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const activityCheckRef = useRef<NodeJS.Timeout | null>(null);

  // ลบผู้ใช้ที่ไม่ active (ไม่มี activity เกิน 30 วินาที)
  useEffect(() => {
    activityCheckRef.current = setInterval(() => {
      const now = Date.now();
      const INACTIVE_THRESHOLD = 30000; // 30 seconds

      setRemoteUsers((prev) =>
        prev.filter((user) => now - user.lastActivity < INACTIVE_THRESHOLD)
      );
    }, 5000);

    return () => {
      if (activityCheckRef.current) {
        clearInterval(activityCheckRef.current);
      }
    };
  }, []);

  // ส่ง Message ไปยัง WebSocket
  const sendMessage = useCallback((message: Omit<CollaborationMessage, 'userId' | 'userName' | 'userColor' | 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const fullMessage: CollaborationMessage = {
        ...message,
        userId: localUserIdRef.current,
        userName: localUserNameRef.current,
        userColor: localUserColorRef.current,
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(fullMessage));
    }
  }, []);

  // จัดการ Message ที่รับมา
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: CollaborationMessage = JSON.parse(event.data);

      // ไม่ประมวลผล message ของตัวเอง
      if (message.userId === localUserIdRef.current) return;

      const now = Date.now();

      switch (message.type) {
        case 'join':
          setRemoteUsers((prev) => {
            // ตรวจสอบว่า user นี้มีอยู่แล้วหรือไม่
            const exists = prev.find((u) => u.id === message.userId);
            if (exists) {
              return prev.map((u) =>
                u.id === message.userId
                  ? { ...u, lastActivity: now }
                  : u
              );
            }
            return [
              ...prev,
              {
                id: message.userId,
                name: message.userName,
                color: message.userColor,
                cursor: null,
                selectedBlockId: null,
                lastActivity: now,
              },
            ];
          });
          break;

        case 'leave':
          setRemoteUsers((prev) => prev.filter((u) => u.id !== message.userId));
          break;

        case 'cursor':
          const cursorPayload = message.payload as { x: number; y: number };
          setRemoteUsers((prev) =>
            prev.map((u) =>
              u.id === message.userId
                ? { ...u, cursor: cursorPayload, lastActivity: now }
                : u
            )
          );
          // Auto-add user if not exists
          setRemoteUsers((prev) => {
            if (!prev.find((u) => u.id === message.userId)) {
              return [
                ...prev,
                {
                  id: message.userId,
                  name: message.userName,
                  color: message.userColor,
                  cursor: cursorPayload,
                  selectedBlockId: null,
                  lastActivity: now,
                },
              ];
            }
            return prev;
          });
          break;

        case 'select':
          const selectPayload = message.payload as { blockId: string | null };
          setRemoteUsers((prev) =>
            prev.map((u) =>
              u.id === message.userId
                ? { ...u, selectedBlockId: selectPayload.blockId, lastActivity: now }
                : u
            )
          );
          break;

        case 'block-move':
        case 'block-resize':
        case 'block-update':
          // เรียก callback เพื่ออัพเดท block ใน parent component
          const blockPayload = message.payload as Block;
          if (blockPayload && config.onRemoteBlockUpdate) {
            config.onRemoteBlockUpdate(blockPayload);
          }
          setRemoteUsers((prev) =>
            prev.map((u) =>
              u.id === message.userId
                ? { ...u, lastActivity: now }
                : u
            )
          );
          break;
      }
    } catch (err) {
      console.error('Failed to parse collaboration message:', err);
    }
  }, [config.onRemoteBlockUpdate]);

  // เชื่อมต่อ WebSocket
  const connect = useCallback(() => {
    if (!config.enabled || !config.wsUrl) return;

    try {
      // Add dashboard ID as query param
      const url = new URL(config.wsUrl);
      url.searchParams.set('dashboard', config.dashboardId);

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Collaboration WebSocket connected');
        setIsConnected(true);

        // ส่ง join message
        sendMessage({ type: 'join' });

        // เริ่ม heartbeat
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error('Collaboration WebSocket error:', event);
      };

      ws.onclose = (event) => {
        console.log('Collaboration WebSocket closed:', event.code);
        setIsConnected(false);

        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }

        // Reconnect ถ้าไม่ได้ปิดแบบตั้งใจ
        if (config.enabled && event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('Failed to connect collaboration:', err);
    }
  }, [config.enabled, config.wsUrl, config.dashboardId, handleMessage, sendMessage]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    if (wsRef.current) {
      sendMessage({ type: 'leave' });
      wsRef.current.close(1000);
      wsRef.current = null;
    }
    setIsConnected(false);
    setRemoteUsers([]);
  }, [sendMessage]);

  // Effect สำหรับเชื่อมต่อ
  useEffect(() => {
    if (config.enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [config.enabled, config.wsUrl, config.dashboardId]);

  // Broadcast functions
  const broadcastCursor = useCallback((x: number, y: number) => {
    sendMessage({ type: 'cursor', payload: { x, y } });
  }, [sendMessage]);

  const broadcastSelect = useCallback((blockId: string | null) => {
    sendMessage({ type: 'select', payload: { blockId } });
  }, [sendMessage]);

  const broadcastBlockMove = useCallback((block: Block) => {
    sendMessage({ type: 'block-move', payload: block });
  }, [sendMessage]);

  const broadcastBlockResize = useCallback((block: Block) => {
    sendMessage({ type: 'block-resize', payload: block });
  }, [sendMessage]);

  const broadcastBlockUpdate = useCallback((block: Block) => {
    sendMessage({ type: 'block-update', payload: block });
  }, [sendMessage]);

  return {
    remoteUsers,
    isConnected,
    localUserId: localUserIdRef.current,
    localUserColor: localUserColorRef.current,
    broadcastCursor,
    broadcastSelect,
    broadcastBlockMove,
    broadcastBlockResize,
    broadcastBlockUpdate,
  };
}
