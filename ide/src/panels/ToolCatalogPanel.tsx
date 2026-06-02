/**
 * ToolCatalogPanel — the main sidebar panel that exposes every VibeServe
 * MCP tool. The panel is the "all tools" surface: a user can browse, search,
 * filter by category, and invoke any tool. The result renders inline below
 * the form so the workflow is `Pick → Fill → Run → Inspect → Copy`.
 *
 *   - Header shows the MCP connection status (live + static tool counts).
 *   - Middle is a search box + category list + tool list.
 *   - When a tool is selected, the right side (or below) shows the form
 *     and result.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ToolInvokeForm } from "../components/ToolInvokeForm";
import { ToolResult } from "../components/ToolResult";
import { Icons } from "../lib/icons";
import {
	findTool,
	listCategories,
	type ToolEntry,
	VIBESERVE_TOOL_CATALOG,
} from "../server/toolCatalog";

interface McpStatus {
	connected: boolean;
	latencyMs: number | null;
	liveToolCount: number | null;
	staticToolCount: number;
	serverName: string;
	version: string;
	error: string | null;
}

const SCOPE_COLORS: Record<string, string> = {
	read: "var(--accent, #89b4fa)",
	write: "var(--warning, #f9e2af)",
	execute: "var(--error, #f38ba8)",
	ai: "var(--success, #a6e3a1)",
};

const API_BASE =
	typeof window !== "undefined" && window.location.port === "3000"
		? "http://localhost:3002"
		: "";

export function ToolCatalogPanel() {
	const categories = useMemo(() => listCategories(), []);
	const [query, setQuery] = useState("");
	const [activeCategory, setActiveCategory] = useState<string | null>(null);
	const [selectedTool, setSelectedTool] = useState<ToolEntry | null>(null);
	const [args, setArgs] = useState<Record<string, unknown>>({});
	const [result, setResult] = useState<unknown>(undefined);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<McpStatus | null>(null);
	const [statusLoading, setStatusLoading] = useState(false);

	const filtered = useMemo(() => {
		const q = query.toLowerCase().trim();
		return VIBESERVE_TOOL_CATALOG.filter((t) => {
			if (activeCategory && t.category !== activeCategory) return false;
			if (!q) return true;
			return (
				t.name.toLowerCase().includes(q) ||
				t.title.toLowerCase().includes(q) ||
				t.description.toLowerCase().includes(q)
			);
		});
	}, [query, activeCategory]);

	const fetchStatus = useCallback(async () => {
		setStatusLoading(true);
		try {
			const res = await fetch(`${API_BASE}/api/pipeline/mcp/status`);
			if (res.ok) setStatus((await res.json()) as McpStatus);
		} catch (e: any) {
			setStatus((prev) => ({
				...(prev as McpStatus),
				connected: false,
				error: e?.message || "unreachable",
			}));
		} finally {
			setStatusLoading(false);
		}
	}, []);

	const reconnect = useCallback(async () => {
		setStatusLoading(true);
		setError(null);
		try {
			const res = await fetch(`${API_BASE}/api/pipeline/mcp/reconnect`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			await fetchStatus();
		} catch (e: any) {
			setError(e?.message || "reconnect failed");
		} finally {
			setStatusLoading(false);
		}
	}, [fetchStatus]);

	useEffect(() => {
		fetchStatus();
		const id = setInterval(fetchStatus, 15000);
		return () => clearInterval(id);
	}, [fetchStatus]);

	// Listen for "open a specific tool" requests from the command palette.
	useEffect(() => {
		const handler = (e: Event) => {
			const name = (e as CustomEvent<string>).detail;
			const tool = findTool(name);
			if (tool) pickTool(tool);
		};
		const sessionHandler = () => {
			try {
				const name = sessionStorage.getItem("vs:openTool");
				if (name) {
					const tool = findTool(name);
					if (tool) pickTool(tool);
					sessionStorage.removeItem("vs:openTool");
				}
			} catch {
				/* ignore */
			}
		};
		window.addEventListener("vibeserve:openTool", handler as EventListener);
		sessionHandler();
		return () =>
			window.removeEventListener(
				"vibeserve:openTool",
				handler as EventListener,
			);
	}, [pickTool]);

	const pickTool = useCallback((tool: ToolEntry) => {
		setSelectedTool(tool);
		setArgs({ ...(tool.example || {}) });
		setResult(undefined);
		setError(null);
	}, []);

	const runTool = useCallback(async () => {
		if (!selectedTool) return;
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`${API_BASE}/api/pipeline/mcp/tools/call`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tool: selectedTool.name, args }),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(data?.error || `HTTP ${res.status}`);
				setResult(data);
			} else {
				setResult(data);
			}
		} catch (e: any) {
			setError(e?.message || "Network error");
		} finally {
			setLoading(false);
		}
	}, [selectedTool, args]);

	return (
		<div
			className="flex flex-col h-full overflow-hidden"
			style={{ background: "var(--bg-secondary)" }}
		>
			{/* Header */}
			<div
				className="px-3 py-2 border-b"
				style={{ borderColor: "var(--border)" }}
			>
				<div className="flex items-center justify-between">
					<span
						className="text-xs font-semibold uppercase tracking-wider"
						style={{ color: "var(--text-muted)" }}
					>
						VibeServe Tools
					</span>
					<button
						onClick={reconnect}
						disabled={statusLoading}
						title="Refresh connection"
						className="opacity-60 hover:opacity-100 disabled:opacity-30"
						style={{ color: "var(--text-muted)" }}
					>
						<Icons.Refresh />
					</button>
				</div>
				<div
					className="mt-1.5 flex items-center gap-2 text-xxs"
					style={{ color: "var(--text-muted)" }}
				>
					<span
						className="inline-block w-2 h-2 rounded-full"
						style={{
							background: status?.connected
								? "var(--success, #a6e3a1)"
								: "var(--error, #f38ba8)",
						}}
						title={status?.connected ? "MCP connected" : "MCP disconnected"}
					/>
					{status?.connected ? (
						<span>Connected · {status.liveToolCount ?? "?"} live tools</span>
					) : status === null ? (
						<span>Checking…</span>
					) : (
						<span title={status.error || ""}>
							Disconnected — Python MCP offline
						</span>
					)}
				</div>
				{status && (
					<div
						className="mt-0.5 text-xxs opacity-50"
						style={{ color: "var(--text-muted)" }}
					>
						{status.staticToolCount} tools registered · {status.serverName} v
						{status.version}
						{status.latencyMs !== null && ` · ${status.latencyMs}ms`}
					</div>
				)}
			</div>

			{selectedTool ? (
				<ToolDetail
					tool={selectedTool}
					args={args}
					setArgs={setArgs}
					result={result}
					loading={loading}
					error={error}
					onRun={runTool}
					onBack={() => {
						setSelectedTool(null);
						setResult(undefined);
						setError(null);
					}}
					onReconnect={reconnect}
				/>
			) : (
				<ToolBrowser
					categories={categories}
					activeCategory={activeCategory}
					setActiveCategory={setActiveCategory}
					query={query}
					setQuery={setQuery}
					tools={filtered}
					onPick={pickTool}
				/>
			)}
		</div>
	);
}

