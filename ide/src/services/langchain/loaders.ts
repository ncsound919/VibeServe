export async function loadTextDocument(content: string, metadata: Record<string, unknown> = {}): Promise<{ pageContent: string; metadata: Record<string, unknown> }> {
  return { pageContent: content, metadata };
}
