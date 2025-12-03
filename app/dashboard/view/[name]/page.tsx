'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { DashboardConfig, Block, ApiData } from '../../../types/dashboard';

// Helper to extract keys from nested object
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Helper to get value by path (supports bracket notation)
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path || !obj) return undefined;

  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

// Get bound value for a block
function getBoundValue(block: Block, apiData: unknown): string | undefined {
  if (!block.variableKey || !apiData) return undefined;

  let value: unknown = undefined;
  const varKey = block.variableKey;

  // Case 1: variableKey is like "data[0].htcCode" - explicit array index
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

  // Case 2: variableKey is like "data.id" where apiData.data is an array
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

  // Case 3: Direct path lookup
  if (value === undefined || value === null) {
    value = getValueByPath(apiData as Record<string, unknown>, varKey);
  }

  // Case 4: apiData is array, try first item
  if ((value === undefined || value === null) && Array.isArray(apiData) && apiData[0]) {
    value = getValueByPath(apiData[0] as Record<string, unknown>, varKey);
  }

  if (value === undefined || value === null) return undefined;
  return String(value);
}

export default function DashboardViewPage() {
  const params = useParams();
  const name = params.name as string;

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch dashboard config
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch(`/api/load-project?name=${encodeURIComponent(name)}`);
        if (!response.ok) {
          throw new Error('Dashboard not found');
        }
        const data = await response.json();
        if (data.success && data.config) {
          setConfig(data.config);
        } else {
          throw new Error(data.error || 'Failed to load dashboard');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (name) {
      loadDashboard();
    }
  }, [name]);

  // Fetch API data
  const fetchApiData = useCallback(async () => {
    if (!config?.apiConfig?.url) return;

    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(config.apiConfig.url)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();

      let headers: string[] = [];
      if (Array.isArray(data) && data.length > 0) {
        headers = extractKeys(data[0] as Record<string, unknown>);
      } else if (typeof data === 'object' && data !== null) {
        headers = extractKeys(data as Record<string, unknown>);
      }

      setApiData({
        url: config.apiConfig.url,
        data,
        headers,
        loading: false,
        error: null,
        lastFetched: Date.now(),
      });
    } catch (err) {
      console.error('API fetch error:', err);
    }
  }, [config?.apiConfig?.url]);

  // Setup data fetching (WebSocket or Polling)
  useEffect(() => {
    if (!config?.apiConfig) return;

    // Clean up
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

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          let headers: string[] = [];
          if (Array.isArray(data) && data.length > 0) {
            headers = extractKeys(data[0] as Record<string, unknown>);
          } else if (typeof data === 'object' && data !== null) {
            headers = extractKeys(data as Record<string, unknown>);
          }

          setApiData({
            url: config.apiConfig.wsUrl || '',
            data,
            headers,
            loading: false,
            error: null,
            lastFetched: Date.now(),
          });
        } catch {
          console.error('Failed to parse WebSocket message');
        }
      };

      return () => {
        ws.close();
      };
    }

    // Polling mode - always fetch initially if URL exists
    if (config.apiConfig.url) {
      // Initial fetch
      fetchApiData();

      // Set up interval if refreshInterval > 0
      if (config.apiConfig.refreshInterval > 0) {
        intervalRef.current = setInterval(fetchApiData, config.apiConfig.refreshInterval * 1000);

        return () => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
        };
      }
    }
  }, [config?.apiConfig, fetchApiData]);

  // Calculate scale to fit screen
  const getScale = useCallback(() => {
    if (typeof window === 'undefined' || !config) return 1;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const canvasWidth = config.canvasSize.width;
    const canvasHeight = config.canvasSize.height;

    const scaleX = screenWidth / canvasWidth;
    const scaleY = screenHeight / canvasHeight;

    // Use the smaller scale to fit both dimensions
    return Math.min(scaleX, scaleY, 1); // Max scale of 1 (don't enlarge)
  }, [config]);

  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      setScale(getScale());
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [getScale]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">❌ {error || 'Dashboard not found'}</div>
          <a href="/dashboard" className="text-blue-400 hover:underline">
            ← Back to Dashboard Designer
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden flex items-center justify-center"
      style={{
        backgroundColor: '#111827',
      }}
    >
      <div
        className="relative"
        style={{
          width: config.canvasSize.width,
          height: config.canvasSize.height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          backgroundImage: config.backgroundImage ? `url(${config.backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {config.blocks.map((block) => {
          const boundValue = getBoundValue(block, apiData?.data);
          // Show actual data, fallback to label/content only if no data
          const displayValue = boundValue !== undefined ? boundValue : (block.label || block.content || '');

          return (
            <div
              key={block.id}
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
                fontFamily: block.style.fontFamily,
                textAlign: block.style.textAlign,
                borderRadius: block.style.borderRadius,
                padding: block.style.padding,
                borderWidth: block.style.borderWidth,
                borderColor: block.style.borderColor,
                borderStyle: block.style.borderWidth > 0 ? 'solid' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: block.style.textAlign === 'center' ? 'center' :
                               block.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
                overflow: 'hidden',
              }}
            >
              {displayValue}
            </div>
          );
        })}
      </div>
    </div>
  );
}
