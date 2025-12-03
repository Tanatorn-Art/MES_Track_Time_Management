'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Block } from '../../types/dashboard';
import {
  Type,
  Hash,
  Tag,
  Gauge,
  BarChart3,
  Image,
  Clock,
  Table,
  Box
} from 'lucide-react';

interface DraggableBlockProps {
  block: Block;
  isSelected: boolean;
  isEditMode: boolean;
  onSelect: () => void;
  onUpdate: (block: Block) => void;
  onDelete: () => void;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
  boundValue?: string;
  // Multi-select drag support
  selectedBlockIds?: string[];
  allBlocks?: Block[];
  onMultiBlocksUpdate?: (blocks: Block[]) => void;
}

export default function DraggableBlock({
  block,
  isSelected,
  isEditMode,
  onSelect,
  onUpdate,
  onDelete,
  canvasRef,
  boundValue,
  selectedBlockIds = [],
  allBlocks = [],
  onMultiBlocksUpdate,
}: DraggableBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const blockRef = useRef<HTMLDivElement>(null);

  const getCanvasOffset = () => {
    if (canvasRef?.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    }
    return { x: 0, y: 0 };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditMode) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    setIsDragging(true);

    const canvasOffset = getCanvasOffset();
    setDragOffset({
      x: e.clientX - canvasOffset.x - block.position.x,
      y: e.clientY - canvasOffset.y - block.position.y,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isEditMode) return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const canvasOffset = getCanvasOffset();
        const newX = e.clientX - canvasOffset.x - dragOffset.x;
        const newY = e.clientY - canvasOffset.y - dragOffset.y;

        // Calculate delta movement
        const deltaX = newX - block.position.x;
        const deltaY = newY - block.position.y;

        // Check if this block is part of multi-selection
        const isMultiSelected = selectedBlockIds.length > 1 && selectedBlockIds.includes(block.id);

        if (isMultiSelected && onMultiBlocksUpdate) {
          // Move all selected blocks together
          const updatedBlocks = allBlocks.map(b => {
            if (selectedBlockIds.includes(b.id)) {
              return {
                ...b,
                position: {
                  x: Math.max(0, b.position.x + deltaX),
                  y: Math.max(0, b.position.y + deltaY),
                },
              };
            }
            return b;
          });
          onMultiBlocksUpdate(updatedBlocks);
        } else {
          // Single block drag
          onUpdate({
            ...block,
            position: {
              x: Math.max(0, newX),
              y: Math.max(0, newY),
            },
          });
        }
      } else if (isResizing && blockRef.current) {
        const rect = blockRef.current.getBoundingClientRect();
        onUpdate({
          ...block,
          size: {
            width: Math.max(50, e.clientX - rect.left),
            height: Math.max(30, e.clientY - rect.top),
          },
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, block, onUpdate]);

  // Get icon based on block type
  const getTypeIcon = () => {
    const iconProps = { size: 12, className: 'opacity-70' };
    switch (block.type) {
      case 'text': return <Type {...iconProps} />;
      case 'number': return <Hash {...iconProps} />;
      case 'label': return <Tag {...iconProps} />;
      case 'gauge': return <Gauge {...iconProps} />;
      case 'chart': return <BarChart3 {...iconProps} />;
      case 'image': return <Image {...iconProps} />;
      case 'clock': return <Clock {...iconProps} />;
      case 'table': return <Table {...iconProps} />;
      default: return <Box {...iconProps} />;
    }
  };

  return (
    <div
      ref={blockRef}
      data-block-id={block.id}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: block.position.x,
        top: block.position.y,
        width: block.size.width,
        height: block.size.height,
        backgroundColor: block.style.backgroundColor,
        color: block.style.textColor,
        fontSize: block.style.fontSize,
        fontWeight: block.style.fontWeight,
        fontFamily: block.style.fontFamily || 'Arial',
        borderRadius: block.style.borderRadius,
        padding: block.style.padding,
        borderWidth: block.style.borderWidth,
        borderColor: block.style.borderColor,
        borderStyle: 'solid',
        cursor: isEditMode ? 'move' : 'default',
        userSelect: 'none',
        boxShadow: isSelected && isEditMode ? '0 0 0 2px #3b82f6' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: block.style.textAlign === 'left' ? 'flex-start' : block.style.textAlign === 'right' ? 'flex-end' : 'center',
        justifyContent: 'center',
        textAlign: block.style.textAlign || 'center',
        overflow: 'hidden',
      }}
      className="transition-shadow"
    >
      {/* Type icon for edit mode */}
      {isEditMode && (
        <div className="absolute top-1 left-1 text-xs opacity-50">
          {getTypeIcon()}
        </div>
      )}

      {/* Show bound variable key in edit mode */}
      {isEditMode && block.variableKey && (
        <div className="absolute top-1 right-1 text-[10px] text-blue-400 bg-blue-900/50 px-1 rounded">
          {block.variableKey}
        </div>
      )}

      {/* Display bound value or label */}
      {boundValue !== undefined ? (
        <div
          className="truncate w-full font-medium"
          style={{
            fontSize: block.style.fontSize,
            textAlign: block.style.textAlign || 'center',
          }}
        >
          {boundValue}
        </div>
      ) : block.label && (
        <div
          className="truncate w-full font-medium"
          style={{
            fontSize: block.style.fontSize,
            textAlign: block.style.textAlign || 'center',
          }}
        >
          {block.label}
        </div>
      )}

      {/* Content placeholder for different types */}
      {block.content && !boundValue && (
        <div
          className="text-xs opacity-70 truncate w-full"
          style={{ textAlign: block.style.textAlign || 'center' }}
        >
          {block.content}
        </div>
      )}

      {/* Edit mode controls */}
      {isEditMode && isSelected && (
        <>
          {/* Resize handle */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-blue-500 opacity-80"
            style={{
              borderTopLeftRadius: 4,
            }}
          />
        </>
      )}
    </div>
  );
}
