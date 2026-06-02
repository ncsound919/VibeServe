import { v4 as uuidv4 } from "uuid";
import { WebSocket, WebSocketServer } from "ws";
import { broadcastService } from "../broadcastService";
import { type FileJob, FileQueue, FileWorker } from "../fileQueue";
import { getVibeServeClient } from "../mcpClient";

// ─── Orchestrator (WebSocket) ───────────────────────────────────────────────

export class Orchestrator {
	sandboxId: string;
	ws?: WebSocket;

	constructor(sandboxId: string, ws: WebSocket) {
		this.sandboxId = sandboxId;
		this.ws = ws;
	}

	broadcastToSandbox(msg: unknown) {
		const payload = JSON.stringify(msg);
		if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(payload);
	}

	async callMcpTool(toolName: string, args: unknown) {
		return { result: await this.execTool(toolName, args) };
	}

	async execTool(toolName: string, args: any) {
		switch (toolName) {
			case "check_node_env":
				return {
					node: process.version,
					platform: process.platform,
					arch: process.arch,
				};
			case "npm_audit": {
				const { runShellCommand } = await import("../realTools");
				return runShellCommand("npm audit --json", args.dir, 30000);
			}
			case "generate_plan":
			case "detect_package_manager":
			case "run_install":
			case "run_build":
			case "run_test":
			case "write_file":
			case "read_file":
				throw new Error(
					`Tool "${toolName}" not implemented — use pipeline phase directly`,
				);
			default:
				throw new Error(`Unknown tool: ${toolName}`);
		}
	}
}

// ─── File-backed Pipeline Queue ─────────────────────────────────────────────

export interface PipelineJob {
	repos: string[];
	userId: string;
	agentId?: string;
	type?:
		| "pipeline-run"
		| "find-test-gaps"
		| "cross-repo-suggest"
		| "find-refactors"
		| "gitnexus-analyze"
		| "codegraph-build";
}

let queue: FileQueue | null = null;
let worker: FileWorker | null = null;
let _ready = false;

const BG_TOOLS: Record<string, string> = {
	"find-test-gaps": "find_test_gaps",
	"cross-repo-suggest": "cross_repo_suggest",
	"find-refactors": "find_refactors",
	"gitnexus-analyze": "gitnexus_analyze",
	"codegraph-build": "codegraph_build",
};

function extractInnerArray(tool: string, response: unknown): unknown[] {
	if (!response || typeof response !== "object") return [];
	const r = response as Record<string, unknown>;
	const keyMap: Record<string, string> = {
		find_test_gaps: "gaps",
		cross_repo_suggest: "suggestions",
		find_refactors: "targets",
	};
	const key = keyMap[tool];
	if (key && Array.isArray(r[key])) return r[key] as unknown[];
	return Array.isArray(response) ? response : [];
}

export function getPipelineQueue(): FileQueue | null {
	return queue;
}

export async function initPipelineQueue(): Promise<boolean> {
	if (_ready && queue) return true;
	try {
		queue = new FileQueue("nexus-pipeline");

		worker = new FileWorker(
			"nexus-pipeline",
			async (job: FileJob) => {
				const jobName = job.name as keyof typeof BG_TOOLS | "pipeline-run";
				try {
					const client = getVibeServeClient();
					if (!client) {
						return {
							ok: false,
							reason: "mcp_unavailable",
							message: "VibeServe MCP not connected",
						};
					}
					if (jobName === "pipeline-run") {
						const data = job.data as PipelineJob;
						const { runAutomatedPipeline } = await import(
							"../../services/pipelineService"
						);
						const repos = data.repos.join(" + ");
						const result = await runAutomatedPipeline(repos, (exec) => {
							broadcastService.broadcast({
								type: "pipeline:update",
								execution: exec,
								jobId: job.id,
							});
						});
						broadcastService.broadcast({
							type: "pipeline:completed",
							executionId: result.id,
							status: result.status,
						});
						return {
							ok: true,
							executionId: result.id,
							status: result.status,
							repos: data.repos,
						};
					}
					const mcpTool = BG_TOOLS[jobName];
					if (!mcpTool) return { ok: false, reason: "unknown_tool", jobName };
					const repos = (job.data as PipelineJob).repos || [];
					const response = await client.callTool({
						name: mcpTool,
						arguments: { repos },
					});
					const items = extractInnerArray(mcpTool, response);
					broadcastService.broadcast({
						type: "background_job_complete",
						jobName,
						count: items.length,
						items,
					});
					return { ok: true, jobName, count: items.length };
				} catch (e: any) {
					return {
						ok: false,
						reason: "exception",
						message: e?.message || String(e),
					};
				}
			},
			{ concurrency: 1, pollInterval: 1500 },
		);

		_ready = true;
		return true;
	} catch (e) {
		console.error("[orchestrator] initPipelineQueue failed:", e);
		_ready = false;
		return false;
	}
}

