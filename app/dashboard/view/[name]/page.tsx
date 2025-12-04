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

// Helper to get value by path (supports bracket notation like [0].field)
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path || !obj) return undefined;

  // Convert bracket notation to dot notation and handle leading bracket
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

  return current;
}

// Get bound value for a block
function getBoundValue(block: Block, apiData: unknown): string | undefined {
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
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false); // Use ref instead of state for background fetch

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

  // Fetch API data (background fetch - no loading indicator)
  const fetchApiData = useCallback(async () => {
    if (!config?.apiConfig?.url) return;
    if (isFetchingRef.current) return; // Prevent duplicate fetches

    isFetchingRef.current = true;

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

      // Update state - React will re-render with new data
      setApiData({
        url: config.apiConfig.url,
        data,
        headers,
        loading: false,
        error: null,
        lastFetched: Date.now(),
      });
      setLastUpdate(new Date());
    } catch (err) {
      console.error('API fetch error:', err);
    } finally {
      isFetchingRef.current = false;
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

      // Set up interval - use configured interval or default to 30 seconds
      // Only poll if interval is set (> 0), otherwise just use initial fetch
      const interval = config.apiConfig.refreshInterval;

      if (interval > 0) {
        // Setup polling with visibility detection to reduce server load
        let isVisible = true;

        const handleVisibilityChange = () => {
          isVisible = !document.hidden;
          // Fetch immediately when tab becomes visible again
          if (isVisible && intervalRef.current) {
            fetchApiData();
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        intervalRef.current = setInterval(() => {
          // Only fetch if tab is visible
          if (isVisible) {
            fetchApiData();
          }
        }, interval * 1000);

        return () => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  // Get refresh interval for display
  const refreshInterval = config?.apiConfig?.refreshInterval || 0;
  const isAutoRefreshEnabled = refreshInterval > 0;

  return (
    <div
      className="h-screen w-screen overflow-hidden flex items-center justify-center relative"
      style={{
        backgroundColor: '#111827',
      }}
    >
      {/* Real-time indicator */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-gray-800/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-700">
        {isAutoRefreshEnabled ? (
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        ) : (
          <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
        )}
        <span className="text-xs text-gray-300">
          {isAutoRefreshEnabled ? 'Live' : 'Static'}
        </span>
        {isAutoRefreshEnabled && (
          <span className="text-xs text-gray-500">
            ({refreshInterval}s)
          </span>
        )}
        {lastUpdate && (
          <span className="text-xs text-gray-500">
            {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

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
          // Check if we're still loading API data
          const isApiLoading = !apiData || apiData.loading;
          // Show loading indicator for blocks with variableKey when API is loading
          const showLoading = isApiLoading && block.variableKey;
          // Show actual data, show loading if waiting for API, fallback to content for static blocks
          const displayValue = showLoading
            ? ''
            : (boundValue !== undefined ? boundValue : (block.content || ''));

          // Render table block
          if (block.type === 'table' && block.content === 'table') {
            try {
              const tableConfig = JSON.parse(block.variableKey || '{}');
              const { columns = [], arrayField = '', style: tableStyle = {} } = tableConfig;

              // Get data array from apiData
              let dataArray: Record<string, unknown>[] = [];
              if (apiData?.data) {
                if (arrayField === '__ROOT_ARRAY__' && Array.isArray(apiData.data)) {
                  dataArray = apiData.data as unknown as Record<string, unknown>[];
                } else if (arrayField && (apiData.data as Record<string, unknown>)[arrayField]) {
                  dataArray = (apiData.data as Record<string, unknown>)[arrayField] as Record<string, unknown>[];
                }
              }

              const enabledColumns = columns.filter((c: { enabled: boolean }) => c.enabled);

              // Calculate dynamic font size based on block size and content
              const numColumns = enabledColumns.length || 1;
              const numRows = Math.max(dataArray.length, 3);

              const baseFontSize = tableStyle.fontSize || 12;
              const baseHeaderFontSize = tableStyle.headerFontSize || 12;

              const availableWidth = block.size.width / numColumns;
              const availableHeight = block.size.height / (numRows + 1);

              const widthScale = Math.min(1.5, Math.max(0.5, availableWidth / 80));
              const heightScale = Math.min(1.5, Math.max(0.5, availableHeight / 25));
              const scaleFactor = Math.min(widthScale, heightScale);

              const scaledFontSize = Math.max(8, Math.min(24, Math.round(baseFontSize * scaleFactor)));
              const scaledHeaderFontSize = Math.max(8, Math.min(24, Math.round(baseHeaderFontSize * scaleFactor)));
              const scaledPadding = Math.max(2, Math.round(4 * scaleFactor));

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
                    borderRadius: block.style.borderRadius,
                    borderWidth: block.style.borderWidth,
                    borderColor: block.style.borderColor,
                    borderStyle: block.style.borderWidth > 0 ? 'solid' : 'none',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                  }}
                >
                  <div className="w-full h-full overflow-hidden">
                    <table className="w-full h-full border-collapse text-left table-fixed" style={{ fontSize: scaledFontSize }}>
                      <thead>
                        <tr style={{ backgroundColor: tableStyle.headerBg || '#374151' }}>
                          {enabledColumns.map((col: { field: string; header: string; width: number }, idx: number) => (
                            <th
                              key={idx}
                              className="font-medium break-words align-top"
                              style={{
                                color: tableStyle.headerText || '#ffffff',
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
                            {enabledColumns.map((col: { field: string; header: string; width: number }, colIdx: number) => (
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
                      ) : showLoading ? (
                        <tr>
                          <td colSpan={enabledColumns.length} className="text-center py-4 text-gray-500">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                              Loading...
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={enabledColumns.length} className="text-center py-4 text-gray-500">
                            No data
                          </td>
                        </tr>
                      )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            } catch {
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
                    color: 'red',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Invalid table config
                </div>
              );
            }
          }

          // Render regular block
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
              {showLoading ? (
                <div className="flex items-center gap-1 text-gray-500">
                  <div className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                displayValue
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
