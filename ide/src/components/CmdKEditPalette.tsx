import {
	Copy,
	Eye,
	HelpCircle,
	Loader,
	Sparkles,
	Wand2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAIStore } from "../stores/useAIStore";

interface CmdKEditPaletteProps {
	open: boolean;
	onClose: () => void;
	selectedText: string;
	language: string;
	fileName: string;
	onApply: (newText: string) => void;
	onExplain?: (explanation: string) => void;
}

interface Suggestion {
	label: string;
	prompt: string;
	icon: typeof Wand2;
}

const QUICK_SUGGESTIONS: Suggestion[] = [
	{
		label: "Refactor",
		prompt: "Refactor this code for clarity and maintainability",
		icon: Wand2,
	},
	{
		label: "Add comments",
		prompt: "Add clear JSDoc comments to this code",
		icon: Wand2,
	},
	{
		label: "Add types",
		prompt: "Add explicit TypeScript types to this code",
		icon: Wand2,
	},
	{
		label: "Add tests",
		prompt: "Generate unit tests for this code",
		icon: Wand2,
	},
	{
		label: "Find bugs",
		prompt: "Find and fix any bugs in this code",
		icon: Wand2,
	},
	{
		label: "Optimize",
		prompt: "Optimize this code for performance",
		icon: Wand2,
	},
	{
		label: "Explain",
		prompt: "Explain what this code does in plain English",
		icon: HelpCircle,
	},
	{
		label: "Add error handling",
		prompt: "Add comprehensive error handling",
		icon: Wand2,
	},
];

