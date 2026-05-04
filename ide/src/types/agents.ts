/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CustomAgentData {
  id: string;
  name: string;
  type: 'script' | 'folder' | 'config';
  status: 'active' | 'analyzing' | 'uploading' | 'error';
  analysis?: string;
  lastActive: string;
  fileCount?: number;
}

export interface CLIStateData {
  activeProvider: 'opencode' | 'openrouter' | 'deepseek';
  lastCommand?: string;
  output: string[];
}

export interface AgentAssessment {
  name: string;
  path: string;
  type: string;
  quality: { 
    lintScore: number; 
    typeSafety: number; 
    structureScore: number; 
    overall: string 
  };
  skills: string[];
  integrationPotential: { 
    pipelinePhase: string; 
    score: number; 
    reason: string 
  }[];
  recommendedAssignment: string;
  confidence: number;
}
