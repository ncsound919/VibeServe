/**
 * VibeServe MCP UI Generator — Feeds design spec into VibeServe's pipeline
 * to auto-generate the professional UI components.
 * Usage: npx tsx scripts/vibeserve-gen.mts
 */

import fs from "fs";
import path from "path";
import {
	callMcpTool,
	disconnectMcp,
	initVibeServeClient,
	listMcpTools,
} from "../src/server/mcpClient";

const SPEC = `# Nexus Alpha UI Professionalization Design Spec

## Sidebar: Progressive Pipeline (10 items)
Replace current 19-item sidebar with 8 progressive pipeline steps + 1 settings link:
1. Architect — design system layout (Lightbulb icon)
2. Plan — implementation strategy (ClipboardList icon)
3. Build — code generation with contextual tools: Editor, Memory (Hammer icon)
4. Review — initial code review (Eye icon)
5. Audit — security + lint audit (Shield icon)
6. Fix & Retest — grouped: Fix→E2E→Re-fix→Re-audit, expands inline when active (Wrench icon)
7. Verify — final validation (BadgeCheck icon)
8. Deploy — ship with contextual tool: Preview (Rocket icon)
9. (bottom) Settings — settings + remaining tools (Settings icon)

Each step has status indicators: completed=emerald-500 solid dot, active=pulsing emerald-400 ring with "NOW" badge, failed=rose-500 dot with retry link, pending=gray hollow circle. Completed steps collapse, active step expands. Contextual tools appear inline under active step.

## Dashboard: Default Main View
4-zone layout:
- Live Metrics: 6 gauges (CPU, Memory, Disk, WS status, MCP status, Pipeline Health) with color thresholds
- Activity Feed: color-coded event stream (green=complete, amber=warning, red=error, gray=progress)
- Mission Control: agent status cards with progress bars
- Stat Cards: Pipeline (12/15 streak 5), Projects (3 live), Repos (8 scanned), Quality (B+ 73%)

## Notifications: 4-Tier Toast System
Bottom-right stack. Color rail left border. Icon + title + description + inline actions.
- Info: indigo-400, 4s auto-dismiss
- Success: emerald-500, 6s auto-dismiss
- Warning: amber-500, persistent with actions
- Error: rose-500, persistent with actions

## Header Status Bar
Pipeline progress bar between header and main. Shows phase, progress %, ETA, remaining steps. Active=pulse, Paused=amber, Failed=rose flash. Auto-hides when idle.

## Professional Polish
- 4-layer card system: Base (#0d0d10), Content (#151619), Glass (blurred), Elevated (hover lift)
- Progress bars with color thresholds (green→amber→red) and animations
- Metric gauges with smooth sweep
- Sliders, toggles, knobs with micro-interactions`;

const OUTPUT_DIR = path.resolve(process.cwd(), "src");

