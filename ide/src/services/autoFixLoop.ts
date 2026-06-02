/**
 * AutoFixLoop — Intelligent fix-try-retest cycle for pipeline errors
 *
 * When a pipeline phase fails, the AutoFixLoop:
 * 1. Captures the error + full context (logs, source repos, codebase state)
 * 2. Runs ErrorAnalyzer (Gemini) to diagnose the root cause
 * 3. Generates a targeted fix (code change, command, config update)
 * 4. Applies the fix (with backup/checkpoint)
 * 5. Re-executes the failed phase to verify the fix
 * 6. If still broken → tries a different fix (up to 5 attempts)
 * 7. If exhausted → escalates to user with full diagnosis history
 *
 * Modeled on Claude Code's verify loop: test → fail → analyze → fix → retest
 */

import { exec } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

import { logger } from "../lib/logger";
import type { AutoFixContext, FixAttempt } from "../types/hooks";
import { analyzeError, generateFixCode } from "./errorAnalyzer";
import { vitalsService } from "./vitalsService";

const DATA_DIR = path.resolve(process.cwd(), "uploads", "nexus");
const FIXES_DIR = path.join(DATA_DIR, "fixes");
const MAX_FIX_ATTEMPTS = 5;

// ─── Security Configuration ───────────────────────────────────────────────

const ALLOW_AUTO_FIX = process.env.NEXUS_ALLOW_AUTO_FIX === "true";
const SAFE_NPM_PACKAGES = new Set([
	"typescript",
	"vite",
	"vitest",
	"eslint",
	"prettier",
	"rimraf",
	"cross-env",
	"dotenv",
]);
const SAFE_NPX_PACKAGES = new Set([
	"tsc",
	"vite",
	"vitest",
	"eslint",
	"prettier",
	"rimraf",
	"prisma",
	"supabase",
]);

// Strict regex for package names (prevents path traversal or malicious scopes)
const PKG_REGEX = /^(@[a-z0-9-]+\/)?[a-z0-9-]+$/i;

