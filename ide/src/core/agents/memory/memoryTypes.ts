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
