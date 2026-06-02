import { listQuickActions, VIBESERVE_TOOL_COUNT } from "../server/toolCatalog";
import { useIDEStore } from "../stores/useIDEStore";

const API_BASE =
	typeof window !== "undefined" && window.location.port === "3000"
		? "http://localhost:3002"
		: "";

export function WelcomePage() {
	const { recentFiles, setActivePanel } = useIDEStore();
	const quickActions = listQuickActions();

	return (
		<div
			className="flex flex-col items-center justify-center h-full gap-6 overflow-y-auto p-8"
			style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
		>
			<div className="text-4xl font-bold" style={{ color: "var(--accent)" }}>
				VS
			</div>
			<div className="text-lg" style={{ color: "var(--text-secondary)" }}>
				VibeServe IDE
			</div>

			<div className="flex flex-col gap-2 text-xs">
				<ShortcutRow keys="Ctrl+P" description="Quick open file" />
				<ShortcutRow keys="Ctrl+Shift+P" description="Command palette" />
				<ShortcutRow keys="Ctrl+`" description="Toggle terminal" />
				<ShortcutRow keys="Ctrl+Shift+M" description="Toggle autonomy mode" />
				<ShortcutRow
					keys="Ctrl+Shift+T"
					description="Open VibeServe Tool Catalog"
				/>
			</div>

			<div className="w-full max-w-2xl">
				<div className="flex items-center justify-between mb-2">
					<div className="text-xs" style={{ color: "var(--text-secondary)" }}>
						Quick Tools — {VIBESERVE_TOOL_COUNT} MCP tools available
					</div>
					<button
						onClick={() => setActivePanel("tools")}
						className="text-xxs underline opacity-70 hover:opacity-100"
						style={{ color: "var(--accent)" }}
					>
						Open full catalog →
					</button>
				</div>
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
					{quickActions.map((t) => (
						<button
							key={t.name}
							onClick={() => {
								setActivePanel("tools");
								setTimeout(() => {
									try {
										window.dispatchEvent(
											new CustomEvent("vibeserve:openTool", { detail: t.name }),
										);
									} catch {
										/* ignore */
									}
								}, 30);
							}}
							className="text-left p-2 rounded border hover:border-current"
							style={{
								background: "var(--bg-secondary)",
								borderColor: "var(--border)",
							}}
						>
							<div
								className="text-xs font-medium"
								style={{ color: "var(--text-primary)" }}
							>
								{t.title}
							</div>
							<div
								className="text-xxs opacity-60 truncate"
								style={{ color: "var(--text-muted)" }}
							>
								{t.description}
							</div>
						</button>
					))}
				</div>
			</div>

			{recentFiles.length > 0 && (
				<div className="w-full max-w-2xl mt-4">
					<div
						className="text-xs mb-2"
						style={{ color: "var(--text-secondary)" }}
					>
						Recent Files
					</div>
					{recentFiles.slice(0, 5).map((path) => (
						<div
							key={path}
							className="text-xs py-1 cursor-pointer hover:opacity-80"
							style={{ color: "var(--text-muted)" }}
							onClick={() => {
								const name = path.split("/").pop() || path;
								const ext = path.split(".").pop() || "plaintext";
								useIDEStore.getState().openFile(path, name, ext);
							}}
						>
							{path}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function ShortcutRow({
	keys,
	description,
}: {
	keys: string;
	description: string;
}) {
	return (
		<div className="flex items-center gap-3">
			<span
				className="px-2 py-0.5 rounded text-[11px] font-mono"
				style={{
					background: "var(--bg-tertiary)",
					color: "var(--text-primary)",
				}}
			>
				{keys}
			</span>
			<span style={{ color: "var(--text-muted)" }}>{description}</span>
		</div>
	);
}
