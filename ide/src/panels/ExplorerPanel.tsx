import {
	createFileTree,
	type FileTreeNode,
	type FileTree as FileTreeType,
	isDir,
	isFile,
	Node,
	useHotkeys,
	useObserver,
	useRovingFocus,
	useSelections,
	useTraits,
	useVirtualize,
	useVisibleNodes,
} from "exploration";
import {
	CheckSquare,
	ChevronDown,
	ChevronUp,
	FilePlus,
	FolderPlus,
	ListCollapse,
	ListTree,
	Plus,
	RefreshCw,
	Sparkles,
	Square,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type FileEntry, fileService } from "../services/fileService";
import { useAIStore } from "../stores/useAIStore";
import { useIDEStore } from "../stores/useIDEStore";

const ROOT = "";

type GitStatus = Record<string, { status: string; staged: boolean }>;

export function ExplorerPanel() {
	const windowRef = useRef<HTMLDivElement>(null);
	const [fileTree, setFileTree] = useState<FileTreeType<any> | null>(null);
	const [gitStatus, setGitStatus] = useState<GitStatus>({});
	const [aiFiles, setAiFiles] = useState<Set<string>>(new Set());
	const [contextSet, setContextSet] = useState<Set<string>>(new Set());
	const [refreshKey, setRefreshKey] = useState(0);

	const getNodes = useCallback(async (parent: any, factory: any) => {
		const dirPath = parent?.data?.meta?.path ?? ROOT;
		try {
			const entries = await fileService.listDir(dirPath);
			return entries
				.filter((e: FileEntry) => !e.name.startsWith(".") || e.name === ".git")
				.map((e: FileEntry) => {
					if (e.type === "directory") {
						return factory.createDir({
							name: e.name,
							meta: { path: e.path, type: e.type },
						});
					}
					return factory.createFile({
						name: e.name,
						meta: { path: e.path, type: e.type },
					});
				});
		} catch {
			return [];
		}
	}, []);

	useEffect(() => {
		const tree = createFileTree(getNodes);
		setFileTree(tree);
		return () => {
			tree.dispose();
		};
	}, [getNodes, refreshKey]);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const [gitRes, aiRes] = await Promise.all([
					fetch("/api/git/status"),
					fetch("/api/files/ai-generated"),
				]);
				if (mounted && gitRes.ok) {
					const data = await gitRes.json();
					setGitStatus(data.files || {});
				}
				if (mounted && aiRes.ok) {
					const data = await aiRes.json();
					setAiFiles(new Set(data.files || []));
				}
			} catch {
				/* offline */
			}
		})();
		const id = setInterval(() => setRefreshKey((k) => k + 1), 30000);
		return () => {
			mounted = false;
			clearInterval(id);
		};
	}, []);

	const toggleContext = (path: string) => {
		setContextSet((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			const att = {
				id: `ctx_${Date.now()}_${path}`,
				kind: "file" as const,
				value: path,
				label: path.split("/").pop() || path,
			};
			if (next.has(path)) useAIStore.getState().addAttachment(att);
			else useAIStore.getState().removeAttachment(att.id);
			return next;
		});
	};

	const newFile = async (parentPath: string = "") => {
		const name = prompt("New file name:");
		if (!name) return;
		const path = parentPath ? `${parentPath}/${name}` : name;
		try {
			await fetch("/api/files/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path, content: "" }),
			});
			setRefreshKey((k) => k + 1);
		} catch {
			/* ignore */
		}
	};

	const newFolder = async (parentPath: string = "") => {
		const name = prompt("New folder name:");
		if (!name) return;
		const path = parentPath ? `${parentPath}/${name}` : name;
		try {
			await fetch("/api/files/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path, content: "" }),
			});
			setRefreshKey((k) => k + 1);
		} catch {
			/* ignore */
		}
	};

	if (!fileTree)
		return (
			<div className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
				Loading workspace...
			</div>
		);

	return (
		<div className="flex flex-col h-full">
			<div
				className="px-3 py-1.5 flex items-center gap-1"
				style={{ borderBottom: "1px solid var(--border)" }}
			>
				<span
					className="text-[11px] font-semibold uppercase tracking-wider flex-1"
					style={{ color: "var(--text-muted)" }}
				>
					Explorer
				</span>
				<button
					onClick={() => setRefreshKey((k) => k + 1)}
					className="p-1 rounded hover:opacity-80"
					style={{ color: "var(--text-muted)" }}
					title="Refresh"
				>
					<RefreshCw className="w-3 h-3" />
				</button>
				<button
					onClick={() => newFile()}
					className="p-1 rounded hover:opacity-80"
					style={{ color: "var(--text-muted)" }}
					title="New file at root"
				>
					<FilePlus className="w-3 h-3" />
				</button>
				<button
					onClick={() => newFolder()}
					className="p-1 rounded hover:opacity-80"
					style={{ color: "var(--text-muted)" }}
					title="New folder at root"
				>
					<FolderPlus className="w-3 h-3" />
				</button>
			</div>
			<div
				ref={windowRef}
				className="flex-1 overflow-y-auto overflow-x-hidden"
				style={{ scrollBehavior: "smooth" }}
			>
				<ExplorerFileTree
					fileTree={fileTree}
					windowRef={windowRef}
					gitStatus={gitStatus}
					aiFiles={aiFiles}
					contextSet={contextSet}
					onToggleContext={toggleContext}
					onNewFile={newFile}
				/>
			</div>
			{contextSet.size > 0 && (
				<div
					className="px-3 py-1.5 text-[10px] flex items-center justify-between"
					style={{
						background: "var(--bg-tertiary)",
						color: "var(--text-muted)",
						borderTop: "1px solid var(--border)",
					}}
				>
					<span>
						{contextSet.size} file{contextSet.size === 1 ? "" : "s"} in composer
						context
					</span>
					<button
						onClick={() => {
							contextSet.forEach((p) => {
								const att = {
									id: `ctx_${Date.now()}_${p}`,
									kind: "file" as const,
									value: p,
									label: p.split("/").pop() || p,
								};
								useAIStore.getState().removeAttachment(att.id);
							});
							setContextSet(new Set());
						}}
						className="text-[10px] hover:opacity-80"
					>
						Clear
					</button>
				</div>
			)}
		</div>
	);
}

