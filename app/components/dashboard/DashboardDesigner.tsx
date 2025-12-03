'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Block, BlockGroup, DashboardConfig, BlockStyle, BlockType, ApiData, ComponentConfig } from '../../types/dashboard';
import BottomPanel, { BLOCK_TEMPLATES } from './BottomPanel';
import Canvas from './Canvas';
import { Layers, Eye, EyeOff, Trash2, ChevronLeft, ChevronRight, Type, Hash, Tag, Gauge, BarChart3, Image, Clock, Table, Box, FolderOpen, FolderClosed, ChevronDown, ChevronRight as ChevronRightIcon, Ungroup, X, AlignLeft, AlignCenter, AlignRight, Bold, Settings2 } from 'lucide-react';

const DEFAULT_BLOCK_STYLE: BlockStyle = {
  backgroundColor: '#1e40af',
  textColor: '#ffffff',
  fontSize: 24,
  fontWeight: 'bold',
  fontFamily: 'Arial',
  textAlign: 'center',
  borderRadius: 8,
  padding: 12,
  borderWidth: 0,
  borderColor: '#3b82f6',
};

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  id: 'dashboard-1',
  name: 'My Dashboard',
  backgroundImage: '',
  canvasSize: { width: 1920, height: 1080 },
  blocks: [],
  groups: [],
  apiConfig: { url: '', method: 'GET', headers: {}, refreshInterval: 2 },
};

// Local storage key
const STORAGE_KEY = 'dashboard-config';
const API_STORAGE_KEY = 'dashboard-api';

const DEFAULT_API_DATA: ApiData = {
  url: '',
  data: null,
  headers: [],
  loading: false,
  error: null,
  lastFetched: null,
};

// Helper to extract all keys from nested object
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
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

