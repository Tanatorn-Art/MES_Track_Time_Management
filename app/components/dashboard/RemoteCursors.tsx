'use client';

import React from 'react';
import { RemoteUser } from '../../hooks/useCollaboration';
import { MousePointer2 } from 'lucide-react';

interface RemoteCursorsProps {
  users: RemoteUser[];
  scale: number;
  offsetX: number;
  offsetY: number;
}

// แสดง Mouse Cursor ของผู้ใช้อื่นๆ บน Canvas
export default function RemoteCursors({ users, scale, offsetX, offsetY }: RemoteCursorsProps) {
  return (
    <>
      {users.map((user) => {
        if (!user.cursor) return null;

        // คำนวณตำแหน่งจริงบนหน้าจอ (รวม scale และ offset)
        const screenX = user.cursor.x * scale + offsetX;
        const screenY = user.cursor.y * scale + offsetY;

        return (
          <div
            key={user.id}
            className="pointer-events-none fixed z-[9999] transition-all duration-75"
            style={{
              left: screenX,
              top: screenY,
              transform: 'translate(-2px, -2px)',
            }}
          >
            {/* Mouse Pointer Icon */}
            <MousePointer2
              size={24}
              className="drop-shadow-md"
              style={{
                color: user.color,
                fill: user.color,
                transform: 'rotate(-15deg)',
              }}
            />

            {/* User Name Badge */}
            <div
              className="absolute left-5 top-3 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-lg"
              style={{
                backgroundColor: user.color,
              }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </>
  );
}

// แสดง Indicator ว่าผู้ใช้อื่นกำลังเลือก Block นี้อยู่
interface RemoteSelectionIndicatorProps {
  users: RemoteUser[];
  blockId: string;
}

export function RemoteSelectionIndicator({ users, blockId }: RemoteSelectionIndicatorProps) {
  const selectingUsers = users.filter((u) => u.selectedBlockId === blockId);

  if (selectingUsers.length === 0) return null;

  return (
    <div className="absolute -top-6 left-0 flex gap-1">
      {selectingUsers.map((user) => (
        <div
          key={user.id}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-md"
          style={{ backgroundColor: user.color }}
        >
          <div
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: 'white' }}
          />
          {user.name}
        </div>
      ))}
    </div>
  );
}

// แสดง Border รอบ Block ที่ผู้ใช้อื่นกำลังเลือก
interface RemoteSelectionBorderProps {
  users: RemoteUser[];
  blockId: string;
}

export function RemoteSelectionBorder({ users, blockId }: RemoteSelectionBorderProps) {
  const selectingUser = users.find((u) => u.selectedBlockId === blockId);

  if (!selectingUser) return null;

  return (
    <>
      {/* Solid colored border */}
      <div
        className="pointer-events-none absolute inset-[-4px] rounded-lg"
        style={{
          border: `3px solid ${selectingUser.color}`,
          boxShadow: `0 0 12px ${selectingUser.color}80, inset 0 0 8px ${selectingUser.color}20`,
        }}
      />
      {/* User name badge on top-right */}
      <div
        className="absolute -top-5 -right-1 px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-lg whitespace-nowrap z-10"
        style={{ backgroundColor: selectingUser.color }}
      >
        {selectingUser.name}
      </div>
    </>
  );
}

// แสดงรายการผู้ใช้ที่กำลังดู/แก้ไข Dashboard อยู่
interface ActiveUsersListProps {
  users: RemoteUser[];
  localUserName: string;
  localUserColor: string;
}

export function ActiveUsersList({ users, localUserName, localUserColor }: ActiveUsersListProps) {
  const totalUsers = users.length + 1; // +1 สำหรับตัวเอง

  return (
    <div className="flex items-center gap-2">
      {/* Avatar Stack */}
      <div className="flex -space-x-2">
        {/* ตัวเอง */}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md"
          style={{ backgroundColor: localUserColor }}
          title={`${localUserName} (You)`}
        >
          {localUserName.charAt(0).toUpperCase()}
        </div>

        {/* ผู้ใช้อื่นๆ (แสดงสูงสุด 4 คน) */}
        {users.slice(0, 4).map((user) => (
          <div
            key={user.id}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md transition-transform hover:scale-110 hover:z-10"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}

        {/* ถ้ามีมากกว่า 5 คน แสดง +N */}
        {users.length > 4 && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-600 text-xs font-bold text-white shadow-md"
            title={`${users.length - 4} more users`}
          >
            +{users.length - 4}
          </div>
        )}
      </div>

      {/* จำนวนผู้ใช้ */}
      <span className="text-sm text-gray-400">
        {totalUsers} {totalUsers === 1 ? 'user' : 'users'} online
      </span>
    </div>
  );
}

// Tooltip แสดงข้อมูลผู้ใช้
interface UserTooltipProps {
  user: RemoteUser;
  children: React.ReactNode;
}

export function UserTooltip({ user, children }: UserTooltipProps) {
  return (
    <div className="group relative">
      {children}
      <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div
          className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-white shadow-lg"
          style={{ backgroundColor: user.color }}
        >
          <div className="font-medium">{user.name}</div>
          {user.selectedBlockId && (
            <div className="text-xs opacity-80">
              Editing: {user.selectedBlockId}
            </div>
          )}
        </div>
        <div
          className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45"
          style={{ backgroundColor: user.color }}
        />
      </div>
    </div>
  );
}
