import { PermissionRule, PermissionScope, PermissionContext, PermissionAction } from '../types';

export interface PermissionCheckResult {
  allowed: boolean;
  action: PermissionAction;
  ruleId?: string;
  reason?: string;
}

export class PermissionService {
  private rules: PermissionRule[] = [];

  constructor(initialRules: PermissionRule[] = []) {
    this.rules = initialRules;
  }

  setRules(rules: PermissionRule[]) {
    this.rules = rules;
  }

  addRule(rule: PermissionRule) {
    this.rules.push(rule);
  }

  checkPermission(ctx: PermissionContext): PermissionCheckResult {
    // Enabled rules prioritized by specificity (pattern matching)
    const enabledRules = this.rules.filter(r => r.enabled && r.scope === ctx.requestedScope);
    
    // Sort rules: those with patterns first, then by scope
    const sortedRules = [...enabledRules].sort((a, b) => {
      if (a.pattern && !b.pattern) return -1;
      if (!a.pattern && b.pattern) return 1;
      return 0;
    });

    for (const rule of sortedRules) {
      if (rule.pattern) {
        const regex = new RegExp(rule.pattern.replace(/\*/g, '.*'));
        const target = ctx.targetPath || ctx.command || '';
        if (regex.test(target)) {
          return { allowed: rule.action === 'allow', action: rule.action, ruleId: rule.id };
        }
      } else {
        // Default rule for the scope
        return { allowed: rule.action === 'allow', action: rule.action, ruleId: rule.id };
      }
    }

    // Default to 'ask' if no rules found
    return { allowed: false, action: 'ask', reason: 'No matching permission rule found' };
  }
}

export const permissionService = new PermissionService([
  { id: 'default-read', scope: 'read', action: 'allow', enabled: true, description: 'Allow read by default' },
  { id: 'default-edit', scope: 'edit', action: 'ask', enabled: true, description: 'Always ask for edits' },
  { id: 'default-bash', scope: 'bash', action: 'ask', enabled: true, description: 'Always ask for shell commands' },
  { id: 'default-network', scope: 'network', action: 'deny', enabled: true, description: 'Deny external network calls by default' },
]);
