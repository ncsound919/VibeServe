import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let vibeServeClient: Client | null = null;

async function findPython(): Promise<string | null> {
	const { execFile } = await import("child_process");
	for (const cmd of ["python", "python3"]) {
		try {
			await new Promise<void>((resolve, reject) => {
				execFile(cmd, ["--version"], { timeout: 5000 }, (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			return cmd;
		} catch {
			/* try next */
		}
	}
	return null;
}

export async function initVibeServeClient(): Promise<Client | null> {
	if (vibeServeClient) return vibeServeClient;

	const pythonCmd = await findPython();
	if (!pythonCmd) {
		console.error(
			"[MCP Client] Python not found. Install Python 3.10+ and add to PATH.",
		);
		return null;
	}

	const transport = new StdioClientTransport({
		command: pythonCmd,
		args: ["-m", "vibeserve"],
		env: { ...process.env },
	});

	vibeServeClient = new Client(
		{ name: "nexus-alpha-ide", version: "1.0.0" },
		{ capabilities: { tools: {} } },
	);

	try {
		await Promise.race([
			vibeServeClient.connect(transport),
			new Promise((_, reject) =>
				setTimeout(
					() => reject(new Error("MCP connection timeout (10s)")),
					10000,
				),
			),
		]);
		console.log(`[MCP Client] Connected to VibeServe MCP via ${pythonCmd}`);
		return vibeServeClient;
	} catch (err) {
		console.error("[MCP Client] Failed to connect:", (err as Error).message);
		transport.close().catch(() => {});
		vibeServeClient = null;
		return null;
	}
}

export async function getVibeServe() {
	if (!vibeServeClient) {
		return await initVibeServeClient();
	}
	return vibeServeClient;
}

export function getVibeServeClient() {
	return vibeServeClient;
}

export async function respawnVibeServeClient(): Promise<boolean> {
	if (vibeServeClient) {
		try {
			await vibeServeClient.close();
		} catch {
			/* ignore */
		}
		vibeServeClient = null;
	}
	const client = await initVibeServeClient();
	return client !== null;
}

export function isVibeServeConnected(): boolean {
	return vibeServeClient !== null;
}
