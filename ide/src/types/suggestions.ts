export type SuggestionType =
	| "fix"
	| "refactor"
	| "test"
	| "reuse"
	| "docs"
	| "chore"
	| "perf"
	| "security";

export type GoalType =
	| "feature"
	| "reliability"
	| "performance"
	| "docs"
	| "marketing"
	| "chore";

export interface RawSuggestion {
	id: string;
	type: SuggestionType;
	title: string;
	description: string;
	repoName: string;
	filePath?: string;
	symbolName?: string;
	confidence: number; // 0–1
	createdAt: string; // ISO timestamp
}

export interface GoalSummary {
	id: string;
	title: string;
	priority: number; // 1 = highest
	status: "planned" | "active" | "completed" | "blocked";
	goalType?: GoalType;
	tags?: string[];
	targetMetric?: string;
	dueDate?: string;
	effort?: "S" | "M" | "L";
	areas?: string[];
	allowBgWork?: boolean;
	scheduleMode?: string;
}

export interface Suggestion extends RawSuggestion {
	goalId: string | null;
	goalTitle?: string;
	goalPriority?: number;
	verificationStatus?: "not-run" | "passing" | "failing" | "running";
	verificationLogRef?: string;
}

export interface VerificationResult {
	suggestionId: string;
	status: "passing" | "failing";
	logs: string[];
	formatPassed: boolean;
	typecheckPassed: boolean;
	testsPassed: boolean;
	completedAt: string;
}
