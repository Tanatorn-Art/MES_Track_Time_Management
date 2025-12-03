// Types for Dashboard Canvas

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BlockStyle {
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  fontWeight: string;
  borderRadius: number;
  padding: number;
  borderWidth: number;
  borderColor: string;
}

export type BlockType = 'text' | 'number' | 'image' | 'chart' | 'gauge' | 'table' | 'clock' | 'label';

export interface Block {
  id: string;
  type: BlockType;
  position: Position;
  size: Size;
  variableKey: string;
  label: string;
  style: BlockStyle;
  content?: string; // For static content like labels
}

export interface BlockTemplate {
  type: BlockType;
  icon: string;
  label: string;
  defaultSize: Size;
  defaultStyle: Partial<BlockStyle>;
}

export interface ApiConfig {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  refreshInterval: number; // in seconds
}

export interface DashboardConfig {
  id: string;
  name: string;
  backgroundImage: string;
  canvasSize: Size;
  blocks: Block[];
  apiConfig: ApiConfig;
}

export interface ApiVariable {
  key: string;
  value: string | number | boolean;
  path: string;
}

// API Response data storage
export interface ApiData {
  url: string;
  data: Record<string, unknown> | null;
  headers: string[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}
