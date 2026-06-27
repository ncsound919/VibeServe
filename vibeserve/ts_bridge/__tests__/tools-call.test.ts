import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, TEST_HOST } from "./helpers.js";

describe("Tool call endpoint", () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const { createBridgeApp } = await import("../bridge.js");

    const toolResults: Record<string, unknown> = {
      vs_memory_get: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              entries: [
                { key: "ctx-1", context_type: "plan", payload: { intent: "test" } },
              ],
            }),
          },
        ],
      },
      vs_memory_store: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              stored: true,
              context_type: "plan",
            }),
          },
        ],
      },
      vs_schema_validate: {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "success", valid: true, errors: [] }),
          },
        ],
      },
    };

    const mockLifecycle = {
      mcp: {
        isReady: () => true,
        listTools: async () => ({}),
        callTool: async (name: string, _args: Record<string, unknown>) => {
          return toolResults[name] ?? { content: [{ type: "text", text: "{}" }] };
        },
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

  it("executes a tool and returns parsed result", async () => {
    const res = await fetch(`http://${TEST_HOST}:${port}/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "vs_memory_get",
        arguments: { workspace_id: "test-ws", limit: 10 },
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.entries).toBeDefined();
    expect(body.entries.length).toBe(1);
  });

  it("passes trace_id to tool arguments", async () => {
    const { createBridgeApp } = await import("../bridge.js");
    let capturedArgs: Record<string, unknown> = {};

    const lifecycle = {
      mcp: {
        isReady: () => true,
        callTool: async (_name: string, args: Record<string, unknown>) => {
          capturedArgs = args;
          return { content: [{ type: "text", text: JSON.stringify({ status: "ok" }) }] };
        },
      },
      start: async () => {},
    };

    const app = createBridgeApp(lifecycle as any);
    const server = await startTestServer(app);

    try {
      await fetch(`http://${TEST_HOST}:${server.port}/tools/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "vs_memory_store",
          arguments: { workspace_id: "ws1", context_type: "plan" },
          trace_id: "tr-abc-123",
        }),
      });

      expect(capturedArgs.trace_id).toBe("tr-abc-123");
    } finally {
      await server.close();
    }
  });

  it("returns 400 for missing tool name", async () => {
    const res = await fetch(`http://${TEST_HOST}:${port}/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arguments: { x: 1 } }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Missing");
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await fetch(`http://${TEST_HOST}:${port}/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });

  it("returns 503 when MCP is not ready", async () => {
    const { createBridgeApp } = await import("../bridge.js");

    const lifecycle = {
      mcp: {
        isReady: () => false,
        callTool: async () => ({}),
      },
      start: async () => {},
    };

    const app = createBridgeApp(lifecycle as any);
    const server = await startTestServer(app);

    try {
      const res = await fetch(`http://${TEST_HOST}:${server.port}/tools/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "vs_test", arguments: {} }),
      });
      expect(res.status).toBe(503);
    } finally {
      await server.close();
    }
  });
});
