import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { serve } from "@hono/node-server";
import { WebSocket } from "ws";
import { IncomingMessage } from "http";

const TEST_HOST = "127.0.0.1";

async function startBridge(): Promise<{ port: number; close: () => Promise<void> }> {
  const { createBridgeApp, createWss } = await import("../bridge.js");

  const mockLifecycle = {
    mcp: {
      isReady: () => true,
      listTools: async () => ({}),
      callTool: async (name: string, _args: Record<string, unknown>) => {
        if (name === "vs_stream_test") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "success",
                  data: "streamed-result",
                  tool: name,
                }),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "success", tool: name }),
            },
          ],
        };
      },
    },
    start: async () => {},
  };

  const app = createBridgeApp(mockLifecycle as any);
  const wss = createWss(mockLifecycle as any);

  return new Promise((resolve) => {
    const server = serve(
      { fetch: app.fetch, hostname: TEST_HOST, port: 0 },
      (info) => {
        (server as any).on(
          "upgrade",
          (request: IncomingMessage, socket: any, head: Buffer) => {
            const url = new URL(
              request.url ?? "/",
              `http://${request.headers.host ?? "localhost"}`
            );

            if (url.pathname === "/ws") {
              wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit("connection", ws, request);
              });
            } else {
              socket.destroy();
            }
          }
        );

        resolve({
          port: info.port,
          close: () =>
            new Promise<void>((resolveClose) => {
              wss.clients.forEach((c) => c.close());
              wss.close();
              const closeServer = () => {
                if (typeof (server as any).close === "function") {
                  (server as any).close(() => resolveClose());
                } else {
                  resolveClose();
                }
              };
              closeServer();
              setTimeout(resolveClose, 200);
            }),
        });
      }
    );
  });
}

describe("WebSocket streaming", () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const server = await startBridge();
    port = server.port;
    close = server.close;
  });

  afterAll(async () => {
    await close();
  });

  it("connects via WebSocket and executes a tool call", async () => {
    const ws = new WebSocket(`ws://${TEST_HOST}:${port}/ws`);

    const response = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WS timeout")), 5000);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "tool_call",
            name: "vs_stream_test",
            arguments: { data: "hello" },
          })
        );
      });

      ws.on("message", (data: Buffer) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
        ws.close();
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    expect(response).toBeDefined();
    const result = response as Record<string, unknown>;
    expect(result.status).toBe("success");
    expect(result.data).toBe("streamed-result");
  });

  it("responds to ping messages", async () => {
    const ws = new WebSocket(`ws://${TEST_HOST}:${port}/ws`);

    const response = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WS ping timeout")), 5000);

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "ping" }));
      });

      ws.on("message", (data: Buffer) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
        ws.close();
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const result = response as Record<string, unknown>;
    expect(result.type).toBe("pong");
  });

  it("returns error for unknown message types", async () => {
    const ws = new WebSocket(`ws://${TEST_HOST}:${port}/ws`);

    const response = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WS error timeout")), 5000);

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "unknown_cmd" }));
      });

      ws.on("message", (data: Buffer) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
        ws.close();
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const result = response as Record<string, unknown>;
    expect(result.status).toBe("error");
    expect(result.error).toContain("Unknown");
  });

  it("returns error for invalid JSON on WebSocket", async () => {
    const ws = new WebSocket(`ws://${TEST_HOST}:${port}/ws`);

    const response = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WS invalid JSON timeout")), 5000);

      ws.on("open", () => {
        ws.send("not-valid-json{{{");
      });

      ws.on("message", (data: Buffer) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
        ws.close();
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const result = response as Record<string, unknown>;
    expect(result.status).toBe("error");
    expect(result.error).toContain("Invalid JSON");
  });

  it("reports error when MCP is not ready", async () => {
    const { createBridgeApp, createWss } = await import("../bridge.js");

    const lifecycle = {
      mcp: {
        isReady: () => false,
        callTool: async () => ({}),
      },
      start: async () => {},
    };

    const app = createBridgeApp(lifecycle as any);
    const wss = createWss(lifecycle as any);

    const { server, portNum } = await new Promise<{ server: any; portNum: number }>((resolve) => {
      const s: any = serve(
        { fetch: app.fetch, hostname: TEST_HOST, port: 0 },
        (info) => {
          s.on("upgrade", (req: any, sock: any, head: Buffer) => {
            const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
            if (url.pathname === "/ws") {
              wss.handleUpgrade(req, sock, head, (ws: any) => {
                wss.emit("connection", ws, req);
              });
            } else {
              sock.destroy();
            }
          });
          resolve({ server: s, portNum: info.port });
        }
      );
    });

    try {
      const ws = new WebSocket(`ws://${TEST_HOST}:${portNum}/ws`);

      const response = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("WS not ready timeout")), 5000);

        ws.on("open", () => {
          ws.send(
            JSON.stringify({
              type: "tool_call",
              name: "vs_test",
              arguments: {},
            })
          );
        });

        ws.on("message", (data: Buffer) => {
          clearTimeout(timeout);
          resolve(JSON.parse(data.toString()));
          ws.close();
        });

        ws.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const result = response as Record<string, unknown>;
      expect(result.status).toBe("error");
      expect(result.error).toBe("MCP not ready");
    } finally {
      wss.close();
      server.close?.();
    }
  });

  it("does not crash when client disconnects during tool call", async () => {
    const ws = new WebSocket(`ws://${TEST_HOST}:${port}/ws`);

    await new Promise<void>((resolve) => {
      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "tool_call",
            name: "vs_stream_test",
            arguments: { data: "disconnect-test" },
          })
        );
        ws.close();
        resolve();
      });
    });

    await new Promise((r) => setTimeout(r, 500));

    const probe = new WebSocket(`ws://${TEST_HOST}:${port}/ws`);
    const alive = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        probe.close();
        resolve(false);
      }, 3000);

      probe.on("open", () => {
        clearTimeout(timeout);
        probe.close();
        resolve(true);
      });

      probe.on("error", () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });

    expect(alive).toBe(true);
  });
});
