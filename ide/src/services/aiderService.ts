import { exec } from "child_process";
import { existsSync } from "fs";
import { promisify } from "util";

const execAsync = promisify(exec);

async function isAiderAvailable(): Promise<boolean> {
	try {
		const { stdout } = await execAsync("aider --version", { timeout: 5000 });
		return !!stdout;
	} catch {
		return false;
	}
}

export async function runAiderAutoFix(
	prompt: string,
	files: string[],
	opts?: { model?: string; timeout?: number },
): Promise<{ success: boolean; output: string }> {
	const available = await isAiderAvailable();
	if (!available) {
		return {
			success: false,
			output: "Aider not installed — install with: pip install aider-chat",
		};
	}

	const apiKey =
		process.env.OPENAI_API_KEY ||
		process.env.ANTHROPIC_API_KEY ||
		process.env.DEEPSEEK_API_KEY;
	if (!apiKey) {
		return {
			success: false,
			output:
				"No LLM API key configured — set OPENAI_API_KEY or ANTHROPIC_API_KEY",
		};
	}

	const fileArgs = files.map((f) => `"${f}"`).join(" ");
	const modelFlag = opts?.model ? `--model ${opts.model}` : "";
	const cmd = `aider ${modelFlag} --message "${prompt.replace(/"/g, '\\"')}" --no-suggest-shell-commands --yes ${fileArgs}`;

	try {
		const { stdout, stderr } = await execAsync(cmd, {
			timeout: opts?.timeout || 120000,
			maxBuffer: 10 * 1024 * 1024,
		});
		return { success: true, output: stdout || stderr };
	} catch (e: any) {
		return { success: false, output: e.stdout || e.stderr || e.message };
	}
}

export async function runAiderLintFix(
	targetPath?: string,
): Promise<{ fixed: number; output: string }> {
	const available = await isAiderAvailable();
	if (!available) return { fixed: 0, output: "Aider not installed" };

	const apiKey =
		process.env.OPENAI_API_KEY ||
		process.env.ANTHROPIC_API_KEY ||
		process.env.DEEPSEEK_API_KEY;
	if (!apiKey) return { fixed: 0, output: "No LLM API key configured" };

	try {
		const { stdout, stderr } = await execAsync(
			`aider --lint --yes --no-suggest-shell-commands ${targetPath || "."}`,
			{ timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
		);
		const output = stdout || stderr;
		const fixed = (output.match(/fixed/i) || []).length;
		return { fixed, output };
	} catch (e: any) {
		return { fixed: 0, output: e.stdout || e.stderr || e.message };
	}
}
