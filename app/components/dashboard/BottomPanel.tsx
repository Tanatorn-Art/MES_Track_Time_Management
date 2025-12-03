'use client';

import React, { useState } from 'react';
import { Block, BlockStyle, BlockType, BlockTemplate, ApiData } from '../../types/dashboard';
import {
  Type,
  Hash,
  Tag,
  Gauge,
  BarChart3,
  Image,
  Clock,
  Table,
  Wrench,
  Palette,
  ImageIcon,
  Copy,
  Trash2,
  X,
  Settings,
  Download,
  Upload,
  RotateCcw,
  Pencil,
  Eye,
  Globe,
  Play,
  Loader2,
  Link2
} from 'lucide-react';

// Block Templates with Lucide icons
const BLOCK_TEMPLATES: { type: BlockType; icon: React.ReactNode; label: string; defaultSize: { width: number; height: number }; defaultStyle: { backgroundColor: string; textColor: string; fontSize?: number } }[] = [
  { type: 'text', icon: <Type size={18} />, label: 'Text', defaultSize: { width: 150, height: 60 }, defaultStyle: { backgroundColor: '#1e40af', textColor: '#ffffff' } },
  { type: 'number', icon: <Hash size={18} />, label: 'Number', defaultSize: { width: 120, height: 80 }, defaultStyle: { backgroundColor: '#059669', textColor: '#ffffff', fontSize: 32 } },
  { type: 'label', icon: <Tag size={18} />, label: 'Label', defaultSize: { width: 100, height: 40 }, defaultStyle: { backgroundColor: 'transparent', textColor: '#ffffff', fontSize: 16 } },
  { type: 'gauge', icon: <Gauge size={18} />, label: 'Gauge', defaultSize: { width: 150, height: 150 }, defaultStyle: { backgroundColor: '#1f2937', textColor: '#10b981' } },
  { type: 'chart', icon: <BarChart3 size={18} />, label: 'Chart', defaultSize: { width: 200, height: 150 }, defaultStyle: { backgroundColor: '#1f2937', textColor: '#60a5fa' } },
  { type: 'image', icon: <Image size={18} />, label: 'Image', defaultSize: { width: 200, height: 150 }, defaultStyle: { backgroundColor: '#374151', textColor: '#9ca3af' } },
  { type: 'clock', icon: <Clock size={18} />, label: 'Clock', defaultSize: { width: 150, height: 60 }, defaultStyle: { backgroundColor: '#1f2937', textColor: '#f59e0b', fontSize: 24 } },
  { type: 'table', icon: <Table size={18} />, label: 'Table', defaultSize: { width: 250, height: 150 }, defaultStyle: { backgroundColor: '#1f2937', textColor: '#e5e7eb' } },
];

interface BottomPanelProps {
  // Background
  backgroundImage: string;
  onBackgroundChange: (url: string) => void;
  // Block Editor
  selectedBlock: Block | null;
  onBlockUpdate: (block: Block) => void;
  onBlockCreate: (type: BlockType) => void;
  onBlockDelete: (id: string) => void;
  onBlockDuplicate: (block: Block) => void;
  // Settings
  configName: string;
  onConfigNameChange: (name: string) => void;
  canvasSize: { width: number; height: number };
  onCanvasSizeChange: (size: { width: number; height: number }) => void;
  isEditMode: boolean;
  onEditModeToggle: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  // API
  apiData: ApiData;
  onApiUrlChange: (url: string) => void;
  onApiFetch: () => void;
}

type TabType = 'tools' | 'block' | 'bg' | 'settings' | 'api';

