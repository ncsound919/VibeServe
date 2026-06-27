import { serve } from "@hono/node-server";
import { Hono } from "hono";

export const TEST_HOST = "127.0.0.1";

export async function startTestServer(app: Hono): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = serve(
      { fetch: app.fetch, hostname: TEST_HOST, port: 0 },
      (info) => {
        resolve({
          port: info.port,
          close: () =>
            new Promise<void>((resolveClose) => {
              (server as any).close?.(() => resolveClose());
              setTimeout(resolveClose, 100);
            }),
        });
      }
    );
  });
}
