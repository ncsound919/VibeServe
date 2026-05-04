/**
 * Guardrails Service - Policy-driven execution protection
 * 
 * Intercepts and validates agent actions against defined safety policies.
 */
import { create } from 'zustand';
import { logger } from '../lib/logger';

export type GuardrailAction = 'command' | 'file_read' | 'file_write' | 'network';

export interface GuardrailPolicy {
  id: string;
  name: string;
  type: GuardrailAction;
  pattern: string; // Regex pattern to block or allow
  effect: 'allow' | 'deny';
  enabled: boolean;
}

interface GuardrailsStore {
  policies: GuardrailPolicy[];
  validateAction: (action: GuardrailAction, value: string) => { allowed: boolean; reason?: string };
  addPolicy: (policy: Omit<GuardrailPolicy, 'id'>) => void;
}

export const useGuardrailsStore = create<GuardrailsStore>((set, get) => ({
  policies: [
    {
      id: 'block-rm-rf',
      name: 'Block Destructive Commands',
      type: 'command',
      pattern: 'rm\\s+-rf\\s+/',
      effect: 'deny',
      enabled: true,
    },
    {
      id: 'block-env-secrets',
      name: 'Protect Environment Secrets',
      type: 'file_read',
      pattern: '\\.env(\\..*)?$',
      effect: 'deny',
      enabled: true,
    },
    {
      id: 'block-ssh-keys',
      name: 'Protect SSH Keys',
      type: 'file_read',
      pattern: '\\.ssh/.*',
      effect: 'deny',
      enabled: true,
    },
    {
      id: 'block-destructive-git',
      name: 'Block Git Reset Hard',
      type: 'command',
      pattern: 'git\\s+reset\\s+--hard',
      effect: 'deny',
      enabled: true,
    },
  ],

  validateAction: (action, value) => {
    const { policies } = get();
    const activePolicies = policies.filter(p => p.enabled && p.type === action);

    for (const policy of activePolicies) {
      const regex = new RegExp(policy.pattern, 'i');
      const matches = regex.test(value);

      if (policy.effect === 'deny' && matches) {
        logger.warn('Guardrails', `Blocked action: ${action} on "${value}" due to policy "${policy.name}"`);
        return { allowed: false, reason: `Policy violation: ${policy.name}` };
      }
    }

    return { allowed: true };
  },

  addPolicy: (policy) => {
    const id = `policy-${Date.now()}`;
    set(state => ({
      policies: [...state.policies, { ...policy, id }],
    }));
  },
}));
