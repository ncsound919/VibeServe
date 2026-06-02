import { create } from "zustand";

export type ComposerMode = "build" | "edit" | "chat" | "ask";

export type LLMProvider =
	| "openai"
	| "deepseek"
	| "openrouter"
	| "local"
	| "gemini";

export interface PipelineStep {
	id: string;
	name: string;
	status: "pending" | "running" | "done" | "error" | "awaiting_approval";
	detail?: string;
	score?: number;
	output?: unknown;
	startedAt?: number;
	finishedAt?: number;
}

export interface AIComposerMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: number;
	mode?: ComposerMode;
	attachments?: ContextAttachment[];
}

export interface TrustReportEntry {
	status: "pass" | "fail" | "warn";
	detail: string;
}

export interface ContextAttachment {
	id: string;
	kind: "file" | "symbol" | "url" | "docs";
	value: string;
	label: string;
}

export interface RunHistoryEntry {
	id: string;
	prompt: string;
	mode: ComposerMode;
	provider: LLMProvider;
	model: string;
	status: "ok" | "error" | "cancelled";
	startedAt: number;
	finishedAt?: number;
	steps?: PipelineStep[];
}

interface AIState {
	messages: AIComposerMessage[];
	pipelineSteps: PipelineStep[];
	isPipelineRunning: boolean;
	selectedModel: string;
	selectedProvider: LLMProvider;
	composerMode: ComposerMode;
	contextAttachments: ContextAttachment[];
	runHistory: RunHistoryEntry[];
	activeRunId: string | null;
	trustReport: Record<string, TrustReportEntry> | null;
	inlineSuggestion: string | null;
	showInlineChat: boolean;
	inlineChatPosition: { line: number } | null;
	showDiffReview: boolean;
	diffReviewFiles: {
		oldPath: string;
		newPath: string;
		oldContent: string;
		newContent: string;
	}[];
	streamingContent: string;
	pendingDiff: { path: string; content: string } | null;
	pendingApproval: { stepId: string; message: string } | null;

	addMessage: (msg: Omit<AIComposerMessage, "id" | "timestamp">) => void;
	clearMessages: () => void;
	updatePipelineStep: (id: string, update: Partial<PipelineStep>) => void;
	setPipelineSteps: (steps: PipelineStep[]) => void;
	setPipelineRunning: (running: boolean) => void;
	setModel: (model: string) => void;
	setProvider: (provider: LLMProvider) => void;
	setComposerMode: (mode: ComposerMode) => void;
	addAttachment: (a: ContextAttachment) => void;
	removeAttachment: (id: string) => void;
	clearAttachments: () => void;
	pushRunHistory: (entry: RunHistoryEntry) => void;
	setActiveRunId: (id: string | null) => void;
	setTrustReport: (report: Record<string, TrustReportEntry> | null) => void;
	setInlineSuggestion: (suggestion: string | null) => void;
	setShowInlineChat: (show: boolean) => void;
	setInlineChatPosition: (pos: { line: number } | null) => void;
	setShowDiffReview: (show: boolean) => void;
	setDiffReviewFiles: (
		files: {
			oldPath: string;
			newPath: string;
			oldContent: string;
			newContent: string;
		}[],
	) => void;
	acceptDiffFile: (index: number) => void;
	appendStreamingContent: (chunk: string) => void;
	clearStreamingContent: () => void;
	setPendingDiff: (diff: { path: string; content: string } | null) => void;
	setPendingApproval: (a: { stepId: string; message: string } | null) => void;
	applyPendingDiff: () => Promise<boolean>;
}

const HISTORY_KEY = "vs:runHistory";
const MAX_HISTORY = 50;

function loadHistory(): RunHistoryEntry[] {
	try {
		const raw = localStorage.getItem(HISTORY_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
	} catch {
		return [];
	}
}

function saveHistory(entries: RunHistoryEntry[]) {
	try {
		localStorage.setItem(
			HISTORY_KEY,
			JSON.stringify(entries.slice(0, MAX_HISTORY)),
		);
	} catch {
		/* ignore */
	}
}

export const useAIStore = create<AIState>((set, get) => ({
	messages: [],
	pipelineSteps: [],
	isPipelineRunning: false,
	selectedModel: "gemini-2.0-flash",
	selectedProvider: "gemini",
	composerMode: "build",
	contextAttachments: [],
	runHistory: loadHistory(),
	activeRunId: null,
	trustReport: null,
	inlineSuggestion: null,
	showInlineChat: false,
	inlineChatPosition: null,
	showDiffReview: false,
	diffReviewFiles: [],
	streamingContent: "",
	pendingDiff: null,
	pendingApproval: null,

	addMessage: (msg) =>
		set((s) => ({
			messages: [
				...s.messages,
				{
					...msg,
					id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
					timestamp: Date.now(),
				},
			],
		})),
	clearMessages: () => set({ messages: [] }),
	updatePipelineStep: (id, update) =>
		set((s) => ({
			pipelineSteps: s.pipelineSteps.map((step) =>
				step.id === id ? { ...step, ...update } : step,
			),
		})),
	setPipelineSteps: (steps) => set({ pipelineSteps: steps }),
	setPipelineRunning: (running) => set({ isPipelineRunning: running }),
	setModel: (model) => set({ selectedModel: model }),
	setProvider: (provider) => set({ selectedProvider: provider }),
	setComposerMode: (mode) => set({ composerMode: mode }),
	addAttachment: (a) =>
		set((s) => ({ contextAttachments: [...s.contextAttachments, a] })),
	removeAttachment: (id) =>
		set((s) => ({
			contextAttachments: s.contextAttachments.filter((x) => x.id !== id),
		})),
	clearAttachments: () => set({ contextAttachments: [] }),
	pushRunHistory: (entry) => {
		const next = [
			entry,
			...get().runHistory.filter((e) => e.id !== entry.id),
		].slice(0, MAX_HISTORY);
		set({ runHistory: next });
		saveHistory(next);
	},
	setActiveRunId: (id) => set({ activeRunId: id }),
	setTrustReport: (report) => set({ trustReport: report }),
	setInlineSuggestion: (suggestion) => set({ inlineSuggestion: suggestion }),
	setShowInlineChat: (show) => set({ showInlineChat: show }),
	setInlineChatPosition: (pos) => set({ inlineChatPosition: pos }),
	setShowDiffReview: (show) => set({ showDiffReview: show }),
	setDiffReviewFiles: (files) =>
		set({ diffReviewFiles: files, showDiffReview: files.length > 0 }),
	acceptDiffFile: (index) =>
		set((s) => {
			const files = [...s.diffReviewFiles];
			files.splice(index, 1);
			return { diffReviewFiles: files, showDiffReview: files.length > 0 };
		}),
	appendStreamingContent: (chunk) =>
		set((s) => ({ streamingContent: s.streamingContent + chunk })),
	clearStreamingContent: () => set({ streamingContent: "" }),
	setPendingDiff: (diff) => set({ pendingDiff: diff }),
	setPendingApproval: (a) => set({ pendingApproval: a }),
	applyPendingDiff: async () => {
		const state = useAIStore.getState();
		if (!state.pendingDiff) return false;
		try {
			const res = await fetch("/api/files/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					path: state.pendingDiff.path,
					content: state.pendingDiff.content,
				}),
			});
			if (res.ok) {
				set({ pendingDiff: null });
				return true;
			}
		} catch (e) {
			console.error("Failed to apply diff:", e);
		}
		return false;
	},
}));
