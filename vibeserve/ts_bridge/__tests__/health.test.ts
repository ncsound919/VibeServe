import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, TEST_HOST } from "./helpers.js";

class MockMcpClient {
  private _ready = true;
  isReady() { return this._ready; }
  setReady(r: boolean) { this._ready = r; }
  async listTools() { return { tools: [] }; }
  async callTool(name: string, args: Record<string, unknown>) {
    return { content: [{ type: "text", text: JSON.stringify({ status: "success", tool: name }) }] };
  }
  async waitForReady() {}
  async shutdown() { this._ready = false; }
}

class MockLifecycle {
  mcp = new MockMcpClient();
  async start() { this.mcp.setReady(true); }
  async gracefulShutdown() { this.mcp.setReady(false); }
}

describe("Health endpoint", () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const { createBridgeApp } = await import("../bridge.js");
    const mockLifecycle = new MockLifecycle() as any;
    await mockLifecycle.start();
    const app = createBridgeApp(mockLifecycle);
    const server = await startTestServer(app);
    port = server.port;
    close = server.close;
  });

  afterAll(async () => {
    await close();
  });

  it("responds 200 OK with bridge info", async () => {
    const res = await fetch(`http://${TEST_HOST}:${port}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("vibeserve-ts-bridge");
    expect(body.bridgeType).toBe("typescript-hono");
    expect(body.mcpReady).toBe(true);
  });

  it("reports initializing when MCP is not ready", async () => {
    const { createBridgeApp } = await import("../bridge.js");
    const lifecycle = new MockLifecycle() as any;
    lifecycle.mcp.setReady(false);
    lifecycle.mcp.isReady = () => false;
    const app = createBridgeApp(lifecycle);
    const server = await startTestServer(app);

    try {
      const res = await fetch(`http://${TEST_HOST}:${server.port}/health`);
      const body = await res.json();
      expect(body.status).toBe("initializing");
      expect(body.mcpReady).toBe(false);
    } finally {
      await server.close();
    }
  });
});
