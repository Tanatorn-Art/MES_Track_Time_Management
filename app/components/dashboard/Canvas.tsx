'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Block, Size, BlockGroup } from '../../types/dashboard';
import DraggableBlock from './DraggableBlock';
import { Group, Edit2, Trash2, Ungroup, Check, X } from 'lucide-react';
import RemoteCursors, { RemoteSelectionBorder } from './RemoteCursors';
import { RemoteUser } from '../../hooks/useCollaboration';

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface CanvasProps {
  blocks: Block[];
  groups: BlockGroup[];
  selectedBlockId: string | null;
  selectedBlockIds: string[];
  selectedGroupId: string | null;
  isEditMode: boolean;
  backgroundImage: string;
  canvasSize: Size;
  onBlockSelect: (id: string | null) => void;
  onMultiBlockSelect: (ids: string[]) => void;
  onBlockUpdate: (block: Block) => void;
  onMultiBlocksUpdate: (blocks: Block[]) => void;
  onBlockDelete: (id: string) => void;
  onGroupBlocks: (ids: string[]) => void;
  onSelectGroup: (groupId: string) => void; // Select all blocks in a group
  onUngroupBlocks: (groupId: string) => void;
  onRenameGroup: (groupId: string, newName: string) => void;
  onDeleteGroup: (groupId: string) => void;
  apiData: Record<string, unknown> | unknown[] | null;
  showLiveData?: boolean; // Toggle to show real data or variable names
  // Collaboration props
  remoteUsers?: RemoteUser[];
  onCursorMove?: (x: number, y: number) => void;
}

// Helper to get value from nested object by path (supports bracket notation like data[0].field or [0].field)
function getValueByPath(obj: Record<string, unknown> | unknown[], path: string): unknown {
  if (!path || !obj) return undefined;

  // Convert bracket notation to dot notation: data[0].field -> data.0.field, [0].field -> 0.field
  let normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');

  // Remove leading dot if path starts with bracket notation (e.g., "[0].station" becomes ".0.station")
  if (normalizedPath.startsWith('.')) {
    normalizedPath = normalizedPath.substring(1);
  }

  const keys = normalizedPath.split('.').filter(k => k !== '');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  if (current === null || current === undefined) return undefined;
  return current;
}

