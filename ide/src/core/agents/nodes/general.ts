export async function generalAgentNode(params: { query: string }): Promise<{
  context: Array<{ id: string; content: string; similarity: number }>;
  response: string;
}> {
  return { context: [], response: `General answer for: ${params.query}` };
}
