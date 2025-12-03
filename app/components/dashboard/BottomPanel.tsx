'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Block, BlockStyle, BlockType, BlockTemplate, ApiData, ComponentConfig } from '../../types/dashboard';
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
  Link2,
  Save,
  FolderOpen,
  RefreshCw,
  Plus,
  Move,
  Maximize2,
  Box,
  Package,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold
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
  onSaveProject: () => void;
  onLoadProject: () => void;
  isSaving?: boolean;
  // API
  apiData: ApiData;
  onApiUrlChange: (url: string) => void;
  onApiFetch: () => void;
  refreshInterval: number;
  onRefreshIntervalChange: (interval: number) => void;
  // Component
  onAddComponent?: (component: ComponentConfig) => void;
  onComponentUpdate?: (component: ComponentConfig) => void;
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
  onSaveProject,
  onLoadProject,
  isSaving,
  apiData,
  onApiUrlChange,
  onApiFetch,
  refreshInterval,
  onRefreshIntervalChange,
  onAddComponent,
  onComponentUpdate,
}: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('tools');
  const [showApiData, setShowApiData] = useState(false);
  const [modalTab, setModalTab] = useState<'data' | 'headers' | 'byField' | 'sync'>('data');
  const [expandedHeaders, setExpandedHeaders] = useState<Set<string>>(new Set());
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedSubField, setSelectedSubField] = useState<string | null>(null);
  const [expandedFieldValues, setExpandedFieldValues] = useState<Set<string>>(new Set());
  const [expandedFieldMenu, setExpandedFieldMenu] = useState<Set<string>>(new Set());

  // Sync Component States
  const [componentName, setComponentName] = useState<string>('New Component');
  const [componentBlocks, setComponentBlocks] = useState<Block[]>([]);
  const [componentSize, setComponentSize] = useState({ width: 400, height: 300 });
  const [selectedComponentBlockId, setSelectedComponentBlockId] = useState<string | null>(null);
  const [draggedComponentBlock, setDraggedComponentBlock] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [savedComponents, setSavedComponents] = useState<ComponentConfig[]>([]);
  const componentCanvasRef = useRef<HTMLDivElement>(null);
  const [showComponentsModal, setShowComponentsModal] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null); // Track which component is being edited
  const [showEditComponentModal, setShowEditComponentModal] = useState(false); // Modal to select component to edit
  const [resizingComponentBlock, setResizingComponentBlock] = useState<string | null>(null); // Block being resized
  const [resizeDirection, setResizeDirection] = useState<string | null>(null); // Direction of resize
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 }); // Start position for resize
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 }); // Start size for resize
  const [expandedSyncFields, setExpandedSyncFields] = useState<Set<string>>(new Set()); // Expanded fields in Sync tab
  const [selectedArrayField, setSelectedArrayField] = useState<string | null>(null); // Selected array field for index
  const [componentDataIndex, setComponentDataIndex] = useState<number>(0); // Selected index for array data
  const [selectedIndexField, setSelectedIndexField] = useState<string | null>(null); // Selected field to use as index key

  // Toggle expanded state for Sync field (left panel in Sync tab)
  const toggleSyncFieldExpanded = (field: string) => {
    setExpandedSyncFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  // Check if API data is a root-level array (e.g., [{...}, {...}])
  const isRootArray = (): boolean => {
    return Array.isArray(apiData.data) && apiData.data.length > 0;
  };

  // Get root array length (when data itself is an array)
  const getRootArrayLength = (): number => {
    if (!Array.isArray(apiData.data)) return 0;
    return apiData.data.length;
  };

  // Get fields from root array items
  const getRootArrayFields = (): string[] => {
    if (!Array.isArray(apiData.data) || apiData.data.length === 0) return [];
    const firstItem = apiData.data[0] as Record<string, unknown>;
    return Object.keys(firstItem);
  };

  // Get value from root array at specific index
  const getRootArrayValue = (fieldName: string, index: number): unknown => {
    if (!Array.isArray(apiData.data) || !apiData.data[index]) return undefined;
    return (apiData.data[index] as Record<string, unknown>)[fieldName];
  };

  // Check if a field is an array of objects
  const isArrayOfObjects = (fieldName: string): boolean => {
    if (!apiData.data) return false;
    // Handle case where data is an array (use first item)
    const rootData = Array.isArray(apiData.data)
      ? (apiData.data[0] as Record<string, unknown>)
      : (apiData.data as Record<string, unknown>);
    if (!rootData) return false;
    const fieldValue = rootData[fieldName];
    return Array.isArray(fieldValue) && fieldValue.length > 0 && typeof fieldValue[0] === 'object' && fieldValue[0] !== null;
  };

  // Get array field length
  const getArrayFieldLength = (fieldName: string): number => {
    if (!apiData.data) return 0;
    // For root array, return the root array length
    if (fieldName === '__ROOT_ARRAY__') {
      return getRootArrayLength();
    }
    const rootData = Array.isArray(apiData.data)
      ? (apiData.data[0] as Record<string, unknown>)
      : (apiData.data as Record<string, unknown>);
    if (!rootData) return 0;
    const fieldValue = rootData[fieldName];
    return Array.isArray(fieldValue) ? fieldValue.length : 0;
  };

  // Get all array fields from API data (including root array option)
  const getArrayFields = (): string[] => {
    const fields: string[] = [];
    // If data itself is an array, add root array option
    if (isRootArray()) {
      fields.push('__ROOT_ARRAY__');
    }
    // Also check for nested array fields
    fields.push(...apiData.headers.filter(h => !h.includes('.') && isArrayOfObjects(h)));
    return fields;
  };

  // Cache root data to avoid repeated lookups
  // Get root data from API response
  const rootData = useMemo(() => {
    if (!apiData.data) return null;
    return Array.isArray(apiData.data)
      ? (apiData.data[0] as Record<string, unknown>)
      : (apiData.data as Record<string, unknown>);
  }, [apiData.data]);

  // Get value from array field at specific index (for Settings panel preview)
  const getArrayFieldValue = useCallback((fieldName: string, subField: string, index: number): unknown => {
    // Handle root array case
    if (fieldName === '__ROOT_ARRAY__') {
      if (!Array.isArray(apiData.data) || !apiData.data[index]) return undefined;
      return (apiData.data[index] as Record<string, unknown>)[subField];
    }

    if (!rootData) return undefined;
    const fieldValue = rootData[fieldName];
    if (Array.isArray(fieldValue) && fieldValue[index]) {
      return (fieldValue[index] as Record<string, unknown>)[subField];
    }
    return undefined;
  }, [rootData, apiData.data]);

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

    // Handle root array case
    if (fieldName === '__ROOT_ARRAY__') {
      return getRootArrayFields();
    }

    // Handle case where data is an array (use first item)
    const rootData = Array.isArray(apiData.data)
      ? (apiData.data[0] as Record<string, unknown>)
      : (apiData.data as Record<string, unknown>);
    if (!rootData) return [];
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

  // ============ Sync Component Functions ============

  // Add field as text block to component canvas
  const addFieldToComponent = (fieldName: string) => {
    const newBlock: Block = {
      id: `comp-block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      position: { x: 10 + (componentBlocks.length % 3) * 130, y: 10 + Math.floor(componentBlocks.length / 3) * 30 },
      size: { width: 120, height: 24 },
      variableKey: fieldName,
      label: fieldName,
      style: {
        backgroundColor: 'transparent',
        textColor: '#60a5fa',
        fontSize: 14,
        fontWeight: 'normal',
        fontFamily: 'Arial',
        textAlign: 'left',
        borderRadius: 0,
        padding: 4,
        borderWidth: 0,
        borderColor: 'transparent',
      },
    };
    setComponentBlocks([...componentBlocks, newBlock]);
  };

  // Add all fields at once
  const addAllFieldsToComponent = () => {
    // If root array is selected, use root array fields
    let fields: string[];
    if (selectedArrayField === '__ROOT_ARRAY__') {
      fields = getRootArrayFields();
    } else if (selectedArrayField) {
      // Use fields from selected array
      fields = getSubFieldsFromArrayField(selectedArrayField).map(f => `${selectedArrayField}.${f}`);
    } else {
      // Default: use top-level headers
      fields = apiData.headers.filter(h => !h.includes('.'));
    }

    const newBlocks: Block[] = fields.map((field, idx) => ({
      id: `comp-block-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text' as BlockType,
      position: { x: 10 + (idx % 4) * 100, y: 10 + Math.floor(idx / 4) * 28 },
      size: { width: 90, height: 22 },
      variableKey: field,
      label: field.includes('.') ? field.split('.').pop() || field : field,
      style: {
        backgroundColor: 'transparent',
        textColor: '#60a5fa',
        fontSize: 12,
        fontWeight: 'normal',
        fontFamily: 'Arial',
        textAlign: 'left',
        borderRadius: 0,
        padding: 4,
        borderWidth: 0,
        borderColor: 'transparent',
      },
    }));
    setComponentBlocks(newBlocks);
  };

  // Update component block
  const updateComponentBlock = (blockId: string, updates: Partial<Block>) => {
    setComponentBlocks(componentBlocks.map(b =>
      b.id === blockId ? { ...b, ...updates } : b
    ));
  };

  // Delete component block
  const deleteComponentBlock = (blockId: string) => {
    setComponentBlocks(componentBlocks.filter(b => b.id !== blockId));
    if (selectedComponentBlockId === blockId) {
      setSelectedComponentBlockId(null);
    }
  };

  // Handle drag start for component block
  const handleComponentBlockDragStart = (e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const block = componentBlocks.find(b => b.id === blockId);
    if (!block || !componentCanvasRef.current) return;

    const canvasRect = componentCanvasRef.current.getBoundingClientRect();

    setDraggedComponentBlock(blockId);
    setSelectedComponentBlockId(blockId);
    // Calculate offset from where user clicked relative to block position
    setDragOffset({
      x: e.clientX - canvasRect.left - block.position.x,
      y: e.clientY - canvasRect.top - block.position.y
    });
  };

  // Handle drag move for component block
  const handleComponentCanvasMouseMove = (e: React.MouseEvent) => {
    // Handle resize
    if (resizingComponentBlock && componentCanvasRef.current) {
      const block = componentBlocks.find(b => b.id === resizingComponentBlock);
      if (!block) return;

      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;

      let newWidth = resizeStartSize.width;
      let newHeight = resizeStartSize.height;

      if (resizeDirection?.includes('e')) newWidth = Math.max(20, resizeStartSize.width + deltaX);
      if (resizeDirection?.includes('s')) newHeight = Math.max(10, resizeStartSize.height + deltaY);
      if (resizeDirection?.includes('w')) newWidth = Math.max(20, resizeStartSize.width - deltaX);
      if (resizeDirection?.includes('n')) newHeight = Math.max(10, resizeStartSize.height - deltaY);

      updateComponentBlock(resizingComponentBlock, {
        size: { width: Math.round(newWidth), height: Math.round(newHeight) }
      });
      return;
    }

    // Handle drag
    if (!draggedComponentBlock || !componentCanvasRef.current) return;

    const rect = componentCanvasRef.current.getBoundingClientRect();
    const block = componentBlocks.find(b => b.id === draggedComponentBlock);
    if (!block) return;

    const newX = Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x, componentSize.width - block.size.width));
    const newY = Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y, componentSize.height - block.size.height));

    updateComponentBlock(draggedComponentBlock, {
      position: { x: Math.round(newX), y: Math.round(newY) }
    });
  };

  // Handle drag/resize end
  const handleComponentCanvasMouseUp = () => {
    setDraggedComponentBlock(null);
    setResizingComponentBlock(null);
    setResizeDirection(null);
  };

  // Handle resize start
  const handleComponentBlockResizeStart = (e: React.MouseEvent, blockId: string, direction: string) => {
    e.preventDefault();
    e.stopPropagation();

    const block = componentBlocks.find(b => b.id === blockId);
    if (!block) return;

    setResizingComponentBlock(blockId);
    setResizeDirection(direction);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setResizeStartSize({ width: block.size.width, height: block.size.height });
    setSelectedComponentBlockId(blockId);
  };

  // Save component to file
  const saveComponent = async () => {
    if (!componentName.trim()) {
      alert('Please enter a component name');
      return;
    }

    if (componentBlocks.length === 0) {
      alert('Please add at least one block to the component');
      return;
    }

    const component: ComponentConfig = {
      id: editingComponentId || `component-${Date.now()}`,
      name: componentName,
      description: '',
      size: componentSize,
      blocks: componentBlocks,
      arrayField: selectedArrayField || undefined,
      dataIndex: componentDataIndex,
      indexField: selectedIndexField || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      const response = await fetch('/api/save-component', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentName: componentName,
          config: component,
        }),
      });

      if (response.ok) {
        alert(`Component "${componentName}" saved successfully!`);
        loadSavedComponents();

        // Notify parent to update all instances of this component on main canvas
        if (onComponentUpdate && editingComponentId) {
          onComponentUpdate(component);
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to save component: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving component:', error);
      alert('Error saving component: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Load saved components list
  const loadSavedComponents = async () => {
    try {
      const response = await fetch('/api/load-components');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.components) {
          setSavedComponents(data.components.map((c: { name: string; path: string; config: ComponentConfig }) => ({
            id: c.config?.id || c.name,
            name: c.config?.name || c.name,
            description: c.config?.description || '',
            size: c.config?.size || { width: 400, height: 300 },
            blocks: c.config?.blocks || [],
            arrayField: c.config?.arrayField,
            dataIndex: c.config?.dataIndex,
            indexField: c.config?.indexField,
            createdAt: c.config?.createdAt || Date.now(),
            updatedAt: c.config?.updatedAt || Date.now(),
          })));
        }
      }
    } catch (error) {
      console.error('Error loading components:', error);
    }
  };

  // Load a saved component into editor for editing
  const loadComponentForEdit = (component: ComponentConfig) => {
    setEditingComponentId(component.id);
    setComponentName(component.name);
    setComponentSize(component.size);
    // Keep original block IDs to maintain mapping with main canvas blocks
    setComponentBlocks(component.blocks.map(b => ({
      ...b,
      // Keep original ID for proper update mapping
    })));
    // Load array field and index settings
    setSelectedArrayField(component.arrayField || null);
    setComponentDataIndex(component.dataIndex || 0);
    setSelectedIndexField(component.indexField || null);
    setSelectedComponentBlockId(null);
    setShowEditComponentModal(false);
  };

  // Clear/New component
  const clearComponent = () => {
    setEditingComponentId(null);
    setComponentName('New Component');
    setComponentBlocks([]);
    setComponentSize({ width: 400, height: 300 });
    setSelectedArrayField(null);
    setComponentDataIndex(0);
    setSelectedIndexField(null);
    setSelectedComponentBlockId(null);
  };

  // Get selected component block
  const selectedComponentBlock = componentBlocks.find(b => b.id === selectedComponentBlockId);

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
            <div className="w-px h-12 bg-gray-700 mx-1" />
            {/* Components Button */}
            <button
              onClick={() => { setShowComponentsModal(true); loadSavedComponents(); }}
              className="flex flex-col items-center justify-center px-3 py-1 bg-purple-900 border border-purple-700 rounded hover:bg-purple-800 hover:border-purple-500 transition-colors min-w-[70px]"
              title="Add Component"
            >
              <span className="text-purple-400"><Box size={18} /></span>
              <span className="text-xs text-purple-300">Components</span>
            </button>
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
            <div className="flex items-center gap-2 flex-wrap">
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

              {/* Refresh Interval */}
              <div className="flex items-center gap-1 border-l border-gray-700 pl-2">
                <RefreshCw size={12} className="text-gray-400" />
                <input
                  type="number"
                  value={refreshInterval}
                  onChange={(e) => onRefreshIntervalChange(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
                  title="Auto-refresh interval in seconds (0 = disabled)"
                />
                <span className="text-xs text-gray-500">sec</span>
                {refreshInterval > 0 && (
                  <span className="text-xs text-green-400"> Live</span>
                )}
              </div>

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
            <span className="text-xs text-gray-400">Background:</span>
            <label className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs cursor-pointer hover:bg-blue-700 flex items-center gap-1.5">
              <ImageIcon size={14} />
              Choose Image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const dataUrl = event.target?.result as string;
                      onBackgroundChange(dataUrl);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="hidden"
              />
            </label>
            {backgroundImage && (
              <>
                <div className="w-16 h-12 border border-gray-700 rounded overflow-hidden flex-shrink-0">
                  <img src={backgroundImage} alt="BG" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-green-400">✓ Image loaded</span>
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
            {/* Save/Load Project */}
            <div className="flex items-center gap-1">
              <button
                onClick={onSaveProject}
                disabled={isSaving}
                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Save Project to config folder"
              >
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>
              <button
                onClick={onLoadProject}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1"
                title="Load Project from config folder"
              >
                <FolderOpen size={12} /> Load
              </button>
              <button
                onClick={() => {
                  const projectName = configName.replace(/\s+/g, '-').toLowerCase();
                  const viewUrl = `${window.location.origin}/dashboard/view/${encodeURIComponent(projectName)}`;

                  // Try modern clipboard API first, fallback to prompt
                  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    navigator.clipboard.writeText(viewUrl).then(() => {
                      alert(`Link copied!\n\n${viewUrl}\n\nSave your project first before sharing.`);
                    }).catch(() => {
                      prompt('Copy this link:', viewUrl);
                    });
                  } else {
                    // Fallback for HTTP or unsupported browsers
                    prompt('Copy this link (Ctrl+C):', viewUrl);
                  }
                }}
                className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 flex items-center gap-1"
                title="Get shareable view link"
              >
                <Link2 size={12} /> Get Link
              </button>
            </div>
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
              <button
                onClick={() => { setModalTab('sync'); loadSavedComponents(); }}
                className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1 ${
                  modalTab === 'sync'
                    ? 'bg-gray-900 text-white border-b-2 border-green-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <RefreshCw size={12} /> Sync
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-auto flex-1 p-0 dark-scrollbar">
              {modalTab === 'data' ? (
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words bg-gray-900 p-4 rounded border border-gray-700 overflow-auto max-h-[calc(80vh-150px)] dark-scrollbar">
                  {JSON.stringify(apiData.data, null, 2)}
                </pre>
              ) : modalTab === 'sync' ? (
                /* ============ SYNC TAB CONTENT ============ */
                <div className="flex gap-0 h-[calc(80vh-150px)]">
                  {/* Left Panel - Field List */}
                  <div className="w-48 flex-shrink-0 bg-gray-900 border border-gray-700 rounded overflow-auto dark-scrollbar">
                    <div className="p-2 bg-gray-800 border-b border-gray-700 sticky top-0 flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Fields</span>
                      <button
                        onClick={addAllFieldsToComponent}
                        className="px-1.5 py-0.5 bg-green-600 text-white rounded text-[10px] hover:bg-green-700 flex items-center gap-0.5"
                        title="Add all fields"
                      >
                        <Plus size={10} /> All
                      </button>
                    </div>
                    <div className="p-1 space-y-0.5">
                      {/* Show sub-fields of selected array field first (including root array) */}
                      {selectedArrayField && (
                        <div className="mb-2 pb-2 border-b border-gray-700">
                          <div className="px-2 py-1 text-[10px] text-yellow-400 font-medium flex items-center gap-1">
                            <Package size={10} />
                            {selectedArrayField === '__ROOT_ARRAY__'
                              ? `Root Array[${componentDataIndex}]`
                              : `${selectedArrayField}[${componentDataIndex}]`}
                            {selectedIndexField && (
                              <span className="text-green-400 text-[9px]">
                                (key: {selectedIndexField})
                              </span>
                            )}
                          </div>
                          <div className="ml-2 border-l border-yellow-600/50 pl-1 space-y-0.5">
                            {getSubFieldsFromArrayField(selectedArrayField).map((subField, subIdx) => (
                              <div
                                key={subIdx}
                                onClick={() => addFieldToComponent(selectedArrayField === '__ROOT_ARRAY__' ? subField : `${selectedArrayField}.${subField}`)}
                                className="flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono text-green-400 hover:bg-gray-700 cursor-pointer group"
                              >
                                <span className="truncate">{subField}</span>
                                <Plus size={10} className="text-gray-500 group-hover:text-green-400" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Root Array Option - show when data is root array */}
                      {isRootArray() && selectedArrayField !== '__ROOT_ARRAY__' && (
                        <div
                          onClick={() => {
                            setSelectedArrayField('__ROOT_ARRAY__');
                            setComponentDataIndex(0);
                            setSelectedIndexField(null);
                          }}
                          className="flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono bg-blue-900/30 text-blue-400 hover:bg-blue-800/50 cursor-pointer mb-2"
                        >
                          <div className="flex items-center gap-1">
                            <Package size={12} />
                            <span>📦 Root Array</span>
                            <span className="text-[9px] text-gray-500">({getRootArrayLength()} items)</span>
                          </div>
                        </div>
                      )}

                      {/* Other fields - hide if root array is selected */}
                      {selectedArrayField !== '__ROOT_ARRAY__' && apiData.headers.filter(h => !h.includes('.')).map((header, idx) => {
                        const hasSubFields = isArrayOfObjects(header);
                        const subFields = hasSubFields ? getSubFieldsFromArrayField(header) : [];
                        const isExpanded = expandedSyncFields.has(header);
                        const isSelectedArray = header === selectedArrayField;

                        return (
                          <div key={idx}>
                            {/* Main Field */}
                            <div
                              className={`flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono hover:bg-gray-700 cursor-pointer group ${
                                isSelectedArray ? 'bg-yellow-900/30 text-yellow-400' : 'text-blue-400'
                              }`}
                            >
                              {hasSubFields ? (
                                <>
                                  <div
                                    className="flex items-center gap-1 flex-1"
                                    onClick={() => {
                                      // If clicking on array field, select it for index
                                      if (!isSelectedArray) {
                                        setSelectedArrayField(header);
                                        setComponentDataIndex(0);
                                      } else {
                                        toggleSyncFieldExpanded(header);
                                      }
                                    }}
                                  >
                                    {isSelectedArray ? (
                                      <span className="text-yellow-400">✓</span>
                                    ) : (
                                      <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                    )}
                                    <span className={`truncate ${isSelectedArray ? 'text-yellow-400' : 'text-yellow-400'}`}>{header}</span>
                                    <span className="text-[9px] text-gray-500">📦 {getArrayFieldLength(header)}</span>
                                  </div>
                                  {!isSelectedArray && (
                                    <Plus
                                      size={12}
                                      className="text-gray-500 hover:text-green-400"
                                      onClick={(e) => { e.stopPropagation(); addFieldToComponent(header); }}
                                    />
                                  )}
                                </>
                              ) : (
                                <>
                                  <span
                                    className="truncate flex-1"
                                    onClick={() => addFieldToComponent(header)}
                                  >{header}</span>
                                  <Plus
                                    size={12}
                                    className="text-gray-500 group-hover:text-green-400"
                                    onClick={() => addFieldToComponent(header)}
                                  />
                                </>
                              )}
                            </div>

                            {/* Sub Fields - only show if expanded and NOT the selected array */}
                            {hasSubFields && isExpanded && !isSelectedArray && (
                              <div className="ml-3 border-l border-gray-700 pl-1 space-y-0.5">
                                {subFields.map((subField, subIdx) => (
                                  <div
                                    key={subIdx}
                                    onClick={() => addFieldToComponent(`${header}.${subField}`)}
                                    className="flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono text-green-400 hover:bg-gray-700 cursor-pointer group"
                                  >
                                    <span className="truncate">{subField}</span>
                                    <Plus size={10} className="text-gray-500 group-hover:text-green-400" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Center - Component Canvas */}
                  <div className="flex-1 flex flex-col">
                    {/* Canvas Header */}
                    <div className="p-2 bg-gray-800 border border-gray-700 rounded-t flex items-center gap-2">
                      {/* Edit Indicator */}
                      {editingComponentId && (
                        <span className="px-1.5 py-0.5 bg-purple-600/30 text-purple-400 rounded text-[10px] border border-purple-500/50">
                          Editing
                        </span>
                      )}
                      <input
                        type="text"
                        value={componentName}
                        onChange={(e) => setComponentName(e.target.value)}
                        className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                        placeholder="Component Name"
                      />
                      <button
                        onClick={() => { setShowEditComponentModal(true); loadSavedComponents(); }}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1"
                        title="Load saved component to edit"
                      >
                        <FolderOpen size={12} /> Load
                      </button>
                      <button
                        onClick={clearComponent}
                        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 flex items-center gap-1"
                        title="Clear and create new component"
                      >
                        <Plus size={12} /> New
                      </button>
                      <button
                        onClick={saveComponent}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center gap-1"
                      >
                        <Save size={12} /> Save
                      </button>
                    </div>

                    {/* Canvas Area */}
                    <div
                      className="flex-1 bg-gray-950 border border-gray-700 border-t-0 rounded-b overflow-auto relative"
                      onMouseMove={handleComponentCanvasMouseMove}
                      onMouseUp={handleComponentCanvasMouseUp}
                      onMouseLeave={handleComponentCanvasMouseUp}
                    >
                      <div
                        ref={componentCanvasRef}
                        className="relative bg-gray-900"
                        style={{ width: componentSize.width, height: componentSize.height, minWidth: '100%', minHeight: '100%' }}
                      >
                        {/* Grid Pattern */}
                        <div
                          className="absolute inset-0 opacity-20"
                          style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                          }}
                        />

                        {/* Component Blocks */}
                        {componentBlocks.map((block) => {
                          // Show only variable name, not actual data
                          const displayText = block.label;

                          return (
                          <div
                            key={block.id}
                            onMouseDown={(e) => handleComponentBlockDragStart(e, block.id)}
                            onClick={() => setSelectedComponentBlockId(block.id)}
                            className={`absolute cursor-move select-none ${
                              selectedComponentBlockId === block.id ? 'ring-2 ring-blue-500' : ''
                            }`}
                            style={{
                              left: block.position.x,
                              top: block.position.y,
                              width: block.size.width,
                              height: block.size.height,
                              backgroundColor: block.style.backgroundColor,
                              color: block.style.textColor,
                              fontSize: block.style.fontSize,
                              fontWeight: block.style.fontWeight,
                              fontFamily: block.style.fontFamily,
                              textAlign: block.style.textAlign,
                              borderRadius: block.style.borderRadius,
                              padding: block.style.padding,
                              borderWidth: block.style.borderWidth,
                              borderColor: block.style.borderColor,
                              borderStyle: 'solid',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: block.style.textAlign === 'center' ? 'center' : block.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                            }}
                          >
                            {displayText}

                            {/* Resize Handles - Show when selected */}
                            {selectedComponentBlockId === block.id && (
                              <>
                                {/* Right edge */}
                                <div
                                  className="absolute top-0 right-0 w-2 h-full cursor-e-resize hover:bg-blue-500/30"
                                  onMouseDown={(e) => handleComponentBlockResizeStart(e, block.id, 'e')}
                                />
                                {/* Bottom edge */}
                                <div
                                  className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize hover:bg-blue-500/30"
                                  onMouseDown={(e) => handleComponentBlockResizeStart(e, block.id, 's')}
                                />
                                {/* Bottom-right corner */}
                                <div
                                  className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize bg-blue-500 rounded-tl"
                                  onMouseDown={(e) => handleComponentBlockResizeStart(e, block.id, 'se')}
                                />
                                {/* Left edge */}
                                <div
                                  className="absolute top-0 left-0 w-2 h-full cursor-w-resize hover:bg-blue-500/30"
                                  onMouseDown={(e) => handleComponentBlockResizeStart(e, block.id, 'w')}
                                />
                                {/* Top edge */}
                                <div
                                  className="absolute top-0 left-0 w-full h-2 cursor-n-resize hover:bg-blue-500/30"
                                  onMouseDown={(e) => handleComponentBlockResizeStart(e, block.id, 'n')}
                                />
                              </>
                            )}
                          </div>
                        );
                        })}

                        {/* Empty State */}
                        {componentBlocks.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                            คลิก field ด้านซ้ายเพื่อเพิ่มลง Canvas
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Panel - Block Settings */}
                  <div className="w-56 flex-shrink-0 bg-gray-900 border border-gray-700 rounded overflow-auto dark-scrollbar">
                    <div className="p-2 bg-gray-800 border-b border-gray-700 sticky top-0">
                      <span className="text-xs text-gray-400 font-medium">Settings</span>
                    </div>
                    {/* Canvas Size - Always visible */}
                    <div className="p-2 border-b border-gray-700">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
                        <Maximize2 size={10} /> Canvas Size
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <label className="text-[10px] text-gray-500 cursor-ew-resize select-none"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const startX = e.clientX;
                              const startWidth = componentSize.width;
                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                const delta = moveEvent.clientX - startX;
                                setComponentSize({ ...componentSize, width: Math.max(100, startWidth + delta) });
                              };
                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                              };
                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                            }}
                          >Width ↔</label>
                          <input
                            type="number"
                            value={componentSize.width}
                            onChange={(e) => setComponentSize({ ...componentSize, width: Number(e.target.value) })}
                            className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                            title="Canvas Width"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 cursor-ns-resize select-none"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const startY = e.clientY;
                              const startHeight = componentSize.height;
                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                const delta = moveEvent.clientY - startY;
                                setComponentSize({ ...componentSize, height: Math.max(100, startHeight + delta) });
                              };
                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                              };
                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                            }}
                          >Height ↕</label>
                          <input
                            type="number"
                            value={componentSize.height}
                            onChange={(e) => setComponentSize({ ...componentSize, height: Number(e.target.value) })}
                            className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                            title="Canvas Height"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Data Index Selector */}
                    {getArrayFields().length > 0 && (
                      <div className="p-2 border-b border-gray-700">
                        <div className="flex items-center gap-1 text-[10px] text-yellow-400 mb-1">
                          <Package size={10} /> Data Index
                        </div>
                        {/* Array Field Selector */}
                        <div className="mb-1">
                          <label className="text-[10px] text-gray-500">Array Field</label>
                          <select
                            value={selectedArrayField || ''}
                            onChange={(e) => {
                              setSelectedArrayField(e.target.value || null);
                              setComponentDataIndex(0);
                              setSelectedIndexField(null);
                            }}
                            className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                            title="Select array field for data index"
                          >
                            <option value="">-- Select --</option>
                            {getArrayFields().map((field) => (
                              <option key={field} value={field}>
                                {field === '__ROOT_ARRAY__' ? '📦 Root Array' : field} ({getArrayFieldLength(field)} items)
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* Index Field Selector - เลือก field ที่จะใช้เป็น index key */}
                        {selectedArrayField && (
                          <div className="mb-1">
                            <label className="text-[10px] text-gray-500">Index Field (ใช้ field นี้เป็น key)</label>
                            <select
                              value={selectedIndexField || ''}
                              onChange={(e) => setSelectedIndexField(e.target.value || null)}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                              title="Select field to use as index key"
                            >
                              <option value="">-- ใช้ตำแหน่ง index ปกติ --</option>
                              {getSubFieldsFromArrayField(selectedArrayField).map((subField) => (
                                <option key={subField} value={subField}>{subField}</option>
                              ))}
                            </select>
                            {selectedIndexField && (
                              <div className="mt-1 text-[9px] text-green-400">
                                ✓ จะใช้ค่าของ &quot;{selectedIndexField}&quot; เป็น key ในการจับคู่ข้อมูล
                              </div>
                            )}
                          </div>
                        )}
                        {/* Index Selector */}
                        {selectedArrayField && (
                          <div>
                            <label className="text-[10px] text-gray-500">
                              {selectedIndexField ? `Preview (${selectedIndexField})` : 'Index'}
                            </label>
                            <select
                              value={componentDataIndex}
                              onChange={(e) => setComponentDataIndex(Number(e.target.value))}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                              title="Select data index"
                            >
                              {Array.from({ length: getArrayFieldLength(selectedArrayField) }, (_, i) => (
                                <option key={i} value={i}>
                                  [{i}] {(() => {
                                    // Show index field value or first field value as preview
                                    const subFields = getSubFieldsFromArrayField(selectedArrayField);
                                    const previewField = selectedIndexField || (subFields.length > 0 ? subFields[0] : null);
                                    if (previewField) {
                                      const preview = getArrayFieldValue(selectedArrayField, previewField, i);
                                      return preview ? String(preview).substring(0, 30) : '';
                                    }
                                    return '';
                                  })()}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedComponentBlock ? (
                      <div className="p-2 space-y-2">
                        {/* Block Header */}
                        <div className="text-[10px] text-purple-400 font-medium border-b border-gray-700 pb-1">Block Settings</div>

                        {/* Label */}
                        <div>
                          <label className="text-[10px] text-gray-500">Label</label>
                          <input
                            type="text"
                            value={selectedComponentBlock.label}
                            onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { label: e.target.value })}
                            className="w-full px-1.5 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                            title="Block Label"
                          />
                        </div>

                        {/* Position X, Y */}
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="text-[10px] text-gray-500 cursor-ew-resize select-none"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const startX = e.clientX;
                                const startPosX = selectedComponentBlock.position.x;
                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const delta = moveEvent.clientX - startX;
                                  updateComponentBlock(selectedComponentBlock.id, { position: { ...selectedComponentBlock.position, x: Math.max(0, startPosX + delta) } });
                                };
                                const handleMouseUp = () => {
                                  document.removeEventListener('mousemove', handleMouseMove);
                                  document.removeEventListener('mouseup', handleMouseUp);
                                };
                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                              }}
                            >X ↔</label>
                            <input
                              type="number"
                              value={Math.round(selectedComponentBlock.position.x)}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { position: { ...selectedComponentBlock.position, x: Number(e.target.value) } })}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                              title="X Position"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 cursor-ns-resize select-none"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const startY = e.clientY;
                                const startPosY = selectedComponentBlock.position.y;
                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const delta = moveEvent.clientY - startY;
                                  updateComponentBlock(selectedComponentBlock.id, { position: { ...selectedComponentBlock.position, y: Math.max(0, startPosY + delta) } });
                                };
                                const handleMouseUp = () => {
                                  document.removeEventListener('mousemove', handleMouseMove);
                                  document.removeEventListener('mouseup', handleMouseUp);
                                };
                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                              }}
                            >Y ↕</label>
                            <input
                              type="number"
                              value={Math.round(selectedComponentBlock.position.y)}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { position: { ...selectedComponentBlock.position, y: Number(e.target.value) } })}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                              title="Y Position"
                            />
                          </div>
                        </div>

                        {/* Size W, H */}
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="text-[10px] text-gray-500 cursor-ew-resize select-none"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const startX = e.clientX;
                                const startW = selectedComponentBlock.size.width;
                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const delta = moveEvent.clientX - startX;
                                  updateComponentBlock(selectedComponentBlock.id, { size: { ...selectedComponentBlock.size, width: Math.max(20, startW + delta) } });
                                };
                                const handleMouseUp = () => {
                                  document.removeEventListener('mousemove', handleMouseMove);
                                  document.removeEventListener('mouseup', handleMouseUp);
                                };
                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                              }}
                            >W ↔</label>
                            <input
                              type="number"
                              value={Math.round(selectedComponentBlock.size.width)}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { size: { ...selectedComponentBlock.size, width: Number(e.target.value) } })}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                              title="Width"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 cursor-ns-resize select-none"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const startY = e.clientY;
                                const startH = selectedComponentBlock.size.height;
                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const delta = moveEvent.clientY - startY;
                                  updateComponentBlock(selectedComponentBlock.id, { size: { ...selectedComponentBlock.size, height: Math.max(10, startH + delta) } });
                                };
                                const handleMouseUp = () => {
                                  document.removeEventListener('mousemove', handleMouseMove);
                                  document.removeEventListener('mouseup', handleMouseUp);
                                };
                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                              }}
                            >H ↕</label>
                            <input
                              type="number"
                              value={Math.round(selectedComponentBlock.size.height)}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { size: { ...selectedComponentBlock.size, height: Number(e.target.value) } })}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                              title="Height"
                            />
                          </div>
                        </div>

                        {/* BG Color */}
                        <div>
                          <label className="text-[10px] text-gray-500">BG</label>
                          <div className="flex gap-0.5 items-center">
                            <input
                              type="color"
                              value={selectedComponentBlock.style.backgroundColor === 'transparent' ? '#000000' : selectedComponentBlock.style.backgroundColor}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, backgroundColor: e.target.value } })}
                              className="w-6 h-5 rounded cursor-pointer border border-gray-600"
                              disabled={selectedComponentBlock.style.backgroundColor === 'transparent'}
                              title="Background Color"
                            />
                            <input
                              type="text"
                              value={selectedComponentBlock.style.backgroundColor}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, backgroundColor: e.target.value } })}
                              className="flex-1 min-w-0 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[10px]"
                              title="Background Color"
                            />
                            <button
                              onClick={() => updateComponentBlock(selectedComponentBlock.id, {
                                style: { ...selectedComponentBlock.style, backgroundColor: selectedComponentBlock.style.backgroundColor === 'transparent' ? '#3b82f6' : 'transparent' }
                              })}
                              className={`px-1 py-0.5 rounded border text-[9px] ${
                                selectedComponentBlock.style.backgroundColor === 'transparent'
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="No Background"
                            >
                              None
                            </button>
                          </div>
                        </div>

                        {/* Text Color */}
                        <div>
                          <label className="text-[10px] text-gray-500">Text</label>
                          <div className="flex gap-0.5">
                            <input
                              type="color"
                              value={selectedComponentBlock.style.textColor}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, textColor: e.target.value } })}
                              className="w-6 h-5 rounded cursor-pointer border border-gray-600"
                              title="Text Color"
                            />
                            <input
                              type="text"
                              value={selectedComponentBlock.style.textColor}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, textColor: e.target.value } })}
                              className="flex-1 min-w-0 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[10px]"
                              title="Text Color"
                            />
                          </div>
                        </div>

                        {/* Border & Radius & Padding */}
                        <div className="grid grid-cols-3 gap-1">
                          <div>
                            <label className="text-[10px] text-gray-500">Border</label>
                            <input
                              type="number"
                              min="0"
                              value={selectedComponentBlock.style.borderWidth}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, borderWidth: Number(e.target.value) } })}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                              title="Border Width"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500">Radius</label>
                            <input
                              type="number"
                              min="0"
                              value={selectedComponentBlock.style.borderRadius}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, borderRadius: Number(e.target.value) } })}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                              title="Border Radius"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500">Pad</label>
                            <input
                              type="number"
                              min="0"
                              value={selectedComponentBlock.style.padding}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, padding: Number(e.target.value) } })}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                              title="Padding"
                            />
                          </div>
                        </div>

                        {/* Border Color */}
                        <div>
                          <label className="text-[10px] text-gray-500">Border Color</label>
                          <div className="flex gap-0.5">
                            <input
                              type="color"
                              value={selectedComponentBlock.style.borderColor}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, borderColor: e.target.value } })}
                              className="w-6 h-5 rounded cursor-pointer border border-gray-600"
                              title="Border Color"
                            />
                            <input
                              type="text"
                              value={selectedComponentBlock.style.borderColor}
                              onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, borderColor: e.target.value } })}
                              className="flex-1 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[10px]"
                              title="Border Color"
                            />
                          </div>
                        </div>

                        {/* Font Size */}
                        <div>
                          <label className="text-[10px] text-gray-500 cursor-ew-resize select-none"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const startX = e.clientX;
                              const startSize = selectedComponentBlock.style.fontSize;
                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                const delta = (moveEvent.clientX - startX) / 5;
                                updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, fontSize: Math.max(8, Math.round(startSize + delta)) } });
                              };
                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                              };
                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                            }}
                          >Font Size ↔</label>
                          <input
                            type="number"
                            min="8"
                            max="200"
                            value={selectedComponentBlock.style.fontSize}
                            onChange={(e) => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, fontSize: Number(e.target.value) } })}
                            className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px]"
                            title="Font Size"
                          />
                        </div>

                        {/* Align & Weight */}
                        <div className="flex gap-1">
                          <div className="flex gap-0.5">
                            <button
                              onClick={() => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, textAlign: 'left' } })}
                              className={`p-1 rounded border ${
                                selectedComponentBlock.style.textAlign === 'left'
                                  ? 'bg-blue-600 border-blue-500'
                                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                              }`}
                              title="Align Left"
                            >
                              <AlignLeft size={12} className="text-white" />
                            </button>
                            <button
                              onClick={() => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, textAlign: 'center' } })}
                              className={`p-1 rounded border ${
                                selectedComponentBlock.style.textAlign === 'center'
                                  ? 'bg-blue-600 border-blue-500'
                                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                              }`}
                              title="Align Center"
                            >
                              <AlignCenter size={12} className="text-white" />
                            </button>
                            <button
                              onClick={() => updateComponentBlock(selectedComponentBlock.id, { style: { ...selectedComponentBlock.style, textAlign: 'right' } })}
                              className={`p-1 rounded border ${
                                selectedComponentBlock.style.textAlign === 'right'
                                  ? 'bg-blue-600 border-blue-500'
                                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                              }`}
                              title="Align Right"
                            >
                              <AlignRight size={12} className="text-white" />
                            </button>
                          </div>
                          <div className="flex gap-0.5">
                            <button
                              onClick={() => updateComponentBlock(selectedComponentBlock.id, {
                                style: { ...selectedComponentBlock.style, fontWeight: selectedComponentBlock.style.fontWeight === 'bold' ? 'normal' : 'bold' }
                              })}
                              className={`p-1 rounded border ${
                                selectedComponentBlock.style.fontWeight === 'bold'
                                  ? 'bg-blue-600 border-blue-500'
                                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                              }`}
                              title="Bold"
                            >
                              <Bold size={12} className="text-white" />
                            </button>
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => deleteComponentBlock(selectedComponentBlock.id)}
                          className="w-full px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center justify-center gap-1 mt-2"
                        >
                          <Trash2 size={12} /> Delete Block
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500 text-xs">
                        <Box size={24} className="mx-auto mb-2 opacity-50" />
                        เลือก block เพื่อแก้ไข
                      </div>
                    )}
                  </div>
                </div>
              ) : modalTab === 'byField' ? (
                <div className="flex gap-0 h-[calc(80vh-150px)]">
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
                        เลือก field จากรายการด้านซ้ายเพื่อดูค่าทั้งหมด
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

      {/* Edit Component Modal - Select saved component to edit */}
      {showEditComponentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowEditComponentModal(false)}>
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-2xl max-h-[70vh] w-full mx-4 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
              <h3 className="text-white font-medium text-sm flex items-center gap-2">
                <FolderOpen size={16} className="text-blue-400" /> Load Component to Edit
              </h3>
              <button
                onClick={() => setShowEditComponentModal(false)}
                className="text-gray-400 hover:text-white p-1"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            {/* Modal Body */}
            <div className="overflow-auto flex-1 p-4 dark-scrollbar">
              {savedComponents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No components saved yet</p>
                  <p className="text-xs mt-1">Save a component first to edit it later</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {savedComponents.map((component) => (
                    <div
                      key={component.id}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-blue-500 cursor-pointer transition-colors group"
                      onClick={() => loadComponentForEdit(component)}
                    >
                      {/* Component Preview */}
                      <div className="bg-gray-950 border border-gray-700 rounded h-20 mb-2 flex items-center justify-center overflow-hidden">
                        <div className="relative w-full h-full" style={{ transform: 'scale(0.3)', transformOrigin: 'top left' }}>
                          {component.blocks.slice(0, 5).map((block) => (
                            <div
                              key={block.id}
                              className="absolute text-[10px] truncate"
                              style={{
                                left: block.position.x * 0.3,
                                top: block.position.y * 0.3,
                                color: block.style.textColor,
                                backgroundColor: block.style.backgroundColor,
                                padding: '2px 4px',
                                borderRadius: 2,
                              }}
                            >
                              {block.label}
                            </div>
                          ))}
                        </div>
                        {component.blocks.length === 0 && (
                          <span className="text-gray-600 text-xs">Empty</span>
                        )}
                      </div>
                      {/* Component Info */}
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium truncate">{component.name}</span>
                        <span className="text-gray-500 text-xs">{component.blocks.length} blocks</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Components Modal */}
      {showComponentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowComponentsModal(false)}>
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-2xl max-h-[70vh] w-full mx-4 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
              <h3 className="text-white font-medium text-sm flex items-center gap-2">
                <Package size={16} className="text-purple-400" /> Components
              </h3>
              <button
                onClick={() => setShowComponentsModal(false)}
                className="text-gray-400 hover:text-white p-1"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-auto flex-1 p-4 dark-scrollbar">
              {savedComponents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No components saved yet</p>
                  <p className="text-xs mt-1">Create components from the API Sync tab</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {savedComponents.map((component) => (
                    <div
                      key={component.id}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-purple-500 cursor-pointer transition-colors group"
                      onClick={() => {
                        if (onAddComponent) {
                          onAddComponent(component);
                        }
                        setShowComponentsModal(false);
                      }}
                    >
                      {/* Component Preview */}
                      <div className="bg-gray-950 border border-gray-700 rounded h-20 mb-2 flex items-center justify-center overflow-hidden">
                        <div className="relative w-full h-full" style={{ transform: 'scale(0.3)', transformOrigin: 'top left' }}>
                          {component.blocks.slice(0, 5).map((block) => (
                            <div
                              key={block.id}
                              className="absolute text-[10px] truncate"
                              style={{
                                left: block.position.x * 0.3,
                                top: block.position.y * 0.3,
                                color: block.style.textColor,
                                backgroundColor: block.style.backgroundColor,
                                padding: '2px 4px',
                                borderRadius: 2,
                              }}
                            >
                              {block.label}
                            </div>
                          ))}
                        </div>
                        {component.blocks.length === 0 && (
                          <span className="text-gray-600 text-xs">Empty</span>
                        )}
                      </div>
                      {/* Component Info */}
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium truncate">{component.name}</span>
                        <span className="text-gray-500 text-xs">{component.blocks.length} blocks</span>
                      </div>
                    </div>
                  ))}
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
