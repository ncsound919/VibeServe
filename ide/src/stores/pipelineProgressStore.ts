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
  progress: number;
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
