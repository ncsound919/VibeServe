/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PermissionScope = 'edit' | 'bash' | 'read' | 'delete' | 'execute' | 'all';
export type PermissionAction = 'ask' | 'allow' | 'deny';

export interface PermissionRule {
  id: string;
  scope: PermissionScope;
  pattern: string;
  action: PermissionAction;
  priority: number;
  enabled: boolean;
  description?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  action: PermissionAction;
  matchedRule?: string;
  reason?: string;
}

export interface PermissionStore {
  rules: PermissionRule[];
  defaultAction: PermissionAction;
}
