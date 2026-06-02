import { AnimatePresence, motion } from "motion/react";
import { usePipelineProgressStore } from "../stores/pipelineProgressStore";

const STATUS_COLORS = {
	active: "from-emerald-600 to-emerald-400",
	paused: "from-amber-600 to-amber-400",
	failed: "from-rose-600 to-rose-400",
	idle: "",
};

const STATUS_DOT = {
	active: "bg-emerald-500 animate-pulse",
	paused: "bg-amber-500",
	failed: "bg-rose-500",
	idle: "",
};

export function HeaderStatusBar() {
	const { status, phase, progress, remainingSteps, eta } =
		usePipelineProgressStore();

	if (status === "idle") return null;

	const phaseLabel =
		phase === "fix-retest"
			? "Fix & Retest"
			: phase.charAt(0).toUpperCase() + phase.slice(1);

	return (
		<AnimatePresence>
			<motion.div
				initial={{ height: 0, opacity: 0 }}
				animate={{ height: "auto", opacity: 1 }}
				exit={{ height: 0, opacity: 0 }}
				className="overflow-hidden border-b border-[#1a1b1e]"
			>
				<div className="flex items-center justify-between px-6 py-1.5 text-xs font-mono">
					<div className="flex items-center gap-3">
						<div className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
						<span className="text-[#8E9299]">Pipeline:</span>
						<span className="text-white">{phaseLabel}</span>
						<div className="flex-1 w-32 h-1.5 rounded-full bg-[#1a1b1e] overflow-hidden">
							<motion.div
								className={`h-full rounded-full bg-gradient-to-r ${STATUS_COLORS[status]}`}
								initial={{ width: 0 }}
								animate={{ width: `${progress}%` }}
								transition={{ duration: 0.5, ease: "easeOut" }}
							/>
						</div>
						<span className="text-[#8E9299]">{progress}%</span>
					</div>
					<div className="flex items-center gap-4 text-[#4a4b50]">
						{eta && <span>ETA: {eta}</span>}
						{remainingSteps > 0 && <span>{remainingSteps} remaining</span>}
					</div>
				</div>
			</motion.div>
		</AnimatePresence>
	);
}
