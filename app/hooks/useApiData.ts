'use client';

import { useState, useEffect, useCallback } from 'react';
import { ApiConfig, ApiVariable } from '../types/dashboard';

// Helper function to extract all keys from nested object
function extractVariables(obj: unknown, parentPath: string = ''): ApiVariable[] {
  const variables: ApiVariable[] = [];

  if (obj === null || obj === undefined) {
    return variables;
  }

  if (typeof obj !== 'object') {
    return variables;
  }

  const entries = Object.entries(obj as Record<string, unknown>);

  for (const [key, value] of entries) {
    const currentPath = parentPath ? `${parentPath}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      variables.push(...extractVariables(value, currentPath));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          variables.push(...extractVariables(item, `${currentPath}[${index}]`));
        } else {
          variables.push({
            key: `${currentPath}[${index}]`,
            value: item,
            path: `${currentPath}[${index}]`,
          });
        }
      });
    } else {
      variables.push({
        key: currentPath,
        value: value as string | number | boolean,
        path: currentPath,
      });
    }
  }

  return variables;
}

// Helper function to get value by path
export function getValueByPath(obj: unknown, path: string): string | number | boolean | undefined {
  if (!path || !obj) return undefined;

  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
    return current;
  }

  return undefined;
}

export function useApiData(apiConfig: ApiConfig | null) {
  const [data, setData] = useState<unknown>(null);
  const [variables, setVariables] = useState<ApiVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!apiConfig?.url) {
      setData(null);
      setVariables([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const options: RequestInit = {
        method: apiConfig.method,
        headers: {
          'Content-Type': 'application/json',
          ...apiConfig.headers,
        },
      };

      if (apiConfig.method === 'POST' && apiConfig.body) {
        options.body = apiConfig.body;
      }

      const response = await fetch(apiConfig.url, options);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.json();
      setData(jsonData);
      setVariables(extractVariables(jsonData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setData(null);
      setVariables([]);
    } finally {
      setLoading(false);
    }
  }, [apiConfig?.url, apiConfig?.method, apiConfig?.headers, apiConfig?.body]);

  useEffect(() => {
    fetchData();

    if (apiConfig?.refreshInterval && apiConfig.refreshInterval > 0) {
      const interval = setInterval(fetchData, apiConfig.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, apiConfig?.refreshInterval]);

  return { data, variables, loading, error, refetch: fetchData };
}
