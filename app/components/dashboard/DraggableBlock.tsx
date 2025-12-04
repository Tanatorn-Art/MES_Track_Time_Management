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
import { RemoteSelectionBorder, RemoteSelectionIndicator } from './RemoteCursors';
import { RemoteUser } from '../../hooks/useCollaboration';

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
  // API data for table rendering
  apiData?: Record<string, unknown> | unknown[] | null;
  showLiveData?: boolean;
  // Collaboration
  remoteUsers?: RemoteUser[];
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
  apiData,
  showLiveData = false,
  remoteUsers = [],
}: DraggableBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const blockRef = useRef<HTMLDivElement>(null);

  // Store initial size and mouse position for resize
  const resizeStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    width: 0,
    height: 0
  });

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

    // Store initial values when resize starts
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: block.size.width,
      height: block.size.height,
    };

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
      } else if (isResizing) {
        // Calculate size based on delta from start position
        const deltaX = e.clientX - resizeStartRef.current.mouseX;
        const deltaY = e.clientY - resizeStartRef.current.mouseY;

        onUpdate({
          ...block,
          size: {
            width: Math.max(50, resizeStartRef.current.width + deltaX),
            height: Math.max(30, resizeStartRef.current.height + deltaY),
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

      {/* Remote user selection indicator - show who is editing this block */}
      {isEditMode && remoteUsers.length > 0 && (
        <>
          <RemoteSelectionIndicator users={remoteUsers} blockId={block.id} />
          <RemoteSelectionBorder users={remoteUsers} blockId={block.id} />
        </>
      )}

      {/* Show bound variable key in edit mode */}
      {isEditMode && block.variableKey && block.type !== 'table' && (
        <div className="absolute top-1 right-1 text-[10px] text-blue-400 bg-blue-900/50 px-1 rounded">
          {block.variableKey}
        </div>
      )}

      {/* Table Block Rendering */}
      {block.type === 'table' && block.content === 'table' && (() => {
        try {
          // Handle case where variableKey might be an object already or a JSON string
          let tableConfig: {
            columns?: { field: string; header: string; width: number; enabled: boolean; headerBgColor?: string; headerTextColor?: string }[];
            arrayField?: string;
            style?: Record<string, unknown>;
            sortField?: string;
            sortOrder?: 'asc' | 'desc' | 'none';
            maxRecords?: number;
          };

          if (typeof block.variableKey === 'string' && block.variableKey.startsWith('{')) {
            tableConfig = JSON.parse(block.variableKey);
          } else if (typeof block.variableKey === 'object' && block.variableKey !== null) {
            tableConfig = block.variableKey as typeof tableConfig;
          } else {
            // No valid config, show placeholder
            return (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                <div className="text-center">
                  <Table size={24} className="mx-auto mb-1 opacity-50" />
                  <div>{block.label || 'Table'}</div>
                  <div className="text-xs text-gray-500">No config</div>
                </div>
              </div>
            );
          }

          const { columns = [], arrayField = '', style: tStyle = {}, sortField, sortOrder, maxRecords } = tableConfig;

          const tableStyle = tStyle as {
            fontSize?: number;
            headerBg?: string;
            headerText?: string;
            headerFontSize?: number;
            showBorder?: boolean;
            borderColor?: string;
            stripedRows?: boolean;
            rowAltBg?: string;
            rowBg?: string;
            rowText?: string;
          };

          // Get data array from apiData
          let dataArray: Record<string, unknown>[] = [];
          if (apiData && showLiveData) {
            if (arrayField === '__ROOT_ARRAY__' && Array.isArray(apiData)) {
              dataArray = [...(apiData as unknown as Record<string, unknown>[])];
            } else if (arrayField && !Array.isArray(apiData) && (apiData as Record<string, unknown>)[arrayField]) {
              dataArray = [...((apiData as Record<string, unknown>)[arrayField] as Record<string, unknown>[])];
            }
          }

          // Apply sorting
          if (sortField && sortOrder && sortOrder !== 'none' && dataArray.length > 0) {
            dataArray.sort((a, b) => {
              const aVal = a[sortField];
              const bVal = b[sortField];

              // Handle null/undefined
              if (aVal == null && bVal == null) return 0;
              if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
              if (bVal == null) return sortOrder === 'asc' ? -1 : 1;

              // Compare values
              let comparison = 0;
              if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
              } else {
                comparison = String(aVal).localeCompare(String(bVal));
              }

              return sortOrder === 'asc' ? comparison : -comparison;
            });
          }

          // Apply max records limit
          if (maxRecords && maxRecords > 0) {
            dataArray = dataArray.slice(0, maxRecords);
          }

          // Filter enabled columns, or use all if none have enabled flag
          const enabledColumns = columns.filter((c: { enabled?: boolean }) => c.enabled !== false);

          // Calculate dynamic font size based on block size and content
          const numColumns = enabledColumns.length || 1;
          const numRows = Math.max(dataArray.length, 3); // At least 3 rows for preview

          // Base calculations
          const baseFontSize = tableStyle.fontSize || 12;
          const baseHeaderFontSize = tableStyle.headerFontSize || 12;

          // Calculate available space per cell
          const availableWidth = block.size.width / numColumns;
          const availableHeight = block.size.height / (numRows + 1); // +1 for header

          // Scale factor based on available space (smaller of width or height constraint)
          const widthScale = Math.min(1.5, Math.max(0.5, availableWidth / 80)); // 80px is ideal column width
          const heightScale = Math.min(1.5, Math.max(0.5, availableHeight / 25)); // 25px is ideal row height
          const scaleFactor = Math.min(widthScale, heightScale);

          const scaledFontSize = Math.max(8, Math.min(24, Math.round(baseFontSize * scaleFactor)));
          const scaledHeaderFontSize = Math.max(8, Math.min(24, Math.round(baseHeaderFontSize * scaleFactor)));
          const scaledPadding = Math.max(2, Math.round(4 * scaleFactor));

          // If no columns, show placeholder
          if (enabledColumns.length === 0) {
            return (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                <div className="text-center">
                  <Table size={24} className="mx-auto mb-1 opacity-50" />
                  <div>{block.label || 'Table'}</div>
                  <div className="text-xs text-gray-500">No columns defined</div>
                </div>
              </div>
            );
          }

          return (
            <div className="w-full h-full overflow-hidden">
              <table className="w-full h-full border-collapse text-left table-fixed" style={{ fontSize: scaledFontSize }}>
                <thead>
                  <tr>
                    {enabledColumns.map((col: { field: string; header: string; width: number; headerBgColor?: string; headerTextColor?: string }, idx: number) => (
                      <th
                        key={idx}
                        className="font-medium break-words align-top"
                        style={{
                          backgroundColor: col.headerBgColor || tableStyle.headerBg || '#374151',
                          color: col.headerTextColor || tableStyle.headerText || '#ffffff',
                          fontSize: scaledHeaderFontSize,
                          padding: scaledPadding,
                          borderWidth: tableStyle.showBorder ? 1 : 0,
                          borderColor: tableStyle.borderColor || '#4b5563',
                          borderStyle: 'solid',
                          wordBreak: 'break-word'
                        }}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataArray.length > 0 ? (
                    dataArray.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        style={{
                          backgroundColor: tableStyle.stripedRows && rowIdx % 2 === 1
                            ? (tableStyle.rowAltBg || '#111827')
                            : (tableStyle.rowBg || '#1f2937')
                        }}
                      >
                        {enabledColumns.map((col: { field: string; header: string; width: number; headerBgColor?: string; headerTextColor?: string }, colIdx: number) => (
                          <td
                            key={colIdx}
                            className="break-words align-top"
                            style={{
                              color: tableStyle.rowText || '#e5e7eb',
                              padding: scaledPadding,
                              borderWidth: tableStyle.showBorder ? 1 : 0,
                              borderColor: tableStyle.borderColor || '#4b5563',
                              borderStyle: 'solid',
                              wordBreak: 'break-word'
                            }}
                          >
                            {String(row[col.field] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    // Show empty rows when no data or in edit mode
                    [0, 1, 2].map((rowIdx) => (
                      <tr
                        key={rowIdx}
                        style={{
                          backgroundColor: tableStyle.stripedRows && rowIdx % 2 === 1
                            ? (tableStyle.rowAltBg || '#111827')
                            : (tableStyle.rowBg || '#1f2937')
                        }}
                      >
                        {enabledColumns.map((col: { field: string; header: string; width: number; headerBgColor?: string; headerTextColor?: string }, colIdx: number) => (
                          <td
                            key={colIdx}
                            className="break-words align-top"
                            style={{
                              color: tableStyle.rowText || '#e5e7eb',
                              padding: scaledPadding,
                              borderWidth: tableStyle.showBorder ? 1 : 0,
                              borderColor: tableStyle.borderColor || '#4b5563',
                              borderStyle: 'solid',
                              wordBreak: 'break-word'
                            }}
                          >
                            {isEditMode ? `{${col.field}}` : '-'}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {isEditMode && (
                <div className="absolute bottom-1 right-6 text-[9px] text-purple-400 bg-purple-900/50 px-1 rounded">
                  {block.label}
                </div>
              )}
            </div>
          );
        } catch {
          return (
            <div className="text-xs text-red-400">Invalid table config</div>
          );
        }
      })()}

      {/* Display bound value or label (non-table blocks) */}
      {block.type !== 'table' && boundValue !== undefined ? (
        <div
          className="truncate w-full font-medium"
          style={{
            fontSize: block.style.fontSize,
            textAlign: block.style.textAlign || 'center',
          }}
        >
          {boundValue}
        </div>
      ) : block.type !== 'table' && block.label && (
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

      {/* Content placeholder for different types (non-table) */}
      {block.type !== 'table' && block.content && !boundValue && (
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
