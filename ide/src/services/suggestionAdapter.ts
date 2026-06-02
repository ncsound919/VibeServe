import { getPendingSuggestions, markApplied } from "./suggestionStoreService";

export function getActiveSuggestions() {
	return getPendingSuggestions().map((s) => ({
		...s,
		benchmarkName: s.title || "Unknown",
		actionable: s.description || "",
	}));
}

export async function applySuggestion(id: string) {
	await markApplied(id, "pipeline");
	return null;
}

export function generateSuggestion(
	_benchmarkId: string,
	_benchmarkName: string,
	_currentScore: number,
	_targetScore: number,
	_actionable: string,
) {
	return null;
}

export function recordOutcome(_id: string, _scoreAfter: number) {
	return null;
}