function gitStatusColor(status: string): string {
	if (status === "untracked" || status === "?") return "#3fb950";
	if (status === "M" || status.includes("modified")) return "#f59e0b";
	if (status === "D" || status.includes("deleted")) return "#f43f5e";
	if (status === "A" || status.includes("added")) return "#3fb950";
	if (status === "U" || status.includes("unmerged")) return "#a78bfa";
	return "#7d8590";
}

function gitStatusLabel(status: string): string {
	if (status === "untracked" || status === "?") return "U";
	if (status === "M" || status.includes("modified")) return "M";
	if (status === "D" || status.includes("deleted")) return "D";
	if (status === "A" || status.includes("added")) return "A";
	if (status === "U" || status.includes("unmerged")) return "U";
	return "·";
}

function ExplorerFileTree({
	fileTree,
	windowRef,
	gitStatus,
	aiFiles,
	contextSet,
	onToggleContext,
	onNewFile,
}: {
	fileTree: FileTreeType<any>;
	windowRef: React.RefObject<HTMLDivElement>;
	gitStatus: GitStatus;
	aiFiles: Set<string>;
	contextSet: Set<string>;
	onToggleContext: (path: string) => void;
	onNewFile: (path: string) => void;
}) {
	const { openFile } = useIDEStore();
	const visibleNodes = useVisibleNodes(fileTree) as any[];
	const virtualize = useVirtualize(fileTree, {
		windowRef,
		nodeHeight: 28,
	}) as any;
	const selections = useSelections(fileTree, visibleNodes) as any;
	const traits = useTraits(fileTree, ["selected", "focused"]) as any;
	const rovingFocus = useRovingFocus(fileTree) as any;
	useHotkeys(fileTree, { windowRef, selections, rovingFocus });

	const prevHeadRef = useRef<number | null>(null);

	const handleSelect = useCallback(
		(node: FileTreeNode<any>) => {
			if (isFile(node)) {
				const meta = node.data.meta;
				if (meta) {
					const ext = (meta.path.split(".").pop() as string) || "plaintext";
					const filename = (meta.path.split("/").pop() as string) || meta.path;
					openFile(meta.path, filename, ext);
				}
			}
			if (isDir(node)) {
				fileTree.expand(node as any);
			}
		},
		[fileTree, openFile],
	);

	useObserver(selections.didChange, (selectedIds: any) => {
		traits.clear("selected");
		for (const id of selectedIds) {
			traits.add("selected", id);
		}
		const head = selections.head as number | null;
		if (head !== null && head !== prevHeadRef.current) {
			prevHeadRef.current = head;
			const node = fileTree.getById(head);
			if (node) handleSelect(node);
		} else if (head === null) {
			prevHeadRef.current = null;
		}
	});

	useObserver(rovingFocus.didChange, (focusedId: any) => {
		traits.clear("focused");
		traits.add("focused", focusedId);
	});

	return (
		<div style={{ height: visibleNodes.length * 28, position: "relative" }}>
			{virtualize.map(({ key, node, tree, style }: any) => {
				const meta = node.data?.meta;
				const isDirectory = isDir(node);
				const path = meta?.path;
				const git = path ? gitStatus[path] : null;
				const isAi = path ? aiFiles.has(path) : false;
				const inContext = path ? contextSet.has(path) : false;
				return (
					<Node
						key={key}
						node={node}
						tree={tree}
						index={node.index}
						style={style}
						plugins={[selections as any, rovingFocus as any, traits as any]}
					>
						<div
							className="flex items-center gap-1.5 h-full px-2 text-xs group"
							style={{ color: "var(--text-secondary)" }}
						>
							{!isDirectory && path && (
								<button
									onClick={(e) => {
										e.stopPropagation();
										onToggleContext(path);
									}}
									className="w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100"
									style={{
										color: inContext ? "var(--accent)" : "var(--text-muted)",
									}}
									title={
										inContext
											? "Remove from composer context"
											: "Add to composer context"
									}
								>
									{inContext ? (
										<CheckSquare className="w-3 h-3" />
									) : (
										<Square className="w-3 h-3" />
									)}
								</button>
							)}
							{isDirectory && <span className="w-3" />}
							<span className="w-4 h-4 flex items-center justify-center text-[10px]">
								{isDirectory ? "📁" : "📄"}
							</span>
							<span className="truncate flex-1">{node.data.name}</span>
							{git && (
								<span
									className="text-[9px] font-mono px-1 rounded"
									style={{ color: gitStatusColor(git.status), fontWeight: 600 }}
									title={`${git.status}${git.staged ? " (staged)" : ""}`}
								>
									{gitStatusLabel(git.status)}
								</span>
							)}
							{isAi && (
								<span title="AI-generated" style={{ color: "#a78bfa" }}>
									<Sparkles className="w-2.5 h-2.5" />
								</span>
							)}
							{isDirectory && (
								<button
									onClick={(e) => {
										e.stopPropagation();
										onNewFile(meta?.path || "");
									}}
									className="w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100"
									style={{ color: "var(--text-muted)" }}
									title="New file in folder"
								>
									<Plus className="w-3 h-3" />
								</button>
							)}
						</div>
					</Node>
				);
			})}
		</div>
	);
}
