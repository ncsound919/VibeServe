import { create } from 'zustand';

export interface ProjectRule {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  priority: number;
}

interface RulesStore {
  rules: ProjectRule[];
  addRule: (rule: Omit<ProjectRule, 'id'>) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
  getEnabledRules: () => ProjectRule[];
  loadRules: () => Promise<void>;
  saveRulesToDisk: (rootPath: string) => Promise<void>;
  loadFromDisk: (rootPath: string) => Promise<boolean>;
}

export const useRulesStore = create<RulesStore>((set, get) => ({
  rules: [
    {
      id: 'no-console',
      name: 'No console.log',
      content: 'Avoid using console.log in production code. Use proper logging.',
      enabled: true,
      priority: 1,
    },
    {
      id: 'typescript-strict',
      name: 'TypeScript Strict Mode',
      content: 'Always enable strict mode in tsconfig.json for better type safety.',
      enabled: true,
      priority: 2,
    },
    {
      id: 'error-handling',
      name: 'Error Handling',
      content: 'All async functions must have try-catch blocks. Never swallow errors.',
      enabled: true,
      priority: 3,
    },
    {
      id: 'naming-conventions',
      name: 'Naming Conventions',
      content: 'Use camelCase for variables, PascalCase for classes/interfaces, UPPER_SNAKE for constants.',
      enabled: true,
      priority: 4,
    },
  ],

  addRule: (rule) => {
    const id = `rule-${Date.now()}`;
    set((state) => ({
      rules: [...state.rules, { ...rule, id }],
    }));
  },

  removeRule: (id) => {
    set((state) => ({
      rules: state.rules.filter(r => r.id !== id),
    }));
  },

  toggleRule: (id) => {
    set((state) => ({
      rules: state.rules.map(r => 
        r.id === id ? { ...r, enabled: !r.enabled } : r
      ),
    }));
  },

  getEnabledRules: () => {
    return get().rules
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority);
  },

  loadRules: async () => {
    try {
      const stored = localStorage.getItem('nexus:rules');
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ rules: parsed });
      }
    } catch (e) {
      console.error('Failed to load rules:', e);
    }
  },

  saveRulesToDisk: async (rootPath) => {
    try {
      const { writeFileSync, mkdirSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const nexusDir = join(rootPath, '.nexus');
      if (!existsSync(nexusDir)) mkdirSync(nexusDir);
      writeFileSync(join(nexusDir, 'rules.json'), JSON.stringify(get().rules, null, 2));
    } catch (e) {
      console.error('Failed to save rules to disk:', e);
    }
  },

  loadFromDisk: async (rootPath) => {
    try {
      const { readFileSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const rulesPath = join(rootPath, '.nexus', 'rules.json');
      if (existsSync(rulesPath)) {
        const content = readFileSync(rulesPath, 'utf-8');
        set({ rules: JSON.parse(content) });
        return true;
      }
    } catch (e) {
      console.error('Failed to load rules from disk:', e);
    }
    return false;
  },
}));

// Save rules on change
useRulesStore.subscribe((state) => {
  try {
    localStorage.setItem('nexus:rules', JSON.stringify(state.rules));
  } catch (e) {
    console.error('Failed to save rules:', e);
  }
});

// Apply rules to code (simple check)
export function checkCodeAgainstRules(code: string, rules: ProjectRule[]): Array<{ rule: string; line: number; message: string }> {
  const violations: Array<{ rule: string; line: number; message: string }> = [];
  const lines = code.split('\n');

  lines.forEach((line, idx) => {
    rules.forEach(rule => {
      if (!rule.enabled) return;

      if (rule.id === 'no-console' && line.includes('console.log')) {
        violations.push({
          rule: rule.name,
          line: idx + 1,
          message: 'Avoid console.log in production code',
        });
      }
    });
  });

  return violations;
}
