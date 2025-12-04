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
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
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
  groupId?: string; // ID of the group this block belongs to
  sourceComponentId?: string; // ID of the component this block was created from
  sourceBlockId?: string; // Original block ID in the source component
}

export interface BlockGroup {
  id: string;
  name: string;
  isExpanded: boolean; // Whether the folder is expanded in layer panel
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
  refreshInterval: number; // in seconds (for polling)
  // WebSocket config
  wsEnabled?: boolean;
  wsUrl?: string;
}

export interface DashboardConfig {
  id: string;
  name: string;
  backgroundImage: string;
  canvasSize: Size;
  blocks: Block[];
  groups: BlockGroup[]; // Groups for organizing blocks into folders
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
  data: Record<string, unknown> | unknown[] | null;
  headers: string[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

// Component for reusable block groups
export interface ComponentConfig {
  id: string;
  name: string;
  description?: string;
  size: Size;
  blocks: Block[];
  arrayField?: string; // The array field used for data binding (e.g., "data")
  dataIndex?: number; // The index within the array field
  indexField?: string; // The field to use as index key (e.g., "id", "name") for matching data
  createdAt: number;
  updatedAt: number;
}
