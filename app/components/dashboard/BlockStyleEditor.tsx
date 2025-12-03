'use client';

import React from 'react';
import { Block, BlockStyle } from '../../types/dashboard';

interface BlockStyleEditorProps {
  block: Block;
  onUpdate: (block: Block) => void;
}

export default function BlockStyleEditor({ block, onUpdate }: BlockStyleEditorProps) {
  const updateStyle = (updates: Partial<BlockStyle>) => {
    onUpdate({
      ...block,
      style: {
        ...block.style,
        ...updates,
      },
    });
  };

  return (
    <div className="w-64 bg-gray-900 text-white p-4 overflow-y-auto h-full">
      <h2 className="text-xl font-bold mb-4">🎨 Block Style</h2>

      {/* Label */}
      <label className="block mb-3">
        <span className="text-sm text-gray-400">Label</span>
        <input
          type="text"
          value={block.label}
          onChange={(e) => onUpdate({ ...block, label: e.target.value })}
          className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
        />
      </label>

      {/* Variable Key */}
      <label className="block mb-3">
        <span className="text-sm text-gray-400">Variable Path</span>
        <input
          type="text"
          value={block.variableKey}
          onChange={(e) => onUpdate({ ...block, variableKey: e.target.value })}
          className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono"
        />
      </label>

      <hr className="border-gray-700 my-4" />

      {/* Size */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-sm text-gray-400">Width</span>
          <input
            type="number"
            value={block.size.width}
            onChange={(e) => onUpdate({ ...block, size: { ...block.size, width: parseInt(e.target.value) || 100 } })}
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-400">Height</span>
          <input
            type="number"
            value={block.size.height}
            onChange={(e) => onUpdate({ ...block, size: { ...block.size, height: parseInt(e.target.value) || 60 } })}
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-sm text-gray-400">X Position</span>
          <input
            type="number"
            value={block.position.x}
            onChange={(e) => onUpdate({ ...block, position: { ...block.position, x: parseInt(e.target.value) || 0 } })}
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-400">Y Position</span>
          <input
            type="number"
            value={block.position.y}
            onChange={(e) => onUpdate({ ...block, position: { ...block.position, y: parseInt(e.target.value) || 0 } })}
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>
      </div>

      <hr className="border-gray-700 my-4" />

      {/* Colors */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-sm text-gray-400">Background</span>
          <input
            type="color"
            value={block.style.backgroundColor}
            onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
            className="w-full mt-1 h-10 bg-gray-800 border border-gray-700 rounded cursor-pointer"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-400">Text Color</span>
          <input
            type="color"
            value={block.style.textColor}
            onChange={(e) => updateStyle({ textColor: e.target.value })}
            className="w-full mt-1 h-10 bg-gray-800 border border-gray-700 rounded cursor-pointer"
          />
        </label>
      </div>

      {/* Font */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-sm text-gray-400">Font Size</span>
          <input
            type="number"
            value={block.style.fontSize}
            onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) || 16 })}
            min="8"
            max="120"
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-400">Font Weight</span>
          <select
            value={block.style.fontWeight}
            onChange={(e) => updateStyle({ fontWeight: e.target.value })}
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
            <option value="100">Thin</option>
            <option value="300">Light</option>
            <option value="500">Medium</option>
            <option value="700">Bold</option>
            <option value="900">Black</option>
          </select>
        </label>
      </div>

      {/* Border */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-sm text-gray-400">Border Width</span>
          <input
            type="number"
            value={block.style.borderWidth}
            onChange={(e) => updateStyle({ borderWidth: parseInt(e.target.value) || 0 })}
            min="0"
            max="20"
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-400">Border Color</span>
          <input
            type="color"
            value={block.style.borderColor}
            onChange={(e) => updateStyle({ borderColor: e.target.value })}
            className="w-full mt-1 h-10 bg-gray-800 border border-gray-700 rounded cursor-pointer"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-sm text-gray-400">Border Radius</span>
          <input
            type="number"
            value={block.style.borderRadius}
            onChange={(e) => updateStyle({ borderRadius: parseInt(e.target.value) || 0 })}
            min="0"
            max="100"
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-400">Padding</span>
          <input
            type="number"
            value={block.style.padding}
            onChange={(e) => updateStyle({ padding: parseInt(e.target.value) || 0 })}
            min="0"
            max="50"
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>
      </div>
    </div>
  );
}
