import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import { Lifecycle } from "./lifecycle.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");

const BRIDGE_HOST = process.env.VIBESERVE_HTTP_HOST ?? "127.0.0.1";
const parsedPort = parseInt(
  process.env.VIBESERVE_HTTP_PORT ?? process.env.TS_BRIDGE_PORT ?? "8000",
  10
);
const BRIDGE_PORT = Number.isFinite(parsedPort) ? parsedPort : 8000;
const WS_PATH = "/ws";

function parseMcpResult(result: unknown): unknown {
  if (result && typeof result === "object" && "content" in result) {
    const content = (result as any).content;
    if (Array.isArray(content) && content.length > 0) {
      const first = content[0];
      if (first && first.type === "text" && typeof first.text === "string") {
        try {
          return JSON.parse(first.text);
        } catch {
          return { text: first.text };
        }
      }
    }
  }
  return result;
}

const ALLOWED_ORIGINS = (process.env.TS_BRIDGE_CORS_ORIGINS || "http://localhost:8000,http://127.0.0.1:8000").split(",").map(s => s.trim());

export function createBridgeApp(lifecycle: Lifecycle): Hono {
  const app = new Hono();

  app.use("*", cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-VibeServe-API-Key",
      "X-Mutly-API-Key",
    ],
  }));

  const API_KEY = process.env.VIBESERVE_API_KEY;
  app.use("/tools/*", async (c, next) => {
    if (API_KEY) {
      let key: string | undefined;
      const authHeader = c.req.header("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        key = authHeader.slice(7);
      } else {
        key = c.req.header("X-VibeServe-API-Key") || c.req.header("x-vibeserve-api-key");
      }
      if (key !== API_KEY) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }
    await next();
  });

  app.get("/health", (c) => {
    return c.json({
      status: lifecycle.mcp.isReady() ? "ok" : "initializing",
      service: "vibeserve-ts-bridge",
      bridgeType: "typescript-hono",
      mcpReady: lifecycle.mcp.isReady(),
    });
  });

  app.post("/tools/list", async (c) => {
    if (!lifecycle.mcp.isReady()) {
      return c.json(
        { status: "error", error: "MCP not ready — bridge still initializing" },
        503
      );
    }

    try {
      const raw = await lifecycle.mcp.listTools();
      return c.json(raw ?? {});
    } catch (err: any) {
      console.error(`[ts-bridge] Internal error:`, err);
      return c.json({ status: "error", error: "Internal server error" }, 502);
    }
  });

  app.post("/tools/call", async (c) => {
    if (!lifecycle.mcp.isReady()) {
      return c.json(
        { status: "error", error: "MCP not ready — bridge still initializing" },
        503
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ status: "error", error: "Invalid JSON body" }, 400);
    }

    const toolName = (body.name ?? body.tool_name ?? body.tool) as string | undefined;
    const toolArgs =
      (body.arguments ?? body.args ?? body.params ?? {}) as Record<string, unknown>;

    if (typeof toolName !== "string" || !toolName) {
      return c.json(
        { status: "error", error: "Missing 'name' field in request body" },
        400
      );
    }

    if (body.trace_id) toolArgs.trace_id = body.trace_id;
    else if (body.traceId) toolArgs.trace_id = body.traceId;

    try {
      const raw = await lifecycle.mcp.callTool(toolName, toolArgs);
      const result = parseMcpResult(raw);
      return c.json(result ?? {});
    } catch (err: any) {
      console.error(`[ts-bridge] Internal error:`, err);
      return c.json({ status: "error", error: "Internal server error" }, 502);
    }
  });

  return app;
}

function safeSend(ws: WebSocket, data: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(data);
  }
}

export function createWss(lifecycle: Lifecycle): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", async (data: Buffer) => {
      try {
        let msg: { type?: string; name?: string; arguments?: Record<string, unknown> };

        try {
          msg = JSON.parse(data.toString());
        } catch {
          safeSend(ws, JSON.stringify({ status: "error", error: "Invalid JSON message" }));
          return;
        }

        if (msg.type === "tool_call" && msg.name) {
          if (!lifecycle.mcp.isReady()) {
            safeSend(ws, JSON.stringify({ status: "error", error: "MCP not ready" }));
            return;
          }

          try {
            const raw = await lifecycle.mcp.callTool(msg.name, msg.arguments ?? {});
            const result = parseMcpResult(raw);
            safeSend(ws, JSON.stringify(result ?? { status: "success" }));
          } catch (err: any) {
            console.error(`[ts-bridge] Tool call error:`, err);
            safeSend(ws, JSON.stringify({ status: "error", error: "Tool execution failed" }));
          }
        } else if (msg.type === "ping") {
          safeSend(ws, JSON.stringify({ type: "pong" }));
        } else {
          safeSend(
            ws,
            JSON.stringify({
              status: "error",
              error: `Unknown or missing message type: ${msg.type ?? "none"}`,
            })
          );
        }
      } catch (err: any) {
        console.error(`[ts-bridge] WebSocket message handler error:`, err);
        safeSend(ws, JSON.stringify({ status: "error", error: "Internal bridge error" }));
      }
    });

    ws.on("error", (err: Error) => {
      console.error(`[ts-bridge] WebSocket error: ${err.message}`);
    });
  });

  return wss;
}

export function getProjectRoot(): string {
  return projectRoot;
}

async function main() {
  process.stdout.write("[ts-bridge] Starting VibeServe TypeScript Bridge...");
  process.stdout.write("[ts-bridge] Launching Python MCP server...");

  const lifecycle = new Lifecycle({
    pythonPath: process.env.VIBESERVE_PYTHON_PATH ?? "python",
    cwd: process.env.VIBESERVE_PROJECT_ROOT ?? projectRoot,
    autoRestart: true,
    maxRestarts: 5,
  });

  const app = createBridgeApp(lifecycle);
  const wss = createWss(lifecycle);

  const server = serve(
    {
      fetch: app.fetch,
      hostname: BRIDGE_HOST,
      port: BRIDGE_PORT,
    },
    (info) => {
      process.stdout.write(`[ts-bridge] HTTP server on http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
      process.stdout.write(`[ts-bridge] WebSocket endpoint: ws://${BRIDGE_HOST}:${BRIDGE_PORT}${WS_PATH}`);
      process.stdout.write(`[ts-bridge] Project root: ${projectRoot}`);
    }
  ) as Server;

  server.on("upgrade", (request: IncomingMessage, socket: any, head: Buffer) => {
    const origin = request.headers.origin;
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      socket.destroy();
      return;
    }

    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`
    );

    if (url.pathname === WS_PATH) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  try {
    await lifecycle.start();
    process.stdout.write("[ts-bridge] Bridge ready — Python MCP initialized");
  } catch (err: any) {
    console.error(`[ts-bridge] Failed to start Python MCP: ${err.message}`);
    process.exit(1);
  }

  const shutdownHandler = async () => {
    process.stdout.write("[ts-bridge] Shutting down...");
    wss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.exit(0);
  };
  process.on("SIGINT", shutdownHandler);
  process.on("SIGTERM", shutdownHandler);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(`[ts-bridge] Fatal: ${err.message}`);
    process.exit(1);
  });
}
