import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import type { VerificationResult } from "../types/suggestions";

const ROOT_DIR = process.cwd();
const SAFE_FILENAME_RE = /^[a-zA-Z0-9_:\\/\s.-]+$/;

function sanitizeForArg(input: string): string | null {
	if (!input || !SAFE_FILENAME_RE.test(input)) return null;
	return input;
}

async function runCommand(
	cmd: string,
	args: string[],
	cwd: string,
	timeout = 120000,
): Promise<{ passed: boolean; logs: string[] }> {
	return new Promise((resolve) => {
		execFile(
			cmd,
			args,
			{ cwd, timeout, encoding: "utf-8" },
			(err, stdout, stderr) => {
				if (err) {
					const logs: string[] = [];
					if (stdout)
						logs.push(...stdout.split("\n").filter(Boolean).slice(-30));
					if (stderr)
						logs.push(...stderr.split("\n").filter(Boolean).slice(-30));
					if (logs.length === 0) logs.push(err.message || "Unknown error");
					resolve({ passed: false, logs });
				} else {
					const output = (stdout || "").split("\n").filter(Boolean).slice(-20);
					resolve({ passed: true, logs: output });
				}
			},
		);
	});
}

function findRepoRoot(filePath: string): string | null {
	let dir = path.resolve(ROOT_DIR, filePath);
	while (dir !== path.parse(dir).root) {
		if (existsSync(path.join(dir, "package.json"))) return dir;
		if (existsSync(path.join(dir, "pyproject.toml"))) return dir;
		dir = path.dirname(dir);
	}
	return existsSync(path.join(ROOT_DIR, "package.json")) ? ROOT_DIR : null;
}

export async function verifySuggestion(
	suggestionId: string,
	filePath: string,
	repoName: string,
): Promise<VerificationResult> {
	const repoRoot = findRepoRoot(filePath);
	const logs: string[] = [
		`[verifySuggestion] Verifying ${filePath} in ${repoName}`,
	];

	if (!repoRoot) {
		return {
			suggestionId,
			status: "failing",
			logs: [
				...logs,
				"Could not find project root (no package.json or pyproject.toml)",
			],
			formatPassed: false,
			typecheckPassed: false,
			testsPassed: false,
			completedAt: new Date().toISOString(),
		};
	}

	const isTS = filePath.endsWith(".ts") || filePath.endsWith(".tsx");
	const isPython = filePath.endsWith(".py");

	let formatPassed = true;
	let typecheckPassed = true;
	let testsPassed = true;

	if (isTS) {
		logs.push("[format] Running biome format...");
		const fmtResult = await runCommand(
			"npx",
			["biome", "format", "--write", "."],
			repoRoot,
		);
		formatPassed = fmtResult.passed;
		logs.push(`[format] ${fmtResult.passed ? "PASS" : "FAIL"}`);

		logs.push("[typecheck] Running tsc...");
		const tsResult = await runCommand("npx", ["tsc", "--noEmit"], repoRoot);
		typecheckPassed = tsResult.passed;
		logs.push(`[typecheck] ${tsResult.passed ? "PASS" : "FAIL"}`);
		if (!tsResult.passed) logs.push(...tsResult.logs.slice(-5));

		logs.push("[test] Running tests...");
		const testPattern = filePath
			.replace("src/", "tests/")
			.replace(".tsx", ".test.tsx")
			.replace(".ts", ".test.ts");
		const safePattern = sanitizeForArg(testPattern);
		if (!safePattern) {
			logs.push("[test] Invalid test pattern — skipping");
			testsPassed = false;
		} else {
			const testResult = await runCommand(
				"npx",
				["vitest", "run", safePattern, "--passWithNoTests"],
				repoRoot,
			);
			testsPassed = testResult.passed;
			logs.push(`[test] ${testResult.passed ? "PASS" : "FAIL"}`);
			if (!testResult.passed) logs.push(...testResult.logs.slice(-5));
		}
	} else if (isPython) {
		logs.push("[format] Running ruff format...");
		const fmtResult = await runCommand(
			"python",
			["-m", "ruff", "format", "--check", "."],
			repoRoot,
		);
		formatPassed = fmtResult.passed;
		logs.push(`[format] ${fmtResult.passed ? "PASS" : "FAIL"}`);

		logs.push("[test] Running pytest...");
		const testName = path.basename(filePath).replace(".py", "");
		const safeTestName = sanitizeForArg(testName);
		const testDir = repoRoot.replace(ROOT_DIR, ".");
		const safeTestDir = sanitizeForArg(testDir);
		if (!safeTestName || !safeTestDir) {
			logs.push("[test] Invalid test name/dir — skipping");
			testsPassed = false;
		} else {
			const testResult = await runCommand(
				"python",
				[
					"-m",
					"pytest",
					`${safeTestDir}/tests/`,
					"-k",
					safeTestName,
					"--no-cov",
					"-q",
				],
				repoRoot,
			);
			testsPassed = testResult.passed;
			logs.push(`[test] ${testResult.passed ? "PASS" : "FAIL"}`);
			if (!testResult.passed) logs.push(...testResult.logs.slice(-5));
		}

		typecheckPassed = true;
	} else {
		logs.push("[verify] Unknown file type — skipping format/typecheck/test");
	}

	const status =
		formatPassed && typecheckPassed && testsPassed ? "passing" : "failing";

	return {
		suggestionId,
		status,
		logs,
		formatPassed,
		typecheckPassed,
		testsPassed,
		completedAt: new Date().toISOString(),
	};
}
