export type MemoryTier =
	| "episodic"
	| "semantic"
	| "procedural"
	| "graph"
	| "error-solutions";

export interface Memory {
	id: string;
	content: string;
	tier: MemoryTier;
	importance: number;
	accessCount: number;
	timestamp: number;
	lastAccessed: number;
	tags: string[];
}

export interface MemoryStats {
	total: number;
	byTier: Record<MemoryTier, number>;
	avgImportance: number;
}

interface MemoryStoreState {
	memories: Memory[];
}

const state: MemoryStoreState = {
	memories: [],
};

const addMemory = (
	content: string,
	tier: MemoryTier,
	importance = 0.5,
	tags: string[] = [],
) => {
	const memory: Memory = {
		id: `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		content,
		tier,
		importance,
		accessCount: 0,
		timestamp: Date.now(),
		lastAccessed: Date.now(),
		tags,
	};
	state.memories.push(memory);

	if (state.memories.length > 10000) {
		state.memories = state.memories.slice(-10000);
	}

	return memory;
};

const query = (opts?: {
	query?: string;
	tier?: MemoryTier;
	limit?: number;
}) => {
	let filtered = [...state.memories];

	if (opts?.tier) {
		filtered = filtered.filter((m) => m.tier === opts.tier);
	}
	if (opts?.query) {
		const q = opts.query.toLowerCase();
		filtered = filtered.filter(
			(m) =>
				m.content.toLowerCase().includes(q) ||
				m.tags.some((t) => t.toLowerCase().includes(q)),
		);
	}

	filtered.sort((a, b) => {
		const impDiff = b.importance - a.importance;
		if (impDiff !== 0) return impDiff;
		return b.timestamp - a.timestamp;
	});

	if (opts?.limit) {
		filtered = filtered.slice(0, opts.limit);
	}

	return filtered;
};

const getStats = (): MemoryStats => {
	const byTier: Record<MemoryTier, number> = {
		episodic: 0,
		semantic: 0,
		procedural: 0,
		graph: 0,
		"error-solutions": 0,
	};

	let totalImportance = 0;

	for (const m of state.memories) {
		byTier[m.tier]++;
		totalImportance += m.importance;
	}

	return {
		total: state.memories.length,
		byTier,
		avgImportance: state.memories.length
			? totalImportance / state.memories.length
			: 0,
	};
};

const decayMemories = () => {
	const now = Date.now();
	const DAY = 24 * 60 * 60 * 1000;

	state.memories = state.memories.filter((m) => {
		const age = now - m.lastAccessed;
		const decay = Math.exp(-age / (30 * DAY));
		return m.importance * decay > 0.1;
	});
};

const consolidate = () => {
	const byTier: Record<string, Memory[]> = {};

	for (const m of state.memories) {
		if (!byTier[m.tier]) byTier[m.tier] = [];
		byTier[m.tier].push(m);
	}

	for (const tier of Object.keys(byTier) as MemoryTier[]) {
		const grouped = byTier[tier];
		if (grouped.length > 100) {
			const summary: Memory = {
				id: `consolidated-${tier}-${Date.now()}`,
				content: `Consolidated ${grouped.length} ${tier} memories`,
				tier,
				importance: 0.8,
				accessCount: grouped.length,
				timestamp: Date.now(),
				lastAccessed: Date.now(),
				tags: ["consolidated"],
			};
			state.memories = state.memories.filter((m) => m.tier !== tier);
			state.memories.push(summary);
		}
	}
};

const clearTier = (tier: MemoryTier) => {
	state.memories = state.memories.filter((m) => m.tier !== tier);
};

const clearAll = () => {
	state.memories = [];
};

export const useMemoryStore = () => ({
	memories: state.memories,
	stats: getStats(),
	query,
	getStats,
	decayMemories,
	consolidate,
	clearTier,
	clearAll,
	addMemory,
});
