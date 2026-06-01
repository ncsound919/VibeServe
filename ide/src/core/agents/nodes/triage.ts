export async function triageNode(params: { query: string }): Promise<{ intent: string }> {
  return { intent: 'general' };
}