export default function DashboardDesigner() {
  const [isEditMode, setIsEditMode] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [apiData, setApiData] = useState<ApiData>(DEFAULT_API_DATA);
  const [isSaving, setIsSaving] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(true);
  const [savedProjects, setSavedProjects] = useState<{ name: string; path: string }[]>([]);
  const [showLiveData, setShowLiveData] = useState(false); // Toggle to show live data vs variable names
  const [wsConnected, setWsConnected] = useState(false);

  // Refs for WebSocket and interval
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get block type icon
  const getBlockTypeIcon = (type: BlockType) => {
    const iconProps = { size: 12 };
    switch (type) {
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

  // Load config from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to load saved config', err);
      }
    }
    // Load API data
    const savedApi = localStorage.getItem(API_STORAGE_KEY);
    if (savedApi) {
      try {
        setApiData(JSON.parse(savedApi));
      } catch (err) {
        console.error('Failed to load saved API data', err);
      }
    }
  }, []);

  // Save config to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  // Save API data to localStorage on change
  useEffect(() => {
    localStorage.setItem(API_STORAGE_KEY, JSON.stringify(apiData));
  }, [apiData]);

  // Fetch API data function (used by both polling and manual fetch)
  const fetchApiData = useCallback(async () => {
    if (!config.apiConfig.url) return;

    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(config.apiConfig.url)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();

      let headers: string[] = [];
      if (Array.isArray(data) && data.length > 0) {
        headers = extractKeys(data[0] as Record<string, unknown>);
      } else if (typeof data === 'object' && data !== null) {
        headers = extractKeys(data as Record<string, unknown>);
      }

      setApiData((prev) => ({
        ...prev,
        url: config.apiConfig.url,
        data,
        headers,
        loading: false,
        error: null,
        lastFetched: Date.now(),
      }));
    } catch (err) {
      setApiData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch',
      }));
    }
  }, [config.apiConfig.url]);

  // WebSocket connection management
  useEffect(() => {
    // Clean up existing connections
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // WebSocket mode
    if (config.apiConfig.wsEnabled && config.apiConfig.wsUrl) {
      const ws = new WebSocket(config.apiConfig.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected:', config.apiConfig.wsUrl);
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          let headers: string[] = [];
          if (Array.isArray(data) && data.length > 0) {
            headers = extractKeys(data[0] as Record<string, unknown>);
          } else if (typeof data === 'object' && data !== null) {
            headers = extractKeys(data as Record<string, unknown>);
          }

          setApiData((prev) => ({
            ...prev,
            data,
            headers,
            loading: false,
            error: null,
            lastFetched: Date.now(),
          }));
        } catch {
          console.error('Failed to parse WebSocket message');
        }
      };

      ws.onerror = () => {
        setApiData((prev) => ({ ...prev, error: 'WebSocket error' }));
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
      };

      return () => {
        ws.close();
      };
    }

    // Polling mode
    if (config.apiConfig.url && config.apiConfig.refreshInterval > 0) {
      // Initial fetch
      fetchApiData();

      // Set up interval
      intervalRef.current = setInterval(() => {
        fetchApiData();
      }, config.apiConfig.refreshInterval * 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [config.apiConfig.wsEnabled, config.apiConfig.wsUrl, config.apiConfig.url, config.apiConfig.refreshInterval, fetchApiData]);

  const selectedBlock = config.blocks.find((b) => b.id === selectedBlockId);

  const handleBackgroundChange = useCallback((backgroundImage: string) => {
    setConfig((prev) => ({ ...prev, backgroundImage }));
  }, []);

  // Create block from template
  const handleBlockCreateFromTemplate = useCallback((type: BlockType) => {
    const template = BLOCK_TEMPLATES.find((t) => t.type === type);
    if (!template) return;

    const newBlock: Block = {
      id: `block-${Date.now()}`,
      type,
      position: { x: 100, y: 100 },
      size: { ...template.defaultSize },
      variableKey: '',
      label: template.label,
      style: { ...DEFAULT_BLOCK_STYLE, ...template.defaultStyle },
    };

    setConfig((prev) => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }));

    setSelectedBlockId(newBlock.id);
  }, []);

  const handleBlockUpdate = useCallback((updatedBlock: Block) => {
    setConfig((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)),
    }));
  }, []);

  // Handle updating multiple blocks at once (for multi-drag)
  const handleMultiBlocksUpdate = useCallback((updatedBlocks: Block[]) => {
    setConfig((prev) => ({
      ...prev,
      blocks: updatedBlocks,
    }));
  }, []);

  const handleBlockDelete = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== id),
    }));
    setSelectedBlockId(null);
  }, []);

  // Handle keyboard Delete key to delete selected block(s)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && isEditMode) {
        // Prevent deleting when focused on input fields
        const activeElement = document.activeElement;
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
          return;
        }

        // Delete multiple selected blocks
        if (selectedBlockIds.length > 0) {
          setConfig((prev) => ({
            ...prev,
            blocks: prev.blocks.filter((b) => !selectedBlockIds.includes(b.id)),
          }));
          setSelectedBlockIds([]);
          setSelectedBlockId(null);
        } else if (selectedBlockId) {
          handleBlockDelete(selectedBlockId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, selectedBlockIds, isEditMode, handleBlockDelete]);

  // Handle multi-block selection
  const handleMultiBlockSelect = useCallback((ids: string[]) => {
    setSelectedBlockIds(ids);
    if (ids.length > 0) {
      setSelectedBlockId(null);
    }
  }, []);

  // Handle selecting all blocks in a group
  const handleSelectGroup = useCallback((groupId: string) => {
    const groupBlockIds = config.blocks
      .filter((b) => b.groupId === groupId)
      .map((b) => b.id);

    if (groupBlockIds.length > 0) {
      setSelectedBlockIds(groupBlockIds);
      setSelectedBlockId(null);
    }
  }, [config.blocks]);

  // Handle grouping blocks - creates a folder in layer panel
  const handleGroupBlocks = useCallback((ids: string[]) => {
    if (ids.length < 2) return;

    // Create a new group
    const groupId = `group-${Date.now()}`;
    const newGroup: BlockGroup = {
      id: groupId,
      name: `Group ${(config.groups?.length || 0) + 1}`,
      isExpanded: true,
    };

    // Update blocks to belong to this group
    setConfig((prev) => ({
      ...prev,
      groups: [...(prev.groups || []), newGroup],
      blocks: prev.blocks.map((block) =>
        ids.includes(block.id) ? { ...block, groupId } : block
      ),
    }));

    // Clear selection after grouping
    setSelectedBlockIds([]);
  }, [config.groups]);

  // Handle ungrouping blocks
  const handleUngroupBlocks = useCallback((groupId: string) => {
    setConfig((prev) => ({
      ...prev,
      groups: (prev.groups || []).filter((g) => g.id !== groupId),
      blocks: prev.blocks.map((block) =>
        block.groupId === groupId ? { ...block, groupId: undefined } : block
      ),
    }));
  }, []);

  // Toggle group expanded state
  const handleToggleGroup = useCallback((groupId: string) => {
    setConfig((prev) => ({
      ...prev,
      groups: (prev.groups || []).map((g) =>
        g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g
      ),
    }));
  }, []);

  // Rename group
  const handleRenameGroup = useCallback((groupId: string, newName: string) => {
    setConfig((prev) => ({
      ...prev,
      groups: (prev.groups || []).map((g) =>
        g.id === groupId ? { ...g, name: newName } : g
      ),
    }));
  }, []);

  // Delete group and all its blocks
  const handleDeleteGroup = useCallback((groupId: string) => {
    setConfig((prev) => ({
      ...prev,
      groups: (prev.groups || []).filter((g) => g.id !== groupId),
      blocks: prev.blocks.filter((block) => block.groupId !== groupId),
    }));
    // Clear selection
    setSelectedBlockIds([]);
    setSelectedBlockId(null);
  }, []);

  // Update all instances of a component on the main canvas when component is saved
  const handleComponentUpdate = useCallback((updatedComponent: ComponentConfig) => {
    setConfig((prev) => {
      // Find all blocks that came from this component
      const affectedBlocks = prev.blocks.filter(
        (block) => block.sourceComponentId === updatedComponent.id
      );

      if (affectedBlocks.length === 0) return prev;

      // Group blocks by their groupId to handle multiple instances
      const blocksByGroup = affectedBlocks.reduce((acc, block) => {
        if (block.groupId) {
          if (!acc[block.groupId]) acc[block.groupId] = [];
          acc[block.groupId].push(block);
        }
        return acc;
      }, {} as Record<string, Block[]>);

      let newBlocks = [...prev.blocks];

      // For each group (instance of the component)
      Object.entries(blocksByGroup).forEach(([groupId, instanceBlocks]) => {
        // Get the position offset of this instance (use first block as reference)
        const firstInstanceBlock = instanceBlocks[0];
        const firstOriginalBlock = updatedComponent.blocks.find(
          (b) => b.id === firstInstanceBlock.sourceBlockId
        );

        if (!firstOriginalBlock) return;

        const offsetX = firstInstanceBlock.position.x - firstOriginalBlock.position.x;
        const offsetY = firstInstanceBlock.position.y - firstOriginalBlock.position.y;

        // Get array field info for variableKey transformation
        const arrayField = updatedComponent.arrayField;

        // Use dataIndex from updatedComponent (from Sync tab)
        // This will update all instances to use the new index
        const dataIndex = updatedComponent.dataIndex ?? 0;

        // Remove old blocks from this instance
        newBlocks = newBlocks.filter((b) => b.groupId !== groupId);

        // Add updated blocks
        updatedComponent.blocks.forEach((srcBlock) => {
          let newVariableKey = srcBlock.variableKey;

          // Transform variableKey if using arrayField
          if (srcBlock.variableKey && arrayField && srcBlock.variableKey.startsWith(`${arrayField}.`)) {
            const subField = srcBlock.variableKey.substring(arrayField.length + 1);
            newVariableKey = `${arrayField}[${dataIndex}].${subField}`;
          }

          newBlocks.push({
            ...srcBlock,
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            groupId: groupId,
            variableKey: newVariableKey,
            position: {
              x: offsetX + srcBlock.position.x,
              y: offsetY + srcBlock.position.y,
            },
            sourceComponentId: updatedComponent.id,
            sourceBlockId: srcBlock.id,
          });
        });
      });

      // Update group names if component name changed
      const newGroups = prev.groups.map((g) => {
        const isComponentGroup = affectedBlocks.some((b) => b.groupId === g.id);
        if (isComponentGroup) {
          return { ...g, name: updatedComponent.name };
        }
        return g;
      });

      return { ...prev, blocks: newBlocks, groups: newGroups };
    });
  }, []);

  // Add component to canvas - creates a group with component name and adds all blocks
  const handleAddComponent = useCallback((component: ComponentConfig) => {
    // Create a new group for the component
    const groupId = `component-${Date.now()}`;
    const newGroup: BlockGroup = {
      id: groupId,
      name: component.name,
      isExpanded: true,
    };

    // Calculate offset to place component blocks near center of canvas
    const canvasCenter = {
      x: Math.max(50, (config.canvasSize.width / 2) - (component.size.width / 2)),
      y: Math.max(50, (config.canvasSize.height / 2) - (component.size.height / 2)),
    };

    // Get array field and index from component
    const arrayField = component.arrayField;
    const dataIndex = component.dataIndex ?? 0;

    // Create new blocks with new IDs and group assignment
    // Transform variableKey from "arrayField.subField" to "arrayField[index].subField"
    const newBlocks: Block[] = component.blocks.map((block) => {
      let newVariableKey = block.variableKey;

      // If the block has a variableKey and component has arrayField
      if (block.variableKey && arrayField && block.variableKey.startsWith(`${arrayField}.`)) {
        // Transform "data.htcCode" to "data[0].htcCode"
        const subField = block.variableKey.substring(arrayField.length + 1);
        newVariableKey = `${arrayField}[${dataIndex}].${subField}`;
      }

      return {
        ...block,
        id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        groupId: groupId,
        variableKey: newVariableKey,
        position: {
          x: canvasCenter.x + block.position.x,
          y: canvasCenter.y + block.position.y,
        },
        sourceComponentId: component.id, // Track which component this block came from
        sourceBlockId: block.id, // Track original block ID for updates
      };
    });

    setConfig((prev) => ({
      ...prev,
      groups: [...(prev.groups || []), newGroup],
      blocks: [...prev.blocks, ...newBlocks],
    }));
  }, [config.canvasSize]);

  const handleBlockDuplicate = useCallback((block: Block) => {
    const newBlock: Block = {
      ...block,
      id: `block-${Date.now()}`,
      position: { x: block.position.x + 20, y: block.position.y + 20 },
    };

    setConfig((prev) => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }));

    setSelectedBlockId(newBlock.id);
  }, []);

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportName = `${config.name.replace(/\s+/g, '-').toLowerCase()}-config.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
  }, [config]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          setConfig(imported);
        } catch (err) {
          alert('Failed to import configuration');
          console.error(err);
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (confirm('Are you sure you want to reset all settings?')) {
      setConfig(DEFAULT_DASHBOARD_CONFIG);
      setSelectedBlockId(null);
      setApiData(DEFAULT_API_DATA);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(API_STORAGE_KEY);
    }
  }, []);

  // Save project to config folder
  const handleSaveProject = useCallback(async () => {
    setIsSaving(true);
    try {
      // Collect images that need to be saved (base64 data URLs)
      const images: Record<string, string> = {};

      // Check if background image is a base64 data URL
      if (config.backgroundImage && config.backgroundImage.startsWith('data:')) {
        images.backgroundImage = config.backgroundImage;
      }

      // Check blocks for image content (for image type blocks)
      config.blocks.forEach((block) => {
        if (block.type === 'image' && block.content && block.content.startsWith('data:')) {
          images[`block-${block.id}`] = block.content;
        }
      });

      // Merge apiData.url into config.apiConfig for saving
      const configToSave = {
        ...config,
        apiConfig: {
          ...config.apiConfig,
          url: apiData.url || config.apiConfig.url,
        },
      };

      const response = await fetch('/api/save-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName: config.name,
          config: configToSave,
          images,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Project saved successfully!\nConfig: ${result.configPath}`);
      } else {
        throw new Error(result.error || 'Failed to save project');
      }
    } catch (err) {
      console.error('Error saving project:', err);
      alert('Failed to save project: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  }, [config, apiData.url]);

  // Load project list
  const handleLoadProject = useCallback(async () => {
    try {
      const response = await fetch('/api/load-project');
      const result = await response.json();

      if (result.success) {
        setSavedProjects(result.projects);
        setShowLoadModal(true);
      } else {
        throw new Error(result.error || 'Failed to load projects');
      }
    } catch (err) {
      console.error('Error loading project list:', err);
      alert('Failed to load project list: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, []);

  // Load specific project
  const handleLoadSpecificProject = useCallback(async (projectName: string) => {
    try {
      const response = await fetch(`/api/load-project?name=${encodeURIComponent(projectName)}`);
      const result = await response.json();

      if (result.success) {
        setConfig(result.config);
        // Sync apiData.url from loaded config
        if (result.config.apiConfig?.url) {
          setApiData((prev) => ({ ...prev, url: result.config.apiConfig.url }));
        }
        setShowLoadModal(false);
        alert(`Project "${projectName}" loaded successfully!`);
      } else {
        throw new Error(result.error || 'Failed to load project');
      }
    } catch (err) {
      console.error('Error loading project:', err);
      alert('Failed to load project: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, []);

  // API handlers
  const handleApiUrlChange = useCallback((url: string) => {
    setApiData((prev) => ({ ...prev, url }));
    // Also sync to config.apiConfig for saving
    setConfig((prev) => ({
      ...prev,
      apiConfig: { ...prev.apiConfig, url },
    }));
  }, []);

  const handleApiFetch = useCallback(async () => {
    if (!apiData.url) return;

    setApiData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Use proxy API route to avoid CORS issues
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(apiData.url)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();

      // Extract headers (keys) from the response
      let headers: string[] = [];
      if (Array.isArray(data) && data.length > 0) {
        // If array, use first item's keys
        headers = extractKeys(data[0] as Record<string, unknown>);
      } else if (typeof data === 'object' && data !== null) {
        headers = extractKeys(data as Record<string, unknown>);
      }

      setApiData((prev) => ({
        ...prev,
        data,
        headers,
        loading: false,
        error: null,
        lastFetched: Date.now(),
      }));
    } catch (err) {
      setApiData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch',
      }));
    }
  }, [apiData.url]);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Minimal Topbar - only show when bottom panel is hidden */}
      {!showSettings && (
        <div className="flex items-center justify-between px-2 py-1 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">📊 {config.name}</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1"
            title="Open Settings Panel"
          >
            ⚙️ Settings
          </button>
        </div>
      )}

      {/* Canvas - Takes full space */}
      <div className="flex-1 overflow-hidden relative">
        <Canvas
          blocks={config.blocks}
          groups={config.groups || []}
          selectedBlockId={selectedBlockId}
          selectedBlockIds={selectedBlockIds}
          selectedGroupId={null}
          isEditMode={isEditMode}
          backgroundImage={config.backgroundImage}
          canvasSize={config.canvasSize}
          onBlockSelect={setSelectedBlockId}
          onMultiBlockSelect={handleMultiBlockSelect}
          onBlockUpdate={handleBlockUpdate}
          onMultiBlocksUpdate={handleMultiBlocksUpdate}
          onBlockDelete={handleBlockDelete}
          onGroupBlocks={handleGroupBlocks}
          onSelectGroup={handleSelectGroup}
          onUngroupBlocks={handleUngroupBlocks}
          onRenameGroup={handleRenameGroup}
          onDeleteGroup={handleDeleteGroup}
          apiData={apiData.data}
          showLiveData={showLiveData}
        />

        {/* Floating Live Data Toggle Button + Connection Status */}
        {isEditMode && (
          <div className="absolute top-2 right-2 z-30 flex items-center gap-2">
            {/* Connection Status */}
            {config.apiConfig.wsEnabled ? (
              <div className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                wsConnected ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'
              }`}>
                {wsConnected ? '🔌 WS Connected' : '❌ WS Disconnected'}
              </div>
            ) : config.apiConfig.refreshInterval > 0 && config.apiConfig.url ? (
              <div className="px-2 py-1 rounded text-xs bg-blue-800 text-blue-200 flex items-center gap-1">
                🔄 Polling {config.apiConfig.refreshInterval}s
              </div>
            ) : null}

            {/* Live Data Toggle */}
            <button
              onClick={() => setShowLiveData(!showLiveData)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-lg transition-all ${
                showLiveData
                  ? 'bg-green-900 text-white hover:bg-green-700'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={showLiveData ? 'Showing live data' : 'Showing variable names'}
            >
              {showLiveData ? <Eye size={14} /> : <EyeOff size={14} />}
              {showLiveData ? 'Live Data' : 'Variables'}
            </button>
          </div>
        )}

        {/* Floating Layer Panel with Block Settings - Above Bottom Panel */}
        {isEditMode && showSettings && (
          <div
            className="absolute left-0 bottom-[10px] bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-t-lg shadow-xl z-20 flex flex-col dark-scrollbar overflow-hidden transition-all"
            style={{ maxHeight: 'calc(100% - 100px)', width: showLayerPanel ? '200px' : '32px' }}
          >
            {/* Block Settings Section - Only when block is selected */}
            {showLayerPanel && selectedBlock && (
              <div className="border-b border-gray-600">
                {/* Settings Header */}
                <div
                  onClick={() => setShowDetailPanel(!showDetailPanel)}
                  className="px-2 py-1 bg-gray-900/50 flex items-center gap-1.5 cursor-pointer hover:bg-gray-700/50"
                >
                  <Settings2 size={14} className="text-blue-400" />
                  <span className="text-[12px] text-white font-medium">Settings</span>
                  <span className="text-[12px] text-gray-500 ml-auto">{showDetailPanel ? '−' : '+'}</span>
                </div>

                {/* Settings Content */}
                {showDetailPanel && (
                  <div className="p-1.5 space-y-1 max-h-[300px] overflow-y-auto">
                    {/* Label */}
                    <div>
                      <label className="text-[11px] text-gray-400 uppercase">Label</label>
                      <input
                        type="text"
                        aria-label="Label of the block"
                        value={selectedBlock.label}
                        onChange={(e) => handleBlockUpdate({ ...selectedBlock, label: e.target.value })}
                        className="w-full px-1.5 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Position X, Y */}
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className="text-[11px] text-gray-500">X</label>
                        <input
                          type="number"
                          aria-label="The X position of the block"
                          value={Math.round(selectedBlock.position.x)}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            position: { ...selectedBlock.position, x: Number(e.target.value) }
                          })}
                          className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500">Y</label>
                        <input
                          type="number"
                          aria-label="The Y position of the block"
                          value={Math.round(selectedBlock.position.y)}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            position: { ...selectedBlock.position, y: Number(e.target.value) }
                          })}
                          className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Size W, H */}
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className="text-[11px] text-gray-500">W</label>
                        <input
                          type="number"
                          aria-label="The width of the block"
                          value={Math.round(selectedBlock.size.width)}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            size: { ...selectedBlock.size, width: Number(e.target.value) }
                          })}
                          className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500">H</label>
                        <input
                          type="number"
                          aria-label="The height of the block"
                          value={Math.round(selectedBlock.size.height)}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            size: { ...selectedBlock.size, height: Number(e.target.value) }
                          })}
                          className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* BG Color */}
                    <div>
                      <label className="text-[11px] text-gray-500">BG</label>
                      <div className="flex gap-0.5 items-center">
                        <input
                          type="color"
                          aria-label="Background color of the block"
                          value={selectedBlock.style.backgroundColor === 'transparent' ? '#000000' : selectedBlock.style.backgroundColor}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            style: { ...selectedBlock.style, backgroundColor: e.target.value }
                          })}
                          className="w-6 h-5 rounded cursor-pointer border border-gray-600"
                          disabled={selectedBlock.style.backgroundColor === 'transparent'}
                        />
                        <input
                          type="text"
                          aria-label="Background color of the block"
                          value={selectedBlock.style.backgroundColor}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            style: { ...selectedBlock.style, backgroundColor: e.target.value }
                          })}
                          className="flex-1 min-w-0 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => handleBlockUpdate({
                            ...selectedBlock,
                            style: { ...selectedBlock.style, backgroundColor: selectedBlock.style.backgroundColor === 'transparent' ? '#3b82f6' : 'transparent' }
                          })}
                          className={`px-1.5 py-0.5 rounded border text-[10px] ${
                            selectedBlock.style.backgroundColor === 'transparent'
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
                      <label className="text-[11px] text-gray-500">Text</label>
                      <div className="flex gap-0.5">
                        <input
                          type="color"
                          aria-label="Text color of the block"
                          value={selectedBlock.style.textColor}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            style: { ...selectedBlock.style, textColor: e.target.value }
                          })}
                          className="w-6 h-5 rounded cursor-pointer border border-gray-600"
                        />
                        <input
                          type="text"
                          aria-label="Text color of the block"
                          value={selectedBlock.style.textColor}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            style: { ...selectedBlock.style, textColor: e.target.value }
                          })}
                          className="flex-1 min-w-0 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Border */}
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <label className="text-[11px] text-gray-500">Border</label>
                        <input
                          type="number"
                          aria-label="Border width of the block"
                          min="0"
                          value={selectedBlock.style.borderWidth}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            style: { ...selectedBlock.style, borderWidth: Number(e.target.value) }
                          })}
                          className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500">Radius</label>
                        <input
                          type="number"
                          aria-label="Border radius of the block"
                          min="0"
                          value={selectedBlock.style.borderRadius}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            style: { ...selectedBlock.style, borderRadius: Number(e.target.value) }
                          })}
                          className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500">Pad</label>
                        <input
                          type="number"
                          aria-label="Padding of the block"
                          min="0"
                          value={selectedBlock.style.padding}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            style: { ...selectedBlock.style, padding: Number(e.target.value) }
                          })}
                          className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Border Color */}
                    <div>
                      <label className="text-[11px] text-gray-500">Border Color</label>
                      <div className="flex gap-0.5">
                        <input
                          aria-label="Border color of the block"
                          type="color"
                          value={selectedBlock.style.borderColor}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            style: { ...selectedBlock.style, borderColor: e.target.value }
                          })}
                          className="w-6 h-5 rounded cursor-pointer border border-gray-600"
                        />
                        <input
                          aria-label="Border color of the block"
                          type="text"
                          value={selectedBlock.style.borderColor}
                          onChange={(e) => handleBlockUpdate({
                            ...selectedBlock,
                            style: { ...selectedBlock.style, borderColor: e.target.value }
                          })}
                          className="flex-1 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Text Settings - Only for text/label blocks */}
                    {(selectedBlock.type === 'text' || selectedBlock.type === 'label') && (
                      <>
                        {/* Font & Size */}
                        <div className="grid grid-cols-3 gap-1">
                          <div className="col-span-2">
                            <label className="text-[11px] text-gray-500">Font</label>
                            <select
                              aria-label="Font family of the block"
                              value={selectedBlock.style.fontFamily || 'Arial'}
                              onChange={(e) => handleBlockUpdate({
                                ...selectedBlock,
                                style: { ...selectedBlock.style, fontFamily: e.target.value }
                              })}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                            >
                              <option value="Arial">Arial</option>
                              <option value="Helvetica">Helvetica</option>
                              <option value="Times New Roman">Times</option>
                              <option value="Georgia">Georgia</option>
                              <option value="Verdana">Verdana</option>
                              <option value="Courier New">Courier</option>
                              <option value="Tahoma">Tahoma</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-500">Size</label>
                            <input
                              aria-label="Font size of the block"
                              type="number"
                              min="8"
                              max="200"
                              value={selectedBlock.style.fontSize}
                              onChange={(e) => handleBlockUpdate({
                                ...selectedBlock,
                                style: { ...selectedBlock.style, fontSize: Number(e.target.value) }
                              })}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* Align & Weight */}
                        <div className="flex gap-1">
                          <div className="flex gap-0.5">
                            <button
                              onClick={() => handleBlockUpdate({
                                ...selectedBlock,
                                style: { ...selectedBlock.style, textAlign: 'left' }
                              })}
                              className={`p-1 rounded border ${
                                selectedBlock.style.textAlign === 'left'
                                  ? 'bg-blue-600 border-blue-500'
                                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                              }`}
                              title="Left"
                            >
                              <AlignLeft size={12} className="text-white" />
                            </button>
                            <button
                              onClick={() => handleBlockUpdate({
                                ...selectedBlock,
                                style: { ...selectedBlock.style, textAlign: 'center' }
                              })}
                              className={`p-1 rounded border ${
                                selectedBlock.style.textAlign === 'center'
                                  ? 'bg-blue-600 border-blue-500'
                                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                              }`}
                              title="Center"
                            >
                              <AlignCenter size={12} className="text-white" />
                            </button>
                            <button
                              onClick={() => handleBlockUpdate({
                                ...selectedBlock,
                                style: { ...selectedBlock.style, textAlign: 'right' }
                              })}
                              className={`p-1 rounded border ${
                                selectedBlock.style.textAlign === 'right'
                                  ? 'bg-blue-600 border-blue-500'
                                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                              }`}
                              title="Right"
                            >
                              <AlignRight size={12} className="text-white" />
                            </button>
                          </div>
                          <div className="flex gap-0.5 ml-auto">
                            <button
                              onClick={() => handleBlockUpdate({
                                ...selectedBlock,
                                style: { ...selectedBlock.style, fontWeight: 'normal' }
                              })}
                              className={`px-1.5 py-1 rounded border text-[11px] ${
                                selectedBlock.style.fontWeight === 'normal'
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              N
                            </button>
                            <button
                              onClick={() => handleBlockUpdate({
                                ...selectedBlock,
                                style: { ...selectedBlock.style, fontWeight: 'bold' }
                              })}
                              className={`px-1.5 py-1 rounded border text-[11px] font-bold ${
                                selectedBlock.style.fontWeight === 'bold'
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              B
                            </button>
                          </div>
                        </div>

                        {/* Content (for label type) */}
                        {selectedBlock.type === 'label' && (
                          <div>
                            <label className="text-[11px] text-gray-500">Content</label>
                            <textarea
                              value={selectedBlock.content || ''}
                              onChange={(e) => handleBlockUpdate({
                                ...selectedBlock,
                                content: e.target.value
                              })}
                              rows={2}
                              className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-[11px] focus:outline-none focus:border-blue-500 resize-none"
                              placeholder="Enter text..."
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Header with Toggle */}
            <div
              onClick={() => setShowLayerPanel(!showLayerPanel)}
              className="px-2 py-2 border-b border-gray-700 flex items-center gap-2 cursor-pointer hover:bg-gray-700/50 rounded-t-lg"
            >
              <Layers size={14} className="text-gray-400" />
              {showLayerPanel && (
                <>
                  <span className="text-xs text-gray-400 font-medium">LAYERS</span>
                  <span className="text-xs text-gray-500 ml-auto">{config.blocks.length}</span>
                </>
              )}
            </div>

            {/* Layer Items */}
            {showLayerPanel && (
              <div className="flex-1 overflow-y-auto max-h-[300px]">
                {config.blocks.length === 0 && (config.groups || []).length === 0 ? (
                  <div className="p-3 text-xs text-gray-500 text-center">No layers</div>
                ) : (
                  <div className="py-1">
                    {/* Render Groups (Folders) */}
                    {(config.groups || []).map((group) => {
                      const groupBlocks = config.blocks.filter((b) => b.groupId === group.id);
                      const hasSelectedBlock = groupBlocks.some(
                        (b) => b.id === selectedBlockId || selectedBlockIds.includes(b.id)
                      );
                      return (
                        <div key={group.id} className="mb-1">
                          {/* Group Header (Folder) */}
                          <div
                            className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs transition-colors ${
                              hasSelectedBlock ? 'bg-blue-600/20' : 'hover:bg-gray-700/50'
                            }`}
                          >
                            {/* Expand/Collapse Toggle */}
                            <button
                              onClick={() => handleToggleGroup(group.id)}
                              className="text-gray-400 hover:text-white p-0.5"
                            >
                              {group.isExpanded ? (
                                <ChevronDown size={12} />
                              ) : (
                                <ChevronRightIcon size={12} />
                              )}
                            </button>
                            {/* Folder Icon */}
                            <span className="text-yellow-500 flex-shrink-0">
                              {group.isExpanded ? <FolderOpen size={12} /> : <FolderClosed size={12} />}
                            </span>
                            {/* Group Name */}
                            <span
                              className="truncate flex-1 min-w-0 text-gray-300"
                              onDoubleClick={(e) => {
                                const input = document.createElement('input');
                                input.value = group.name;
                                input.className = 'bg-gray-700 text-white text-xs px-1 rounded w-full';
                                input.onblur = () => {
                                  handleRenameGroup(group.id, input.value);
                                  (e.target as HTMLElement).textContent = input.value;
                                  input.replaceWith(e.target as HTMLElement);
                                };
                                input.onkeydown = (ke) => {
                                  if (ke.key === 'Enter') input.blur();
                                };
                                (e.target as HTMLElement).replaceWith(input);
                                input.focus();
                                input.select();
                              }}
                              title="Double-click to rename"
                            >
                              {group.name}
                            </span>
                            {/* Block Count */}
                            <span className="text-gray-500 text-[10px]">{groupBlocks.length}</span>
                            {/* Ungroup Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUngroupBlocks(group.id);
                              }}
                              className="p-0.5 hover:bg-orange-600/50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Ungroup"
                            >
                              <Ungroup size={12} className="text-gray-400 hover:text-orange-400" />
                            </button>
                          </div>
                          {/* Group Children (Blocks in folder) */}
                          {group.isExpanded && (
                            <div className="ml-4 border-l border-gray-700">
                              {groupBlocks.reverse().map((block) => {
                                const isSelected = selectedBlockId === block.id || selectedBlockIds.includes(block.id);
                                return (
                                  <div
                                    key={block.id}
                                    onClick={() => {
                                      setSelectedBlockId(block.id);
                                      setSelectedBlockIds([]);
                                    }}
                                    className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs transition-colors ${
                                      isSelected
                                        ? 'bg-blue-600/30 text-white'
                                        : 'text-gray-300 hover:bg-gray-700/50'
                                    }`}
                                  >
                                    <span className="text-gray-400 flex-shrink-0">
                                      {getBlockTypeIcon(block.type)}
                                    </span>
                                    <span className="truncate flex-1 min-w-0">
                                      {block.label || block.type}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleBlockDelete(block.id);
                                      }}
                                      className="p-0.5 hover:bg-red-600/50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Delete"
                                    >
                                      <Trash2 size={12} className="text-gray-400 hover:text-red-400" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Render Ungrouped Blocks */}
                    {[...config.blocks].filter((b) => !b.groupId).reverse().map((block) => {
                      const isSelected = selectedBlockId === block.id || selectedBlockIds.includes(block.id);
                      return (
                        <div
                          key={block.id}
                          onClick={() => {
                            setSelectedBlockId(block.id);
                            setSelectedBlockIds([]);
                          }}
                          className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? 'bg-blue-600/30 text-white'
                              : 'text-gray-300 hover:bg-gray-700/50'
                          }`}
                        >
                          {/* Type Icon */}
                          <span className="text-gray-400 flex-shrink-0">
                            {getBlockTypeIcon(block.type)}
                          </span>
                          {/* Label */}
                          <span className="truncate flex-1 min-w-0">
                            {block.label || block.type}
                          </span>
                          {/* Delete Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBlockDelete(block.id);
                            }}
                            className="p-0.5 hover:bg-red-600/50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete"
                          >
                            <Trash2 size={12} className="text-gray-400 hover:text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      {showSettings && (
        <BottomPanel
          backgroundImage={config.backgroundImage}
          onBackgroundChange={handleBackgroundChange}
          selectedBlock={selectedBlock || null}
          onBlockUpdate={handleBlockUpdate}
          onBlockCreate={handleBlockCreateFromTemplate}
          onBlockDelete={handleBlockDelete}
          onBlockDuplicate={handleBlockDuplicate}
          configName={config.name}
          onConfigNameChange={(name) => setConfig((prev) => ({ ...prev, name }))}
          canvasSize={config.canvasSize}
          onCanvasSizeChange={(canvasSize) => setConfig((prev) => ({ ...prev, canvasSize }))}
          isEditMode={isEditMode}
          onEditModeToggle={() => setIsEditMode(!isEditMode)}
          onExport={handleExport}
          onImport={handleImport}
          onReset={handleReset}
          onSaveProject={handleSaveProject}
          onLoadProject={handleLoadProject}
          isSaving={isSaving}
          apiData={apiData}
          onApiUrlChange={handleApiUrlChange}
          onApiFetch={handleApiFetch}
          onAddComponent={handleAddComponent}
          onComponentUpdate={handleComponentUpdate}
        />
      )}

      {/* Load Project Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLoadModal(false)}>
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
              <h3 className="text-white font-medium">Load Project</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-auto">
              {savedProjects.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No saved projects found</p>
              ) : (
                <div className="space-y-2">
                  {savedProjects.map((project) => (
                    <button
                      key={project.name}
                      onClick={() => handleLoadSpecificProject(project.name)}
                      className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                    >
                      <div className="text-white font-medium">{project.name}</div>
                      <div className="text-gray-400 text-xs">{project.path}</div>
                    </button>
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
