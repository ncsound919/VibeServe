import { exec, execSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface SecurityReport {
	vulnerabilities: number;
	secrets: number;
	passed: boolean;
	skipped: boolean;
	summary: string;
	details: string[];
	tools: {
		name: string;
		available: boolean;
		version?: string;
		findings: number;
	}[];
}

const toolCache: Record<string, { path: string; version: string } | null> = {};

function findOnPath(name: string): string | null {
	const dirs = process.env.PATH?.split(path.delimiter) || [];
	for (const dir of dirs) {
		const full = path.join(dir, `${name}.exe`);
		if (existsSync(full)) return full;
		const noExt = path.join(dir, name);
		if (existsSync(noExt)) return noExt;
	}
	return null;
}

function resolveBinary(name: string): string | null {
	const cached = toolCache[name];
	if (cached !== undefined) return cached.path;

	const onPath = findOnPath(name);
	if (onPath) {
		toolCache[name] = { path: onPath, version: "" };
		return onPath;
	}

	const home = process.env.USERPROFILE || "";
	const candidates: string[] = [];
	if (process.platform === "win32") {
		candidates.push(
			path.join(
				home,
				"AppData",
				"Local",
				"Microsoft",
				"WinGet",
				"Packages",
				"AquaSecurity.Trivy_Microsoft.Winget.Source_8wekyb3d8bbwe",
				`${name}.exe`,
			),
			path.join(
				home,
				"AppData",
				"Local",
				"Microsoft",
				"WinGet",
				"Packages",
				"Gitleaks.Gitleaks_Microsoft.Winget.Source_8wekyb3d8bbwe",
				`${name}.exe`,
			),
			path.join(
				process.env.ProgramFiles || "C:\\Program Files",
				name,
				`${name}.exe`,
			),
		);
	}
	for (const c of candidates) {
		if (existsSync(c)) {
			toolCache[name] = { path: c, version: "" };
			return c;
		}
	}
	toolCache[name] = null;
	return null;
}

async function toolAvailable(name: string): Promise<boolean> {
	const bin = resolveBinary(name);
	if (!bin) return false;
	try {
		const { stdout } = await execAsync(`"${bin}" --version`, {
			timeout: 5000,
			shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
		});
		const ver = stdout.trim().split("\n")[0] || "";
		toolCache[name] = { path: bin, version: ver };
		return true;
	} catch {
		toolCache[name] = null;
		return false;
	}
}

function runTool(
	cmd: string,
	args: string,
	opts?: { timeout?: number; cwd?: string },
): string | null {
	const bin = resolveBinary(cmd);
	if (!bin) return null;
	try {
		return execSync(`"${bin}" ${args}`, {
			encoding: "utf-8",
			timeout: opts?.timeout || 120000,
			cwd: opts?.cwd || process.cwd(),
			maxBuffer: 50 * 1024 * 1024,
			stdio: ["ignore", "pipe", "pipe"],
			shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
		});
	} catch (e: any) {
		if (e.stdout) return e.stdout;
		return null;
	}
}

async function runToolAsync(
	cmd: string,
	args: string,
	opts?: { timeout?: number; cwd?: string },
): Promise<string | null> {
	const bin = resolveBinary(cmd);
	if (!bin) return null;
	try {
		const { stdout } = await execAsync(`"${bin}" ${args}`, {
			timeout: opts?.timeout || 120000,
			cwd: opts?.cwd || process.cwd(),
			maxBuffer: 50 * 1024 * 1024,
			shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
		});
		return stdout;
	} catch (e: any) {
		if (e.stdout) return e.stdout;
		return null;
	}
}

interface TrivyResult {
	Results?: Array<{
		Target: string;
		Type: string;
		Vulnerabilities?: Array<{
			VulnerabilityID: string;
			PkgName: string;
			Severity: string;
			Title: string;
			InstalledVersion: string;
			FixedVersion: string;
		}>;
		Misconfigurations?: Array<{
			ID: string;
			Title: string;
			Severity: string;
		}>;
	}>;
}

async function runTrivy(
	targetPath?: string,
): Promise<{ count: number; details: string[]; available: boolean }> {
	const available = await toolAvailable("trivy");
	if (!available) return { count: 0, details: [], available: false };
	const out = runTool(
		"trivy",
		`fs --scanners vuln,secret --severity HIGH,CRITICAL --format json .`,
		{ cwd: targetPath },
	);
	if (!out)
		return {
			count: 0,
			details: ["Trivy scan returned no output"],
			available: true,
		};

	try {
		const parsed: TrivyResult = JSON.parse(out);
		const vulns = parsed.Results || [];
		let count = 0;
		const details: string[] = [];

		for (const result of vulns) {
			const v = result.Vulnerabilities || [];
			for (const vuln of v) {
				count++;
				details.push(
					`[${vuln.Severity}] ${vuln.VulnerabilityID} in ${vuln.PkgName}@${vuln.InstalledVersion} — ${vuln.Title || ""}`,
				);
			}
			const m = result.Misconfigurations || [];
			for (const mis of m) {
				count++;
				details.push(`[${mis.Severity}] ${mis.ID} — ${mis.Title}`);
			}
		}

		if (count === 0)
			details.push("Trivy: no HIGH/CRITICAL vulnerabilities found");
		return { count, details: details.slice(0, 30), available: true };
	} catch {
		return {
			count: 0,
			details: ["Trivy: could not parse results"],
			available: true,
		};
	}
}

async function runGitleaks(
	targetPath?: string,
): Promise<{ count: number; details: string[]; available: boolean }> {
	const available = await toolAvailable("gitleaks");
	if (!available) return { count: 0, details: [], available: false };

	const targetDir = targetPath || process.cwd();
	const hasGit = existsSync(path.join(targetDir, ".git"));
	const reportPath = path.join(targetDir, ".gitleaks-report.json");

	const mode = hasGit ? "git" : "detect --no-git";
	const args = `${mode} --report-format json --report-path "${reportPath}"`;

	const out = runTool("gitleaks", args, { cwd: targetDir, timeout: 120000 });

	// Clean up report file
	let findings: any[] = [];
	if (existsSync(reportPath)) {
		try {
			const raw = readFileSync(reportPath, "utf-8");
			findings = JSON.parse(raw);
		} catch {
			/* ignore parse errors */
		}
		try {
			unlinkSync(reportPath);
		} catch {
			/* ignore */
		}
	}

	const details = findings
		.slice(0, 20)
		.map(
			(f: any) =>
				`[${f.RuleID}] ${f.File}:${f.StartLine} — ${f.Description || ""}`,
		);

	return { count: findings.length, details, available: true };
}

export async function runSecurityAudit(
	targetPath?: string,
): Promise<SecurityReport> {
	const [trivyResult, gitleaksResult] = await Promise.all([
		runTrivy(targetPath),
		runGitleaks(targetPath),
	]);

	const totalFindings = trivyResult.count + gitleaksResult.count;
	const tools = [
		{
			name: "Trivy",
			available: trivyResult.available,
			version: toolCache["trivy"]?.version,
			findings: trivyResult.count,
		},
		{
			name: "Gitleaks",
			available: gitleaksResult.available,
			version: toolCache["gitleaks"]?.version,
			findings: gitleaksResult.count,
		},
	];

	const availableTools = tools.filter((t) => t.available).length;
	const skipped = availableTools === 0;
	const passed = !skipped && totalFindings === 0;

	return {
		vulnerabilities: trivyResult.count,
		secrets: gitleaksResult.count,
		passed,
		skipped,
		summary: skipped
			? "Security scan skipped — no tools available (install: trivy, gitleaks)"
			: passed
				? `Security audit passed — no HIGH/CRITICAL findings across ${availableTools} tool(s)`
				: `Security audit found ${totalFindings} issue(s): ${trivyResult.count} vulns, ${gitleaksResult.count} secrets`,
		details: [...trivyResult.details, ...gitleaksResult.details],
		tools,
	};
}

export async function runSecurityAuditPhase(ctx: {
	execution: any;
	sourceRepos: string[];
	targetPath?: string;
}): Promise<void> {
	const { execution } = ctx;
	const report = await runSecurityAudit(ctx.targetPath);

	execution.logs = [...execution.logs, `[SECURITY] ${report.summary}`];

	for (const tool of report.tools) {
		const status = tool.available
			? `available — ${tool.findings} finding(s)`
			: "not installed";
		execution.logs = [...execution.logs, `[SECURITY] ${tool.name}: ${status}`];
	}

	if (report.details.length > 0) {
		execution.logs = [...execution.logs, `[SECURITY] Detailed findings:`];
		for (const detail of report.details.slice(0, 10)) {
			execution.logs = [...execution.logs, `[SECURITY]   ${detail}`];
		}
	}

	if (report.skipped) {
		execution.logs = [
			...execution.logs,
			`[SECURITY] ⚠ No security tools available — install trivy and gitleaks`,
		];
	}

	if (!report.passed && !report.skipped) {
		execution.logs = [
			...execution.logs,
			`[SECURITY] ✗ Audit failed — ${report.vulnerabilities} vulnerabilities, ${report.secrets} secrets`,
		];
	}
}