export function CmdKEditPalette({
	open,
	onClose,
	selectedText,
	language,
	fileName,
	onApply,
	onExplain,
}: CmdKEditPaletteProps) {
	const [instruction, setInstruction] = useState("");
	const [busy, setBusy] = useState(false);
	const [preview, setPreview] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [history, setHistory] = useState<
		{ instruction: string; preview: string }[]
	>([]);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const { selectedProvider, selectedModel } = useAIStore();

	useEffect(() => {
		if (open) {
			setInstruction("");
			setPreview(null);
			setError(null);
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [open]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!open) return;
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	const runEdit = useCallback(
		async (promptOverride?: string) => {
			const prompt = (promptOverride ?? instruction).trim();
			if (!prompt) return;
			setBusy(true);
			setError(null);
			setPreview(null);
			try {
				const res = await fetch("/api/ai/edit", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						instruction: prompt,
						code: selectedText,
						language,
						fileName,
						provider: selectedProvider,
						model: selectedModel,
					}),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				const newCode = data?.result ?? data?.content ?? data?.response ?? "";
				if (!newCode) throw new Error("Empty response from AI");
				if (promptOverride === QUICK_SUGGESTIONS[6].prompt) {
					onExplain?.(newCode);
					onClose();
					return;
				}
				setPreview(newCode);
				setHistory((h) =>
					[{ instruction: prompt, preview: newCode }, ...h].slice(0, 5),
				);
			} catch (e: any) {
				setError(e?.message || "Edit failed");
			} finally {
				setBusy(false);
			}
		},
		[
			instruction,
			selectedText,
			language,
			fileName,
			selectedProvider,
			selectedModel,
			onExplain,
			onClose,
		],
	);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] backdrop-blur-sm"
			style={{ background: "rgba(0,0,0,0.5)" }}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className="w-[640px] max-w-[90vw] max-h-[80vh] flex flex-col rounded-xl shadow-2xl overflow-hidden"
				style={{
					background: "var(--bg-primary)",
					border: "1px solid var(--border)",
				}}
			>
				{/* Header */}
				<div
					className="flex items-center gap-2 px-4 py-3"
					style={{ borderBottom: "1px solid var(--border)" }}
				>
					<Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
					<span
						className="text-sm font-medium flex-1"
						style={{ color: "var(--text-primary)" }}
					>
						Edit selection with AI
					</span>
					<span
						className="text-[10px] px-2 py-0.5 rounded font-mono"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-muted)",
						}}
					>
						{selectedProvider}/{selectedModel}
					</span>
					<button
						onClick={onClose}
						className="p-1 rounded hover:opacity-80"
						style={{ color: "var(--text-muted)" }}
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Selection context */}
				<div
					className="px-4 py-2 text-[10px] flex items-center justify-between"
					style={{
						background: "var(--bg-secondary)",
						color: "var(--text-muted)",
					}}
				>
					<span>
						{fileName} · {language} · {selectedText.length} chars ·{" "}
						{selectedText.split("\n").length} lines
					</span>
				</div>
				<pre
					className="px-4 py-2 text-[11px] font-mono overflow-x-auto"
					style={{
						background: "var(--bg-secondary)",
						color: "var(--text-primary)",
						maxHeight: "120px",
						borderBottom: "1px solid var(--border)",
					}}
				>
					{selectedText.slice(0, 500)}
					{selectedText.length > 500 ? "…" : ""}
				</pre>

				{/* Input */}
				<div className="p-4">
					<textarea
						ref={inputRef}
						value={instruction}
						onChange={(e) => setInstruction(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								runEdit();
							}
						}}
						placeholder="Describe the change… (Cmd+Enter to run)"
						rows={2}
						className="w-full p-2 rounded text-sm resize-none"
						style={{
							background: "var(--bg-surface)",
							color: "var(--text-primary)",
							border: "1px solid var(--border)",
						}}
					/>
					<div className="flex flex-wrap gap-1.5 mt-2">
						{QUICK_SUGGESTIONS.map((s) => {
							const Icon = s.icon;
							return (
								<button
									key={s.label}
									onClick={() => runEdit(s.prompt)}
									disabled={busy}
									className="flex items-center gap-1 px-2 py-1 text-[10px] rounded disabled:opacity-50"
									style={{
										background: "var(--bg-tertiary)",
										color: "var(--text-primary)",
									}}
								>
									<Icon className="w-2.5 h-2.5" />
									{s.label}
								</button>
							);
						})}
					</div>
				</div>

				{/* Preview / Error */}
				{(busy || preview || error) && (
					<div
						className="flex-1 min-h-0 flex flex-col"
						style={{ borderTop: "1px solid var(--border)" }}
					>
						{busy && (
							<div
								className="flex items-center gap-2 px-4 py-3 text-xs"
								style={{ color: "var(--text-muted)" }}
							>
								<Loader className="w-3 h-3 animate-spin" />
								Editing…
							</div>
						)}
						{error && (
							<div className="px-4 py-3 text-xs" style={{ color: "#f85149" }}>
								{error}
							</div>
						)}
						{preview && !busy && (
							<>
								<div
									className="px-4 py-2 text-[10px] flex items-center justify-between"
									style={{
										background: "var(--bg-secondary)",
										color: "var(--text-muted)",
									}}
								>
									<span>Preview · apply or copy</span>
									<div className="flex gap-1">
										<button
											onClick={() => navigator.clipboard.writeText(preview)}
											className="flex items-center gap-1 px-2 py-0.5 rounded hover:opacity-80"
											style={{ color: "var(--text-muted)" }}
										>
											<Copy className="w-3 h-3" /> Copy
										</button>
									</div>
								</div>
								<pre
									className="flex-1 px-4 py-2 text-[11px] font-mono overflow-auto"
									style={{
										background: "var(--bg-secondary)",
										color: "var(--text-primary)",
									}}
								>
									{preview}
								</pre>
								<div
									className="p-3 flex gap-2"
									style={{ borderTop: "1px solid var(--border)" }}
								>
									<button
										onClick={() => {
											onApply(preview);
											onClose();
										}}
										className="flex-1 px-3 py-1.5 rounded text-xs font-medium"
										style={{
											background: "var(--accent)",
											color: "var(--text-on-accent)",
										}}
									>
										Apply to selection
									</button>
									<button
										onClick={onClose}
										className="px-3 py-1.5 rounded text-xs"
										style={{
											background: "var(--bg-tertiary)",
											color: "var(--text-muted)",
										}}
									>
										Cancel
									</button>
								</div>
							</>
						)}
					</div>
				)}

				{/* History */}
				{history.length > 0 && !preview && !busy && (
					<div
						className="px-4 pb-3"
						style={{ borderTop: "1px solid var(--border)" }}
					>
						<div
							className="text-[10px] font-semibold uppercase mt-2 mb-1"
							style={{ color: "var(--text-muted)" }}
						>
							Recent edits
						</div>
						{history.map((h, i) => (
							<button
								key={i}
								onClick={() => setPreview(h.preview)}
								className="block w-full text-left px-2 py-1 text-[11px] rounded hover:opacity-80 truncate"
								style={{ color: "var(--text-primary)" }}
							>
								{h.instruction}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
