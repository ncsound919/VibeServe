export async function researchAgentNode(params: { query: string }): Promise<{
  context: Array<{ id: string; content: string; similarity: number }>;
  response: string;
}> {
  return { context: [], response: `Research result for: ${params.query}` };
}
