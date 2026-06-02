import { Copy, HelpCircle, Loader, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAIStore } from "../stores/useAIStore";

interface ExplainCodePanelProps {
	open: boolean;
	onClose: () => void;
	code: string;
	language: string;
	fileName: string;
}

export function ExplainCodePanel({
	open,
	onClose,
	code,
	language,
	fileName,
}: ExplainCodePanelProps) {
	const [explanation, setExplanation] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const { selectedProvider, selectedModel } = useAIStore();

	useEffect(() => {
		if (!open) return;
		setBusy(true);
		setError(null);
		setExplanation(null);
		const ctrl = new AbortController();
		abortRef.current = ctrl;
		(async () => {
			try {
				const res = await fetch("/api/ai/explain", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					signal: ctrl.signal,
					body: JSON.stringify({
						code,
						language,
						fileName,
						provider: selectedProvider,
						model: selectedModel,
					}),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				setExplanation(data?.explanation ?? data?.response ?? "");
			} catch (e: any) {
				if (e?.name !== "AbortError")
					setError(e?.message || "Failed to fetch explanation");
			} finally {
				setBusy(false);
			}
		})();
		return () => ctrl.abort();
	}, [open, code, language, fileName, selectedProvider, selectedModel]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
			style={{ background: "rgba(0,0,0,0.5)" }}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className="w-[640px] max-w-full max-h-[80vh] flex flex-col rounded-xl shadow-2xl overflow-hidden"
				style={{
					background: "var(--bg-primary)",
					border: "1px solid var(--border)",
				}}
			>
				<div
					className="flex items-center gap-2 px-4 py-3"
					style={{ borderBottom: "1px solid var(--border)" }}
				>
					<HelpCircle className="w-4 h-4" style={{ color: "var(--accent)" }} />
					<span
						className="text-sm font-medium flex-1"
						style={{ color: "var(--text-primary)" }}
					>
						Explain · {fileName}
					</span>
					<span
						className="text-[10px] px-2 py-0.5 rounded font-mono"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-muted)",
						}}
					>
						{language} · {code.length} chars
					</span>
					{explanation && (
						<button
							onClick={() => navigator.clipboard.writeText(explanation)}
							className="p-1 rounded hover:opacity-80"
							style={{ color: "var(--text-muted)" }}
							title="Copy"
						>
							<Copy className="w-3.5 h-3.5" />
						</button>
					)}
					<button
						onClick={onClose}
						className="p-1 rounded hover:opacity-80"
						style={{ color: "var(--text-muted)" }}
					>
						<X className="w-4 h-4" />
					</button>
				</div>
				<pre
					className="px-4 py-2 text-[10px] font-mono overflow-x-auto"
					style={{
						background: "var(--bg-secondary)",
						color: "var(--text-muted)",
						maxHeight: "120px",
						borderBottom: "1px solid var(--border)",
					}}
				>
					{code.slice(0, 400)}
					{code.length > 400 ? "…" : ""}
				</pre>
				<div className="flex-1 overflow-auto p-4">
					{busy && (
						<div
							className="flex items-center gap-2 text-xs"
							style={{ color: "var(--text-muted)" }}
						>
							<Loader className="w-3 h-3 animate-spin" />
							Analyzing code…
						</div>
					)}
					{error && (
						<div className="text-xs" style={{ color: "#f85149" }}>
							{error}
						</div>
					)}
					{explanation && !busy && (
						<div
							className="text-sm whitespace-pre-wrap"
							style={{ color: "var(--text-primary)" }}
						>
							{explanation}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