function ToolBrowser({
	categories,
	activeCategory,
	setActiveCategory,
	query,
	setQuery,
	tools,
	onPick,
}: {
	categories: string[];
	activeCategory: string | null;
	setActiveCategory: (c: string | null) => void;
	query: string;
	setQuery: (q: string) => void;
	tools: ToolEntry[];
	onPick: (t: ToolEntry) => void;
}) {
	const grouped = useMemo(() => {
		const g: Record<string, ToolEntry[]> = {};
		for (const t of tools) {
			(g[t.category] ||= []).push(t);
		}
		return g;
	}, [tools]);

	return (
		<>
			<div
				className="px-3 py-2 border-b"
				style={{ borderColor: "var(--border)" }}
			>
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search tools (e.g., 'vibe', 'github', 'run')"
					className="w-full text-xs px-2 py-1.5 rounded border focus:outline-none"
					style={{
						background: "var(--bg-primary)",
						color: "var(--text-primary)",
						borderColor: "var(--border)",
					}}
				/>
			</div>
			<div
				className="px-3 py-2 border-b flex flex-wrap gap-1"
				style={{ borderColor: "var(--border)" }}
			>
				<button
					onClick={() => setActiveCategory(null)}
					className="text-xxs px-1.5 py-0.5 rounded"
					style={{
						background: !activeCategory ? "var(--accent)" : "transparent",
						color: !activeCategory ? "var(--bg-primary)" : "var(--text-muted)",
						border: "1px solid var(--border)",
					}}
				>
					All
				</button>
				{categories.map((c) => (
					<button
						key={c}
						onClick={() => setActiveCategory(c)}
						className="text-xxs px-1.5 py-0.5 rounded"
						style={{
							background:
								activeCategory === c ? "var(--accent)" : "transparent",
							color:
								activeCategory === c
									? "var(--bg-primary)"
									: "var(--text-muted)",
							border: "1px solid var(--border)",
						}}
					>
						{c}
					</button>
				))}
			</div>
			<div className="flex-1 overflow-y-auto">
				{Object.keys(grouped).length === 0 && (
					<div
						className="px-3 py-4 text-xxs"
						style={{ color: "var(--text-muted)" }}
					>
						No tools match your filter.
					</div>
				)}
				{Object.entries(grouped).map(([cat, items]) => (
					<div
						key={cat}
						className="border-b"
						style={{ borderColor: "var(--border)" }}
					>
						<div
							className="px-3 py-1.5 text-xxs font-semibold uppercase tracking-wider"
							style={{ color: "var(--text-muted)" }}
						>
							{cat} ({items.length})
						</div>
						{items.map((t) => (
							<button
								key={t.name}
								onClick={() => onPick(t)}
								className="w-full text-left px-3 py-1.5 flex items-start gap-2 hover:bg-white/5"
							>
								<span
									className="inline-block w-1.5 h-1.5 rounded-full mt-1 shrink-0"
									style={{
										background: SCOPE_COLORS[t.scope] || "var(--text-muted)",
									}}
									title={t.scope}
								/>
								<div className="flex-1 min-w-0">
									<div
										className="text-xs font-medium truncate"
										style={{ color: "var(--text-primary)" }}
									>
										{t.title}
										{t.isQuickAction && (
											<span className="ml-1 text-xxs opacity-50">★</span>
										)}
									</div>
									<div
										className="text-xxs opacity-60 truncate"
										style={{ color: "var(--text-muted)" }}
									>
										{t.name}
									</div>
								</div>
							</button>
						))}
					</div>
				))}
			</div>
		</>
	);
}

