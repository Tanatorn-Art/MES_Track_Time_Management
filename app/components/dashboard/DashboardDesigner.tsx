'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Block, DashboardConfig, BlockStyle, BlockType, ApiData } from '../../types/dashboard';
import BottomPanel, { BLOCK_TEMPLATES } from './BottomPanel';
import Canvas from './Canvas';

const DEFAULT_BLOCK_STYLE: BlockStyle = {
  backgroundColor: '#1e40af',
  textColor: '#ffffff',
  fontSize: 24,
  fontWeight: 'bold',
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
  apiConfig: { url: '', method: 'GET', headers: {}, refreshInterval: 0 },
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
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [apiData, setApiData] = useState<ApiData>(DEFAULT_API_DATA);

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

  const handleBlockDelete = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== id),
    }));
    setSelectedBlockId(null);
  }, []);

  // Handle keyboard Delete key to delete selected block
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId && isEditMode) {
        // Prevent deleting when focused on input fields
        const activeElement = document.activeElement;
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
          return;
        }
        handleBlockDelete(selectedBlockId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, isEditMode, handleBlockDelete]);

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

  // API handlers
  const handleApiUrlChange = useCallback((url: string) => {
    setApiData((prev) => ({ ...prev, url }));
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

      {/* Canvas - Takes most space */}
      <div className="flex-1 overflow-hidden">
        <Canvas
          blocks={config.blocks}
          selectedBlockId={selectedBlockId}
          isEditMode={isEditMode}
          backgroundImage={config.backgroundImage}
          canvasSize={config.canvasSize}
          onBlockSelect={setSelectedBlockId}
          onBlockUpdate={handleBlockUpdate}
          onBlockDelete={handleBlockDelete}
          apiData={apiData.data}
        />
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
          apiData={apiData}
          onApiUrlChange={handleApiUrlChange}
          onApiFetch={handleApiFetch}
        />
      )}
    </div>
  );
}
