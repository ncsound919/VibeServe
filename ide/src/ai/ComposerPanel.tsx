import {
	AtSign,
	BookOpen,
	Check,
	ChevronDown,
	Edit3,
	FileCode,
	HelpCircle,
	History,
	Link as LinkIcon,
	Loader,
	MessageSquare,
	Paperclip,
	Send,
	StopCircle,
	Trash2,
	Wrench,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	getModelsForProvider,
	getProviderInfo,
	LLM_PROVIDERS,
} from "../constants/llmProviders";
import {
	type ComposerMode,
	type ContextAttachment,
	type LLMProvider,
	type RunHistoryEntry,
	useAIStore,
} from "../stores/useAIStore";
import { useIDEStore } from "../stores/useIDEStore";

interface Mention {
	type: "file" | "symbol" | "docs";
	value: string;
	label: string;
}

const MODE_OPTIONS: {
	id: ComposerMode;
	label: string;
	icon: typeof Wrench;
	description: string;
}[] = [
	{
		id: "build",
		label: "Build",
		icon: Wrench,
		description: "Full multi-step pipeline",
	},
	{
		id: "edit",
		label: "Edit",
		icon: Edit3,
		description: "Targeted code modifications",
	},
	{
		id: "chat",
		label: "Chat",
		icon: MessageSquare,
		description: "Conversational, no code changes",
	},
	{
		id: "ask",
		label: "Ask",
		icon: HelpCircle,
		description: "Read-only, no file changes",
	},
];

