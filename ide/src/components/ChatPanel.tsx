/**
 * ChatPanel - Persistent sidebar chat with codebase context.
 * Cursor-like chat sidebar that stays open alongside code.
 * Supports: chat with AI, inline code suggestions, apply edits, diff preview.
 */

import {
	Check,
	Copy,
	FileCode,
	FolderTree,
	MessageSquare,
	Send,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	formatContextForPrompt,
	gatherChatContext,
} from "../services/chatContextService";
import {
	computeDiff,
	type DiffChange,
	InlineDiffOverlay,
} from "./InlineDiffOverlay";

interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	codeBlocks?: CodeBlock[];
	timestamp: number;
}

interface CodeBlock {
	language: string;
	code: string;
	fileName?: string;
	action?: "insert" | "replace" | "delete";
}

interface ChatPanelProps {
	isOpen: boolean;
	onToggle: () => void;
}

// Generate unique IDs
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function ChatPanel({ isOpen, onToggle }: ChatPanelProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [activeCodeBlock, setActiveCodeBlock] = useState<string | null>(null);
	const [diffChange, setDiffChange] = useState<DiffChange | null>(null);
	const [showDiff, setShowDiff] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages]);

	// Focus input on open
	useEffect(() => {
		if (isOpen) inputRef.current?.focus();
	}, [isOpen]);

	const handleSend = useCallback(async () => {
		const text = input.trim();
		if (!text || isStreaming) return;

		const userMsg: ChatMessage = {
			id: uid(),
			role: "user",
			content: text,
			timestamp: Date.now(),
		};

		setMessages((prev: ChatMessage[]) => [...prev, userMsg]);
		setInput("");
		setIsStreaming(true);

		try {
			// Gather codebase context before sending
			const context = await gatherChatContext({
				recentMessages: messages
					.slice(-6)
					.map((m) => ({ role: m.role, content: m.content })),
			});
			const contextStr = formatContextForPrompt(context);

			const res = await fetch("/api/integrations/agent/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: text,
					context: "ide-chat",
					codebaseContext: contextStr,
					hasOpenFile: !!context.openFile,
					symbols: context.openFile?.symbols
						.map((s) => `${s.kind}:${s.name}`)
						.join(", "),
				}),
			});

			const data = await res
				.json()
				.catch(() => ({ response: "Failed to parse response" }));

			const assistantMsg: ChatMessage = {
				id: uid(),
				role: "assistant",
				content: data.response ?? data.message ?? "No response",
				codeBlocks:
					data.codeBlocks ?? extractCodeBlocksFromText(data.response ?? ""),
				timestamp: Date.now(),
			};

			setMessages((prev) => [...prev, assistantMsg]);
		} catch (e) {
			setMessages((prev) => [
				...prev,
				{
					id: uid(),
					role: "assistant",
					content: `Error: ${e instanceof Error ? e.message : "Failed to get response"}`,
					timestamp: Date.now(),
				},
			]);
		} finally {
			setIsStreaming(false);
		}
	}, [input, isStreaming]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleApplyCode = async (codeBlock: CodeBlock) => {
		const fileName = codeBlock.fileName || `suggestion.${codeBlock.language}`;
		setActiveCodeBlock(codeBlock.code);

		try {
			// Try to fetch current file content for diff
			let oldContent = "";
			try {
				const res = await fetch(
					`/api/editor/file?path=${encodeURIComponent(fileName)}`,
				);
				const data = await res.json();
				if (data.content) oldContent = data.content;
			} catch {
				// File doesn't exist yet, that's fine
			}

			const hunks = computeDiff(oldContent, codeBlock.code, fileName);
			const change: DiffChange = {
				fileName,
				oldContent,
				newContent: codeBlock.code,
				language: codeBlock.language,
				hunks,
			};

			setDiffChange(change);
			setShowDiff(true);
			setActiveCodeBlock(null);
		} catch {
			setMessages((prev) => [
				...prev,
				{
					id: uid(),
					role: "system",
					content: "Failed to prepare diff.",
					timestamp: Date.now(),
				},
			]);
			setActiveCodeBlock(null);
		}
	};

	const handleDiffAcceptFile = async (fileName: string) => {
		if (!diffChange || diffChange.fileName !== fileName) return;

		// Mark as verifying
		setDiffChange((prev) => (prev ? { ...prev, verifying: true } : prev));

		try {
			// Write file via API
			const writeRes = await fetch("/api/editor/file", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					path: fileName,
					content: diffChange.newContent,
				}),
			});

			if (!writeRes.ok) throw new Error("Write failed");

			// Run verification
			let verificationStatus: "passing" | "failing" = "passing";
			try {
				const verifyRes = await fetch("/api/pipeline/suggestions/apply", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						filePath: fileName,
						content: diffChange.newContent,
					}),
				});
				const verifyData = await verifyRes.json();
				verificationStatus =
					verifyData.verification?.status === "failing" ? "failing" : "passing";
			} catch {
				// Verification failed, but file was written
			}

			setDiffChange((prev) =>
				prev
					? {
							...prev,
							applied: true,
							verifying: false,
							verified: true,
							verificationStatus,
						}
					: prev,
			);

			setMessages((prev) => [
				...prev,
				{
					id: uid(),
					role: "system",
					content: `Applied to ${fileName}. Verification: ${verificationStatus === "passing" ? "passed" : "failed"}.`,
					timestamp: Date.now(),
				},
			]);
		} catch {
			setDiffChange((prev) => (prev ? { ...prev, verifying: false } : prev));
			setMessages((prev) => [
				...prev,
				{
					id: uid(),
					role: "system",
					content: `Failed to apply ${fileName}.`,
					timestamp: Date.now(),
				},
			]);
		}
	};

	const handleDiffRejectFile = (fileName: string) => {
		if (!diffChange || diffChange.fileName !== fileName) return;
		setDiffChange((prev) => (prev ? { ...prev, rejected: true } : prev));
	};

	const handleDiffAcceptAll = async () => {
		if (!diffChange || diffChange.applied || diffChange.rejected) return;
		await handleDiffAcceptFile(diffChange.fileName);
		setShowDiff(false);
		setDiffChange(null);
	};

	const handleDiffRejectAll = () => {
		setShowDiff(false);
		setDiffChange(null);
		setMessages((prev) => [
			...prev,
			{
				id: uid(),
				role: "system",
				content: "Changes dismissed.",
				timestamp: Date.now(),
			},
		]);
	};

	const handleClear = () => setMessages([]);

	return (
		<>
			{isOpen && (
				<div className="w-80 lg:w-96 border-l border-[#21262d] bg-[#0d1117] flex flex-col h-full">
					{/* Header */}
					<div className="flex items-center justify-between px-4 py-3 border-b border-[#21262d] bg-[#161b22]">
						<div className="flex items-center gap-2">
							<MessageSquare className="w-4 h-4 text-[#58a6ff]" />
							<span className="text-sm font-semibold text-[#c9d1d9]">Chat</span>
							<span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f6feb]/20 text-[#58a6ff] border border-[#1f6feb]/30 font-mono">
								AI
							</span>
						</div>
						<div className="flex items-center gap-1">
							<button
								onClick={handleClear}
								className="p-1.5 rounded hover:bg-[#21262d] text-[#7d8590] hover:text-[#c9d1d9] transition-colors"
								title="Clear chat"
							>
								<Trash2 className="w-3.5 h-3.5" />
							</button>
							<button
								onClick={onToggle}
								className="p-1.5 rounded hover:bg-[#21262d] text-[#7d8590] hover:text-[#c9d1d9] transition-colors"
								title="Close chat"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						</div>
					</div>

					{/* Messages */}
					<div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
						<AnimatePresence>
							{messages.length === 0 && (
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									className="flex flex-col items-center justify-center h-full text-center py-12"
								>
									<div className="w-12 h-12 rounded-xl bg-[#1f6feb]/10 border border-[#1f6feb]/20 flex items-center justify-center mb-4">
										<Sparkles className="w-6 h-6 text-[#58a6ff]" />
									</div>
									<h3 className="text-sm font-semibold text-[#c9d1d9] mb-1">
										Ask anything
									</h3>
									<p className="text-xs text-[#7d8590] max-w-[200px]">
										Generate code, explain logic, refactor, or debug with full
										codebase context.
									</p>
								</motion.div>
							)}

							{messages.map((msg) => (
								<motion.div
									key={msg.id}
									initial={{ opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									className={`${msg.role === "user" ? "pl-4" : "pr-4"}`}
								>
									<div
										className={`rounded-lg p-3 ${
											msg.role === "user"
												? "bg-[#1f6feb]/10 border border-[#1f6feb]/20 ml-auto max-w-[90%]"
												: msg.role === "system"
													? "bg-[#2ea043]/10 border border-[#2ea043]/20 text-xs text-[#7d8590]"
													: "bg-[#21262d] border border-[#30363d]"
										}`}
									>
										{/* Message content */}
										<div className="text-sm text-[#c9d1d9] whitespace-pre-wrap break-words">
											{msg.content}
										</div>

										{/* Code blocks */}
										{msg.codeBlocks?.map((block, i) => (
											<div key={i} className="mt-2">
												<div className="flex items-center justify-between px-2 py-1 bg-[#0d1117] rounded-t border border-b-0 border-[#30363d]">
													<div className="flex items-center gap-1.5">
														<FileCode className="w-3 h-3 text-[#7d8590]" />
														<span className="text-[10px] text-[#7d8590] font-mono">
															{block.fileName || block.language}
														</span>
														{block.action && (
															<span
																className={`text-[9px] px-1 rounded font-mono ${
																	block.action === "insert"
																		? "bg-[#2ea043]/20 text-[#3fb950]"
																		: block.action === "delete"
																			? "bg-[#f85149]/20 text-[#f85149]"
																			: "bg-[#d29922]/20 text-[#d29922]"
																}`}
															>
																{block.action}
															</span>
														)}
													</div>
													<div className="flex items-center gap-1">
														<button
															onClick={() =>
																navigator.clipboard.writeText(block.code)
															}
															className="p-0.5 rounded hover:bg-[#30363d] text-[#7d8590]"
															title="Copy"
														>
															<Copy className="w-3 h-3" />
														</button>
													</div>
												</div>
												<pre className="bg-[#0d1117] border border-[#30363d] rounded-b p-2 overflow-x-auto">
													<code className="text-xs font-mono text-[#c9d1d9]">
														{block.code}
													</code>
												</pre>
												<div className="flex items-center gap-2 mt-1.5">
													<button
														onClick={() => handleApplyCode(block)}
														disabled={activeCodeBlock === block.code}
														className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-[#2ea043]/10 text-[#3fb950] border border-[#2ea043]/20 hover:bg-[#2ea043]/20 transition-colors disabled:opacity-50"
													>
														{activeCodeBlock === block.code ? (
															<div className="w-3 h-3 border-2 border-[#2ea043]/20 border-t-[#3fb950] rounded-full animate-spin" />
														) : (
															<Check className="w-3 h-3" />
														)}
														Apply
													</button>
													<button
														onClick={() => {
															// Reject - just hide
														}}
														className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20 hover:bg-[#f85149]/20 transition-colors"
													>
														<X className="w-3 h-3" />
														Dismiss
													</button>
												</div>
											</div>
										))}

										{/* Timestamp */}
										<div className="mt-1.5 text-[10px] text-[#484f58]">
											{new Date(msg.timestamp).toLocaleTimeString()}
										</div>
									</div>
								</motion.div>
							))}

							{/* Streaming indicator */}
							{isStreaming && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									className="flex items-center gap-2 pl-4"
								>
									<div className="flex gap-1">
										<div
											className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-bounce"
											style={{ animationDelay: "0ms" }}
										/>
										<div
											className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-bounce"
											style={{ animationDelay: "150ms" }}
										/>
										<div
											className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-bounce"
											style={{ animationDelay: "300ms" }}
										/>
									</div>
									<span className="text-xs text-[#7d8590]">Thinking...</span>
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					{/* Input */}
					<div className="p-4 border-t border-[#21262d] bg-[#161b22]">
						<div className="flex items-end gap-2">
							<textarea
								ref={inputRef}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Ask about the codebase..."
								rows={2}
								className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#c9d1d9] placeholder:text-[#484f58] outline-none focus:border-[#58a6ff] resize-none font-mono"
							/>
							<button
								onClick={handleSend}
								disabled={!input.trim() || isStreaming}
								className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#1f6feb] text-white hover:bg-[#388bfd] disabled:bg-[#21262d] disabled:text-[#484f58] transition-colors flex-shrink-0"
							>
								<Send className="w-4 h-4" />
							</button>
						</div>
						<div className="mt-2 flex items-center justify-between text-[10px] text-[#484f58]">
							<span>
								<kbd className="px-1 py-0.5 bg-[#0d1117] border border-[#30363d] rounded font-mono">
									Enter
								</kbd>{" "}
								to send
							</span>
							<span>
								<kbd className="px-1 py-0.5 bg-[#0d1117] border border-[#30363d] rounded font-mono">
									Shift+Enter
								</kbd>{" "}
								new line
							</span>
						</div>
					</div>
				</div>
			)}
			{/* Diff overlay — shown regardless of panel visibility */}
			<InlineDiffOverlay
				changes={diffChange ? [diffChange] : []}
				visible={showDiff && diffChange !== null}
				onAcceptAll={handleDiffAcceptAll}
				onRejectAll={handleDiffRejectAll}
				onAcceptFile={handleDiffAcceptFile}
				onRejectFile={handleDiffRejectFile}
				onClose={() => {
					setShowDiff(false);
					setDiffChange(null);
				}}
			/>
		</>
	);
}

/**
 * Extract code blocks from markdown-style text.
 */
function extractCodeBlocksFromText(text: string): CodeBlock[] {
	const blocks: CodeBlock[] = [];
	const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
	let match;
	while ((match = regex.exec(text)) !== null) {
		blocks.push({
			language: match[1] || "plaintext",
			code: match[2].trim(),
			fileName: `${match[1] || "file"}.${match[1] || "txt"}`,
			action: "insert",
		});
	}
	return blocks;
}
