/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PermissionScope = 'read' | 'edit' | 'bash' | 'network' | 'system';
export type PermissionAction = 'ask' | 'allow' | 'deny';

export interface PermissionRule {
  id: string;
  scope: PermissionScope;
  pattern?: string;
  action: PermissionAction;
  description?: string;
  enabled: boolean;
}

export interface PermissionContext {
  requestedScope: PermissionScope;
  requestedAction: string;
  targetPath?: string;
  command?: string;
  timestamp: string;
}

export interface CheckpointSnapshot {
  id: string;
  timestamp: string;
  description: string;
  files: string[];
  fileCount: number;
  totalSize: number;
  tags?: string[];
}

export interface CheckpointRestoreResult {
  success: boolean;
  restoredFiles: string[];
  failedFiles: string[];
  errors: string[];
}

export interface ModelProvider {
  id: string;
  name: string;
  modelId: string;
  enabled: boolean;
  priority: number;
  maxComplexity: number;
}

export interface ModelRoutingDecision {
  providerId: string;
  complexity: number;
  reasoning: string;
  fallbackProvider?: string;
}

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'import' | 'export';
  file: string;
  line: number;
  column: number;
}

export interface CodeDependency {
  source: string;
  target: string;
  type: 'import' | 'export' | 'require' | 'reference';
}

export interface CodeAnalysisResult {
  filePath: string;
  symbols: CodeSymbol[];
  dependencies: CodeDependency[];
  complexityScore: number;
  linesOfCode: number;
  issues: { severity: 'error' | 'warning' | 'info'; message: string; line?: number }[];
}

export interface ExecutionPlan {
  id: string;
  description: string;
  steps: PlanStep[];
  estimatedDuration: number;
  requiresApproval: boolean;
  approved?: boolean;
  createdAt: string;
}

export interface PlanStep {
  id: string;
  description: string;
  command?: string;
  files?: string[];
  dependsOn: string[];
  estimatedDuration: number;
}

export interface PlanApprovalRequest {
  planId: string;
  plan: ExecutionPlan;
  autoApproved: boolean;
}
