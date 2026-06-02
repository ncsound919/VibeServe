/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	Check,
	ChevronDown,
	ChevronRight,
	Clock,
	Download,
	Loader,
	RotateCcw,
	Star,
	ThumbsDown,
	ThumbsUp,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import type { BuildStepData } from "../../types";

interface PipelineVisualizerProps {
	steps: BuildStepData[];
	onRerunFromStep?: (stepIndex: number) => void;
	onApproveStep?: (stepIndex: number) => void;
	onRejectStep?: (stepIndex: number) => void;
	onExportLog?: () => void;
	onStepClick?: (stepIndex: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
	completed: "bg-emerald-500 text-emerald-400 border-emerald-500/30",
	running: "bg-amber-500 text-amber-400 border-amber-500/30",
	failed: "bg-rose-500 text-rose-400 border-rose-500/30",
	awaiting_approval: "bg-blue-500 text-blue-300 border-blue-500/30",
	pending: "bg-[#2d2e32] text-[#4a4b50] border-[#2d2e32]",
};

const STATUS_DOT: Record<string, string> = {
	completed: "bg-emerald-500",
	running: "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]",
	failed: "bg-rose-500",
	awaiting_approval:
		"bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]",
	pending: "bg-[#2d2e32]",
};

function deriveScore(step: BuildStepData): number | null {
	if (typeof (step as any).score === "number")
		return (step as any).score as number;
	if (step.status === "completed") return 100;
	if (step.status === "failed") return 0;
	if (step.status === "running") return 50;
	return null;
}

function formatDuration(step: BuildStepData): string | null {
	const started = (step as any).startedAt as number | undefined;
	const finished = (step as any).finishedAt as number | undefined;
	if (!started) return null;
	const end = finished ?? Date.now();
	const ms = end - started;
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export const PipelineVisualizer = ({
	steps,
	onRerunFromStep,
	onApproveStep,
	onRejectStep,
	onExportLog,
	onStepClick,
}: PipelineVisualizerProps) => {
	const [expanded, setExpanded] = useState<Set<number>>(new Set());
	const [scoresShown, setScoresShown] = useState(true);

	const toggle = (i: number) => {
		setExpanded((s) => {
			const n = new Set(s);
			if (n.has(i)) n.delete(i);
			else n.add(i);
			return n;
		});
	};

	const completedCount = steps.filter((s) => s.status === "completed").length;
	const failedCount = steps.filter((s) => s.status === "failed").length;
	const totalDuration = steps.reduce((acc, s) => {
		const started = (s as any).startedAt as number | undefined;
		const finished = (s as any).finishedAt as number | undefined;
		if (started && finished) return acc + (finished - started);
		return acc;
	}, 0);

	return (
		<div className="space-y-4">
			{/* Summary bar */}
			<div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-[#0a0a0c] border border-[#2d2e32] rounded-lg">
				<span className="text-[10px] font-mono uppercase tracking-widest text-[#8E9299]">
					{completedCount}/{steps.length} steps
				</span>
				{failedCount > 0 && (
					<span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
						{failedCount} failed
					</span>
				)}
				{totalDuration > 0 && (
					<span className="text-[10px] font-mono text-[#4a4b50] flex items-center gap-1">
						<Clock className="w-2.5 h-2.5" />
						{(totalDuration / 1000).toFixed(1)}s
					</span>
				)}
				<div className="flex-1" />
				<button
					onClick={() => setScoresShown((v) => !v)}
					className="text-[10px] font-mono text-[#4a4b50] hover:text-white flex items-center gap-1"
					title="Toggle score badges"
				>
					<Star className="w-3 h-3" />
					Scores
				</button>
				{onExportLog && (
					<button
						onClick={onExportLog}
						className="text-[10px] font-mono text-[#4a4b50] hover:text-white flex items-center gap-1"
						title="Export run log"
					>
						<Download className="w-3 h-3" />
						Export
					</button>
				)}
			</div>

			{/* Steps */}
			<div className="space-y-2">
				{steps.map((step, i) => {
					const isExpanded = expanded.has(i);
					const score = deriveScore(step);
					const dur = formatDuration(step);
					const isAwaiting = step.status === "awaiting_approval";
					return (
						<motion.div
							key={i}
							initial={{ opacity: 0, x: -8 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: i * 0.05 }}
							className="relative pl-7"
						>
							<div
								className={cn(
									"absolute left-2 top-3 w-2 h-2 rounded-full",
									STATUS_DOT[step.status] ?? STATUS_DOT.pending,
								)}
							/>
							<div
								className={cn(
									"bg-[#151619] border rounded-lg group transition-colors",
									isAwaiting
										? "border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
										: "border-[#2d2e32] hover:border-[#424348]",
								)}
							>
								<div className="flex items-center justify-between p-2.5">
									<button
										onClick={() => {
											toggle(i);
											onStepClick?.(i);
										}}
										className="flex items-center gap-2 flex-1 text-left min-w-0"
									>
										{isExpanded ? (
											<ChevronDown className="w-3 h-3 text-[#4a4b50]" />
										) : (
											<ChevronRight className="w-3 h-3 text-[#4a4b50]" />
										)}
										<span className="text-xs font-medium text-white truncate">
											{step.phase}
										</span>
										{scoresShown && score !== null && (
											<span
												className={cn(
													"text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-0.5",
													score >= 80
														? "bg-emerald-500/10 text-emerald-400"
														: score >= 50
															? "bg-amber-500/10 text-amber-400"
															: "bg-rose-500/10 text-rose-400",
												)}
												title={`Iteration score: ${score}`}
											>
												<Star className="w-2 h-2" />
												{score}
											</span>
										)}
										{dur && (
											<span className="text-[9px] font-mono text-[#4a4b50]">
												{dur}
											</span>
										)}
									</button>
									<div className="flex items-center gap-1.5 shrink-0">
										<span
											className={cn(
												"text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border",
												STATUS_COLORS[step.status] ?? STATUS_COLORS.pending,
											)}
										>
											{step.status}
										</span>
										{isAwaiting && (
											<>
												{onApproveStep && (
													<button
														onClick={() => onApproveStep(i)}
														className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
														title="Approve & continue"
													>
														<ThumbsUp className="w-3 h-3" />
													</button>
												)}
												{onRejectStep && (
													<button
														onClick={() => onRejectStep(i)}
														className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300"
														title="Reject & revise"
													>
														<ThumbsDown className="w-3 h-3" />
													</button>
												)}
											</>
										)}
										{(step.status === "completed" ||
											step.status === "failed") &&
											onRerunFromStep && (
												<button
													onClick={() => onRerunFromStep(i)}
													className="p-1 rounded text-[#4a4b50] hover:text-emerald-300 hover:bg-emerald-500/10"
													title="Re-run from this step"
												>
													<RotateCcw className="w-3 h-3" />
												</button>
											)}
									</div>
								</div>

								<AnimatePresence>
									{isExpanded && (
										<motion.div
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											exit={{ height: 0, opacity: 0 }}
											className="overflow-hidden border-t border-[#2d2e32]"
										>
											<div className="p-3 space-y-2 text-[11px]">
												{step.details && (
													<p className="text-[#8E9299] font-mono whitespace-pre-wrap">
														{step.details}
													</p>
												)}
												{(step as any).output !== undefined && (
													<details className="bg-[#0a0a0c] border border-[#2d2e32] rounded p-2">
														<summary className="cursor-pointer text-[10px] font-mono text-[#4a4b50] hover:text-white">
															Raw output
														</summary>
														<pre className="mt-2 text-[10px] font-mono text-emerald-500/80 overflow-x-auto max-h-64">
															{JSON.stringify((step as any).output, null, 2)}
														</pre>
													</details>
												)}
												{step.status === "failed" && onRerunFromStep && (
													<button
														onClick={() => onRerunFromStep(i)}
														className="w-full mt-1 px-2 py-1.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 flex items-center justify-center gap-1.5"
													>
														<RotateCcw className="w-3 h-3" /> Re-run this step
													</button>
												)}
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
};
