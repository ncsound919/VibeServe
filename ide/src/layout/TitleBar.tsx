import { useIDEStore } from "../stores/useIDEStore";

export function TitleBar() {
	const { autonomyMode } = useIDEStore();

	return (
		<div
			className="flex items-center justify-between shrink-0 select-none"
			style={{
				height: "var(--title-bar-height)",
				background: "var(--bg-secondary)",
				borderBottom: "1px solid var(--border)",
				padding: "0 8px",
			}}
		>
			<div className="flex items-center gap-2">
				<span
					className="font-semibold text-sm"
					style={{ color: "var(--accent)" }}
				>
					VS
				</span>
				<span
					className="font-medium text-sm"
					style={{ color: "var(--text-secondary)" }}
				>
					VibeServe
				</span>
			</div>

			<div
				className="flex items-center gap-3 text-xs"
				style={{ color: "var(--text-muted)" }}
			>
				<div className="flex items-center gap-1">
					<div
						className="w-2 h-2 rounded-full"
						style={{
							background:
								autonomyMode === "pipeline"
									? "var(--accent)"
									: autonomyMode === "copilot"
										? "var(--info)"
										: "var(--success)",
						}}
					/>
					<span>main</span>
				</div>
				<span style={{ color: "var(--border)" }}>|</span>
				<span>~/my-project</span>
			</div>

			<div className="flex items-center gap-2">
				<button
					className="text-xs px-2 py-0.5 rounded transition-colors hover:opacity-80"
					style={{
						background: "var(--bg-tertiary)",
						color: "var(--text-secondary)",
					}}
					onClick={() =>
						window.dispatchEvent(
							new KeyboardEvent("keydown", {
								key: "P",
								ctrlKey: true,
								shiftKey: true,
							}),
						)
					}
				>
					Ctrl+P
				</button>
				<button
					className="text-xs px-2 py-0.5 rounded"
					style={{
						background: "var(--accent)",
						color: "var(--text-on-accent)",
					}}
					onClick={() => {
						useIDEStore.getState().setAutonomyMode("pipeline");
					}}
				>
					Pipeline
				</button>
			</div>
		</div>
	);
}
