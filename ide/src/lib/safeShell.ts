import type { SpawnSyncOptions } from "child_process";

export interface SafeExecResult {
	success: boolean;
	stdout: string;
	stderr: string;
	exitCode: number | null;
	error?: Error;
}

const IS_BROWSER = typeof window !== "undefined";

const BROWSER_NO_OP: SafeExecResult = {
	success: false,
	stdout: "",
	stderr: "[safeShell] not available in browser",
	exitCode: null,
};

/**
 * Safely executes a command with arguments to prevent shell injection.
 * Uses child_process.spawnSync instead of execSync.
 * No-ops silently in browser environments.
 */
export async function safeExec(
	command: string,
	args: string[] = [],
	options: SpawnSyncOptions = {},
): Promise<SafeExecResult> {
	if (IS_BROWSER) return BROWSER_NO_OP;

	try {
		const { spawnSync } = await import("child_process");
		const result = spawnSync(command, args, {
			...options,
			encoding: "utf-8",
			shell: false,
		});

		if (result.error) {
			return {
				success: false,
				stdout: result.stdout?.toString() || "",
				stderr: result.stderr?.toString() || "",
				exitCode: result.status,
				error: result.error,
			};
		}

		return {
			success: result.status === 0,
			stdout: result.stdout?.toString() || "",
			stderr: result.stderr?.toString() || "",
			exitCode: result.status,
		};
	} catch (err) {
		console.error("[SafeShell] Failed to execute", command, err);
		return {
			success: false,
			stdout: "",
			stderr: err instanceof Error ? err.message : String(err),
			exitCode: 1,
			error: err instanceof Error ? err : new Error(String(err)),
		};
	}
}

/**
 * Legacy wrapper — async version for browser compat.
 */
export async function safeExecLegacy(
	commandLine: string,
	options: SpawnSyncOptions = {},
): Promise<string> {
	if (IS_BROWSER) return "";

	const parts: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < commandLine.length; i++) {
		const char = commandLine[i];
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === " " && !inQuotes) {
			if (current) {
				parts.push(current);
				current = "";
			}
		} else {
			current += char;
		}
	}
	if (current) parts.push(current);

	const [cmd, ...args] = parts;
	const res = await safeExec(cmd, args, options);

	if (!res.success && options.stdio !== "ignore") {
		throw new Error(
			`Command failed with exit code ${res.exitCode}: ${res.stderr}`,
		);
	}

	return res.stdout;
}
