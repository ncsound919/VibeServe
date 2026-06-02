import { useAIStore } from "../stores/useAIStore";
import { useToastStore } from "../stores/useToastStore";

export function TrustReport() {
	const { trustReport } = useAIStore();
	const { addToast } = useToastStore();

	if (!trustReport) return null;

	const entries = Object.entries(trustReport);

	return (
		<div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
			<div
				className="text-[11px] font-semibold uppercase tracking-wider mb-2"
				style={{ color: "var(--text-secondary)" }}
			>
				Trust Report
			</div>
			<div className="space-y-1">
				{entries.map(([key, entry]) => (
					<div key={key} className="flex items-center gap-2 py-0.5">
						<span className="text-xs">
							{entry.status === "pass"
								? "✓"
								: entry.status === "warn"
									? "⚠"
									: "✗"}
						</span>
						<span
							className="text-xs capitalize"
							style={{ color: "var(--text-muted)" }}
						>
							{key.replace(/([A-Z])/g, " $1").trim()}:
						</span>
						<span
							className="text-xs"
							style={{
								color:
									entry.status === "pass"
										? "var(--success)"
										: entry.status === "warn"
											? "var(--warning)"
											: "var(--error)",
							}}
						>
							{entry.detail}
						</span>
					</div>
				))}
			</div>
			<div className="flex gap-2 mt-3">
				<button
					className="flex-1 text-[10px] py-1 rounded"
					style={{
						background: "var(--bg-tertiary)",
						color: "var(--text-secondary)",
					}}
					onClick={() => {
						addToast({
							type: "info",
							message: "Full audit coming in Phase 4.4",
						});
					}}
				>
					View Full Audit
				</button>
				<button
					className="flex-1 text-[10px] py-1 rounded"
					style={{
						background: "var(--accent)",
						color: "var(--text-on-accent)",
					}}
					onClick={() => {
						addToast({
							type: "info",
							message: "Generated code view coming in Phase 4.4",
						});
					}}
				>
					View Code
				</button>
			</div>
		</div>
	);
}