async function main() {
	console.log("Connecting to VibeServe MCP...");
	await initVibeServeClient();

	console.log("\nListing available MCP tools:");
	const tools = await listMcpTools();
	for (const t of tools) {
		console.log(
			`  • ${t.name}: ${t.description?.substring(0, 80) ?? "no description"}`,
		);
	}

	// Step 1: Architect — parse the spec
	console.log("\n─── Step 1: Architect ───");
	try {
		const archResult = await callMcpTool("aethernexus_vibe_architect", {
			intent:
				"Redesign Nexus Alpha IDE with progressive pipeline sidebar, dashboard, toast notifications, and professional polish",
			design_system:
				"Custom dark theme (#0A0A0B background, emerald/amber/rose/indigo color system)",
			target_stack:
				"React 18 + TypeScript + Tailwind CSS v4 + Zustand + framer-motion + lucide-react",
			constraints: `Sidebar: 8 pipeline steps with status indicators and grouped fix & retest loop.
Dashboard: live metrics gauges, activity feed, mission control agent cards, stat cards.
Toast: 4-tier bottom-right stack with color rails and auto-dismiss.
Header bar: pipeline progress with phase/ETA, auto-hides when idle.
Cards: 4-layer system (base/content/glass/elevated).
Progress bars: semantic color transitions at thresholds.
Gauges: smooth sweep instruments.
Controls: sliders, toggles, knobs with micro-interactions.`,
		});
		console.log(
			"Architect result:",
			JSON.stringify(archResult, null, 2).substring(0, 500),
		);
	} catch (err: any) {
		console.log(
			"Architect failed (expected — may need different tool):",
			err.message,
		);
	}

	// Step 2: Generate UI spec
	console.log("\n─── Step 2: Generate UI Spec ───");
	try {
		const specResult = await callMcpTool("aethernexus_generate_ui_spec", {
			project_intent:
				"Professional pipeline sidebar + dashboard + toast notifications for Nexus Alpha IDE",
			target_stack: "React + TypeScript + Tailwind CSS v4 + framer-motion",
			max_iterations: 3,
			description: SPEC,
		});
		console.log(
			"UI Spec result:",
			JSON.stringify(specResult, null, 2).substring(0, 1000),
		);

		// Save spec output
		fs.writeFileSync(
			path.resolve(process.cwd(), ".planning/vibeserve-ui-spec.json"),
			JSON.stringify(specResult, null, 2),
		);
		console.log("Saved UI spec to .planning/vibeserve-ui-spec.json");
	} catch (err: any) {
		console.log("UI Spec generation failed:", err.message);
	}

	// Step 3: Generate code
	console.log("\n─── Step 3: Generate Code ───");
	try {
		const codeResult = await callMcpTool("aethernexus_vibe_code", {
			architecture_plan: JSON.stringify({
				components: [
					"PipelineSidebar — 8 progressive steps + settings, status indicators, sub-step expansion",
					"DashboardView — live metrics gauges, activity feed, mission control, stat cards",
					"ToastContainer — 4-tier toast stack with color rails and auto-dismiss",
					"HeaderStatusBar — pipeline progress bar with phase/ETA",
					"toastStore — Zustand store for toast queue management",
					"pipelineProgressStore — Zustand store for pipeline phase/progress tracking",
				],
				styling:
					"Tailwind CSS v4, dark theme (#0A0A0B base), emerald/amber/rose/indigo color system",
				state_management: "Zustand stores",
				animations: "framer-motion for enter/exit, progress, and pulse effects",
			}),
			target_language: "typescript",
			generate_tests: "false",
			max_tokens: 32000,
			description: SPEC.substring(0, 2000),
		});
		console.log(
			"Code result:",
			JSON.stringify(codeResult, null, 2).substring(0, 2000),
		);

		fs.writeFileSync(
			path.resolve(process.cwd(), ".planning/vibeserve-code-output.json"),
			JSON.stringify(codeResult, null, 2),
		);
		console.log("Saved code output to .planning/vibeserve-code-output.json");

		// Try to extract generated files from the result
		extractAndWriteFiles(codeResult);
	} catch (err: any) {
		console.log("Code generation failed:", err.message);
	}

	// Step 4: Validate
	console.log("\n─── Step 4: Validate ───");
	try {
		const validateResult = await callMcpTool("aethernexus_vibe_verify", {
			code: SPEC.substring(0, 1500),
			standards: ["WCAG_AAA", "design_system_consistency", "accessibility"],
		});
		console.log(
			"Validate result:",
			JSON.stringify(validateResult, null, 2).substring(0, 500),
		);
	} catch (err: any) {
		console.log("Validation failed:", err.message);
	}

	await disconnectMcp();
	console.log("\nDone. Check .planning/ for generated artifacts.");
}

function extractAndWriteFiles(result: any) {
	// Try to extract files from various possible response formats
	const content = typeof result === "string" ? result : JSON.stringify(result);

	// Look for file markers like ```tsx:path/to/file.tsx
	const fileRegex = /```(?:tsx|typescript|css)(?::([^\n]+))?\n([\s\S]*?)```/g;
	let match;
	let fileCount = 0;

	while ((match = fileRegex.exec(content)) !== null) {
		const filePath = match[1]?.trim();
		const fileContent = match[2];
		if (filePath && fileContent) {
			const fullPath = path.resolve(OUTPUT_DIR, filePath);
			fs.mkdirSync(path.dirname(fullPath), { recursive: true });
			fs.writeFileSync(fullPath, fileContent);
			console.log(`  ✓ Wrote ${filePath} (${fileContent.length} chars)`);
			fileCount++;
		}
	}

	if (fileCount === 0) {
		// Try another format: arrays of { path, content }
		try {
			const parsed = typeof result === "string" ? JSON.parse(result) : result;
			if (parsed.files && Array.isArray(parsed.files)) {
				for (const file of parsed.files) {
					if (file.path && file.content) {
						const fullPath = path.resolve(OUTPUT_DIR, file.path);
						fs.mkdirSync(path.dirname(fullPath), { recursive: true });
						fs.writeFileSync(fullPath, file.content);
						console.log(
							`  ✓ Wrote ${file.path} (${file.content.length} chars)`,
						);
						fileCount++;
					}
				}
			}
		} catch {}
	}

	if (fileCount === 0) {
		// Save raw output for manual extraction
		fs.writeFileSync(
			path.resolve(process.cwd(), ".planning/vibeserve-raw-output.txt"),
			content,
		);
		console.log(
			"  No structured files found. Saved raw output to .planning/vibeserve-raw-output.txt",
		);
	}
}

main().catch(console.error);