export default function Canvas({
  blocks,
  groups,
  selectedBlockId,
  selectedBlockIds,
  selectedGroupId,
  isEditMode,
  backgroundImage,
  canvasSize,
  onBlockSelect,
  onMultiBlockSelect,
  onBlockUpdate,
  onMultiBlocksUpdate,
  onBlockDelete,
  onGroupBlocks,
  onSelectGroup,
  onUngroupBlocks,
  onRenameGroup,
  onDeleteGroup,
  apiData,
  showLiveData = false,
  remoteUsers = [],
  onCursorMove,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and Zoom state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Selection box state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [justFinishedSelecting, setJustFinishedSelecting] = useState(false);

  // Component/Group editing state
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState('');

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

  // Get canvas-relative coordinates from mouse event
  const getCanvasCoordinates = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - position.x) / scale;
    const y = (e.clientY - rect.top - position.y) / scale;
    return { x, y };
  }, [position, scale]);

  // Check if a block intersects with the selection box
  const blockIntersectsSelection = useCallback((block: Block, box: SelectionBox) => {
    const minX = Math.min(box.startX, box.endX);
    const maxX = Math.max(box.startX, box.endX);
    const minY = Math.min(box.startY, box.endY);
    const maxY = Math.max(box.startY, box.endY);

    const blockRight = block.position.x + block.size.width;
    const blockBottom = block.position.y + block.size.height;

    return !(
      block.position.x > maxX ||
      blockRight < minX ||
      block.position.y > maxY ||
      blockBottom < minY
    );
  }, []);

  // Handle mouse down for panning or selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if clicked on the canvas background (not on a block)
    const target = e.target as HTMLElement;
    const isClickOnBlock = target.closest('[data-block-id]');

    if (isSpacePressed) {
      e.preventDefault();
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (isEditMode && e.button === 0 && !isClickOnBlock) {
      // Left click on empty canvas - start selection box
      const coords = getCanvasCoordinates(e);
      setIsSelecting(true);
      setSelectionBox({
        startX: coords.x,
        startY: coords.y,
        endX: coords.x,
        endY: coords.y,
      });
    }
  }, [isSpacePressed, isEditMode, getCanvasCoordinates]);

  // Handle mouse move for panning or selection
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Broadcast cursor position for collaboration
    if (onCursorMove && isEditMode) {
      const coords = getCanvasCoordinates(e);
      onCursorMove(coords.x, coords.y);
    }

    if (isPanning && isSpacePressed) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;

      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (isSelecting && selectionBox) {
      const coords = getCanvasCoordinates(e);
      setSelectionBox(prev => prev ? {
        ...prev,
        endX: coords.x,
        endY: coords.y,
      } : null);
    }
  }, [isPanning, isSpacePressed, lastMousePos, isSelecting, selectionBox, getCanvasCoordinates]);

  // Handle mouse up to stop panning or finish selection
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);

    if (isSelecting && selectionBox) {
      // Only count as selection if the box is big enough (not just a click)
      const boxWidth = Math.abs(selectionBox.endX - selectionBox.startX);
      const boxHeight = Math.abs(selectionBox.endY - selectionBox.startY);

      if (boxWidth > 10 || boxHeight > 10) {
        // Find all blocks that intersect with the selection box
        const selectedIds = blocks
          .filter(block => blockIntersectsSelection(block, selectionBox))
          .map(block => block.id);

        if (selectedIds.length > 0) {
          onMultiBlockSelect(selectedIds);
          setJustFinishedSelecting(true);
          // Reset the flag after a short delay
          setTimeout(() => setJustFinishedSelecting(false), 100);
        } else {
          onMultiBlockSelect([]);
        }
      }
    }

    setIsSelecting(false);
    setSelectionBox(null);
  }, [isSelecting, selectionBox, blocks, blockIntersectsSelection, onMultiBlockSelect]);

  // Get bound value for a block
  const getBoundValue = (block: Block): string | undefined => {
    // If not showing live data, return variable name
    if (!showLiveData) {
      return block.variableKey ? `{${block.variableKey}}` : undefined;
    }

    if (!block.variableKey || !apiData) return undefined;

    let value: unknown = undefined;
    const varKey = block.variableKey;

    // Case 0: variableKey is like "[0].station" - root array with explicit index
    const rootArrayMatch = varKey.match(/^\[(\d+)\]\.(.+)$/);
    if (rootArrayMatch && Array.isArray(apiData)) {
      const [, indexStr, fieldPath] = rootArrayMatch;
      const index = parseInt(indexStr, 10);
      if (apiData[index]) {
        value = getValueByPath(apiData[index] as Record<string, unknown>, fieldPath);
      }
    }

    // Case 1: variableKey is like "data[0].htcCode" - explicit array index
    if (value === undefined || value === null) {
      const arrayMatch = varKey.match(/^(\w+)\[(\d+)\]\.(.+)$/);
      if (arrayMatch) {
        const [, fieldName, indexStr, subPath] = arrayMatch;
        const index = parseInt(indexStr, 10);

        // Check if apiData is the array itself
        if (Array.isArray(apiData) && apiData[index]) {
          value = getValueByPath(apiData[index] as Record<string, unknown>, subPath);
        }
        // Check if apiData has this field as array property
        if (value === undefined || value === null) {
          const fieldData = (apiData as Record<string, unknown>)[fieldName];
          if (Array.isArray(fieldData) && fieldData[index]) {
            value = getValueByPath(fieldData[index] as Record<string, unknown>, subPath);
          }
        }
      }
    }

    // Case 2: variableKey is like "data.id" where apiData.data is an array
    // Use first item (index 0) by default
    if (value === undefined || value === null) {
      const dotMatch = varKey.match(/^(\w+)\.(.+)$/);
      if (dotMatch) {
        const [, fieldName, subPath] = dotMatch;
        const fieldData = (apiData as Record<string, unknown>)[fieldName];
        if (Array.isArray(fieldData) && fieldData[0]) {
          value = getValueByPath(fieldData[0] as Record<string, unknown>, subPath);
        }
      }
    }

    // Case 3: Direct path lookup (e.g., "success", "message")
    if (value === undefined || value === null) {
      value = getValueByPath(apiData as Record<string, unknown>, varKey);
    }

    // Case 4: apiData is array, try first item
    if ((value === undefined || value === null) && Array.isArray(apiData) && apiData[0]) {
      value = getValueByPath(apiData[0] as Record<string, unknown>, varKey);
    }

    if (value === undefined || value === null) return undefined;
    return String(value);
  };

  // Calculate selection box bounds for multi-select UI
  const getMultiSelectBounds = useCallback(() => {
    if (selectedBlockIds.length < 2) return null;

    const selectedBlocks = blocks.filter(b => selectedBlockIds.includes(b.id));
    if (selectedBlocks.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    selectedBlocks.forEach(block => {
      minX = Math.min(minX, block.position.x);
      minY = Math.min(minY, block.position.y);
      maxX = Math.max(maxX, block.position.x + block.size.width);
      maxY = Math.max(maxY, block.position.y + block.size.height);
    });

    return { minX, minY, maxX, maxY };
  }, [selectedBlockIds, blocks]);

  const multiSelectBounds = getMultiSelectBounds();

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden bg-gray-800 relative"
      style={{
        cursor: isSpacePressed ? (isPanning ? 'grabbing' : 'grab') : (isSelecting ? 'crosshair' : 'default'),
      }}
      onClick={(e) => {
        // Only clear selection if not from selection box action
        if (!isSpacePressed && !isSelecting && !justFinishedSelecting) {
          const target = e.target as HTMLElement;
          const isClickOnBlock = target.closest('[data-block-id]');
          if (!isClickOnBlock) {
            onBlockSelect(null);
            onMultiBlockSelect([]);
          }
        }
      }}
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
              isSelected={selectedBlockId === block.id || selectedBlockIds.includes(block.id)}
              isEditMode={isEditMode}
              onSelect={() => {
                // If block is in a group, select all blocks in that group
                if (block.groupId) {
                  onSelectGroup(block.groupId);
                } else if (!selectedBlockIds.includes(block.id)) {
                  onBlockSelect(block.id);
                  onMultiBlockSelect([]);
                }
              }}
              onUpdate={onBlockUpdate}
              onDelete={() => onBlockDelete(block.id)}
              canvasRef={canvasRef}
              boundValue={getBoundValue(block)}
              selectedBlockIds={selectedBlockIds}
              allBlocks={blocks}
              onMultiBlocksUpdate={onMultiBlocksUpdate}
              apiData={apiData}
              showLiveData={showLiveData}
              remoteUsers={remoteUsers}
            />
          ))}

          {/* Selection Box (while dragging) */}
          {isSelecting && selectionBox && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.endX),
                top: Math.min(selectionBox.startY, selectionBox.endY),
                width: Math.abs(selectionBox.endX - selectionBox.startX),
                height: Math.abs(selectionBox.endY - selectionBox.startY),
              }}
            />
          )}

          {/* Multi-select highlight box with Group button */}
          {multiSelectBounds && isEditMode && (() => {
            // Check if any selected block is already in a group
            const hasGroupedBlocks = blocks
              .filter(b => selectedBlockIds.includes(b.id))
              .some(b => b.groupId);

            // Check if all selected blocks are from the same group (component selected)
            const selectedBlocks = blocks.filter(b => selectedBlockIds.includes(b.id));
            const allSameGroup = selectedBlocks.length > 0 &&
              selectedBlocks.every(b => b.groupId && b.groupId === selectedBlocks[0].groupId);
            const currentGroupId = allSameGroup ? selectedBlocks[0].groupId : null;
            const currentGroup = currentGroupId ? groups.find(g => g.id === currentGroupId) : null;

            return (
              <>
                <div
                  className={`absolute border-2 border-dashed pointer-events-none ${currentGroup ? 'border-purple-500' : 'border-yellow-500'}`}
                  style={{
                    left: multiSelectBounds.minX - 5,
                    top: multiSelectBounds.minY - 5,
                    width: multiSelectBounds.maxX - multiSelectBounds.minX + 10,
                    height: multiSelectBounds.maxY - multiSelectBounds.minY + 10,
                  }}
                />

                {/* Component/Group Toolbar */}
                {currentGroup ? (
                  <div
                    className="absolute bg-gray-900 border border-purple-500 rounded-lg shadow-lg z-10 flex items-center gap-1 p-1"
                    style={{
                      left: multiSelectBounds.minX - 5,
                      top: multiSelectBounds.minY - 45,
                    }}
                  >
                    {isEditingGroupName ? (
                      <>
                        <input
                          type="text"
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-600 w-32"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onRenameGroup(currentGroup.id, editingGroupName);
                              setIsEditingGroupName(false);
                            } else if (e.key === 'Escape') {
                              setIsEditingGroupName(false);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Component name"
                          title="Component name"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRenameGroup(currentGroup.id, editingGroupName);
                            setIsEditingGroupName(false);
                          }}
                          className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                          title="Save"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingGroupName(false);
                          }}
                          className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-purple-400 text-xs font-medium px-2">{currentGroup.name}</span>
                        <div className="w-px h-4 bg-gray-700" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroupName(currentGroup.name);
                            setIsEditingGroupName(true);
                          }}
                          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                          title="Rename"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUngroupBlocks(currentGroup.id);
                          }}
                          className="p-1 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded"
                          title="Ungroup"
                        >
                          <Ungroup size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete component "${currentGroup.name}" and all its blocks?`)) {
                              onDeleteGroup(currentGroup.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                          title="Delete component"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  /* Group Button - only show if no blocks are already grouped */
                  !hasGroupedBlocks && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onGroupBlocks(selectedBlockIds);
                      }}
                      className="absolute bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 shadow-lg z-10"
                      style={{
                        left: multiSelectBounds.maxX - 60,
                        top: multiSelectBounds.minY - 35,
                      }}
                      title="Group selected blocks"
                    >
                      <Group size={14} />
                      Group ({selectedBlockIds.length})
                    </button>
                  )
                )}
              </>
            );
          })()}

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

      {/* Remote Cursors - show other users' cursors */}
      {isEditMode && remoteUsers.length > 0 && (
        <RemoteCursors
          users={remoteUsers}
          scale={scale}
          offsetX={position.x}
          offsetY={position.y}
        />
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm pointer-events-none">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
