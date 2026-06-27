import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, TEST_HOST } from "./helpers.js";

describe("Tool list endpoint", () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const { createBridgeApp } = await import("../bridge.js");

    const mockTools = {
      tools: [
        { name: "vs_memory_get", description: "Get workspace memory" },
        { name: "vs_memory_store", description: "Store workspace memory" },
        { name: "vs_schema_validate", description: "Validate JSON schema" },
      ],
    };

    const mockLifecycle = {
      mcp: {
        isReady: () => true,
        listTools: async () => mockTools,
        callTool: async () => ({}),
      },
      start: async () => {},
    };

    const app = createBridgeApp(mockLifecycle as any);
    const server = await startTestServer(app);
    port = server.port;
    close = server.close;
  });

  afterAll(async () => {
    await close();
  });

  it("returns tool list from Python MCP", async () => {
    const res = await fetch(`http://${TEST_HOST}:${port}/tools/list`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toBeDefined();
    expect(body.tools).toBeDefined();
    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tools.length).toBe(3);
    expect(body.tools[0].name).toBe("vs_memory_get");
  });

  it("returns 503 when MCP is not ready", async () => {
    const { createBridgeApp } = await import("../bridge.js");

    const lifecycle = {
      mcp: {
        isReady: () => false,
        listTools: async () => ({}),
        callTool: async () => ({}),
      },
      start: async () => {},
    };

    const app = createBridgeApp(lifecycle as any);
    const server = await startTestServer(app);

    try {
      const res = await fetch(`http://${TEST_HOST}:${server.port}/tools/list`, {
        method: "POST",
      });
      expect(res.status).toBe(503);

      const body = await res.json();
      expect(body.error).toContain("initializing");
    } finally {
      await server.close();
    }
  });
});