export default function BottomPanel({
  backgroundImage,
  onBackgroundChange,
  selectedBlock,
  onBlockUpdate,
  onBlockCreate,
  onBlockDelete,
  onBlockDuplicate,
  configName,
  onConfigNameChange,
  canvasSize,
  onCanvasSizeChange,
  isEditMode,
  onEditModeToggle,
  onExport,
  onImport,
  onReset,
  apiData,
  onApiUrlChange,
  onApiFetch,
}: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('tools');
  const [showApiData, setShowApiData] = useState(false);
  const [modalTab, setModalTab] = useState<'data' | 'headers' | 'byField'>('data');
  const [expandedHeaders, setExpandedHeaders] = useState<Set<string>>(new Set());
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedSubField, setSelectedSubField] = useState<string | null>(null);
  const [expandedFieldValues, setExpandedFieldValues] = useState<Set<string>>(new Set());
  const [expandedFieldMenu, setExpandedFieldMenu] = useState<Set<string>>(new Set());

  // Toggle expanded state for field menu (left panel)
  const toggleFieldMenuExpanded = (field: string) => {
    setExpandedFieldMenu(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  // Get sub-fields from a field that contains array of objects
  const getSubFieldsFromArrayField = (fieldName: string): string[] => {
    if (!apiData.data) return [];
    const rootData = apiData.data as Record<string, unknown>;
    const fieldValue = rootData[fieldName];

    if (Array.isArray(fieldValue) && fieldValue.length > 0 && typeof fieldValue[0] === 'object' && fieldValue[0] !== null) {
      return Object.keys(fieldValue[0] as Record<string, unknown>);
    }
    return [];
  };

  // Toggle expanded state for field values in By Field tab
  const toggleFieldValueExpanded = (key: string) => {
    setExpandedFieldValues(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Get sample value for a header from API data
  const getSampleValue = (header: string): unknown => {
    if (!apiData.data) return undefined;
    const data = Array.isArray(apiData.data) ? apiData.data[0] : apiData.data;
    if (!data) return undefined;
    return getNestedValue(data as Record<string, unknown>, header);
  };

  // Check if a value is a JSON object (expandable)
  const isExpandable = (value: unknown): boolean => {
    return value !== null && typeof value === 'object';
  };

  // Toggle expanded state for a header
  const toggleExpanded = (header: string) => {
    setExpandedHeaders(prev => {
      const next = new Set(prev);
      if (next.has(header)) {
        next.delete(header);
      } else {
        next.add(header);
      }
      return next;
    });
  };

  // Get nested fields from an object value
  const getNestedFields = (value: unknown, parentKey: string): { key: string; value: unknown }[] => {
    if (!value || typeof value !== 'object') return [];
    const fields: { key: string; value: unknown }[] = [];
    for (const key in value as Record<string, unknown>) {
      fields.push({
        key: `${parentKey}.${key}`,
        value: (value as Record<string, unknown>)[key]
      });
    }
    return fields;
  };

  // Render nested value recursively for By Field tab
  const renderNestedValue = (value: unknown, parentKey: string, depth: number): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500 italic px-3 py-1">null</span>;
    }

    if (typeof value !== 'object') {
      return <span className="text-green-400 px-3 py-1">{String(value)}</span>;
    }

    const entries = Array.isArray(value)
      ? value.map((v, i) => [`[${i}]`, v] as [string, unknown])
      : Object.entries(value as Record<string, unknown>);

    const colors = ['text-blue-400', 'text-green-400', 'text-purple-400', 'text-orange-400', 'text-pink-400'];
    const colorClass = colors[depth % colors.length];

    return (
      <div className="space-y-1">
        {entries.map(([key, val], idx) => {
          const fullKey = `${parentKey}.${key}`;
          const isObject = val !== null && typeof val === 'object';
          const isExpanded = expandedFieldValues.has(fullKey);

          return (
            <div key={idx} className="space-y-1">
              <div
                onClick={() => isObject && toggleFieldValueExpanded(fullKey)}
                className={`px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs font-mono flex items-center ${
                  isObject ? 'cursor-pointer hover:bg-gray-700 hover:border-blue-500' : ''
                }`}
              >
                <span className={`${colorClass} flex-shrink-0`}>{key}:</span>
                {isObject ? (
                  <span className="flex-1 ml-2 flex items-center justify-between">
                    <span className="text-yellow-500">📦 {Array.isArray(val) ? `Array(${val.length})` : `Object(${Object.keys(val as object).length})`}</span>
                    <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                  </span>
                ) : (
                  <span className={`ml-2 ${val === null || val === undefined ? 'text-gray-500 italic' : 'text-gray-300'}`}>
                    {formatCellValue(val)}
                  </span>
                )}
              </div>
              {isObject && isExpanded && (
                <div className="ml-4 border-l-2 border-gray-600 pl-2">
                  {renderNestedValue(val, fullKey, depth + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const updateBlockStyle = (updates: Partial<BlockStyle>) => {
    if (selectedBlock) {
      onBlockUpdate({
        ...selectedBlock,
        style: { ...selectedBlock.style, ...updates },
      });
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: 'tools', label: 'Tools', icon: <Wrench size={14} />, show: true },
    { id: 'block', label: 'Block', icon: <Palette size={14} />, show: !!selectedBlock },
    { id: 'api', label: 'API', icon: <Globe size={14} />, show: true },
    { id: 'bg', label: 'BG', icon: <ImageIcon size={14} />, show: true },
    { id: 'settings', label: 'Settings', icon: <Settings size={14} />, show: true },
  ];

  return (
    <div className="bg-gray-900 border-t border-gray-700">
      {/* Tabs */}
      <div className="flex bg-gray-800 border-b border-gray-700">
        {tabs.filter(t => t.show).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-gray-900 text-white border-t-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="h-20 overflow-x-auto">
        {/* Tools Tab - Block Templates */}
        {activeTab === 'tools' && (
          <div className="flex items-center gap-2 p-2 h-full">
            <span className="text-xs text-gray-400 mr-1">Add Block:</span>
            {BLOCK_TEMPLATES.map((template) => (
              <button
                key={template.type}
                onClick={() => onBlockCreate(template.type)}
                className="flex flex-col items-center justify-center px-3 py-1 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 hover:border-blue-500 transition-colors min-w-[60px]"
                title={`Add ${template.label} block`}
              >
                <span className="text-blue-400">{template.icon}</span>
                <span className="text-xs text-gray-400">{template.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Block Editor Tab */}
        {activeTab === 'block' && selectedBlock && (
          <div className="flex items-center gap-2 p-2 h-full overflow-x-auto">
            {/* Position */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">X:</span>
              <input
                type="number"
                value={Math.round(selectedBlock.position.x)}
                onChange={(e) => onBlockUpdate({ ...selectedBlock, position: { ...selectedBlock.position, x: parseInt(e.target.value) || 0 } })}
                className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white text-center"
                title="X Position"
              />
              <span className="text-xs text-gray-400">Y:</span>
              <input
                type="number"
                value={Math.round(selectedBlock.position.y)}
                onChange={(e) => onBlockUpdate({ ...selectedBlock, position: { ...selectedBlock.position, y: parseInt(e.target.value) || 0 } })}
                className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white text-center"
                title="Y Position"
              />
            </div>
            <div className="w-px h-10 bg-gray-700" />
            {/* Size */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">W:</span>
              <input
                type="number"
                value={Math.round(selectedBlock.size.width)}
                onChange={(e) => onBlockUpdate({ ...selectedBlock, size: { ...selectedBlock.size, width: parseInt(e.target.value) || 50 } })}
                className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white text-center"
                title="Width"
              />
              <span className="text-xs text-gray-400">H:</span>
              <input
                type="number"
                value={Math.round(selectedBlock.size.height)}
                onChange={(e) => onBlockUpdate({ ...selectedBlock, size: { ...selectedBlock.size, height: parseInt(e.target.value) || 30 } })}
                className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white text-center"
                title="Height"
              />
            </div>
            <div className="w-px h-10 bg-gray-700" />
            {/* Label/Content */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Label:</span>
              <input
                type="text"
                value={selectedBlock.label}
                onChange={(e) => onBlockUpdate({ ...selectedBlock, label: e.target.value })}
                placeholder="Label"
                className="w-24 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                title="Block Label"
              />
            </div>
            <div className="w-px h-10 bg-gray-700" />
            {/* Colors */}
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={selectedBlock.style.backgroundColor}
                onChange={(e) => updateBlockStyle({ backgroundColor: e.target.value })}
                className="w-6 h-6 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                title="Background Color"
              />
              <input
                type="color"
                value={selectedBlock.style.textColor}
                onChange={(e) => updateBlockStyle({ textColor: e.target.value })}
                className="w-6 h-6 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                title="Text Color"
              />
              <input
                type="number"
                value={selectedBlock.style.fontSize}
                onChange={(e) => updateBlockStyle({ fontSize: parseInt(e.target.value) || 16 })}
                className="w-10 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white text-center"
                title="Font Size"
              />
            </div>
            <div className="w-px h-10 bg-gray-700" />
            {/* Border */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">R:</span>
              <input
                type="number"
                value={selectedBlock.style.borderRadius}
                onChange={(e) => updateBlockStyle({ borderRadius: parseInt(e.target.value) || 0 })}
                className="w-10 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white text-center"
                title="Border Radius"
              />
            </div>
            <div className="w-px h-10 bg-gray-700" />
            {/* API Data Binding */}
            {apiData.headers.length > 0 && (
              <>
                <div className="flex items-center gap-1">
                  <Link2 size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-400">Bind:</span>
                  <select
                    value={selectedBlock.variableKey || ''}
                    onChange={(e) => onBlockUpdate({ ...selectedBlock, variableKey: e.target.value })}
                    className="w-28 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                    title="Bind to API field"
                  >
                    <option value="">-- None --</option>
                    {apiData.headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
                <div className="w-px h-10 bg-gray-700" />
              </>
            )}
            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onBlockDuplicate(selectedBlock)}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1"
                title="Duplicate Block"
              >
                <Copy size={12} /> Copy
              </button>
              <button
                onClick={() => onBlockDelete(selectedBlock.id)}
                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center gap-1"
                title="Delete Block"
              >
                <Trash2 size={12} /> Del
              </button>
            </div>
          </div>
        )}

        {/* API Tab */}
        {activeTab === 'api' && (
          <div className="flex flex-col gap-2 p-2 h-full">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">URL:</span>
              <input
                type="text"
                value={apiData.url}
                onChange={(e) => onApiUrlChange(e.target.value)}
                placeholder="https://api.example.com/data"
                className="flex-1 max-w-lg px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
              />
              <button
                onClick={onApiFetch}
                disabled={apiData.loading || !apiData.url}
                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Fetch API Data"
              >
                {apiData.loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                GET
              </button>
              {apiData.data && (
                <button
                  onClick={() => { setShowApiData(!showApiData); setModalTab('byField'); }}
                  className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600"
                  title="Toggle Data Preview"
                >
                  {showApiData ? 'Hide' : 'Show'} Data
                </button>
              )}
              {apiData.error && (
                <span className="text-xs text-red-400">{apiData.error}</span>
              )}
              {apiData.headers.length > 0 && (
                <span className="text-xs text-green-400">
                  ✓ {apiData.headers.length} fields
                </span>
              )}
            </div>
          </div>
        )}

        {/* Background Tab */}
        {activeTab === 'bg' && (
          <div className="flex items-center gap-2 p-2 h-full">
            <span className="text-xs text-gray-400">Image URL:</span>
            <input
              type="text"
              value={backgroundImage}
              onChange={(e) => onBackgroundChange(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1 max-w-md px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
            />
            {backgroundImage && (
              <>
                <div className="w-16 h-12 border border-gray-700 rounded overflow-hidden flex-shrink-0">
                  <img src={backgroundImage} alt="BG" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={() => onBackgroundChange('')}
                  className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center justify-center"
                  title="Clear Background"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="flex items-center gap-3 p-2 h-full overflow-x-auto">
            {/* Dashboard Name */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Name:</span>
              <input
                type="text"
                value={configName}
                onChange={(e) => onConfigNameChange(e.target.value)}
                className="w-32 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                placeholder="Dashboard Name"
              />
            </div>
            <div className="w-px h-10 bg-gray-700" />
            {/* Canvas Size */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Canvas:</span>
              <input
                type="number"
                value={canvasSize.width}
                onChange={(e) => onCanvasSizeChange({ ...canvasSize, width: parseInt(e.target.value) || 1920 })}
                className="w-16 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white text-center"
                title="Canvas Width"
              />
              <span className="text-xs text-gray-400">×</span>
              <input
                type="number"
                value={canvasSize.height}
                onChange={(e) => onCanvasSizeChange({ ...canvasSize, height: parseInt(e.target.value) || 1080 })}
                className="w-16 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-white text-center"
                title="Canvas Height"
              />
            </div>
            <div className="w-px h-10 bg-gray-700" />
            {/* Edit/View Toggle */}
            <button
              onClick={onEditModeToggle}
              className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 ${isEditMode ? 'bg-yellow-600 text-white' : 'bg-green-600 text-white'}`}
              title={isEditMode ? 'Switch to View Mode' : 'Switch to Edit Mode'}
            >
              {isEditMode ? <Pencil size={12} /> : <Eye size={12} />}
              {isEditMode ? 'Edit' : 'View'}
            </button>
            <div className="w-px h-10 bg-gray-700" />
            {/* Import/Export */}
            <div className="flex items-center gap-1">
              <label className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs cursor-pointer hover:bg-gray-600 flex items-center gap-1" title="Import Config">
                <Download size={12} /> Import
                <input type="file" accept=".json" onChange={onImport} className="hidden" />
              </label>
              <button
                onClick={onExport}
                className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 flex items-center gap-1"
                title="Export Config"
              >
                <Upload size={12} /> Export
              </button>
            </div>
            <div className="w-px h-10 bg-gray-700" />
            {/* Reset */}
            <button
              onClick={onReset}
              className="px-2 py-1 bg-red-700 text-white rounded text-xs hover:bg-red-600 flex items-center gap-1"
              title="Reset All Settings"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        )}
      </div>

      {/* API Data Modal */}
      {showApiData && apiData.data && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 -mt-20 " onClick={() => setShowApiData(false)}>
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-4xl max-h-[80vh] w-full mx-4 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0">
              <h3 className="text-white font-medium text-sm flex items-center gap-2">
                <Table size={16} /> API Response
                {Array.isArray(apiData.data) && (
                  <span className="text-gray-400 text-xs">({apiData.data.length} items)</span>
                )}
              </h3>
              <button
                onClick={() => setShowApiData(false)}
                className="text-gray-400 hover:text-white p-1"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tab Menu */}
            <div className="flex bg-gray-800 border-b border-gray-700 flex-shrink-0">
              <button
                onClick={() => { setModalTab('byField'); setSelectedField(null); }}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  modalTab === 'byField'
                    ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                By Field
              </button>
              <button
                onClick={() => setModalTab('data')}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  modalTab === 'data'
                    ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                Data
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-auto flex-1 p-4 dark-scrollbar">
              {modalTab === 'data' ? (
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words bg-gray-900 p-4 rounded border border-gray-700 overflow-auto max-h-[calc(80vh-150px)] dark-scrollbar">
                  {JSON.stringify(apiData.data, null, 2)}
                </pre>
              ) : modalTab === 'byField' ? (
                <div className="flex gap-4 h-[calc(80vh-150px)]">
                  {/* Field Selection List */}
                  <div className="w-56 flex-shrink-0 bg-gray-900 border border-gray-700 rounded overflow-auto dark-scrollbar">
                    <div className="p-2 bg-gray-800 border-b border-gray-700 sticky top-0">
                      <span className="text-xs text-gray-400 font-medium">เลือก Field</span>
                    </div>
                    <div className="p-1 space-y-1">
                      {apiData.headers.filter(h => !h.includes('.')).map((header, idx) => {
                        const subFields = getSubFieldsFromArrayField(header);
                        const hasSubFields = subFields.length > 0;
                        const isMenuExpanded = expandedFieldMenu.has(header);
                        const isSelected = selectedField === header && !selectedSubField;

                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center">
                              {hasSubFields && (
                                <button
                                  onClick={() => toggleFieldMenuExpanded(header)}
                                  className="p-1 text-gray-500 hover:text-white"
                                >
                                  {isMenuExpanded ? '▼' : '▶'}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedField(header);
                                  setSelectedSubField(null);
                                  setExpandedFieldValues(new Set());
                                }}
                                className={`flex-1 text-left px-2 py-2 rounded text-xs font-mono transition-colors ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'text-blue-400 hover:bg-gray-700'
                                } ${!hasSubFields ? 'ml-5' : ''}`}
                              >
                                {header}
                                {hasSubFields && <span className="text-yellow-500 ml-1">📦</span>}
                              </button>
                            </div>
                            {/* Sub-fields */}
                            {hasSubFields && isMenuExpanded && (
                              <div className="ml-6 space-y-1 border-l-2 border-gray-700 pl-2">
                                {subFields.map((subField, subIdx) => {
                                  const isSubSelected = selectedField === header && selectedSubField === subField;
                                  return (
                                    <button
                                      key={subIdx}
                                      onClick={() => {
                                        setSelectedField(header);
                                        setSelectedSubField(subField);
                                        setExpandedFieldValues(new Set());
                                      }}
                                      className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                                        isSubSelected
                                          ? 'bg-green-600 text-white'
                                          : 'text-green-400 hover:bg-gray-700'
                                      }`}
                                    >
                                      {subField}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Field Values Display */}
                  <div className="flex-1 bg-gray-900 border border-gray-700 rounded overflow-auto dark-scrollbar">
                    {selectedField ? (
                      <>
                        <div className="p-2 bg-gray-800 border-b border-gray-700 sticky top-0 flex items-center justify-between">
                          <span className="text-xs text-white font-medium">
                            ค่าทั้งหมดของ <span className="text-blue-400">{selectedField}{selectedSubField ? `.${selectedSubField}` : ''}</span>
                          </span>
                          {selectedSubField && (() => {
                            const rootData = apiData.data as Record<string, unknown>;
                            const arrayData = rootData[selectedField];
                            if (Array.isArray(arrayData)) {
                              return <span className="text-xs text-gray-400">({arrayData.length} รายการ)</span>;
                            }
                            return null;
                          })()}
                          {!selectedSubField && Array.isArray(apiData.data) && (
                            <span className="text-xs text-gray-400">({apiData.data.length} รายการ)</span>
                          )}
                        </div>
                        <div className="p-2 space-y-1">
                          {/* Display sub-field values from array */}
                          {selectedSubField ? (() => {
                            const rootData = apiData.data as Record<string, unknown>;
                            const arrayData = rootData[selectedField] as unknown[];
                            if (Array.isArray(arrayData)) {
                              // Collect all values for JSON display
                              const allValues = arrayData.map((item) => (item as Record<string, unknown>)[selectedSubField]);
                              return (
                                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words bg-gray-800 p-4 rounded border border-gray-700 overflow-auto">
                                  {JSON.stringify(allValues, null, 2)}
                                </pre>
                              );
                            }
                            return null;
                          })() : Array.isArray(apiData.data) ? (
                            apiData.data.map((item, idx) => {
                              const value = (item as Record<string, unknown>)[selectedField];
                              const itemKey = `${idx}`;
                              const isObject = value !== null && typeof value === 'object';
                              const isItemExpanded = expandedFieldValues.has(itemKey);

                              return (
                                <div key={idx} className="space-y-1">
                                  <div
                                    onClick={() => isObject && toggleFieldValueExpanded(itemKey)}
                                    className={`px-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs flex items-center hover:border-gray-600 ${
                                      isObject ? 'cursor-pointer' : ''
                                    }`}
                                  >
                                    <span className="text-gray-500 font-mono w-8 flex-shrink-0">[{idx}]</span>
                                    {isObject ? (
                                      <span className="flex-1 ml-2 flex items-center justify-between">
                                        <span className="text-yellow-500">📦 {Array.isArray(value) ? `Array(${value.length})` : `Object(${Object.keys(value as object).length})`}</span>
                                        <span className="text-gray-500">{isItemExpanded ? '▼' : '▶'}</span>
                                      </span>
                                    ) : (
                                      <span className={`flex-1 ml-2 ${
                                        value === null || value === undefined ? 'text-gray-500 italic' : 'text-green-400'
                                      }`}>
                                        {formatCellValue(value)}
                                      </span>
                                    )}
                                  </div>
                                  {/* Nested fields for this item */}
                                  {isObject && isItemExpanded && (
                                    <div className="ml-8 space-y-1 border-l-2 border-gray-700 pl-2">
                                      {renderNestedValue(value, itemKey, 0)}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (() => {
                            // For non-array data, show as JSON
                            const value = (apiData.data as Record<string, unknown>)[selectedField];
                            return (
                              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words bg-gray-800 p-4 rounded border border-gray-700 overflow-auto">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            );
                          })()}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                        👈 เลือก field จากรายการด้านซ้ายเพื่อดูค่าทั้งหมด
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-3">Click on fields with 📦 to expand nested JSON:</p>
                  <div className="space-y-1">
                    {apiData.headers.filter(h => !h.includes('.')).map((header, idx) => {
                      const sampleValue = getSampleValue(header);
                      const canExpand = isExpandable(sampleValue);
                      const isExpanded = expandedHeaders.has(header);
                      const nestedFields = isExpanded ? getNestedFields(sampleValue, header) : [];

                      return (
                        <div key={idx}>
                          <div
                            onClick={() => canExpand && toggleExpanded(header)}
                            className={`px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs font-mono flex items-center justify-between ${
                              canExpand ? 'cursor-pointer hover:bg-gray-700 hover:border-blue-500' : 'cursor-default'
                            }`}
                          >
                            <span className="text-blue-400">{header}</span>
                            <span className="flex items-center gap-2">
                              {canExpand ? (
                                <>
                                  <span className="text-yellow-500">📦</span>
                                  <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                                </>
                              ) : (
                                <span className="text-gray-500 text-[10px] truncate max-w-[150px]">
                                  {formatCellValue(sampleValue)}
                                </span>
                              )}
                            </span>
                          </div>
                          {/* Nested fields */}
                          {isExpanded && nestedFields.length > 0 && (
                            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-700 pl-2">
                              {nestedFields.map((field, fieldIdx) => {
                                const nestedValue = field.value;
                                const canExpandNested = isExpandable(nestedValue);
                                const isNestedExpanded = expandedHeaders.has(field.key);
                                const deepNestedFields = isNestedExpanded ? getNestedFields(nestedValue, field.key) : [];

                                return (
                                  <div key={fieldIdx}>
                                    <div
                                      onClick={() => canExpandNested && toggleExpanded(field.key)}
                                      className={`px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs font-mono flex items-center justify-between ${
                                        canExpandNested ? 'cursor-pointer hover:bg-gray-700 hover:border-blue-500' : 'cursor-default'
                                      }`}
                                    >
                                      <span className="text-green-400">{field.key}</span>
                                      <span className="flex items-center gap-2">
                                        {canExpandNested ? (
                                          <>
                                            <span className="text-yellow-500">📦</span>
                                            <span className="text-gray-500">{isNestedExpanded ? '▼' : '▶'}</span>
                                          </>
                                        ) : (
                                          <span className="text-gray-500 text-[10px] truncate max-w-[150px]">
                                            {formatCellValue(nestedValue)}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    {/* Deep nested fields */}
                                    {isNestedExpanded && deepNestedFields.length > 0 && (
                                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-600 pl-2">
                                        {deepNestedFields.map((deepField, deepIdx) => (
                                          <div
                                            key={deepIdx}
                                            className="px-3 py-1.5 bg-gray-700 border border-gray-500 rounded text-xs font-mono flex items-center justify-between"
                                          >
                                            <span className="text-purple-400">{deepField.key}</span>
                                            <span className="text-gray-400 text-[10px] truncate max-w-[150px]">
                                              {formatCellValue(deepField.value)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format cell values
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Helper function to get nested value by dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export { BLOCK_TEMPLATES };
