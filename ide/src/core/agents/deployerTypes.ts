export type DeployTarget = 'docker' | 'vercel' | 'netlify' | 'zip';

export interface DeployConfig {
  target: DeployTarget;
  appName: string;
  appDir: string;
  port?: number;
  env?: Record<string, string>;
}

export interface DeployResult {
  success: boolean;
  target: DeployTarget;
  logs: string[];
  url?: string;
  configPath?: string;
  zipPath?: string;
  error?: string;
}

export interface DeployAvailability {
  docker: boolean;
  vercel: boolean;
  netlify: boolean;
  zip: boolean;
}