export function ComposerPanel() {
	const {
		messages,
		addMessage,
		clearMessages,
		streamingContent,
		appendStreamingContent,
		clearStreamingContent,
		pendingDiff,
		setPendingDiff,
		applyPendingDiff,
		composerMode,
		setComposerMode,
		selectedProvider,
		setProvider,
		selectedModel,
		setModel,
		contextAttachments,
		addAttachment,
		removeAttachment,
		clearAttachments,
		runHistory,
		pushRunHistory,
		setActiveRunId,
	} = useAIStore();
	const { openFile } = useIDEStore();
	const [input, setInput] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [showMentions, setShowMentions] = useState(false);
	const [mentions, setMentions] = useState<Mention[]>([]);
	const [mentionIndex, setMentionIndex] = useState(0);
	const [showProviderMenu, setShowProviderMenu] = useState(false);
	const [showModelMenu, setShowModelMenu] = useState(false);
	const [showHistoryMenu, setShowHistoryMenu] = useState(false);
	const [showAttachMenu, setShowAttachMenu] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const providerMenuRef = useRef<HTMLDivElement>(null);
	const historyMenuRef = useRef<HTMLDivElement>(null);
	const attachMenuRef = useRef<HTMLDivElement>(null);

	const providerInfo = useMemo(
		() => getProviderInfo(selectedProvider),
		[selectedProvider],
	);
	const modelOptions = useMemo(
		() => getModelsForProvider(selectedProvider),
		[selectedProvider],
	);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, streamingContent]);

	useEffect(() => {
		const atMatches = input.match(/@(\w+)/g);
		if (atMatches) {
			const parsed = atMatches.map((m) => m.slice(1));
			const newMentions: Mention[] = parsed.map((v) => ({
				type: "file" as const,
				value: v,
				label: v,
			}));
			setMentions(newMentions);
		} else {
			setMentions([]);
		}
	}, [input]);

	useEffect(() => {
		const onClickAway = (e: MouseEvent) => {
			if (
				providerMenuRef.current &&
				!providerMenuRef.current.contains(e.target as Node)
			)
				setShowProviderMenu(false);
			if (
				historyMenuRef.current &&
				!historyMenuRef.current.contains(e.target as Node)
			)
				setShowHistoryMenu(false);
			if (
				attachMenuRef.current &&
				!attachMenuRef.current.contains(e.target as Node)
			) {
				setShowAttachMenu(false);
				setUrlInput("");
			}
		};
		document.addEventListener("mousedown", onClickAway);
		return () => document.removeEventListener("mousedown", onClickAway);
	}, []);

	const handleSend = async () => {
		if (!input.trim() || isProcessing) return;
		const userMsg = input.trim();
		const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		const startedAt = Date.now();
		addMessage({
			role: "user",
			content: userMsg,
			mode: composerMode,
			attachments: contextAttachments,
		});
		setInput("");
		clearAttachments();
		clearStreamingContent();
		setIsProcessing(true);
		setActiveRunId(runId);

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const ws = new WebSocket(`${protocol}//${window.location.host}/ws/ai`);
		wsRef.current = ws;

		ws.onopen = () => {
			ws.send(
				JSON.stringify({
					type: "prompt",
					content: userMsg,
					mode: composerMode,
					provider: selectedProvider,
					model: selectedModel,
					context: [...mentions, ...contextAttachments],
					runId,
				}),
			);
		};

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);
				if (msg.type === "chunk") {
					appendStreamingContent(msg.content);
				} else if (msg.type === "done") {
					const fullContent = useAIStore.getState().streamingContent;
					addMessage({ role: "assistant", content: fullContent });
					clearStreamingContent();
					ws.close();
				} else if (msg.type === "diff") {
					setPendingDiff({ path: msg.path, content: msg.content });
				} else if (msg.type === "step") {
					useAIStore.getState().updatePipelineStep(msg.stepId, msg.update);
				}
			} catch (e) {
				console.error("Failed to parse WS message:", e);
			}
		};

		ws.onerror = () => {
			addMessage({
				role: "assistant",
				content: "Connection error. Using fallback API.",
			});
			callFallbackAPI(userMsg);
		};

		ws.onclose = () => {
			setIsProcessing(false);
			pushRunHistory({
				id: runId,
				prompt: userMsg,
				mode: composerMode,
				provider: selectedProvider,
				model: selectedModel,
				status: "ok",
				startedAt,
				finishedAt: Date.now(),
			});
			setActiveRunId(null);
		};
	};

	const callFallbackAPI = async (msg: string) => {
		try {
			const res = await fetch("/api/ai/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: msg,
					mode: composerMode,
					provider: selectedProvider,
					model: selectedModel,
				}),
			});
			if (res.ok) {
				const data = await res.json();
				addMessage({ role: "assistant", content: data.response || "Done." });
			}
		} catch {
			addMessage({ role: "assistant", content: "AI backend unavailable." });
		} finally {
			setIsProcessing(false);
		}
	};

	const handleStop = () => {
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}
		setIsProcessing(false);
		clearStreamingContent();
	};

	const handleApply = async () => {
		const success = await applyPendingDiff();
		if (success) {
			const diff = useAIStore.getState().pendingDiff;
			if (diff) {
				addMessage({ role: "assistant", content: `✅ Applied: ${diff.path}` });
				const ext = diff.path.split(".").pop() || "txt";
				openFile(diff.path, diff.path.split("/").pop() || "file", ext);
			}
		}
	};

	const handleReject = () => {
		setPendingDiff(null);
		addMessage({ role: "assistant", content: "❌ Diff rejected." });
	};

	const insertMention = (mention: Mention) => {
		const atIndex = input.lastIndexOf("@");
		if (atIndex >= 0) setInput(input.slice(0, atIndex) + `@${mention.value} `);
		setShowMentions(false);
		inputRef.current?.focus();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey && !showMentions) {
			e.preventDefault();
			handleSend();
		} else if (showMentions && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
			e.preventDefault();
			setMentionIndex((i) =>
				e.key === "ArrowDown"
					? Math.min(i + 1, mentions.length - 1)
					: Math.max(i - 1, 0),
			);
		} else if (showMentions && e.key === "Enter" && mentions[mentionIndex]) {
			e.preventDefault();
			insertMention(mentions[mentionIndex]);
		} else if (e.key === "Escape") {
			setShowMentions(false);
			setShowProviderMenu(false);
			setShowModelMenu(false);
			setShowHistoryMenu(false);
			setShowAttachMenu(false);
		}
	};

	const handleAttachFile = () => {
		const inputEl = document.createElement("input");
		inputEl.type = "file";
		inputEl.onchange = () => {
			const f = inputEl.files?.[0];
			if (f) {
				const att: ContextAttachment = {
					id: `att_${Date.now()}`,
					kind: "file",
					value: f.name,
					label: f.name,
				};
				addAttachment(att);
			}
		};
		inputEl.click();
		setShowAttachMenu(false);
	};

	const handleAttachUrl = () => {
		if (!urlInput.trim()) return;
		const att: ContextAttachment = {
			id: `att_${Date.now()}`,
			kind: "url",
			value: urlInput.trim(),
			label: urlInput
				.trim()
				.replace(/^https?:\/\//, "")
				.slice(0, 30),
		};
		addAttachment(att);
		setUrlInput("");
		setShowAttachMenu(false);
	};

	const handleHistorySelect = (entry: RunHistoryEntry) => {
		setInput(entry.prompt);
		setComposerMode(entry.mode);
		setProvider(entry.provider);
		setModel(entry.model);
		setShowHistoryMenu(false);
		inputRef.current?.focus();
	};

	const currentModeMeta = MODE_OPTIONS.find((m) => m.id === composerMode)!;

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div
				className="flex items-center justify-between px-3 py-2"
				style={{ borderBottom: "1px solid var(--border)" }}
			>
				<div className="flex items-center gap-2">
					<currentModeMeta.icon
						className="w-3.5 h-3.5"
						style={{ color: "var(--accent)" }}
					/>
					<span
						className="text-xs font-medium"
						style={{ color: "var(--text-primary)" }}
					>
						Composer
					</span>
					<span
						className="text-[10px] px-1.5 py-0.5 rounded"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-muted)",
						}}
					>
						{currentModeMeta.label}
					</span>
				</div>
				<div className="flex gap-1.5">
					<button
						onClick={clearMessages}
						className="text-[11px] px-2 py-0.5 rounded hover:opacity-80"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-muted)",
						}}
					>
						Clear
					</button>
				</div>
			</div>

			{/* Mode + Provider/Model row */}
			<div
				className="flex items-center gap-1.5 px-3 py-1.5"
				style={{ borderBottom: "1px solid var(--border)" }}
			>
				<div
					className="flex rounded"
					style={{ background: "var(--bg-tertiary)" }}
				>
					{MODE_OPTIONS.map((m) => {
						const Icon = m.icon;
						const active = m.id === composerMode;
						return (
							<button
								key={m.id}
								onClick={() => setComposerMode(m.id)}
								className="flex items-center gap-1 px-2 py-1 text-[11px] rounded font-medium"
								style={{
									background: active ? "var(--accent)" : "transparent",
									color: active ? "var(--text-on-accent)" : "var(--text-muted)",
								}}
								title={m.description}
							>
								<Icon className="w-3 h-3" />
								{m.label}
							</button>
						);
					})}
				</div>

				<div ref={providerMenuRef} className="relative">
					<button
						onClick={() => {
							setShowProviderMenu((v) => !v);
							setShowModelMenu(false);
						}}
						className="flex items-center gap-1 px-2 py-1 text-[11px] rounded"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-primary)",
						}}
					>
						<span style={{ color: "var(--text-muted)" }}>Provider:</span>
						<span className="font-medium">{providerInfo.name}</span>
						<ChevronDown className="w-3 h-3" />
					</button>
					{showProviderMenu && (
						<div
							className="absolute top-full mt-1 left-0 z-50 w-44 rounded shadow-lg"
							style={{
								background: "var(--bg-surface)",
								border: "1px solid var(--border)",
							}}
						>
							{LLM_PROVIDERS.map((p) => (
								<button
									key={p.id}
									onClick={() => {
										setProvider(p.id);
										setModel(p.defaultModel);
										setShowProviderMenu(false);
									}}
									className="block w-full text-left px-3 py-1.5 text-[11px] hover:opacity-80"
									style={{
										background:
											p.id === selectedProvider
												? "var(--accent)"
												: "transparent",
										color:
											p.id === selectedProvider
												? "var(--text-on-accent)"
												: "var(--text-primary)",
									}}
								>
									{p.name}
								</button>
							))}
						</div>
					)}
				</div>

				<div className="relative">
					<button
						onClick={() => {
							setShowModelMenu((v) => !v);
							setShowProviderMenu(false);
						}}
						className="flex items-center gap-1 px-2 py-1 text-[11px] rounded max-w-[140px]"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-primary)",
						}}
						title={selectedModel}
					>
						<span style={{ color: "var(--text-muted)" }}>Model:</span>
						<span className="font-medium truncate">{selectedModel}</span>
						<ChevronDown className="w-3 h-3 shrink-0" />
					</button>
					{showModelMenu && (
						<div
							className="absolute top-full mt-1 left-0 z-50 w-56 rounded shadow-lg max-h-64 overflow-y-auto"
							style={{
								background: "var(--bg-surface)",
								border: "1px solid var(--border)",
							}}
						>
							{modelOptions.map((m) => (
								<button
									key={m}
									onClick={() => {
										setModel(m);
										setShowModelMenu(false);
									}}
									className="block w-full text-left px-3 py-1.5 text-[11px] hover:opacity-80 font-mono"
									style={{
										background:
											m === selectedModel ? "var(--accent)" : "transparent",
										color:
											m === selectedModel
												? "var(--text-on-accent)"
												: "var(--text-primary)",
									}}
								>
									{m}
								</button>
							))}
						</div>
					)}
				</div>

				<div ref={historyMenuRef} className="relative ml-auto">
					<button
						onClick={() => setShowHistoryMenu((v) => !v)}
						className="flex items-center gap-1 px-2 py-1 text-[11px] rounded"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-muted)",
						}}
						title="Run history"
						disabled={runHistory.length === 0}
					>
						<History className="w-3 h-3" />
						{runHistory.length > 0 && <span>{runHistory.length}</span>}
					</button>
					{showHistoryMenu && runHistory.length > 0 && (
						<div
							className="absolute top-full mt-1 right-0 z-50 w-80 rounded shadow-lg max-h-80 overflow-y-auto"
							style={{
								background: "var(--bg-surface)",
								border: "1px solid var(--border)",
							}}
						>
							<div
								className="px-3 py-1.5 text-[10px] font-semibold uppercase flex items-center justify-between"
								style={{
									color: "var(--text-muted)",
									borderBottom: "1px solid var(--border)",
								}}
							>
								<span>Recent runs</span>
								<button
									onClick={() => {
										useAIStore.setState({ runHistory: [] });
										try {
											localStorage.removeItem("vs:runHistory");
										} catch {}
									}}
									className="text-[10px] hover:opacity-80 flex items-center gap-1"
									style={{ color: "var(--text-muted)" }}
								>
									<Trash2 className="w-3 h-3" /> Clear
								</button>
							</div>
							{runHistory.map((entry) => (
								<button
									key={entry.id}
									onClick={() => handleHistorySelect(entry)}
									className="block w-full text-left px-3 py-2 text-[11px] hover:opacity-80 border-b"
									style={{ borderColor: "var(--border)" }}
								>
									<div
										className="truncate font-medium"
										style={{ color: "var(--text-primary)" }}
									>
										{entry.prompt}
									</div>
									<div
										className="flex items-center gap-2 mt-0.5 text-[10px]"
										style={{ color: "var(--text-muted)" }}
									>
										<span>{entry.mode}</span>
										<span>·</span>
										<span>
											{entry.provider}/{entry.model}
										</span>
										<span>·</span>
										<span>
											{new Date(entry.startedAt).toLocaleTimeString()}
										</span>
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-3 space-y-3">
				{messages.length === 0 && streamingContent === "" && (
					<div
						className="text-xs mt-8 text-center"
						style={{ color: "var(--text-muted)" }}
					>
						<div className="mb-3">
							Describe what you want to {currentModeMeta.label.toLowerCase()}
						</div>
						<div className="flex gap-3 justify-center text-[11px] flex-wrap">
							<span
								className="flex items-center gap-1"
								style={{
									background: "var(--bg-tertiary)",
									padding: "2px 8px",
									borderRadius: "4px",
								}}
							>
								<AtSign
									className="w-3 h-3"
									style={{ color: "var(--accent)" }}
								/>
								Files
							</span>
							<span
								className="flex items-center gap-1"
								style={{
									background: "var(--bg-tertiary)",
									padding: "2px 8px",
									borderRadius: "4px",
								}}
							>
								<FileCode
									className="w-3 h-3"
									style={{ color: "var(--accent)" }}
								/>
								Symbols
							</span>
							<span
								className="flex items-center gap-1"
								style={{
									background: "var(--bg-tertiary)",
									padding: "2px 8px",
									borderRadius: "4px",
								}}
							>
								<BookOpen
									className="w-3 h-3"
									style={{ color: "var(--accent)" }}
								/>
								Docs
							</span>
							<span
								className="flex items-center gap-1"
								style={{
									background: "var(--bg-tertiary)",
									padding: "2px 8px",
									borderRadius: "4px",
								}}
							>
								<Paperclip
									className="w-3 h-3"
									style={{ color: "var(--accent)" }}
								/>
								Attach
							</span>
						</div>
					</div>
				)}

				{messages.map((m) => (
					<div
						key={m.id}
						className={`text-xs ${m.role === "user" ? "flex justify-end" : "flex justify-start"}`}
					>
						<div
							className="inline-block max-w-[85%] px-3 py-2 rounded-lg"
							style={{
								background:
									m.role === "user" ? "var(--accent)" : "var(--bg-tertiary)",
								color:
									m.role === "user"
										? "var(--text-on-accent)"
										: "var(--text-primary)",
								borderRadius:
									m.role === "user"
										? "12px 12px 2px 12px"
										: "12px 12px 12px 2px",
							}}
						>
							{m.mode && m.role === "user" && (
								<div className="text-[9px] opacity-70 mb-1 flex items-center gap-1">
									<currentModeMeta.icon className="w-2.5 h-2.5" />
									{m.mode}
								</div>
							)}
							<pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
						</div>
					</div>
				))}

				{streamingContent && (
					<div className="text-xs flex justify-start">
						<div
							className="inline-block max-w-[85%] px-3 py-2 rounded-lg"
							style={{
								background: "var(--bg-tertiary)",
								color: "var(--text-primary)",
								borderRadius: "12px 12px 12px 2px",
							}}
						>
							<pre className="whitespace-pre-wrap font-sans">
								{streamingContent}
								<span className="animate-pulse">▋</span>
							</pre>
						</div>
					</div>
				)}

				{pendingDiff && (
					<div
						className="flex gap-2 p-2 rounded-lg"
						style={{
							background: "var(--accent)",
							opacity: 0.1,
							border: "1px dashed var(--accent)",
						}}
					>
						<span
							className="text-xs flex-1"
							style={{ color: "var(--text-primary)" }}
						>
							Pending: {pendingDiff.path}
						</span>
						<button
							onClick={handleApply}
							className="p-1 rounded bg-green-600 text-white"
							title="Apply"
						>
							<Check className="w-4 h-4" />
						</button>
						<button
							onClick={handleReject}
							className="p-1 rounded bg-red-600 text-white"
							title="Reject"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				)}

				{isProcessing && (
					<div
						className="text-xs flex items-center gap-2"
						style={{ color: "var(--text-muted)" }}
					>
						<Loader className="w-3 h-3 animate-spin" />
						<span className="animate-pulse">
							Thinking in {currentModeMeta.label} mode…
						</span>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			{showMentions && mentions.length > 0 && (
				<div
					className="mx-3 mb-1 p-2 rounded-lg"
					style={{
						background: "var(--bg-surface)",
						border: "1px solid var(--border)",
					}}
				>
					{mentions.map((m, i) => (
						<button
							key={i}
							onClick={() => insertMention(m)}
							className={`block w-full text-left px-2 py-1 text-xs rounded ${i === mentionIndex ? "bg-[var(--accent)]/20" : ""}`}
							style={{ color: "var(--text-primary)" }}
						>
							{m.type === "file" && (
								<FileCode className="w-3 h-3 inline mr-1" />
							)}
							{m.type === "symbol" && (
								<AtSign className="w-3 h-3 inline mr-1" />
							)}
							{m.type === "docs" && (
								<BookOpen className="w-3 h-3 inline mr-1" />
							)}
							{m.label}
						</button>
					))}
				</div>
			)}

			{/* Attachment chips */}
			{contextAttachments.length > 0 && (
				<div
					className="px-3 pt-2 flex flex-wrap gap-1.5"
					style={{ borderTop: "1px solid var(--border)" }}
				>
					{contextAttachments.map((a) => (
						<span
							key={a.id}
							className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded"
							style={{
								background: "var(--bg-tertiary)",
								color: "var(--text-primary)",
							}}
						>
							{a.kind === "file" ? (
								<FileCode className="w-2.5 h-2.5" />
							) : (
								<LinkIcon className="w-2.5 h-2.5" />
							)}
							{a.label}
							<button
								onClick={() => removeAttachment(a.id)}
								className="hover:opacity-80"
							>
								<X className="w-2.5 h-2.5" />
							</button>
						</span>
					))}
				</div>
			)}

			{/* Input area */}
			<div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
				<div className="flex gap-1 mb-1.5">
					<div ref={attachMenuRef} className="relative">
						<button
							onClick={() => setShowAttachMenu((v) => !v)}
							className="p-1 rounded hover:opacity-80"
							style={{
								background: "var(--bg-tertiary)",
								color: "var(--text-muted)",
							}}
							title="Attach context"
						>
							<Paperclip className="w-3.5 h-3.5" />
						</button>
						{showAttachMenu && (
							<div
								className="absolute bottom-full mb-1 left-0 z-50 w-64 rounded shadow-lg p-2"
								style={{
									background: "var(--bg-surface)",
									border: "1px solid var(--border)",
								}}
							>
								<button
									onClick={handleAttachFile}
									className="block w-full text-left px-2 py-1.5 text-xs hover:opacity-80 rounded"
									style={{ color: "var(--text-primary)" }}
								>
									<FileCode className="w-3 h-3 inline mr-2" />
									Attach file…
								</button>
								<div
									className="px-2 py-1 text-[10px]"
									style={{ color: "var(--text-muted)" }}
								>
									OR PASTE A URL
								</div>
								<div className="flex gap-1 px-2">
									<input
										value={urlInput}
										onChange={(e) => setUrlInput(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleAttachUrl();
										}}
										placeholder="https://…"
										className="flex-1 px-2 py-1 text-[11px] rounded"
										style={{
											background: "var(--bg-tertiary)",
											color: "var(--text-primary)",
											border: "1px solid var(--border)",
										}}
									/>
									<button
										onClick={handleAttachUrl}
										className="px-2 py-1 text-[11px] rounded"
										style={{
											background: "var(--accent)",
											color: "var(--text-on-accent)",
										}}
									>
										Add
									</button>
								</div>
							</div>
						)}
					</div>
					<span
						className="text-[10px] self-center"
						style={{ color: "var(--text-muted)" }}
					>
						{currentModeMeta.description}
					</span>
				</div>

				<textarea
					ref={inputRef}
					value={input}
					onChange={(e) => {
						setInput(e.target.value);
						setShowMentions(e.target.value.includes("@"));
					}}
					onKeyDown={handleKeyDown}
					placeholder={`${currentModeMeta.label}: @ file.ts — describe what to ${currentModeMeta.label.toLowerCase()}`}
					rows={3}
					className="w-full p-2 rounded resize-none text-sm"
					style={{
						background: "var(--bg-surface)",
						color: "var(--text-primary)",
						border: "1px solid var(--border)",
						outlineColor: "var(--accent)",
						fontFamily: "var(--font-sans)",
					}}
				/>
				<div className="flex justify-between items-center mt-1">
					<span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
						@ files · @ symbols · @ docs · attach with 📎
					</span>
					<div className="flex gap-2">
						{isProcessing && (
							<button
								onClick={handleStop}
								className="flex items-center gap-1 px-2 py-1 rounded text-xs"
								style={{
									background: "var(--bg-tertiary)",
									color: "var(--text-muted)",
								}}
							>
								<StopCircle className="w-3 h-3" />
								Stop
							</button>
						)}
						<button
							onClick={handleSend}
							disabled={!input.trim() || isProcessing}
							className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium disabled:opacity-40"
							style={{
								background: "var(--accent)",
								color: "var(--text-on-accent)",
							}}
						>
							{isProcessing ? (
								<Loader className="w-3 h-3 animate-spin" />
							) : (
								<Send className="w-3 h-3" />
							)}
							{isProcessing ? "Running" : currentModeMeta.label}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