export async function enqueuePipeline(
	repos: string[],
	userId: string,
	agentId?: string,
): Promise<string | null> {
	if (!queue) {
		const ok = await initPipelineQueue();
		if (!ok || !queue) return null;
	}
	const job = await queue!.add("pipeline-run", {
		repos,
		userId,
		agentId,
	} as PipelineJob);
	return job.id;
}

export async function enqueueBackgroundJob(
	type:
		| "find-test-gaps"
		| "cross-repo-suggest"
		| "find-refactors"
		| "gitnexus-analyze"
		| "codegraph-build",
	repos: string[],
	userId: string,
): Promise<string | null> {
	if (!queue) {
		const ok = await initPipelineQueue();
		if (!ok || !queue) return null;
	}
	const job = await queue!.add(type, { repos, userId, type } as PipelineJob);
	return job.id;
}

export async function getJobStatus(
	jobId: string,
	_userId?: string,
): Promise<Record<string, unknown> | null> {
	if (!queue) return null;
	const job = await queue.getJob(jobId);
	if (!job) return null;
	return {
		id: job.id,
		name: job.name,
		status: job.status,
		progress: job.progress,
		returnvalue: job.returnvalue,
		failedReason: job.failedReason,
		attempts: job.attempts,
		createdAt: job.createdAt,
		processedAt: job.processedAt,
		finishedAt: job.finishedAt,
	};
}

export async function shutdownPipelineQueue(): Promise<void> {
	try {
		if (worker) await worker.close();
		if (queue) await queue.close();
	} catch {
		/* ignore */
	}
	queue = null;
	worker = null;
	_ready = false;
}

// ─── Schedulers (hourly + nightly) ──────────────────────────────────────────

export async function scheduleHourlyJobs(
	repos: string[],
	userId: string,
): Promise<void> {
	if (!queue) {
		const ok = await initPipelineQueue();
		if (!ok || !queue) return;
	}
	const q = queue!;
	for (const t of ["find-test-gaps", "find-refactors"] as const) {
		await q.add(t, { repos, userId, type: t } as PipelineJob, {
			repeat: { pattern: "0 * * * *" },
		});
	}
}

export async function scheduleNightlyJobs(
	repos: string[],
	userId: string,
): Promise<void> {
	if (!queue) {
		const ok = await initPipelineQueue();
		if (!ok || !queue) return;
	}
	const q = queue!;
	for (const t of [
		"cross-repo-suggest",
		"gitnexus-analyze",
		"codegraph-build",
	] as const) {
		await q.add(t, { repos, userId, type: t } as PipelineJob, {
			repeat: { pattern: "0 2 * * *" },
		});
	}
}

export async function removeAllSchedules(): Promise<void> {
	if (!queue) return;
	for (const t of [
		"find-test-gaps",
		"find-refactors",
		"cross-repo-suggest",
		"gitnexus-analyze",
		"codegraph-build",
	]) {
		try {
			await queue.removeRepeatable(t);
		} catch {
			/* ignore */
		}
	}
}

export function isReady(): boolean {
	return _ready;
}
