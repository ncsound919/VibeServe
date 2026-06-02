import { useCallback, useEffect, useState } from "react";
import { useIDEStore } from "../stores/useIDEStore";

interface SearchResult {
	file: string;
	line: number;
	column: number;
	content: string;
}

interface FileResult {
	name: string;
	path: string;
	type: string;
}

export function SearchPanel() {
	const [query, setQuery] = useState("");
	const [mode, setMode] = useState<"files" | "content">("files");
	const [results, setResults] = useState<(SearchResult | FileResult)[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { openFile } = useIDEStore();

	const search = useCallback(async () => {
		if (!query.trim()) {
			setResults([]);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			if (mode === "files") {
				const res = await fetch(
					`/api/search/files?q=${encodeURIComponent(query)}`,
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				setResults(await res.json());
			} else {
				const res = await fetch(
					`/api/search/content?q=${encodeURIComponent(query)}`,
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				setResults(await res.json());
			}
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}, [query, mode]);

	useEffect(() => {
		const timer = setTimeout(search, 300);
		return () => clearTimeout(timer);
	}, [search]);

	const handleResultClick = (result: SearchResult | FileResult) => {
		if ("line" in result) {
			const ext = result.file.split(".").pop() || "plaintext";
			const name = result.file.split("/").pop() || result.file;
			openFile(result.file, name, ext);
		} else {
			const ext = result.path.split(".").pop() || "plaintext";
			openFile(result.path, result.name, ext);
		}
	};

	return (
		<div className="flex flex-col h-full">
			<div
				className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
				style={{ color: "var(--text-muted)" }}
			>
				Search
			</div>

			<div className="px-3 py-2 space-y-2">
				<div className="flex gap-2">
					<button
						onClick={() => setMode("files")}
						className="flex-1 text-[11px] py-1 rounded font-medium"
						style={{
							background:
								mode === "files" ? "var(--accent)" : "var(--bg-tertiary)",
							color:
								mode === "files"
									? "var(--text-on-accent)"
									: "var(--text-muted)",
						}}
					>
						Files
					</button>
					<button
						onClick={() => setMode("content")}
						className="flex-1 text-[11px] py-1 rounded font-medium"
						style={{
							background:
								mode === "content" ? "var(--accent)" : "var(--bg-tertiary)",
							color:
								mode === "content"
									? "var(--text-on-accent)"
									: "var(--text-muted)",
						}}
					>
						Content
					</button>
				</div>
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={
						mode === "files"
							? "Search files by name..."
							: "Search file contents..."
					}
					autoFocus
					className="w-full px-3 py-1.5 rounded text-xs"
					style={{
						background: "var(--bg-surface)",
						color: "var(--text-primary)",
						border: "1px solid var(--border)",
						outlineColor: "var(--accent)",
					}}
				/>
			</div>

			<div className="flex-1 overflow-y-auto px-3">
				{loading && (
					<div
						className="py-4 text-xs text-center"
						style={{ color: "var(--text-muted)" }}
					>
						Searching...
					</div>
				)}
				{error && (
					<div
						className="py-4 text-xs text-center"
						style={{ color: "var(--error)" }}
					>
						{error}
					</div>
				)}
				{!loading && !error && results.length === 0 && query.trim() && (
					<div
						className="py-4 text-xs text-center"
						style={{ color: "var(--text-muted)" }}
					>
						No results found
					</div>
				)}
				{results.map((r, i) => (
					<div
						key={i}
						tabIndex={0}
						role="option"
						onClick={() => handleResultClick(r)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleResultClick(r);
						}}
						className="py-1.5 text-xs cursor-pointer hover:opacity-80"
						style={{ borderBottom: "1px solid var(--border)" }}
					>
						{"line" in r ? (
							<>
								<div
									className="font-mono text-[11px]"
									style={{ color: "var(--accent)" }}
								>
									{r.file}:{r.line}:{r.column}
								</div>
								<div
									className="truncate mt-0.5"
									style={{ color: "var(--text-secondary)" }}
								>
									{r.content.trim()}
								</div>
							</>
						) : (
							<div className="flex items-center gap-2">
								<span>📄</span>
								<span>{r.path}</span>
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
