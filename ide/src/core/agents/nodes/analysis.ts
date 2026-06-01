export async function analysisAgentNode(params: { query: string }): Promise<{
  context: Array<{ id: string; content: string; similarity: number }>;
  response: string;
}> {
  return { context: [], response: `Analysis result for: ${params.query}` };
}
