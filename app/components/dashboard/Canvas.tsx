'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Block, Size } from '../../types/dashboard';
import DraggableBlock from './DraggableBlock';

interface CanvasProps {
  blocks: Block[];
  selectedBlockId: string | null;
  isEditMode: boolean;
  backgroundImage: string;
  canvasSize: Size;
  onBlockSelect: (id: string | null) => void;
  onBlockUpdate: (block: Block) => void;
  onBlockDelete: (id: string) => void;
  apiData: Record<string, unknown> | null;
}

// Helper to get value from nested object by dot notation path
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export default function Canvas({
  blocks,
  selectedBlockId,
  isEditMode,
  backgroundImage,
  canvasSize,
  onBlockSelect,
  onBlockUpdate,
  onBlockDelete,
  apiData,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and Zoom state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Handle spacebar press for panning mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(0.1, scale + delta), 3);

    // Zoom towards mouse position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scaleChange = newScale / scale;
      const newX = mouseX - (mouseX - position.x) * scaleChange;
      const newY = mouseY - (mouseY - position.y) * scaleChange;

      setPosition({ x: newX, y: newY });
    }

    setScale(newScale);
  }, [scale, position]);

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isSpacePressed) {
      e.preventDefault();
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [isSpacePressed]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && isSpacePressed) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;

      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [isPanning, isSpacePressed, lastMousePos]);

  // Handle mouse up to stop panning
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Get bound value for a block
  const getBoundValue = (block: Block): string | undefined => {
    if (!block.variableKey || !apiData) return undefined;

    // Handle array data (use first item)
    const data = Array.isArray(apiData) ? apiData[0] : apiData;
    if (!data) return undefined;

    const value = getValueByPath(data as Record<string, unknown>, block.variableKey);
    if (value === undefined || value === null) return undefined;
    return String(value);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden bg-gray-800"
      style={{
        cursor: isSpacePressed ? (isPanning ? 'grabbing' : 'grab') : 'default',
      }}
      onClick={() => !isSpacePressed && onBlockSelect(null)}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="relative origin-top-left"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          width: canvasSize.width,
          height: canvasSize.height,
        }}
      >
        <div
          ref={canvasRef}
          className="relative w-full h-full"
          style={{
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: backgroundImage ? undefined : '#1f2937',
          }}
        >
          {/* Grid pattern for edit mode */}
          {isEditMode && (
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
          )}

          {/* Blocks */}
          {blocks.map((block) => (
            <DraggableBlock
              key={block.id}
              block={block}
              isSelected={selectedBlockId === block.id}
              isEditMode={isEditMode}
              onSelect={() => onBlockSelect(block.id)}
              onUpdate={onBlockUpdate}
              onDelete={() => onBlockDelete(block.id)}
              canvasRef={canvasRef}
              boundValue={getBoundValue(block)}
            />
          ))}

          {/* Empty hint */}
          {isEditMode && blocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-gray-500 text-center">
                <div>Click a tool below to add blocks</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm pointer-events-none">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