function ToolDetail({
	tool,
	args,
	setArgs,
	result,
	loading,
	error,
	onRun,
	onBack,
	onReconnect,
}: {
	tool: ToolEntry;
	args: Record<string, unknown>;
	setArgs: (a: Record<string, unknown>) => void;
	result: unknown;
	loading: boolean;
	error: string | null;
	onRun: () => void;
	onBack: () => void;
	onReconnect: () => void;
}) {
	const missing = useMemo(
		() =>
			tool.args
				.filter(
					(a) =>
						a.required &&
						(args[a.name] === undefined ||
							args[a.name] === "" ||
							args[a.name] === null),
				)
				.map((a) => a.name),
		[tool, args],
	);

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div
				className="px-3 py-2 border-b flex items-center gap-2"
				style={{ borderColor: "var(--border)" }}
			>
				<button
					onClick={onBack}
					className="text-xxs opacity-70 hover:opacity-100"
					style={{ color: "var(--text-muted)" }}
				>
					← Back
				</button>
				<div className="flex-1 min-w-0">
					<div
						className="text-xs font-semibold truncate"
						style={{ color: "var(--text-primary)" }}
					>
						{tool.title}
					</div>
					<div
						className="text-xxs opacity-60 truncate font-mono"
						style={{ color: "var(--text-muted)" }}
					>
						{tool.name}
					</div>
				</div>
				<span
					className="text-xxs px-1.5 py-0.5 rounded uppercase"
					style={{
						background: SCOPE_COLORS[tool.scope] || "var(--text-muted)",
						color: "var(--bg-primary)",
					}}
				>
					{tool.scope}
				</span>
			</div>

			<div
				className="px-3 py-2 border-b text-xxs"
				style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
			>
				{tool.description}
			</div>

			<div className="flex-1 overflow-y-auto">
				<ToolInvokeForm
					tool={tool}
					value={args}
					onChange={setArgs}
					disabled={loading}
				/>
				<div className="px-3 pb-3">
					<button
						onClick={onRun}
						disabled={loading || missing.length > 0}
						className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium disabled:opacity-40"
						style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
					>
						<Icons.Play />
						{loading
							? "Running…"
							: missing.length > 0
								? `Fill ${missing.length} required`
								: "Run"}
					</button>
				</div>
				{loading || result !== undefined || error ? (
					<div className="border-t" style={{ borderColor: "var(--border)" }}>
						<ToolResult
							result={result}
							kind={tool.resultKind}
							loading={loading}
							error={error}
							onReconnect={onReconnect}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}

// Re-export for the global command palette / modals
export { findTool };
