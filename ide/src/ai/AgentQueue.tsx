import { useEffect } from "react";
import { useAIStore } from "../stores/useAIStore";
import { useIDEStore } from "../stores/useIDEStore";
import { useToastStore } from "../stores/useToastStore";
import { TrustReport } from "./TrustReport";

const PIPELINE_STEPS = [
	{ id: "architect", label: "Architect", emoji: "🏗️" },
	{ id: "code", label: "Code", emoji: "💻" },
	{ id: "review", label: "Review", emoji: "👁️" },
	{ id: "verify", label: "Verify", emoji: "✅" },
	{ id: "iterate", label: "Iterate", emoji: "🔄" },
	{ id: "test", label: "Test", emoji: "🧪" },
	{ id: "deploy", label: "Deploy", emoji: "🚀" },
];

export function AgentQueue() {
	const {
		pipelineSteps,
		isPipelineRunning,
		setPipelineRunning,
		setPipelineSteps,
		updatePipelineStep,
	} = useAIStore();
	const { autonomyMode } = useIDEStore();
	const { addToast } = useToastStore();

	useEffect(() => {
		if (!isPipelineRunning) return;
		const interval = setInterval(async () => {
			try {
				const res = await fetch("/api/pipeline/status");
				if (res.ok) {
					const data = await res.json();
					data.steps?.forEach((step: any) =>
						updatePipelineStep(step.id, {
							status: step.status,
							detail: step.detail,
						}),
					);
					if (data.complete) setPipelineRunning(false);
				}
			} catch {}
		}, 2000);
		return () => clearInterval(interval);
	}, [isPipelineRunning, updatePipelineStep, setPipelineRunning]);

	const handleRunPipeline = async () => {
		setPipelineRunning(true);
		const steps = PIPELINE_STEPS.map((s) => ({
			id: s.id,
			name: s.label,
			status: "pending" as const,
		}));
		setPipelineSteps(steps);

		try {
			const res = await fetch("/api/pipeline/run", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ mode: autonomyMode }),
			});
			if (res.ok) {
				addToast({ type: "success", message: "Pipeline started" });
			} else {
				addToast({ type: "error", message: `Pipeline failed: ${res.status}` });
				setPipelineRunning(false);
			}
		} catch {
			addToast({ type: "error", message: "Orchestrator backend not running" });
			setPipelineRunning(false);
		}
	};

	const handleStopPipeline = () => {
		setPipelineRunning(false);
		setPipelineSteps([]);
		addToast({ type: "info", message: "Pipeline stopped" });
	};

	return (
		<div
			className="flex flex-col"
			style={{ borderTop: "1px solid var(--border)" }}
		>
			<div
				className="flex items-center justify-between px-3 py-2"
				style={{ borderBottom: "1px solid var(--border)" }}
			>
				<span
					className="text-xs font-medium"
					style={{ color: "var(--text-primary)" }}
				>
					Pipeline
				</span>
				<div className="flex gap-1">
					{isPipelineRunning ? (
						<button
							onClick={handleStopPipeline}
							className="text-[11px] px-2 py-0.5 rounded"
							style={{
								background: "var(--error)",
								color: "var(--text-on-accent)",
							}}
						>
							◼ Stop
						</button>
					) : (
						<button
							onClick={handleRunPipeline}
							className="text-[11px] px-2 py-0.5 rounded"
							style={{
								background: "var(--accent)",
								color: "var(--text-on-accent)",
							}}
						>
							▶ Run
						</button>
					)}
				</div>
			</div>

			{pipelineSteps.length > 0 && (
				<div className="p-3 space-y-1">
					{pipelineSteps.map((step) => (
						<div key={step.id} className="flex items-center gap-2 py-1">
							<div
								className="w-2 h-2 rounded-full shrink-0"
								style={{
									background:
										step.status === "done"
											? "var(--success)"
											: step.status === "running"
												? "var(--accent)"
												: step.status === "error"
													? "var(--error)"
													: "var(--text-muted)",
									animation:
										step.status === "running" ? "pulse 1.5s infinite" : "none",
								}}
							/>
							<span
								className="text-xs font-medium"
								style={{
									color:
										step.status === "pending"
											? "var(--text-muted)"
											: "var(--text-primary)",
								}}
							>
								{step.name}
							</span>
							<div className="flex-1" />
							{step.status === "done" && (
								<span style={{ color: "var(--success)", fontSize: "10px" }}>
									✓
								</span>
							)}
							{step.status === "running" && (
								<span style={{ color: "var(--accent)", fontSize: "10px" }}>
									...
								</span>
							)}
							{step.status === "error" && (
								<span style={{ color: "var(--error)", fontSize: "10px" }}>
									✗
								</span>
							)}
						</div>
					))}
				</div>
			)}

			{pipelineSteps.length === 0 && !isPipelineRunning && (
				<div
					className="p-4 text-xs text-center"
					style={{ color: "var(--text-muted)" }}
				>
					Ready to build. Click ▶ Run to start the pipeline.
				</div>
			)}

			<TrustReport />
		</div>
	);
}
