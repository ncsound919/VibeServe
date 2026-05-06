# Nexus Alpha UI Professionalization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 19-item sidebar with an 8-step progressive pipeline sidebar, add a consolidated dashboard as default view, implement 4-tier toast notifications, and apply professional visual polish (card system, progress bars, gauges, controls) across Nexus Alpha IDE.

**Architecture:** New PipelineSidebar replaces Sidebar.tsx with 8 progressive pipeline groups + 1 settings link. DashboardView consolidates live metrics, activity feed, mission control, and stat cards into one main view. ToastContainer manages a bottom-right notification stack driven by a new toastStore. HeaderStatusBar shows pipeline progress between header and main content. All use existing Zustand stores and Tailwind v4 color system.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS v4, Zustand, framer-motion, lucide-react, Playwright E2E

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/stores/toastStore.ts` | **New** — Toast queue, add/dismiss/clear, 4-tier timing |
| `src/stores/pipelineProgressStore.ts` | **New** — Pipeline phase, progress %, ETA, remaining steps |
| `src/layout/PipelineSidebar.tsx` | **New** — 8-step progressive sidebar with status indicators, fix & retest expansion, contextual tools, settings link |
| `src/features/dashboard/DashboardView.tsx` | **New** — Live metrics, activity feed, mission control, stat cards |
| `src/components/ToastContainer.tsx` | **New** — Bottom-right toast stack with color rails, actions, auto-dismiss |
| `src/components/HeaderStatusBar.tsx` | **New** — Thin pipeline progress bar between header and main |
| `src/components/App.tsx` | **Modify** — Wire PipelineSidebar, DashboardView as default, ToastContainer, HeaderStatusBar |
| `src/index.css` | **Modify** — Add card layer classes, progress bar variants, gauge styles |
| `tests/e2e/ui-polish.spec.ts` | **New** — E2E tests for sidebar, dashboard, toasts, status bar |

---

### Task 1: Toast Store — Notification Queue State

**Files:**
- Create: `src/stores/toastStore.ts`

- [ ] **Step 1: Write toast store**

```typescript
// src/stores/toastStore.ts
import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  actions?: { label: string; onClick: () => void }[];
  duration?: number; // ms, undefined = persistent
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++toastId}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));

    const duration = toast.duration ?? (toast.type === 'info' ? 4000 : toast.type === 'success' ? 6000 : undefined);
    if (duration) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearAll: () => set({ toasts: [] }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/stores/toastStore.ts`
Expected: No errors (may need `--skipLibCheck` if global types clash)

- [ ] **Step 3: Commit**

```bash
git add src/stores/toastStore.ts
git commit -m "feat: add toast notification store with 4-tier timing"
```

---

### Task 2: Pipeline Progress Store

**Files:**
- Create: `src/stores/pipelineProgressStore.ts`

- [ ] **Step 1: Write pipeline progress store**

```typescript
// src/stores/pipelineProgressStore.ts
import { create } from 'zustand';

export type PipelinePhase =
  | 'idle'
  | 'architect'
  | 'plan'
  | 'build'
  | 'review'
  | 'audit'
  | 'fix-retest'
  | 'verify'
  | 'deploy';

export type PipelineStatus = 'active' | 'paused' | 'failed' | 'idle';

interface PipelineProgressState {
  status: PipelineStatus;
  phase: PipelinePhase;
  progress: number; // 0-100
  remainingSteps: number;
  eta: string;
  setPhase: (phase: PipelinePhase, remainingSteps: number) => void;
  setProgress: (progress: number, eta?: string) => void;
  setStatus: (status: PipelineStatus) => void;
  reset: () => void;
}

export const usePipelineProgressStore = create<PipelineProgressState>((set) => ({
  status: 'idle',
  phase: 'idle',
  progress: 0,
  remainingSteps: 0,
  eta: '',

  setPhase: (phase, remainingSteps) => set({ phase, remainingSteps, progress: 0, eta: '' }),
  setProgress: (progress, eta) => set((s) => ({ progress, eta: eta ?? s.eta })),
  setStatus: (status) => set({ status }),
  reset: () => set({ status: 'idle', phase: 'idle', progress: 0, remainingSteps: 0, eta: '' }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/pipelineProgressStore.ts
git commit -m "feat: add pipeline progress store with phase tracking"
```

---

### Task 3: Toast Container Component

**Files:**
- Create: `src/components/ToastContainer.tsx`

- [ ] **Step 1: Write ToastContainer**

```typescript
// src/components/ToastContainer.tsx
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useToastStore, type ToastType } from '../stores/toastStore';

const ICON_MAP: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
};

const COLOR_MAP: Record<ToastType, string> = {
  success: 'border-emerald-500 bg-emerald-500/10',
  warning: 'border-amber-500 bg-amber-500/10',
  error: 'border-rose-500 bg-rose-500/10',
  info: 'border-indigo-400 bg-indigo-400/10',
};

const RAIL_MAP: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
  info: 'bg-indigo-400',
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICON_MAP[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex gap-3 p-4 rounded-xl border ${COLOR_MAP[toast.type]} backdrop-blur-md shadow-lg`}
            >
              <div className={`w-1 shrink-0 rounded-full ${RAIL_MAP[toast.type]}`} />
              <Icon size={18} className={`shrink-0 mt-0.5 ${toast.type === 'success' ? 'text-emerald-500' : toast.type === 'warning' ? 'text-amber-500' : toast.type === 'error' ? 'text-rose-500' : 'text-indigo-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">{toast.title}</p>
                  <button onClick={() => dismissToast(toast.id)} className="shrink-0 text-gray-500 hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                </div>
                {toast.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{toast.description}</p>
                )}
                {toast.actions && toast.actions.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {toast.actions.map((action) => (
                      <button
                        key={action.label}
                        onClick={action.onClick}
                        className="text-xs font-mono px-3 py-1 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ToastContainer.tsx
git commit -m "feat: add 4-tier toast notification container with color rails"
```

---

### Task 4: Header Status Bar

**Files:**
- Create: `src/components/HeaderStatusBar.tsx`

- [ ] **Step 1: Write HeaderStatusBar**

```typescript
// src/components/HeaderStatusBar.tsx
import { motion, AnimatePresence } from 'motion/react';
import { usePipelineProgressStore } from '../stores/pipelineProgressStore';

const STATUS_COLORS = {
  active: 'from-emerald-600 to-emerald-400',
  paused: 'from-amber-600 to-amber-400',
  failed: 'from-rose-600 to-rose-400',
  idle: '',
};

const STATUS_DOT = {
  active: 'bg-emerald-500 animate-pulse',
  paused: 'bg-amber-500',
  failed: 'bg-rose-500',
  idle: '',
};

export function HeaderStatusBar() {
  const { status, phase, progress, remainingSteps, eta } = usePipelineProgressStore();

  if (status === 'idle') return null;

  const phaseLabel = phase === 'fix-retest' ? 'Fix & Retest' : phase.charAt(0).toUpperCase() + phase.slice(1);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden border-b border-[#1a1b1e]"
      >
        <div className="flex items-center justify-between px-6 py-1.5 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
            <span className="text-[#8E9299]">Pipeline:</span>
            <span className="text-white">{phaseLabel}</span>
            <div className="flex-1 w-32 h-1.5 rounded-full bg-[#1a1b1e] overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${STATUS_COLORS[status]}`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[#8E9299]">{progress}%</span>
          </div>
          <div className="flex items-center gap-4 text-[#4a4b50]">
            {eta && <span>ETA: {eta}</span>}
            {remainingSteps > 0 && <span>{remainingSteps} remaining</span>}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HeaderStatusBar.tsx
git commit -m "feat: add header pipeline progress bar with phase/ETA"
```

---

### Task 5: Progressive Pipeline Sidebar

**Files:**
- Create: `src/layout/PipelineSidebar.tsx`
- Reference: `src/layout/Sidebar.tsx` (for existing patterns)

- [ ] **Step 1: Write PipelineSidebar**

```typescript
// src/layout/PipelineSidebar.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lightbulb, ClipboardList, Hammer, Eye, Shield, Wrench, BadgeCheck, Rocket,
  ChevronDown, ChevronRight, Settings
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../lib/utils';

type StepStatus = 'completed' | 'active' | 'failed' | 'pending';

interface PipelineStep {
  id: string;
  label: string;
  icon: typeof Lightbulb;
  status: StepStatus;
  progress?: number;
  contextualTools?: { label: string; tab: string; icon: typeof Lightbulb }[];
  subSteps?: { label: string; status: StepStatus; duration?: string }[];
}

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'architect', label: 'Architect', icon: Lightbulb, status: 'pending' },
  { id: 'plan', label: 'Plan', icon: ClipboardList, status: 'pending' },
  {
    id: 'build', label: 'Build', icon: Hammer, status: 'pending',
    contextualTools: [
      { label: 'Editor', tab: 'Editor', icon: Hammer },
      { label: 'Memory', tab: 'Memory', icon: Hammer },
    ],
  },
  { id: 'review', label: 'Review', icon: Eye, status: 'pending' },
  { id: 'audit', label: 'Audit', icon: Shield, status: 'pending' },
  {
    id: 'fix-retest', label: 'Fix & Retest', icon: Wrench, status: 'pending',
    subSteps: [
      { label: 'Fix', status: 'pending' },
      { label: 'E2E Testing', status: 'pending' },
      { label: 'Re-fix', status: 'pending' },
      { label: 'Re-audit', status: 'pending' },
    ],
  },
  { id: 'verify', label: 'Verify', icon: BadgeCheck, status: 'pending' },
  {
    id: 'deploy', label: 'Deploy', icon: Rocket, status: 'pending',
    contextualTools: [{ label: 'Preview', tab: 'Preview', icon: Rocket }],
  },
];

const STATUS_DOT: Record<StepStatus, string> = {
  completed: 'w-2 h-2 rounded-full bg-emerald-500',
  active: 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-2 ring-emerald-500/30',
  failed: 'w-2 h-2 rounded-full bg-rose-500',
  pending: 'w-2 h-2 rounded-full border border-[#4a4b50]',
};

const STATUS_BG: Record<StepStatus, string> = {
  completed: 'bg-emerald-500/5',
  active: 'bg-emerald-500/10 border-emerald-500/20',
  failed: 'bg-rose-500/10 border-rose-500/20',
  pending: '',
};

export function PipelineSidebar() {
  const { activeTab, setActiveTab } = useAppStore();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  return (
    <aside className="w-20 lg:w-56 border-r border-[#1a1b1e] min-h-[calc(100vh-64px)] hidden md:flex flex-col bg-[#0a0a0c]">
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {PIPELINE_STEPS.map((step) => {
          const isExpanded = expandedGroup === step.id;
          const hasSubSteps = step.subSteps && step.status === 'active';

          return (
            <div key={step.id}>
              <button
                onClick={() => {
                  if (hasSubSteps) {
                    setExpandedGroup(isExpanded ? null : step.id);
                  }
                  if (step.status === 'completed' || step.status === 'active') {
                    setActiveTab(step.id as any);
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group',
                  STATUS_BG[step.status],
                  step.status === 'active' && 'border',
                  step.status === 'pending' && 'text-[#4a4b50] hover:text-[#8E9299] hover:bg-[#151619]',
                  step.status === 'completed' && 'text-[#8E9299] hover:text-white hover:bg-[#151619]',
                  step.status === 'active' && 'text-white',
                  step.status === 'failed' && 'text-rose-400 hover:text-rose-300',
                )}
              >
                <step.icon size={18} className={cn(
                  step.status === 'completed' && 'text-emerald-500',
                  step.status === 'active' && 'text-emerald-400',
                  step.status === 'failed' && 'text-rose-500',
                )} />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono truncate hidden lg:block">{step.label}</span>
                    {step.status === 'active' && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hidden lg:inline">NOW</span>
                    )}
                  </div>
                  {step.status === 'active' && step.progress !== undefined && (
                    <div className="mt-1 h-1 rounded-full bg-[#1a1b1e] hidden lg:block">
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" initial={{ width: 0 }} animate={{ width: `${step.progress}%` }} />
                    </div>
                  )}
                </div>
                <div className={STATUS_DOT[step.status]} />
                {hasSubSteps && (
                  <span className="ml-auto hidden lg:block">
                    {isExpanded ? <ChevronDown size={12} className="text-[#4a4b50]" /> : <ChevronRight size={12} className="text-[#4a4b50]" />}
                  </span>
                )}
              </button>

              {/* Contextual tools */}
              <AnimatePresence>
                {step.status === 'active' && step.contextualTools && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ml-9 space-y-0.5 mt-0.5 hidden lg:block">
                    {step.contextualTools.map((tool) => (
                      <button
                        key={tool.tab}
                        onClick={() => setActiveTab(tool.tab as any)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono text-[#8E9299] hover:text-white hover:bg-[#151619] transition-all"
                      >
                        <tool.icon size={12} />
                        {tool.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sub-steps (fix & retest) */}
              <AnimatePresence>
                {isExpanded && hasSubSteps && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ml-9 border-l border-[#1a1b1e] pl-3 space-y-0.5 mt-0.5 hidden lg:block">
                    {step.subSteps!.map((sub) => (
                      <div key={sub.label} className="flex items-center gap-2 py-1 text-[10px] font-mono">
                        <div className={cn(
                          sub.status === 'completed' ? 'w-1.5 h-1.5 rounded-full bg-emerald-500' :
                          sub.status === 'active' ? 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' :
                          'w-1.5 h-1.5 rounded-full border border-[#4a4b50]'
                        )} />
                        <span className={cn(
                          sub.status === 'completed' ? 'text-emerald-400' :
                          sub.status === 'active' ? 'text-white' :
                          'text-[#4a4b50]'
                        )}>{sub.label}</span>
                        {sub.duration && <span className="text-[#4a4b50] ml-auto">{sub.duration}</span>}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Settings Link */}
      <div className="border-t border-[#1a1b1e] p-2">
        <button
          onClick={() => setActiveTab('Settings' as any)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
            activeTab === 'Settings' ? 'bg-emerald-500/10 text-emerald-400' : 'text-[#4a4b50] hover:text-white hover:bg-[#151619]',
          )}
        >
          <Settings size={18} />
          <span className="text-xs font-mono hidden lg:block">Settings</span>
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/layout/PipelineSidebar.tsx
git commit -m "feat: add progressive pipeline sidebar with 8 steps + fix & retest expansion"
```

---

### Task 6: CSS — Card Layers, Progress Bars, Gauges

**Files:**
- Modify: `src/index.css` (append new utility classes)

- [ ] **Step 1: Read current index.css to find append point**

Read `src/index.css` to see the current content. The new classes go after existing utility classes, before the file ends.

- [ ] **Step 2: Append new CSS classes**

Add the following at the end of `src/index.css`:

```css
/* ─── Progress Bar Variants ───────────────────────────────────────────── */
.progress-shimmer {
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ─── Metric Gauge ────────────────────────────────────────────────────── */
.gauge-ring {
  filter: drop-shadow(0 0 6px var(--gauge-glow, rgba(16,185,129,0.3)));
}

/* ─── Card Layer 3: Glass ─────────────────────────────────────────────── */
.glass-card {
  @apply bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-2xl;
}

/* ─── Card Layer 4: Elevated ──────────────────────────────────────────── */
.elevated-card {
  @apply bg-[#151619] border border-[#2d2e32] rounded-2xl;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.elevated-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.35);
}

/* ─── Toggle Pill ─────────────────────────────────────────────────────── */
.toggle-pill {
  transition: background-color 0.18s cubic-bezier(0.34,1.56,0.64,1);
}
.toggle-thumb {
  transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1);
}

/* ─── Slider Knob Glow ────────────────────────────────────────────────── */
.slider-knob::-webkit-slider-thumb {
  box-shadow: 0 0 8px rgba(16,185,129,0.4);
}
.slider-knob:active::-webkit-slider-thumb {
  transform: scale(1.1);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add card layers, progress bar variants, gauge, toggle and slider CSS"
```

---

### Task 7: Dashboard View — Live Metrics, Activity Feed, Mission Control, Stat Cards

**Files:**
- Create: `src/features/dashboard/DashboardView.tsx`

- [ ] **Step 1: Write DashboardView**

```typescript
// src/features/dashboard/DashboardView.tsx
import { motion } from 'motion/react';
import {
  Cpu, HardDrive, Activity, Globe, Zap, CheckCircle2, AlertTriangle, AlertCircle, Circle,
  Play, Pause, Check, TrendingUp, TrendingDown
} from 'lucide-react';

interface MetricGaugeProps {
  label: string;
  value: number;
  max: number;
  unit: string;
  icon: typeof Cpu;
}

function MetricGauge({ label, value, max, unit, icon: Icon }: MetricGaugeProps) {
  const pct = Math.round((value / max) * 100);
  const color = pct > 90 ? 'rose' : pct > 70 ? 'amber' : 'emerald';

  return (
    <div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#8E9299]">{label}</span>
        <Icon size={14} className="text-[#4a4b50]" />
      </div>
      <div className="text-2xl font-bold text-white">{value}<span className="text-sm text-[#4a4b50] ml-1">{unit}</span></div>
      <div className="mt-2 h-1.5 rounded-full bg-[#1a1b1e] overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${color === 'emerald' ? 'from-emerald-600 to-emerald-400' : color === 'amber' ? 'from-amber-600 to-amber-400' : 'from-rose-600 to-rose-400'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

interface ActivityEvent {
  id: string;
  time: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'progress';
}

const EVENTS: ActivityEvent[] = [
  { id: '1', time: '14:32', message: 'Build completed', type: 'success' },
  { id: '2', time: '14:28', message: 'Review passed', type: 'success' },
  { id: '3', time: '14:25', message: 'E2E tests 3/3 passed', type: 'success' },
  { id: '4', time: '14:22', message: 'Audit: 2 findings', type: 'warning' },
  { id: '5', time: '14:18', message: 'Fix applied', type: 'success' },
  { id: '6', time: '14:15', message: 'Build started', type: 'progress' },
];

const EVENT_ICON = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  progress: Circle,
};

const EVENT_COLOR = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-rose-500',
  progress: 'text-[#4a4b50]',
};

interface AgentStatus {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'idle';
  progress: number;
  currentStep: string;
}

const AGENTS: AgentStatus[] = [
  { id: '1', name: 'Agent-1', status: 'active', progress: 80, currentStep: 'Build' },
  { id: '2', name: 'Agent-2', status: 'paused', progress: 40, currentStep: 'Review' },
  { id: '3', name: 'Agent-3', status: 'active', progress: 60, currentStep: 'Audit' },
];

export function DashboardView() {
  return (
    <div className="p-6 space-y-8">
      {/* Top Row: Live Metrics + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Metrics */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#4a4b50] mb-3">Live Metrics</h3>
          <MetricGauge label="CPU" value={42} max={100} unit="%" icon={Cpu} />
          <MetricGauge label="Memory" value={38} max={100} unit="%" icon={HardDrive} />
          <MetricGauge label="Disk I/O" value={22} max={100} unit="%" icon={Activity} />
          <div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[#8E9299]">WS</span>
                <span className="text-white">active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[#8E9299]">MCP</span>
                <span className="text-white">active</span>
              </div>
            </div>
          </div>
          <div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-emerald-500" />
              <span className="text-[10px] font-mono uppercase text-[#8E9299]">Pipeline Health</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#1a1b1e] overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" initial={{ width: 0 }} animate={{ width: '92%' }} transition={{ duration: 1, ease: 'easeOut' }} />
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-[#151619] border border-[#2d2e32] rounded-2xl p-6">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#4a4b50] mb-4">Activity Feed</h3>
          <div className="space-y-1">
            {EVENTS.map((event) => {
              const Icon = EVENT_ICON[event.type];
              return (
                <div key={event.id} className="flex items-center gap-3 py-2 border-b border-[#1a1b1e] last:border-0">
                  <span className="text-[10px] font-mono text-[#4a4b50] w-10 shrink-0">{event.time}</span>
                  <Icon size={14} className={EVENT_COLOR[event.type]} />
                  <span className="text-xs font-mono text-[#8E9299]">{event.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mission Control */}
      <div className="bg-[#151619] border border-[#2d2e32] rounded-2xl p-6">
        <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#4a4b50] mb-4">Mission Control — Agent Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AGENTS.map((agent) => (
            <div key={agent.id} className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-white">{agent.name}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                  agent.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                  agent.status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-[#1a1b1e] text-[#4a4b50]'
                }`}>
                  {agent.status === 'active' ? '▶ active' : agent.status === 'paused' ? '⏸ paused' : '✓ idle'}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-[#1a1b1e] overflow-hidden">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" initial={{ width: 0 }} animate={{ width: `${agent.progress}%` }} transition={{ duration: 0.5 }} />
                </div>
                <span className="text-[10px] font-mono text-[#4a4b50]">{agent.progress}%</span>
              </div>
              <span className="text-[9px] font-mono text-[#4a4b50]">{agent.currentStep} step</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-emerald-500" />
            <span className="text-[10px] font-mono uppercase text-[#8E9299]">Pipeline</span>
          </div>
          <div className="text-2xl font-bold text-white">12/15</div>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp size={12} className="text-emerald-500" />
            <span className="text-[10px] font-mono text-emerald-500">streak 5</span>
          </div>
        </div>
        <div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={14} className="text-indigo-400" />
            <span className="text-[10px] font-mono uppercase text-[#8E9299]">Projects</span>
          </div>
          <div className="text-2xl font-bold text-white">3 live</div>
          <span className="text-[10px] font-mono text-[#4a4b50]">2 complete</span>
        </div>
        <div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={14} className="text-blue-400" />
            <span className="text-[10px] font-mono uppercase text-[#8E9299]">Repos</span>
          </div>
          <div className="text-2xl font-bold text-white">8</div>
          <span className="text-[10px] font-mono text-[#4a4b50]">scanned</span>
        </div>
        <div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="text-[10px] font-mono uppercase text-[#8E9299]">Quality</span>
          </div>
          <div className="text-2xl font-bold text-white">B+</div>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp size={12} className="text-emerald-500" />
            <span className="text-[10px] font-mono text-emerald-500">73% ↑ +8%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/dashboard/DashboardView.tsx
git commit -m "feat: add consolidated dashboard with live metrics, activity feed, mission control, stat cards"
```

---

### Task 8: Wire App.tsx — Sidebar, Dashboard, Toasts, Status Bar

**Files:**
- Modify: `src/components/App.tsx`

- [ ] **Step 1: Read current App.tsx**

Read `src/components/App.tsx` to understand the current sidebar import and rendering pattern.

- [ ] **Step 2: Replace sidebar import and add dashboard default**

In `App.tsx`, make these changes:

```typescript
// Change this import:
import { Sidebar } from "../layout/Sidebar";
// To:
import { PipelineSidebar } from "../layout/PipelineSidebar";

// Add new imports:
import { DashboardView } from "../features/dashboard/DashboardView";
import { ToastContainer } from "./ToastContainer";
import { HeaderStatusBar } from "./HeaderStatusBar";
```

In the JSX, replace `<Sidebar />` with `<PipelineSidebar />`.

Add the dashboard as default view — when `activeTab` is null/undefined or a non-existent tab, render `<DashboardView />`:

```typescript
// In the main content area, replace the tab rendering with:
const renderContent = () => {
  if (!activeTab) return <DashboardView />;
  switch (activeTab) {
    case 'architect': return <ArchitectTab />; // or relevant tab
    case 'Composer': return <ComposerTab />;
    case 'Editor': return <EditorTab />;
    case 'Memory': return <MemoryTab />;
    case 'Preview': return <MultimodalPreview />;
    case 'Settings': return <SettingsTab />;
    default: return <DashboardView />;
  }
};
```

Add ToastContainer and HeaderStatusBar to the layout:

```tsx
<div className="min-h-screen bg-[#0A0A0B]">
  <Header />
  <HeaderStatusBar />
  <div className="flex flex-1 overflow-hidden">
    <PipelineSidebar />
    <main className="flex-1 overflow-auto">
      {renderContent()}
    </main>
    <TrajectorySidebar />
  </div>
  <Footer />
  <GlobalCommandBar />
  <ToastContainer />
</div>
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No new errors (existing project errors are acceptable)

- [ ] **Step 4: Commit**

```bash
git add src/components/App.tsx
git commit -m "feat: wire PipelineSidebar, DashboardView, ToastContainer, HeaderStatusBar into App"
```

---

### Task 9: E2E Tests — Sidebar, Dashboard, Toasts, Status Bar

**Files:**
- Create: `tests/e2e/ui-polish.spec.ts`

- [ ] **Step 1: Write E2E test suite**

```typescript
// tests/e2e/ui-polish.spec.ts
import { test, expect } from '../fixtures';

test.describe('UI Professionalization', () => {

  test('Pipeline sidebar renders all 8 steps + settings', async ({ nexus, mockDashboard, page }) => {
    await nexus.goto();

    const steps = ['Architect', 'Plan', 'Build', 'Review', 'Audit', 'Fix & Retest', 'Verify', 'Deploy'];
    for (const step of steps) {
      await expect(page.getByText(step, { exact: false })).toBeVisible({ timeout: 5000 });
    }
    await expect(page.getByText('Settings')).toBeVisible();
  });

  test('Sidebar step has visual states', async ({ nexus, mockDashboard, page }) => {
    await nexus.goto();

    // All steps should have status dots rendered
    const statusDots = page.locator('.rounded-full');
    const count = await statusDots.count();
    expect(count).toBeGreaterThan(5);
  });

  test('Dashboard renders as default view', async ({ nexus, page }) => {
    await nexus.goto();

    await expect(page.getByText('Live Metrics')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Activity Feed')).toBeVisible();
    await expect(page.getByText('Mission Control')).toBeVisible();
    await expect(page.getByText('Pipeline').first()).toBeVisible();
  });

  test('Dashboard live metrics show gauges', async ({ nexus, page }) => {
    await nexus.goto();

    await expect(page.getByText('CPU')).toBeVisible();
    await expect(page.getByText('Memory')).toBeVisible();
    await expect(page.getByText('Disk I/O')).toBeVisible();
  });

  test('Dashboard activity feed shows events', async ({ nexus, page }) => {
    await nexus.goto();

    await expect(page.getByText('Build completed')).toBeVisible();
    await expect(page.getByText('Review passed')).toBeVisible();
  });

  test('Dashboard mission control shows agent cards', async ({ nexus, page }) => {
    await nexus.goto();

    await expect(page.getByText('Agent-1')).toBeVisible();
    await expect(page.getByText('Agent-2')).toBeVisible();
    await expect(page.getByText('Agent-3')).toBeVisible();
  });

  test('Dashboard stat cards show values', async ({ nexus, page }) => {
    await nexus.goto();

    await expect(page.getByText('12/15')).toBeVisible();
    await expect(page.getByText('3 live')).toBeVisible();
    await expect(page.getByText('8')).toBeVisible();
    await expect(page.getByText('B+')).toBeVisible();
  });

  test('Toast container renders in DOM', async ({ nexus, page }) => {
    await nexus.goto();

    const toastContainer = page.locator('.fixed.bottom-4.right-4');
    await expect(toastContainer).toBeAttached();
  });

  test('Settings link in sidebar navigates to settings', async ({ nexus, page }) => {
    await nexus.goto();

    const settingsLink = page.getByText('Settings').first();
    await settingsLink.click();
    await page.waitForTimeout(500);

    await expect(page.getByText('System Settings').or(page.getByText('AI Provider'))).toBeVisible({ timeout: 5000 });
  });

  test('Zero critical errors on dashboard render', async ({ nexus, page }) => {
    const errors: string[] = [];
    const IGNORE = [
      'favicon', 'Failed to load resource', 'net::', 'ERR_',
      'unique "key" prop', 'GEMINI_API_KEY',
    ];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !IGNORE.some(p => msg.text().includes(p))) {
        errors.push(msg.text());
      }
    });

    await nexus.goto();
    expect(errors.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
npx playwright test tests/e2e/ui-polish.spec.ts --reporter=line
```
Expected: All 10 tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/ui-polish.spec.ts
git commit -m "test: add E2E tests for pipeline sidebar, dashboard, toasts, status bar"
```

---

### Task 10: Final Integration Test

**Files:**
- Modify: `tests/e2e/live-benchmark.spec.ts` (update impacted tests)

- [ ] **Step 1: Update live benchmark to expect new sidebar**

Update `tests/e2e/live-benchmark.spec.ts` — tests L2 and L3 check for tabs by name which no longer exist in the sidebar. Update to navigate via the new pipeline steps or verify the dashboard renders instead.

```typescript
// In L2, replace the primary tab check with dashboard check:
test('L2. Dashboard renders as default view from live backend', async ({ page }) => {
  await nexus.goto();
  await page.waitForTimeout(500);

  const content = await nexus.main.innerText();
  const hasDashboard = content.includes('Live Metrics') || content.includes('Activity Feed');
  record('dashboard-default', hasDashboard, 0, hasDashboard ? 'live dashboard' : 'no dashboard');
});
```

- [ ] **Step 2: Run full benchmark**

```bash
npx playwright test tests/e2e/live-benchmark.spec.ts --reporter=line
```
Expected: ≥95% pass rate

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/live-benchmark.spec.ts
git commit -m "test: update live benchmark for new pipeline sidebar and dashboard"
```

---

## Completion Checklist

- [ ] Pipeline sidebar renders 8 steps + settings link
- [ ] Sidebar step states display correctly (completed/active/failed/pending)
- [ ] Fix & Retest group expands with sub-steps
- [ ] Contextual tool suggestions appear at Build and Deploy
- [ ] Dashboard shows live metrics (CPU, Memory, Disk, WS, MCP, Pipeline Health)
- [ ] Dashboard shows activity feed with color-coded events
- [ ] Dashboard shows mission control agent cards
- [ ] Dashboard shows 4 stat cards with trend arrows
- [ ] Toast container renders in DOM
- [ ] Header status bar appears/disappears based on pipeline state
- [ ] Settings link navigates to settings panel
- [ ] No breaking changes to existing tab functionality
- [ ] E2E tests pass (10 tests minimum)
- [ ] Live benchmark pass rate ≥95%
