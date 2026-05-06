import { create } from 'zustand';

export interface PipelineStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

export interface AIComposerMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface TrustReportEntry {
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

interface AIState {
  messages: AIComposerMessage[];
  pipelineSteps: PipelineStep[];
  isPipelineRunning: boolean;
  selectedModel: string;
  trustReport: Record<string, TrustReportEntry> | null;
  inlineSuggestion: string | null;
  showInlineChat: boolean;
  inlineChatPosition: { line: number } | null;
  showDiffReview: boolean;
  diffReviewFiles: { oldPath: string; newPath: string; oldContent: string; newContent: string }[];

  addMessage: (msg: Omit<AIComposerMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  updatePipelineStep: (id: string, update: Partial<PipelineStep>) => void;
  setPipelineSteps: (steps: PipelineStep[]) => void;
  setPipelineRunning: (running: boolean) => void;
  setModel: (model: string) => void;
  setTrustReport: (report: Record<string, TrustReportEntry> | null) => void;
  setInlineSuggestion: (suggestion: string | null) => void;
  setShowInlineChat: (show: boolean) => void;
  setInlineChatPosition: (pos: { line: number } | null) => void;
  setShowDiffReview: (show: boolean) => void;
  setDiffReviewFiles: (files: { oldPath: string; newPath: string; oldContent: string; newContent: string }[]) => void;
  acceptDiffFile: (index: number) => void;
}

export const useAIStore = create<AIState>((set) => ({
  messages: [],
  pipelineSteps: [],
  isPipelineRunning: false,
  selectedModel: 'gemini-2.0-flash',
  trustReport: null,
  inlineSuggestion: null,
  showInlineChat: false,
  inlineChatPosition: null,
  showDiffReview: false,
  diffReviewFiles: [],

  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, { ...msg, id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, timestamp: Date.now() }],
    })),
  clearMessages: () => set({ messages: [] }),
  updatePipelineStep: (id, update) =>
    set((s) => ({
      pipelineSteps: s.pipelineSteps.map((step) => (step.id === id ? { ...step, ...update } : step)),
    })),
  setPipelineSteps: (steps) => set({ pipelineSteps: steps }),
  setPipelineRunning: (running) => set({ isPipelineRunning: running }),
  setModel: (model) => set({ selectedModel: model }),
  setTrustReport: (report) => set({ trustReport: report }),
  setInlineSuggestion: (suggestion) => set({ inlineSuggestion: suggestion }),
  setShowInlineChat: (show) => set({ showInlineChat: show }),
  setInlineChatPosition: (pos) => set({ inlineChatPosition: pos }),
  setShowDiffReview: (show) => set({ showDiffReview: show }),
  setDiffReviewFiles: (files) => set({ diffReviewFiles: files, showDiffReview: files.length > 0 }),
  acceptDiffFile: (index) =>
    set((s) => {
      const files = [...s.diffReviewFiles];
      files.splice(index, 1);
      return { diffReviewFiles: files, showDiffReview: files.length > 0 };
    }),
}));
