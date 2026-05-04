import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let vibeServeClient: Client | null = null;

export async function initVibeServeClient() {
  if (vibeServeClient) return vibeServeClient;

  const transport = new StdioClientTransport({
    command: "python",
    args: ["-m", "vibeserve"],
    // Assuming VibeServe is run from the VibeNexus directory, or we pass the absolute path
    env: { ...process.env, PYTHONPATH: "C:\\Users\\User\\Desktop\\VibeNexus\\VibeServe" }
  });

  vibeServeClient = new Client(
    { name: "nexus-alpha-ide", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  await vibeServeClient.connect(transport);
  console.log("[MCP Client] Connected to VibeServe MCP");
  return vibeServeClient;
}

export async function getVibeServe() {
  if (!vibeServeClient) {
    return await initVibeServeClient();
  }
  return vibeServeClient;
}
