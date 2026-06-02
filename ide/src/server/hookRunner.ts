import type { HookConfig, HookResult } from "../types/hooks";
import { runShellCommand } from "./realTools";

export async function runHook(
	hook: HookConfig,
	context: any,
): Promise<HookResult> {
	const start = Date.now();
	const cmd =
		hook.command ||
		hook.script ||
		hook.condition ||
		'echo "no command configured"';
	console.log(`[HOOK] Executing: ${hook.name} (${hook.phase})`);

	try {
		const result = await runShellCommand(cmd, process.cwd(), 30000);
		const duration = Date.now() - start;

		return {
			hookId: hook.id,
			phase: hook.phase,
			success: result.code === 0,
			output: result.stdout || result.stderr,
			duration,
			timestamp: new Date().toISOString(),
		};
	} catch (err) {
		return {
			hookId: hook.id,
			phase: hook.phase,
			success: false,
			output: err instanceof Error ? err.message : String(err),
			duration: Date.now() - start,
			timestamp: new Date().toISOString(),
		};
	}
}

export async function runHooksForPhase(
	phase: string,
	hooks: HookConfig[],
	context: any,
): Promise<HookResult[]> {
	const [pipelinePhase, hookPhase] = phase.includes(":")
		? phase.split(":")
		: [phase, ""];
	const relevantHooks = hooks.filter((h) => {
		if (!h.enabled) return false;
		if (hookPhase)
			return (
				h.phase === hookPhase &&
				(!h.pipelinePhase || h.pipelinePhase === pipelinePhase)
			);
		return !h.pipelinePhase || h.pipelinePhase === pipelinePhase;
	});
	const results: HookResult[] = [];

	for (const hook of relevantHooks) {
		const cmd = hook.command || hook.script || hook.condition;
		results.push(await runHook({ ...hook, command: cmd }, context));
	}

	return results;
}
