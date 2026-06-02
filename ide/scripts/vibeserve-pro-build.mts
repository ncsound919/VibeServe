/**
 * VibeServe MCP Professional UI Build — Uses vibe_build_pro for full pipeline.
 * Usage: npx tsx scripts/vibeserve-pro-build.mts
 */

import fs from "fs";
import path from "path";
import {
	callMcpTool,
	disconnectMcp,
	initVibeServeClient,
} from "../src/server/mcpClient";

async function main() {
	console.log("Connecting to VibeServe MCP...");
	await initVibeServeClient();

	// vibe_build_pro: Full professional build: upgrade design -> architect -> code -> verify
	console.log("\n─── Running vibe_build_pro ───");

	const spec = `Build a professional React+TypeScript UI for Nexus Alpha IDE with these exact components:

1. PipelineSidebar (src/layout/PipelineSidebar.tsx):
   - 8 progressive pipeline steps: Architect(Lightbulb), Plan(ClipboardList), Build(Hammer), Review(Eye), Audit(Shield), Fix&Retest(Wrench), Verify(BadgeCheck), Deploy(Rocket)
   - Each step shows status: completed=emerald-500 solid dot, active=pulsing emerald-400 ring, failed=rose-500 dot, pending=gray hollow circle
   - Active step shows "NOW" badge and progress bar
   - Build step shows contextual tools: Editor, Memory as sub-items
   - Deploy step shows contextual tool: Preview as sub-item
   - Fix&Retest step expands inline showing 4 sub-steps: Fix→E2E Testing→Re-fix→Re-audit
   - Bottom: Settings link
   - Uses useAppStore for tab navigation
   - 200px wide, dark bg #0a0a0c, border-r #1a1b1e

2. DashboardView (src/features/dashboard/DashboardView.tsx):
   - Zone 1: Live Metrics - 6 gauges (CPU 42%, Memory 38%, Disk 22%, WS active, MCP active, Pipeline Health 92%) with color thresholds green→amber→red
   - Zone 2: Activity Feed - scrollable event list with color-coded icons (green check=complete, amber triangle=warning, red circle=error, gray circle=progress). Events: "14:32 Build completed", "14:28 Review passed", "14:25 E2E tests 3/3", "14:22 Audit: 2 findings", "14:18 Fix applied", "14:15 Build started"
   - Zone 3: Mission Control - 3 agent cards (Agent-1 active 80% Build, Agent-2 paused 40% Review, Agent-3 active 60% Audit) with progress bars
   - Zone 4: 4 stat cards - Pipeline 12/15 streak 5↑, Projects 3 live 2 done, Repos 8 scanned, Quality B+ 73% ↑+8%
   - Grid layout, dark theme #151619 cards

3. ToastContainer (src/components/ToastContainer.tsx):
   - Bottom-right fixed stack, newest on top
   - 4 tiers: info(indigo,4s), success(emerald,6s), warning(amber,persistent), error(rose,persistent)
   - Left color rail, icon, title, description, close button, optional action buttons
   - Uses framer-motion for enter/exit
   - Zustand store: src/stores/toastStore.ts

4. HeaderStatusBar (src/components/HeaderStatusBar.tsx):
   - Between header and main content
   - Shows: dot(active=green pulse, paused=amber, failed=rose) + "Pipeline: [phase]" + progress bar + "%" + ETA + remaining steps
   - Auto-hides when idle, collapses on scroll
   - Zustand store: src/stores/pipelineProgressStore.ts

5. CSS additions (append to src/index.css):
   - .progress-shimmer animation
   - .gauge-ring with drop-shadow
   - .glass-card (backdrop-blur)
   - .elevated-card (hover lift + shadow)
   - .toggle-pill and .toggle-thumb transitions
   - .slider-knob with glow

Use: React 18, TypeScript, Tailwind CSS v4, framer-motion, lucide-react icons, Zustand stores.`;

	try {
		const result = await callMcpTool("vibe_build_pro", {
			intent: spec,
			design_system: "dark-minimal",
			target_stack: "react typescript tailwind",
		});

		console.log("Result type:", typeof result);
		console.log("Result keys:", Object.keys(result));

		const text = JSON.stringify(result);
		console.log("Result length:", text.length);
		console.log("\nFirst 3000 chars:");
		console.log(text.substring(0, 3000));

		// Save full result
		const outDir = path.resolve(process.cwd(), ".planning");
		fs.mkdirSync(outDir, { recursive: true });
		fs.writeFileSync(path.join(outDir, "vibeserve-pro-output.json"), text);
		console.log(
			`\nSaved full output (${text.length} chars) to .planning/vibeserve-pro-output.json`,
		);

		// Try to extract code
		extractCodeFiles(result, text);
	} catch (err: any) {
		console.error("vibe_build_pro failed:", err.message);
	}

	await disconnectMcp();
	console.log("\nDone.");
}

function extractCodeFiles(result: any, raw: string) {
	let fileCount = 0;

	// Check for files array in result
	if (result?.files && Array.isArray(result.files)) {
		for (const file of result.files) {
			if (file.path && file.content) {
				writeFile(file.path, file.content);
				fileCount++;
			}
		}
	}

	// Check content array (MCP format)
	if (result?.content && Array.isArray(result.content)) {
		for (const item of result.content) {
			if (item.type === "text" && typeof item.text === "string") {
				const extracted = extractFromText(item.text);
				fileCount += extracted;
			}
		}
	}

	// Check for embedded files in raw text
	if (fileCount === 0) {
		const extracted = extractFromText(raw);
		fileCount += extracted;
	}

	if (fileCount === 0) {
		console.log("No structured files found in output. Raw output saved.");
	}
}

function extractFromText(text: string): number {
	let count = 0;
	// Match ```tsx:path/to/file.tsx or ```typescript:path
	const regex =
		/```(?:tsx|typescript|css)(?::\s*([^\n\r]+))?\s*\n([\s\S]*?)```/g;
	let match;
	while ((match = regex.exec(text)) !== null) {
		const filePath = match[1]?.trim();
		const code = match[2];
		if (filePath && code && code.length > 50) {
			writeFile(filePath, code);
			count++;
		}
	}
	return count;
}

function writeFile(relativePath: string, content: string) {
	const fullPath = path.resolve(process.cwd(), relativePath);
	const dir = path.dirname(fullPath);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(fullPath, content);
	console.log(`  ✓ Wrote ${relativePath} (${content.length} chars)`);
}

main().catch(console.error);
