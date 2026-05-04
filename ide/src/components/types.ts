/**
 * src/components/types.ts
 *
 * Re-exports and component-layer type definitions.
 * View files import from '../types' which resolves here.
 */

// Re-export the root DashboardData type so view components
// can import it from the closer relative path '../types'
export type { DashboardData } from '../types';

// ─── Component-specific types ─────────────────────────────────────────────────

export type Status = 'idle' | 'running' | 'success' | 'error' | 'pending';

export type TabId =
  | 'overview'
  | 'pipeline'
  | 'composer'
  | 'command'
  | 'mission'
  | 'memory'
  | 'audit'
  | 'history'
  | 'activity'
  | 'settings'
  | 'repo'
  | 'browser'
  | 'youtube'
  | 'eval'
  | 'changes'
  | 'plan'
  | string;

export interface NavItem {
  id: TabId;
  label: string;
  icon?: string;
  badge?: number | string;
  disabled?: boolean;
}

export interface NexusSignal {
  id: string;
  label: string;
  value: number;
  delta?: number;
  trend?: 'up' | 'down' | 'flat';
  unit?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  duration?: number;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SortState<T = string> {
  field: T;
  direction: 'asc' | 'desc';
}
