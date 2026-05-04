/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

export interface DependencyCheckResult {
  totalPackages: number;
  vulnerabilities: number;
  outdated: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  moderateVulnerabilities: number;
  packagesToUpdate: Array<{
    name: string;
    current: string;
    wanted: string;
    latest: string;
    severity?: string;
  }>;
  remediationSuggestions: string[];
}

interface CheckOptions {
  sourceRepos?: string[];
  targetPath?: string;
}

export async function runDependencyCheck(options: CheckOptions = {}): Promise<DependencyCheckResult> {
  const projectRoot = options.targetPath || process.cwd();
  const hasPackageJson = existsSync(path.join(projectRoot, 'package.json'));

  if (!hasPackageJson) {
    return {
      totalPackages: 0,
      vulnerabilities: 0,
      outdated: 0,
      criticalVulnerabilities: 0,
      highVulnerabilities: 0,
      moderateVulnerabilities: 0,
      packagesToUpdate: [],
      remediationSuggestions: ['No package.json found — skipping dependency check'],
    };
  }

  const result: DependencyCheckResult = {
    totalPackages: 0,
    vulnerabilities: 0,
    outdated: 0,
    criticalVulnerabilities: 0,
    highVulnerabilities: 0,
    moderateVulnerabilities: 0,
    packagesToUpdate: [],
    remediationSuggestions: [],
  };

  try {
    const auditJson = execSync('npm audit --json 2>&1', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 30000,
    });
    const audit = JSON.parse(auditJson);
    if (audit.metadata && audit.metadata.vulnerabilities) {
      result.vulnerabilities = audit.metadata.vulnerabilities.total || 0;
      result.criticalVulnerabilities = audit.metadata.vulnerabilities.critical || 0;
      result.highVulnerabilities = audit.metadata.vulnerabilities.high || 0;
      result.moderateVulnerabilities = audit.metadata.vulnerabilities.moderate || 0;
    }
    if (audit.vulnerabilities) {
      for (const [name, vuln] of Object.entries(audit.vulnerabilities) as [string, any][]) {
        result.packagesToUpdate.push({
          name,
          current: vuln.via?.[0]?.dependency || 'unknown',
          wanted: vuln.fixAvailable?.version || 'latest',
          latest: vuln.fixAvailable?.version || 'latest',
          severity: vuln.severity,
        });
      }
    }
  } catch {
    result.remediationSuggestions.push('npm audit failed — may be network or permissions issue');
  }

  try {
    const outdatedJson = execSync('npm outdated --json 2>&1 || echo "{}"', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const outdated = JSON.parse(outdatedJson);
    if (outdated && typeof outdated === 'object') {
      const entries = Object.entries(outdated) as [string, any][];
      result.outdated = entries.length;
      for (const [name, info] of entries) {
        const existing = result.packagesToUpdate.find(p => p.name === name);
        if (existing) {
          existing.current = info.current;
          existing.wanted = info.wanted;
          existing.latest = info.latest;
        } else {
          result.packagesToUpdate.push({
            name,
            current: info.current,
            wanted: info.wanted,
            latest: info.latest,
          });
        }
      }
    }
  } catch {
    // npm outdated may exit with non-zero if outdated packages exist
  }

  try {
    const lsJson = execSync('npm ls --json --depth=0 2>&1 || echo "{}"', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const ls = JSON.parse(lsJson);
    if (ls.dependencies) {
      result.totalPackages = Object.keys(ls.dependencies).length;
    }
  } catch {
    result.totalPackages = result.packagesToUpdate.length;
  }

  if (result.vulnerabilities > 0) {
    if (result.criticalVulnerabilities > 0) {
      result.remediationSuggestions.push(`Run "npm audit fix --force" to fix ${result.criticalVulnerabilities} critical vulnerabilities`);
    }
    if (result.highVulnerabilities > 0) {
      result.remediationSuggestions.push(`Run "npm audit fix" to fix ${result.highVulnerabilities} high vulnerabilities`);
    }
  }
  if (result.outdated > 0) {
    result.remediationSuggestions.push(`${result.outdated} packages outdated — consider "npm update" or "npx npm-check-updates"`);
  }

  if (result.totalPackages === 0) {
    result.totalPackages = result.packagesToUpdate.length || 1;
  }

  logger.info('DependencyCheck', `Check complete: ${result.totalPackages} packages, ${result.vulnerabilities} vulns, ${result.outdated} outdated`);
  return result;
}
