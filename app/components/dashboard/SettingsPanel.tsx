'use client';

import React, { useState } from 'react';
import { ApiConfig, ApiVariable } from '../../types/dashboard';

interface SettingsPanelProps {
  apiConfig: ApiConfig;
  onApiConfigChange: (config: ApiConfig) => void;
  variables: ApiVariable[];
  loading: boolean;
  error: string | null;
  onTestApi: () => void;
  backgroundImage: string;
  onBackgroundChange: (url: string) => void;
}

export default function SettingsPanel({
  apiConfig,
  onApiConfigChange,
  variables,
  loading,
  error,
  onTestApi,
  backgroundImage,
  onBackgroundChange,
}: SettingsPanelProps) {
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  const handleAddHeader = () => {
    if (headerKey && headerValue) {
      onApiConfigChange({
        ...apiConfig,
        headers: {
          ...apiConfig.headers,
          [headerKey]: headerValue,
        },
      });
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const handleRemoveHeader = (key: string) => {
    const newHeaders = { ...apiConfig.headers };
    delete newHeaders[key];
    onApiConfigChange({
      ...apiConfig,
      headers: newHeaders,
    });
  };

  return (
    <div className="w-80 bg-gray-900 text-white p-4 overflow-y-auto h-full">
      <h2 className="text-xl font-bold mb-4">⚙️ Settings</h2>

      {/* API Configuration */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">API Configuration</h3>

        <label className="block mb-2">
          <span className="text-sm text-gray-400">API URL</span>
          <input
            type="text"
            value={apiConfig.url}
            onChange={(e) => onApiConfigChange({ ...apiConfig, url: e.target.value })}
            placeholder="https://api.example.com/data"
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>

        <label className="block mb-2">
          <span className="text-sm text-gray-400">Method</span>
          <select
            value={apiConfig.method}
            onChange={(e) => onApiConfigChange({ ...apiConfig, method: e.target.value as 'GET' | 'POST' })}
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </label>

        {apiConfig.method === 'POST' && (
          <label className="block mb-2">
            <span className="text-sm text-gray-400">Request Body (JSON)</span>
            <textarea
              value={apiConfig.body || ''}
              onChange={(e) => onApiConfigChange({ ...apiConfig, body: e.target.value })}
              placeholder='{"key": "value"}'
              className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm h-20"
            />
          </label>
        )}

        <label className="block mb-2">
          <span className="text-sm text-gray-400">Refresh Interval (seconds)</span>
          <input
            type="number"
            value={apiConfig.refreshInterval}
            onChange={(e) => onApiConfigChange({ ...apiConfig, refreshInterval: parseInt(e.target.value) || 0 })}
            min="0"
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>

        {/* Headers */}
        <div className="mb-2">
          <span className="text-sm text-gray-400">Headers</span>
          <div className="flex gap-1 mt-1">
            <input
              type="text"
              value={headerKey}
              onChange={(e) => setHeaderKey(e.target.value)}
              placeholder="Key"
              className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
            />
            <input
              type="text"
              value={headerValue}
              onChange={(e) => setHeaderValue(e.target.value)}
              placeholder="Value"
              className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
            />
            <button
              onClick={handleAddHeader}
              className="px-2 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
            >
              +
            </button>
          </div>
          {Object.entries(apiConfig.headers).map(([key, value]) => (
            <div key={key} className="flex items-center gap-1 mt-1 text-xs bg-gray-800 px-2 py-1 rounded">
              <span className="flex-1 truncate">{key}: {value}</span>
              <button
                onClick={() => handleRemoveHeader(key)}
                className="text-red-400 hover:text-red-300"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onTestApi}
          disabled={loading}
          className="w-full mt-2 px-4 py-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : '🔄 Test API'}
        </button>

        {error && (
          <div className="mt-2 p-2 bg-red-900 border border-red-700 rounded text-sm">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Background Image */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Background Image</h3>
        <label className="block mb-2">
          <span className="text-sm text-gray-400">Image URL</span>
          <input
            type="text"
            value={backgroundImage}
            onChange={(e) => onBackgroundChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
          />
        </label>
        {backgroundImage && (
          <div className="mt-2 border border-gray-700 rounded overflow-hidden">
            <img
              src={backgroundImage}
              alt="Preview"
              className="w-full h-32 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </div>

      {/* Available Variables */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">📦 Available Variables</h3>
        <p className="text-xs text-gray-400 mb-2">Drag variables to canvas to create blocks</p>
        <div className="max-h-60 overflow-y-auto">
          {variables.length === 0 ? (
            <p className="text-sm text-gray-500">No variables available. Test API first.</p>
          ) : (
            variables.map((variable) => (
              <div
                key={variable.path}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('variable', JSON.stringify(variable));
                }}
                className="p-2 mb-1 bg-gray-800 border border-gray-700 rounded cursor-move hover:bg-gray-700 transition-colors"
              >
                <div className="text-sm font-mono text-blue-400 truncate">{variable.path}</div>
                <div className="text-xs text-gray-400 truncate">
                  {String(variable.value)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
