import { Cpu, Loader } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAIStore } from "../stores/useAIStore";
import { useIDEStore } from "../stores/useIDEStore";
import { usePipelineStore } from "../stores/usePipelineStore";

interface McpStatus {
	connected: boolean;
	latencyMs: number | null;
	liveToolCount: number | null;
	staticToolCount: number;
	serverName: string;
	version: string;
	error: string | null;
}

const API_BASE =
	typeof window !== "undefined" && window.location.port === "3000"
		? "http://localhost:3002"
		: "";

export function StatusBar() {
	const {
		autonomyMode,
		setAutonomyMode,
		bottomPanelActive,
		setBottomPanelActive,
		setActivePanel,
	} = useIDEStore();
	const { selectedModel, setModel, isPipelineRunning } = useAIStore();
	const { activeExecution, wsConnected } = usePipelineStore();
	const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
	const [mcp, setMcp] = useState<McpStatus | null>(null);
	const [reconnecting, setReconnecting] = useState(false);

	useEffect(() => {
		const interval = setInterval(() => {
			try {
				const monaco = (
					window as unknown as {
						monaco?: {
							editor?: {
								getEditors?: () => {
									getPosition?: () => {
										lineNumber: number;
										column: number;
									} | null;
								}[];
							};
						};
					}
				).monaco;
				const editors = monaco?.editor?.getEditors?.();
				const activeEditor = editors?.[0];
				if (activeEditor) {
					const pos = activeEditor.getPosition?.();
					if (pos) setCursorPosition({ line: pos.lineNumber, col: pos.column });
				}
			} catch {}
		}, 500);
		return () => clearInterval(interval);
	}, []);

	const fetchMcp = useCallback(async () => {
		try {
			const res = await fetch(`${API_BASE}/api/pipeline/mcp/status`);
			if (res.ok) setMcp((await res.json()) as McpStatus);
		} catch {
			setMcp((prev) => (prev ? { ...prev, connected: false } : null));
		}
	}, []);

	const reconnectMcp = useCallback(async () => {
		setReconnecting(true);
		try {
			await fetch(`${API_BASE}/api/pipeline/mcp/reconnect`);
			await fetchMcp();
		} finally {
			setReconnecting(false);
		}
	}, [fetchMcp]);

	useEffect(() => {
		fetchMcp();
		const id = setInterval(fetchMcp, 15000);
		return () => clearInterval(id);
	}, [fetchMcp]);

	return (
		<div
			className="flex items-center justify-between shrink-0 text-xs select-none"
			style={{
				height: "var(--status-bar-height)",
				background: "var(--bg-secondary)",
				color: "var(--text-muted)",
				borderTop: "1px solid var(--border)",
				padding: "0 8px",
			}}
		>
			<div className="flex items-center gap-4">
				<span>main</span>
				<span>UTF-8</span>
				<span>LF</span>
				<span>TypeScript React</span>
				<span>
					Ln {cursorPosition.line}, Col {cursorPosition.col}
				</span>
			</div>

			<div className="flex items-center gap-3">
				<button
					onClick={() => setBottomPanelActive("pipeline-log")}
					className="flex items-center gap-1 hover:text-white transition-colors"
				>
					<div
						className="w-2 h-2 rounded-full"
						style={{ background: "var(--accent)" }}
					/>
					Pipeline
				</button>

				<button
					onClick={() => {
						const modes = ["ide", "copilot", "pipeline"] as const;
						const next =
							modes[(modes.indexOf(autonomyMode) + 1) % modes.length];
						setAutonomyMode(next);
					}}
					className="flex items-center gap-1 hover:text-white transition-colors"
				>
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
					{autonomyMode === "pipeline"
						? "Pipeline"
						: autonomyMode === "copilot"
							? "Copilot"
							: "IDE"}
				</button>

				{/* Agent Queue Indicator */}
				<button
					onClick={() => setBottomPanelActive("pipeline-log")}
					className="flex items-center gap-1 hover:text-white transition-colors"
					title={
						activeExecution
							? `Running: ${activeExecution.status}`
							: wsConnected
								? "Agent idle"
								: "Agent disconnected"
					}
				>
					{isPipelineRunning || activeExecution ? (
						<>
							<Loader
								className="w-3 h-3 animate-spin"
								style={{ color: "var(--accent)" }}
							/>
							<span style={{ color: "var(--accent)" }}>
								Agent ({activeExecution?.steps?.length || 0})
							</span>
						</>
					) : (
						<>
							<Cpu
								className="w-3 h-3"
								style={{
									color: wsConnected ? "var(--success)" : "var(--text-muted)",
								}}
							/>
							<span>{wsConnected ? "Agent ready" : "Agent offline"}</span>
						</>
					)}
				</button>

				{/* VibeServe MCP Connection Chip */}
				<button
					onClick={() => setActivePanel("tools")}
					onDoubleClick={(e) => {
						e.preventDefault();
						reconnectMcp();
					}}
					className="flex items-center gap-1.5 hover:text-white transition-colors"
					title={
						mcp?.connected
							? `MCP connected · ${mcp.liveToolCount ?? "?"} live / ${mcp.staticToolCount} registered · v${mcp.version} · ${mcp.latencyMs ?? "?"}ms\nDouble-click to reconnect`
							: `MCP disconnected — Python offline\n${mcp?.error || ""}\nDouble-click to reconnect`
					}
				>
					<div
						className={`w-2 h-2 rounded-full ${reconnecting ? "animate-pulse" : ""}`}
						style={{
							background: reconnecting
								? "var(--warning, #f9e2af)"
								: mcp?.connected
									? "var(--success, #a6e3a1)"
									: "var(--error, #f38ba8)",
						}}
					/>
					<span
						style={{
							color: mcp?.connected
								? "var(--success, #a6e3a1)"
								: "var(--error, #f38ba8)",
						}}
					>
						{reconnecting
							? "MCP reconnecting…"
							: mcp?.connected
								? `MCP ${mcp.liveToolCount ?? "?"}/${mcp.staticToolCount}`
								: "MCP offline"}
					</span>
				</button>

				<button
					onClick={() => {
						const models = [
							"gemini-2.0-flash",
							"gemini-2.0-pro",
							"gpt-4o",
							"claude-3.5-sonnet",
							"llama3.2",
						];
						const next =
							models[(models.indexOf(selectedModel) + 1) % models.length];
						setModel(next);
					}}
					className="hover:text-white transition-colors"
				>
					{selectedModel}
				</button>

				<div className="flex items-center gap-1">
					<span>🔔</span>
					<span>0</span>
				</div>
			</div>
		</div>
	);
}
