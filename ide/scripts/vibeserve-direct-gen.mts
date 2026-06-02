/**
 * Direct VibeServe code generation — calls vibe_code tool directly.
 */

import fs from "fs";
import path from "path";
import {
	callMcpTool,
	disconnectMcp,
	initVibeServeClient,
} from "../src/server/mcpClient";

const SPEC = `Create React TypeScript components for Nexus Alpha IDE with Tailwind CSS v4 dark theme:

COMPONENT 1: src/layout/PipelineSidebar.tsx
8 progressive pipeline steps as sidebar navigation items:
"Architect" (Lightbulb icon), "Plan" (ClipboardList), "Build" (Hammer, shows contextual Editor/Memory tools), "Review" (Eye), "Audit" (Shield), "Fix & Retest" (Wrench, expandable with sub-steps: Fix→E2E Testing→Re-fix→Re-audit), "Verify" (BadgeCheck), "Deploy" (Rocket, shows Preview tool).
Bottom: "Settings" link (Settings icon).
Each step: status dot (completed=emerald-500, active=pulsing emerald-400 ring with NOW badge, failed=rose-500, pending=gray hollow). Active step has expandable contextual tools and progress bar.
Uses: import from lucide-react, framer-motion, zustand store useAppStore for setActiveTab.
Colors: bg-[#0a0a0c], border-r border-[#1a1b1e], text-white active, text-[#4a4b50] inactive.

COMPONENT 2: src/features/dashboard/DashboardView.tsx
Grid layout p-6 space-y-8. 4 zones:
- Live Metrics (grid-cols-2 gap-3): CPU gauge (42%), Memory (38%), Disk I/O (22%), WS status (active, green dot), MCP status (active, green dot), Pipeline Health (92% bar). Each gauge: label, big value, gradient progress bar with emerald→amber→rose thresholds.
- Activity Feed (bg-[#151619] border-[#2d2e32] rounded-2xl p-6): scrollable list with color icons (CheckCircle2=green, AlertTriangle=amber, AlertCircle=red, Circle=gray). Events: "14:32 Build completed", "14:28 Review passed", "14:25 E2E tests 3/3", "14:22 Audit: 2 findings", "14:18 Fix applied", "14:15 Build started".
- Mission Control (same card style): 3 agent cards (Agent-1 active 80% Build, Agent-2 paused 40% Review, Agent-3 active 60% Audit) with status badge and progress bar.
- 4 stat cards (grid-cols-4 gap-3): Pipeline 12/15 streak 5↑, Projects 3 live 2 done, Repos 8 scanned, Quality B+ 73% ↑+8%. Each card: icon, label, big number, trend arrow.

COMPONENT 3: src/stores/toastStore.ts
Zustand store. Types: ToastType='info'|'success'|'warning'|'error'. Toast: {id, type, title, description?, actions?:{label,onClick}[], duration?}. Methods: addToast (auto-dismiss by type: info=4s, success=6s, warning/error=persistent), dismissToast, clearAll.

COMPONENT 4: src/components/ToastContainer.tsx
Fixed bottom-right z-50 stack. Each toast: framer-motion enter/exit. Left color rail (w-1 rounded-full), icon (CheckCircle2/AlertTriangle/AlertCircle/Info), title+description, close X button, action buttons if present. Colors: success=emerald-500, warning=amber-500, error=rose-500, info=indigo-400.

COMPONENT 5: src/stores/pipelineProgressStore.ts
Zustand store. PipelinePhase='idle'|'architect'|'plan'|'build'|'review'|'audit'|'fix-retest'|'verify'|'deploy'. PipelineStatus='active'|'paused'|'failed'|'idle'. State: status, phase, progress(0-100), remainingSteps, eta. Methods: setPhase, setProgress, setStatus, reset.

COMPONENT 6: src/components/HeaderStatusBar.tsx
Between header and main. Shows only when status!=='idle'. framer-motion height animation. Flex row: colored dot (active=emerald pulse, paused=amber, failed=rose), "Pipeline: [phaseLabel]" text, gradient progress bar, "N%" text, ETA, remaining steps. Auto-hides on idle.

COMPONENT 7: CSS additions for src/index.css
.glass-card: bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-2xl
.elevated-card: bg-[#151619] border border-[#2d2e32] rounded-2xl, hover translate-y-[-2px] shadow
.progress-shimmer: keyframe animation shimmer 1.5s
.toggle-pill, .toggle-thumb: cubic-bezier transitions
.slider-knob: webkit-slider-thumb glow

Use: React 18, TypeScript, Tailwind CSS v4, framer-motion (motion components), lucide-react icons, Zustand`;

async function main() {
	console.log("Connecting to VibeServe MCP...");
	await initVibeServeClient();

	// Try vibe_code directly with the spec as intent
	console.log("\n─── Calling vibe_code ───");
	try {
		const codeResult = await callMcpTool("vibe_code", {
			intent: SPEC,
			plan: JSON.stringify({
				target: "react-typescript",
				components: [
					"PipelineSidebar",
					"DashboardView",
					"ToastContainer",
					"HeaderStatusBar",
					"toastStore",
					"pipelineProgressStore",
				],
			}),
		});

		const text = JSON.stringify(codeResult);
		console.log(`Response length: ${text.length} chars`);

		// Check for content array (MCP format)
		if (codeResult?.content && Array.isArray(codeResult.content)) {
			for (const item of codeResult.content) {
				if (item.type === "text" && item.text) {
					console.log("\nContent text length:", item.text.length);
					console.log("First 2000 chars:");
					console.log(item.text.substring(0, 2000));

					// Extract code blocks
					const regex =
						/```(?:tsx|typescript|css)(?::\s*([^\n\r]+))?\s*\n([\s\S]*?)```/g;
					let match;
					let count = 0;
					while ((match = regex.exec(item.text)) !== null) {
						const filePath = match[1]?.trim() || `generated-${++count}.tsx`;
						const code = match[2];
						const fullPath = path.resolve(process.cwd(), filePath);
						fs.mkdirSync(path.dirname(fullPath), { recursive: true });
						fs.writeFileSync(fullPath, code);
						console.log(`  ✓ Wrote ${filePath} (${code.length} chars)`);
					}

					if (count === 0) {
						// Save full text
						const outPath = path.resolve(
							process.cwd(),
							".planning/vibeserve-code-raw.txt",
						);
						fs.writeFileSync(outPath, item.text);
						console.log(
							`Saved raw output to .planning/vibeserve-code-raw.txt (${item.text.length} chars)`,
						);
					}
				}
			}
		}
	} catch (err: any) {
		console.error("vibe_code failed:", err.message);
	}

	await disconnectMcp();
	console.log("\nDone.");
}

main().catch(console.error);
