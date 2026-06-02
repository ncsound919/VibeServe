export async function codingAgentNode(params: { query: string }): Promise<{
	context: Array<{ id: string; content: string; similarity: number }>;
	response: string;
}> {
	return { context: [], response: `Coding result for: ${params.query}` };
}
