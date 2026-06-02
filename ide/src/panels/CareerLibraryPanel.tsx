import { useCallback, useEffect, useState } from "react";

interface Symbol {
	name: string;
	kind: string;
	file_path: string;
	repo_key: string;
	line: number;
	exported: boolean;
}

interface SearchResult {
	query: string;
	count: number;
	results: Symbol[];
}

export function CareerLibraryPanel() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const apiBase =
		window.location.port === "3000" ? "http://localhost:3002" : "";

	const search = useCallback(
		async (q: string) => {
			if (!q.trim()) {
				setResults(null);
				return;
			}
			setLoading(true);
			setError(null);
			try {
				const res = await fetch(`${apiBase}/api/pipeline/mcp_call`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ tool: "search_repo", args: { query: q } }),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				setResults(data.error ? null : data.result || data);
			} catch (err: any) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		},
		[apiBase],
	);

	const kindColors: Record<string, string> = {
		component: "#cba6f7",
		hook: "#fab387",
		function: "#89b4fa",
		class: "#a6e3a1",
		interface: "#f9e2af",
		export: "#89dceb",
		type: "#b4befe",
	};

	return (
		<div
			className="flex flex-col h-full overflow-hidden"
			style={{ backgroundColor: "var(--bg-secondary, #1e1e2e)" }}
		>
			<div
				className="px-3 py-2 border-b"
				style={{ borderColor: "var(--border, #313244)" }}
			>
				<span
					className="text-xs font-semibold uppercase tracking-wider"
					style={{ color: "var(--text-muted, #6c7086)" }}
				>
					Career Library
				</span>
				<div
					className="text-xxs mt-0.5"
					style={{ color: "var(--text-muted, #6c7086)" }}
				>
					Search components, hooks, and utils across all your repos
				</div>
			</div>

			<div
				className="px-3 py-2 border-b"
				style={{ borderColor: "var(--border, #313244)" }}
			>
				<input
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						search(e.target.value);
					}}
					placeholder="Search symbols (e.g., 'Button', 'useAuth', 'formatDate')..."
					className="w-full text-xs px-2 py-1.5 rounded border focus:outline-none"
					style={{
						backgroundColor: "var(--bg-primary, #1e1e2e)",
						color: "var(--text-primary, #cdd6f4)",
						borderColor: "var(--border, #313244)",
					}}
				/>
			</div>

			<div className="flex-1 overflow-y-auto px-3 py-2">
				{error && (
					<div
						className="text-xs mb-2 p-2 rounded"
						style={{
							color: "var(--error, #f38ba8)",
							backgroundColor: "var(--bg-tertiary, #313244)",
						}}
					>
						{error}
					</div>
				)}
				{loading && (
					<div
						className="text-xs"
						style={{ color: "var(--text-muted, #6c7086)" }}
					>
						Searching across all indexed repos...
					</div>
				)}
				{!query && !results && (
					<div
						className="text-xs py-4 text-center"
						style={{ color: "var(--text-muted, #6c7086)" }}
					>
						Type above to find reusable code across your repos.
						<br />
						<span className="mt-1 block">
							Start with a component name, function, or hook.
						</span>
					</div>
				)}
				{results && results.results.length === 0 && query && (
					<div
						className="text-xs py-4 text-center"
						style={{ color: "var(--text-muted, #6c7086)" }}
					>
						No symbols found for "{query}".
						<br />
						<span className="mt-1 block">
							Try indexing more repos or searching with a different term.
						</span>
					</div>
				)}
				{results && results.results.length > 0 && (
					<div className="space-y-1.5">
						<div
							className="text-xxs mb-2"
							style={{ color: "var(--text-muted, #6c7086)" }}
						>
							{results.count} results for "{results.query}"
						</div>
						{results.results.map((s, i) => (
							<div
								key={i}
								className="p-2 rounded cursor-pointer hover:brightness-110 transition-colors"
								style={{ backgroundColor: "var(--bg-tertiary, #313244)" }}
							>
								<div className="flex items-center justify-between">
									<span
										className="text-xs font-medium"
										style={{ color: "var(--text-primary, #cdd6f4)" }}
									>
										{s.name}
									</span>
									<span
										className="text-xxs px-1.5 py-0.5 rounded"
										style={{
											backgroundColor: (kindColors[s.kind] || "#6c7086") + "22",
											color: kindColors[s.kind] || "#6c7086",
										}}
									>
										{s.kind}
									</span>
								</div>
								<div
									className="text-xxs mt-1 flex items-center gap-2"
									style={{ color: "var(--text-muted, #6c7086)" }}
								>
									<span style={{ color: "var(--accent, #89b4fa)" }}>
										{s.repo_key}
									</span>
									<span>
										{s.file_path}:{s.line}
									</span>
									{s.exported && (
										<span
											className="px-1 py-0.5 rounded"
											style={{
												backgroundColor: "var(--bg-primary, #1e1e2e)",
												fontSize: "0.6rem",
											}}
										>
											exported
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
