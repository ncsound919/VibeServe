/**
 * PipelineControlPanel — Zone 3
 * Thin wrapper around PipelineVisualizer that wires the re-run, approval, and export callbacks.
 * Use this in any panel that wants the new pipeline UX (re-run, score, HIL approval, export).
 */
import { useState } from "react";
import { useAIStore } from "../../stores/useAIStore";
import type { BuildStepData } from "../../types";
import { PipelineVisualizer } from "./PipelineVisualizer";

interface PipelineControlPanelProps {
	steps: BuildStepData[];
	executionId?: string;
	prompt?: string;
	provider?: string;
	model?: string;
}

export function PipelineControlPanel({
	steps,
	executionId,
	prompt,
	provider,
	model,
}: PipelineControlPanelProps) {
	const { selectedProvider, selectedModel } = useAIStore();
	const [busy, setBusy] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [lastRerun, setLastRerun] = useState<{
		stepIndex: number;
		output: unknown;
		score?: number;
	} | null>(null);

	const handleRerun = async (stepIndex: number) => {
		setBusy(stepIndex);
		setError(null);
		try {
			const step = steps[stepIndex];
			const previousOutput =
				stepIndex > 0
					? ((steps[stepIndex - 1] as any).output ?? lastRerun?.output)
					: undefined;
			const res = await fetch("/api/pipeline/rerun-step", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					executionId: executionId || "local",
					stepIndex,
					stepName: step.phase,
					prompt,
					provider: provider || selectedProvider,
					model: model || selectedModel,
					previousOutput,
				}),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || `HTTP ${res.status}`);
			}
			const data = await res.json();
			setLastRerun({ stepIndex, output: data.output, score: data.score });
		} catch (e: any) {
			setError(e?.message || "Re-run failed");
		} finally {
			setBusy(null);
		}
	};

	const handleApprove = (stepIndex: number) => {
		setError(null);
		setLastRerun({
			stepIndex,
			output: { approved: true, approvedAt: Date.now() },
			score: 100,
		});
	};

	const handleReject = (stepIndex: number) => {
		setError(null);
		setLastRerun({
			stepIndex,
			output: { rejected: true, rejectedAt: Date.now() },
			score: 0,
		});
	};

	const handleExport = () => {
		const blob = new Blob(
			[
				JSON.stringify(
					{
						executionId,
						exportedAt: new Date().toISOString(),
						steps: steps.map((s, i) => ({
							index: i,
							phase: s.phase,
							status: s.status,
							details: s.details,
							startedAt: (s as any).startedAt,
							finishedAt: (s as any).finishedAt,
							score: (s as any).score,
						})),
					},
					null,
					2,
				),
			],
			{ type: "application/json" },
		);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `pipeline-${executionId || "local"}-${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	};

	return (
		<div>
			{error && (
				<div className="mb-2 px-3 py-2 text-[11px] rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
					{error}
				</div>
			)}
			{busy !== null && (
				<div className="mb-2 px-3 py-2 text-[11px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
					Re-running step {busy + 1}…
				</div>
			)}
			{lastRerun && (
				<div className="mb-2 px-3 py-2 text-[11px] rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
					✓ Step {lastRerun.stepIndex + 1} re-completed
					{typeof lastRerun.score === "number" && ` · score ${lastRerun.score}`}
				</div>
			)}
			<PipelineVisualizer
				steps={steps.map((s, i) =>
					i === busy
						? { ...s, status: "running" as const }
						: i === lastRerun?.stepIndex
							? {
									...s,
									status: "completed" as const,
									output: lastRerun.output,
									score: lastRerun.score,
								}
							: s,
				)}
				onRerunFromStep={handleRerun}
				onApproveStep={handleApprove}
				onRejectStep={handleReject}
				onExportLog={handleExport}
			/>
		</div>
	);
}