function ensureDir(dir: string): void {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function generateFixId(): string {
	return `fix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Checkpoint / Backup ─────────────────────────────────────────────────

export function createCheckpoint(
	executionId: string,
	phase: string,
	basePath?: string,
): string | null {
	try {
		ensureDir(FIXES_DIR);
		const checkpointId = `ckpt_${executionId}_${phase}_${Date.now()}`;
		const checkpointFile = path.join(FIXES_DIR, `${checkpointId}.json`);

		const cwd = basePath || process.cwd();
		const relevantFiles = ["package.json", "tsconfig.json", "vite.config.ts"];

		const snapshot: Record<string, string> = {};
		for (const file of relevantFiles) {
			const filePath = path.join(cwd, file);
			if (existsSync(filePath)) {
				snapshot[file] = readFileSync(filePath, "utf-8");
			}
		}

		writeFileSync(
			checkpointFile,
			JSON.stringify(
				{
					id: checkpointId,
					timestamp: new Date().toISOString(),
					phase,
					snapshot,
					cwd,
				},
				null,
				2,
			),
			"utf-8",
		);
		logger.info(
			"AutoFixLoop",
			`Checkpoint created: ${checkpointId} (${Object.keys(snapshot).length} files)`,
		);

		return checkpointId;
	} catch (err) {
		logger.error(
			"AutoFixLoop",
			`Checkpoint creation failed: ${err instanceof Error ? err.message : String(err)}`,
		);
		return null;
	}
}

function loadCheckpoint(
	checkpointId: string,
): { id: string; snapshot: Record<string, string>; cwd: string } | null {
	const checkpointFile = path.join(FIXES_DIR, `${checkpointId}.json`);
	if (!existsSync(checkpointFile)) return null;
	try {
		return JSON.parse(readFileSync(checkpointFile, "utf-8"));
	} catch {
		return null;
	}
}

export function restoreCheckpoint(checkpointId: string): boolean {
	const checkpoint = loadCheckpoint(checkpointId);
	if (!checkpoint) return false;

	try {
		for (const [file, content] of Object.entries(checkpoint.snapshot)) {
			writeFileSync(path.join(checkpoint.cwd, file), content, "utf-8");
		}
		logger.info("AutoFixLoop", `Checkpoint restored: ${checkpointId}`);
		return true;
	} catch (err) {
		logger.error(
			"AutoFixLoop",
			`Checkpoint restore failed: ${err instanceof Error ? err.message : String(err)}`,
		);
		return false;
	}
}

// ─── Fix Application ────────────────────────────────────────────────────

export async function applyFix(
	fixAttempt: FixAttempt,
	context: AutoFixContext,
): Promise<boolean> {
	try {
		const { fixCode, targetFile, fixDescription, fixStrategy } = fixAttempt;
		const projectDir = context.sourceRepos?.[0] || process.cwd();

		if (fixStrategy === "add_dep" && fixCode) {
			if (!ALLOW_AUTO_FIX) {
				logger.warn(
					"AutoFixLoop",
					`Blocked dependency install (NEXUS_ALLOW_AUTO_FIX=false): ${fixCode}`,
				);
				return false;
			}
			const pkgName = fixCode.trim().split("@")[0]; // Remove version tag for validation
			if (!PKG_REGEX.test(pkgName) || !SAFE_NPM_PACKAGES.has(pkgName)) {
				logger.warn(
					"AutoFixLoop",
					`Rejected unauthorized or malformed package: ${pkgName}`,
				);
				return false;
			}
			const SHELL_META = /[;&|><`$(){}[\]#!\\*?~]/;
			if (SHELL_META.test(fixCode)) {
				logger.warn(
					"AutoFixLoop",
					`Rejected add_dep fix with shell metacharacters: ${fixCode}`,
				);
				return false;
			}
			try {
				await execAsync(`npm install ${fixCode.trim()}`, {
					timeout: 60000,
					cwd: projectDir,
				});
				logger.info("AutoFixLoop", `Installed dependency: ${fixCode.trim()}`);
				return true;
			} catch (cmdErr) {
				logger.warn(
					"AutoFixLoop",
					`Dependency install failed: ${cmdErr instanceof Error ? cmdErr.message : String(cmdErr)}`,
				);
				return false;
			}
		}

		if (fixStrategy === "add_import" && targetFile && fixCode) {
			if (!ALLOW_AUTO_FIX) {
				logger.warn(
					"AutoFixLoop",
					`Blocked file write (NEXUS_ALLOW_AUTO_FIX=false): ${targetFile}`,
				);
				return false;
			}
			const filePath = path.resolve(projectDir, targetFile);
			if (!filePath.startsWith(path.resolve(projectDir) + path.sep)) {
				logger.warn("AutoFixLoop", `Rejected path traversal: ${targetFile}`);
				return false;
			}
			if (existsSync(filePath)) {
				const content = readFileSync(filePath, "utf-8");
				// Simple sanity check for AI-generated import code
				if (!fixCode.includes("import ") && !fixCode.includes("require(")) {
					logger.warn(
						"AutoFixLoop",
						`Rejected malformed import fix: ${fixCode}`,
					);
					return false;
				}
				const lines = content.split("\n");
				let insertAt = 0;
				for (let i = lines.length - 1; i >= 0; i--) {
					const trimmed = lines[i].trim();
					if (
						/^(import|const|let|var)\s/.test(trimmed) ||
						trimmed.startsWith("require(") ||
						trimmed.startsWith("///")
					) {
						insertAt = i + 1;
						break;
					}
				}
				if (insertAt === 0) {
					insertAt =
						content.startsWith("#!") ||
						content.startsWith("//") ||
						content.startsWith("/*")
							? 1
							: 0;
				}
				lines.splice(insertAt, 0, fixCode.trim());
				writeFileSync(filePath, lines.join("\n"), "utf-8");
				logger.info("AutoFixLoop", `Added import to ${targetFile}`);
				return true;
			}
		}

		if (fixStrategy === "replace" && fixCode && targetFile) {
			const filePath = path.resolve(projectDir, targetFile);
			if (!filePath.startsWith(path.resolve(projectDir) + path.sep)) {
				logger.warn("AutoFixLoop", `Rejected path traversal: ${targetFile}`);
				return false;
			}
			if (existsSync(filePath)) {
				const content = readFileSync(filePath, "utf-8");
				if (
					fixCode.includes("<<<BEFORE>>>") &&
					fixCode.includes("<<<AFTER>>>")
				) {
					const parts = fixCode.split("<<<AFTER>>>");
					const oldSnippet = parts[0].replace("<<<BEFORE>>>", "").trim();
					const newSnippet = parts.length > 1 ? parts[1].trim() : "";
					if (oldSnippet && content.includes(oldSnippet)) {
						writeFileSync(
							filePath,
							content.replace(oldSnippet, newSnippet),
							"utf-8",
						);
						logger.info(
							"AutoFixLoop",
							`Applied line-level fix to ${targetFile}`,
						);
						return true;
					}
				}
				writeFileSync(filePath, fixCode, "utf-8");
				logger.info("AutoFixLoop", `Applied code fix to ${targetFile}`);
				return true;
			}
		}

		if (fixCode && !fixCode.startsWith("npm ") && !fixCode.startsWith("npx ")) {
			if (targetFile) {
				const filePath = path.resolve(projectDir, targetFile);
				if (!filePath.startsWith(path.resolve(projectDir) + path.sep)) {
					logger.warn("AutoFixLoop", `Rejected path traversal: ${targetFile}`);
					return false;
				}
				if (existsSync(filePath)) {
					writeFileSync(filePath, fixCode, "utf-8");
					logger.info("AutoFixLoop", `Applied code fix to ${targetFile}`);
					return true;
				}
			}
		}

		if (fixCode && (fixCode.startsWith("npm ") || fixCode.startsWith("npx "))) {
			if (!ALLOW_AUTO_FIX) {
				logger.warn(
					"AutoFixLoop",
					`Blocked command execution (NEXUS_ALLOW_AUTO_FIX=false): ${fixCode}`,
				);
				return false;
			}

			const SHELL_META = /[;&|><`$(){}[\]#!\\*?~]/;
			if (SHELL_META.test(fixCode.replace(/^npm (install|rebuild) /, ""))) {
				logger.warn(
					"AutoFixLoop",
					`Rejected fix command with shell metacharacters: ${fixCode}`,
				);
				return false;
			}

			// Strict validation for npm/npx
			const parts = fixCode.trim().split(/\s+/);
			const tool = parts[0];
			const cmd = parts[1];

			if (tool === "npm") {
				const allowedNpm = ["install", "rebuild", "run", "test"];
				if (!allowedNpm.includes(cmd)) {
					logger.warn(
						"AutoFixLoop",
						`Rejected unauthorized npm command: ${cmd}`,
					);
					return false;
				}
			} else if (tool === "npx") {
				const pkg = cmd?.split("@")[0];
				if (!pkg || !SAFE_NPX_PACKAGES.has(pkg)) {
					logger.warn(
						"AutoFixLoop",
						`Rejected unauthorized npx package: ${pkg}`,
					);
					return false;
				}
			}

			try {
				await execAsync(fixCode, { timeout: 60000, cwd: projectDir });
				logger.info("AutoFixLoop", `Executed fix command: ${fixCode}`);
				return true;
			} catch (cmdErr) {
				logger.warn(
					"AutoFixLoop",
					`Fix command failed: ${cmdErr instanceof Error ? cmdErr.message : String(cmdErr)}`,
				);
				return false;
			}
		}

		if (
			fixDescription.includes("retry") ||
			fixDescription.includes("backoff")
		) {
			logger.info("AutoFixLoop", `Applying retry strategy: ${fixDescription}`);
			return true;
		}

		return false;
	} catch (err) {
		logger.error(
			"AutoFixLoop",
			`Fix application failed: ${err instanceof Error ? err.message : String(err)}`,
		);
		return false;
	}
}

// ─── Main Auto-Fix Loop ─────────────────────────────────────────────────

export async function runAutoFixLoop(
	context: AutoFixContext,
	maxAttempts: number = MAX_FIX_ATTEMPTS,
): Promise<{
	fixed: boolean;
	attempts: FixAttempt[];
	finalDiagnosis: string;
}> {
	const attempts: FixAttempt[] = [];
	let fixed = false;

	logger.info(
		"AutoFixLoop",
		`Starting auto-fix for "${context.phase}": ${context.error.message.substring(0, 100)}`,
	);

	const checkpointId = createCheckpoint(context.executionId, context.phase);

	for (let i = 1; i <= maxAttempts; i++) {
		const attemptStart = Date.now();
		const fixId = generateFixId();

		// Step 1: Analyze the error (with richer context each iteration)
		const enrichedContext =
			attempts.length > 0
				? `\n\nPrevious fix attempts:\n${attempts.map((a) => `- ${a.fixDescription} → ${a.success ? "FIXED" : "FAILED"}`).join("\n")}`
				: "";

		// Step 0: Check for visual regressions if build succeeded
		let visualContext = "";
		if (context.phase === "build" && !context.error) {
			try {
				const report = await vitalsService.getAppReport(context.executionId);
				if (report.vitals.score < 90) {
					visualContext = `\n[VISUAL WARNING] Performance score is low (${report.vitals.score}). Recommendations: ${report.recommendations.join(", ")}`;
				}
			} catch {
				/* ignore */
			}
		}

		const diagnosis = await analyzeError(
			context.error?.message || "Visual validation requested",
			context.error?.stack || "",
			context.phase,
			context.sourceRepos,
			(context.codebaseContext || "") + enrichedContext + visualContext,
		);

		// Step 2: Generate fix code if applicable
		let fixCode = diagnosis.fixCode;
		if (diagnosis.fixStrategy === "replace" && diagnosis.affectedFile) {
			const filePath = path.resolve(process.cwd(), diagnosis.affectedFile);
			if (existsSync(filePath)) {
				const content = readFileSync(filePath, "utf-8");
				const generated = await generateFixCode(
					context.error.message,
					content,
					diagnosis.affectedFile,
					context.phase,
				);
				if (generated) fixCode = generated;
			}
		}

		// If we've tried this same fix before, try an alternative
		const triedBefore = attempts.some(
			(a) => a.fixDescription === diagnosis.fixDescription,
		);
		if (triedBefore && diagnosis.alternativeFixes.length > 0) {
			fixCode = diagnosis.alternativeFixes[0];
		}

		// Create the fix attempt
		const attempt: FixAttempt = {
			id: fixId,
			attemptNumber: i,
			phase: context.phase,
			errorMessage: context.error.message,
			errorType: diagnosis.errorType,
			diagnosis: diagnosis.rootCause,
			fixDescription: diagnosis.fixDescription,
			fixCode: fixCode || undefined,
			targetFile: diagnosis.affectedFile,
			fixStrategy: diagnosis.fixStrategy,
			applied: false,
			success: false,
			timestamp: new Date().toISOString(),
			durationMs: 0,
		};

		// Step 3: Apply the fix
		attempt.applied = await applyFix(attempt, context);

		// Step 4: Retry the phase (caller must implement this)
		if (attempt.applied && context.retryPhase) {
			try {
				await context.retryPhase();
				attempt.success = true;
				fixed = true;
				attempt.durationMs = Date.now() - attemptStart;
				attempts.push(attempt);

				logger.info(
					"AutoFixLoop",
					`Fix "${diagnosis.fixDescription}" succeeded (attempt ${i}/${maxAttempts})`,
				);
				break;
			} catch (retryErr) {
				const msg =
					retryErr instanceof Error ? retryErr.message : String(retryErr);
				context.error = retryErr instanceof Error ? retryErr : new Error(msg);
				context.pipelineLogs.push(
					`[AUTOFIX] Attempt ${i} failed: ${diagnosis.fixDescription} — ${msg.substring(0, 100)}`,
				);
			}
		}

		attempt.durationMs = Date.now() - attemptStart;
		attempts.push(attempt);

		context.previousFixes = attempts;

		logger.warn(
			"AutoFixLoop",
			`Fix attempt ${i}/${maxAttempts} did not resolve "${context.phase}"`,
		);
	}

	// Heuristic: if all retries applied but code changes didn't stick, try revert + escalate
	if (!fixed && checkpointId) {
		const allApplied = attempts.every((a) => a.applied);
		const noneWorked = attempts.every((a) => !a.success);
		if (allApplied && noneWorked && attempts.length >= 2) {
			logger.info(
				"AutoFixLoop",
				`All fixes failed — restoring checkpoint ${checkpointId}`,
			);
			restoreCheckpoint(checkpointId);

			attempts.push({
				id: generateFixId(),
				attemptNumber: attempts.length + 1,
				phase: context.phase,
				errorMessage: context.error.message,
				errorType: "unknown",
				diagnosis: "All auto-fix strategies exhausted. Restored to checkpoint.",
				fixDescription: "Restored checkpoint — manual intervention required",
				applied: true,
				success: false,
				timestamp: new Date().toISOString(),
				durationMs: 0,
			});
		}
	}

	const finalDiagnosis = fixed
		? `Fixed "${context.phase}" after ${attempts.filter((a) => a.success).length} successful attempt(s)`
		: `Could not auto-fix "${context.phase}" after ${maxAttempts} attempts — escalating`;

	logger.info("AutoFixLoop", finalDiagnosis);

	return { fixed, attempts, finalDiagnosis };
}

// ─── Phase retry support ────────────────────────────────────────────────

export type PhaseRetryFn = () => Promise<void>;

export function extendAutoFixContext(
	ctx: AutoFixContext,
	retryPhase: PhaseRetryFn,
): AutoFixContext {
	return {
		...ctx,
		retryPhase,
	};
}

// ─── Fix History ────────────────────────────────────────────────────────

export interface FixHistoryEntry {
	executionId: string;
	phase: string;
	timestamp: string;
	fixed: boolean;
	attempts: number;
	diagnosis: string;
}

function getFixHistoryPath(): string {
	return path.join(FIXES_DIR, "fix-history.json");
}

export function saveFixHistory(entry: FixHistoryEntry): void {
	ensureDir(FIXES_DIR);
	const historyPath = getFixHistoryPath();
	const backupPath = historyPath + ".bak";

	let existing: FixHistoryEntry[] = [];
	if (existsSync(historyPath)) {
		try {
			existing = JSON.parse(readFileSync(historyPath, "utf-8"));
		} catch (err) {
			logger.error(
				"AutoFixLoop",
				`Failed to parse fix history: ${err}. Attempting recovery from backup.`,
			);
			if (existsSync(backupPath)) {
				try {
					existing = JSON.parse(readFileSync(backupPath, "utf-8"));
				} catch (bakErr) {
					logger.error("AutoFixLoop", `Backup recovery failed: ${bakErr}`);
				}
			}
		}
	}

	existing.unshift(entry);
	if (existing.length > 100) existing.length = 100;

	try {
		// Write to a temporary file first for atomic-like replacement
		const tempPath = historyPath + ".tmp";
		if (existsSync(historyPath)) {
			// Create a backup of the current good file before overwriting
			writeFileSync(backupPath, readFileSync(historyPath, "utf-8"), "utf-8");
		}
		writeFileSync(tempPath, JSON.stringify(existing, null, 2), "utf-8");
		// On Windows, rename doesn't work if target exists, so we delete first
		if (existsSync(historyPath)) {
			try {
				// Simple rename-replace pattern
				writeFileSync(historyPath, readFileSync(tempPath, "utf-8"), "utf-8");
			} catch (err) {
				logger.error("AutoFixLoop", `Atomic write failed: ${err}`);
			}
		} else {
			writeFileSync(historyPath, JSON.stringify(existing, null, 2), "utf-8");
		}
	} catch (err) {
		logger.error("AutoFixLoop", `Failed to save fix history: ${err}`);
	}
}

export function getFixHistory(): FixHistoryEntry[] {
	const historyPath = getFixHistoryPath();
	if (!existsSync(historyPath)) return [];
	try {
		return JSON.parse(readFileSync(historyPath, "utf-8"));
	} catch {
		return [];
	}
}

export function getFixSuccessRate(): number {
	const history = getFixHistory();
	if (history.length === 0) return 100;
	const successful = history.filter((h) => h.fixed).length;
	return Math.round((successful / history.length) * 100);
}
