import { useEffect, useState } from "react";
import {
	type GitCommit,
	type GitStatus,
	gitService,
} from "../services/gitService";
import { useToastStore } from "../stores/useToastStore";

export function GitPanel() {
	const [statuses, setStatuses] = useState<GitStatus[]>([]);
	const [staged, setStaged] = useState<Set<string>>(new Set());
	const [message, setMessage] = useState("");
	const [commits, setCommits] = useState<GitCommit[]>([]);
	const [branches, setBranches] = useState<string[]>([]);
	const [currentBranch, setCurrentBranch] = useState("");
	const [loading, setLoading] = useState(true);
	const [isRepo, setIsRepo] = useState(false);
	const [diffText, setDiffText] = useState<string | null>(null);
	const [viewingDiff, setViewingDiff] = useState(false);
	const { addToast } = useToastStore();

	const load = async () => {
		try {
			setLoading(true);
			const isGitRepo = await gitService.isRepo();
			setIsRepo(isGitRepo);
			if (!isGitRepo) return;

			const [s, c, b, br] = await Promise.all([
				gitService.status(),
				gitService.log(),
				gitService.getBranches(),
				gitService.currentBranch(),
			]);
			setStatuses(s);
			setCommits(c);
			setBranches(b);
			setCurrentBranch(br);
		} catch {
			setIsRepo(false);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const handleStage = (file: string) => {
		setStaged((prev) => {
			const next = new Set(prev);
			if (next.has(file)) next.delete(file);
			else next.add(file);
			return next;
		});
	};

	const handleStageAll = () => setStaged(new Set(statuses.map((s) => s.path)));

	const handleCommit = async () => {
		if (!message.trim() || staged.size === 0) return;
		try {
			await gitService.addFiles(Array.from(staged));
			await gitService.commit(message);
			addToast({
				type: "success",
				message: `Committed: ${message.slice(0, 40)}${message.length > 40 ? "..." : ""}`,
			});
			setMessage("");
			setStaged(new Set());
			await load();
		} catch (err: any) {
			addToast({ type: "error", message: `Commit failed: ${err.message}` });
		}
	};

	const handlePush = async () => {
		try {
			await gitService.push();
			addToast({ type: "success", message: "Pushed to remote" });
			await load();
		} catch (err: any) {
			addToast({ type: "error", message: `Push failed: ${err.message}` });
		}
	};

	const handleViewDiff = async () => {
		if (staged.size === 0) {
			try {
				const d = await gitService.diff();
				setDiffText(d || "No changes detected");
			} catch (err: any) {
				setDiffText(`Diff failed: ${err.message}`);
			}
		} else {
			setDiffText("Diff for staged files coming soon");
		}
		setViewingDiff(true);
	};

	if (loading) {
		return (
			<div className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>
				Loading git status...
			</div>
		);
	}

	if (!isRepo) {
		return (
			<div className="flex flex-col h-full">
				<div
					className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
					style={{ color: "var(--text-muted)" }}
				>
					Source Control
				</div>
				<div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
					<div
						className="text-xs text-center"
						style={{ color: "var(--text-muted)" }}
					>
						No git repository found in this workspace.
					</div>
					<button
						onClick={async () => {
							await gitService.init();
							await load();
							addToast({
								type: "success",
								message: "Git repository initialized",
							});
						}}
						className="px-4 py-2 rounded text-xs font-medium"
						style={{
							background: "var(--accent)",
							color: "var(--text-on-accent)",
						}}
					>
						Initialize Repository
					</button>
				</div>
			</div>
		);
	}

	if (viewingDiff) {
		return (
			<div className="flex flex-col h-full">
				<div
					className="flex items-center justify-between px-3 py-2"
					style={{ borderBottom: "1px solid var(--border)" }}
				>
					<button
						onClick={() => setViewingDiff(false)}
						className="text-xs px-2 py-1 rounded"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-primary)",
						}}
					>
						← Back
					</button>
					<span
						className="text-[11px] font-semibold uppercase"
						style={{ color: "var(--text-muted)" }}
					>
						Diff
					</span>
					<div className="w-12" />
				</div>
				<div className="flex-1 overflow-auto p-3">
					<pre
						className="text-xs font-mono whitespace-pre-wrap"
						style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}
					>
						{diffText?.split("\n").map((line, i) => (
							<div
								key={i}
								style={{
									color: line.startsWith("+")
										? "var(--success)"
										: line.startsWith("-")
											? "var(--error)"
											: line.startsWith("@@")
												? "var(--accent)"
												: "var(--text-secondary)",
								}}
							>
								{line}
							</div>
						))}
					</pre>
				</div>
			</div>
		);
	}

	const statusColors: Record<string, string> = {
		modified: "var(--git-modified)",
		added: "var(--git-added)",
		deleted: "var(--git-deleted)",
		untracked: "var(--git-untracked)",
	};

	return (
		<div className="flex flex-col h-full text-xs">
			<div
				className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
				style={{ color: "var(--text-muted)" }}
			>
				Source Control
			</div>

			<div
				className="px-3 py-2 flex items-center gap-2"
				style={{ borderBottom: "1px solid var(--border)" }}
			>
				<span style={{ color: "var(--text-muted)" }}>Branch:</span>
				<select
					value={currentBranch}
					onChange={async (e) => {
						await gitService.checkout(e.target.value);
						load();
					}}
					className="flex-1 px-2 py-1 rounded text-xs"
					style={{
						background: "var(--bg-tertiary)",
						color: "var(--text-primary)",
						border: "1px solid var(--border)",
					}}
				>
					{branches.map((b) => (
						<option key={b} value={b}>
							{b}
						</option>
					))}
				</select>
			</div>

			{statuses.length === 0 ? (
				<div
					className="flex-1 flex items-center justify-center p-4 text-xs"
					style={{ color: "var(--text-muted)" }}
				>
					Working tree clean
				</div>
			) : (
				<div className="flex-1 overflow-y-auto">
					<div
						className="px-3 py-2 text-[11px] uppercase tracking-wider"
						style={{ color: "var(--text-muted)" }}
					>
						Changes ({statuses.length})
					</div>
					{statuses.map((s) => (
						<div
							key={s.path}
							className="flex items-center gap-2 px-3 py-1 cursor-pointer hover:opacity-80"
							onClick={() => handleStage(s.path)}
							style={{
								background: staged.has(s.path)
									? "rgba(83,109,254,0.1)"
									: "transparent",
							}}
						>
							<input
								type="checkbox"
								checked={staged.has(s.path)}
								onChange={(e) => {
									e.stopPropagation();
									handleStage(s.path);
								}}
								className="w-3 h-3"
							/>
							<span
								className="w-2 h-2 rounded-full shrink-0"
								style={{
									background: statusColors[s.status] || "var(--text-muted)",
								}}
							/>
							<span className="flex-1 truncate">{s.path}</span>
							<span
								className="shrink-0 text-[10px]"
								style={{ color: "var(--text-muted)" }}
							>
								{s.status.charAt(0).toUpperCase()}
							</span>
						</div>
					))}
				</div>
			)}

			<div style={{ borderTop: "1px solid var(--border)" }}>
				<div className="p-3">
					{staged.size > 0 && (
						<textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder="Commit message..."
							rows={3}
							className="w-full p-2 rounded text-xs resize-none"
							style={{
								background: "var(--bg-surface)",
								color: "var(--text-primary)",
								border: "1px solid var(--border)",
								outlineColor: "var(--accent)",
							}}
						/>
					)}
					<div className="flex gap-2 mt-2">
						<button
							onClick={handleStageAll}
							className="flex-1 px-3 py-1.5 rounded text-xs font-medium"
							style={{
								background: "var(--bg-tertiary)",
								color: "var(--text-primary)",
							}}
						>
							Stage All
						</button>
						<button
							onClick={handleCommit}
							disabled={staged.size === 0 || !message.trim()}
							className="flex-1 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40"
							style={{
								background: "var(--accent)",
								color: "var(--text-on-accent)",
							}}
						>
							Commit ({staged.size})
						</button>
					</div>
					<div className="flex gap-2 mt-1">
						<button
							onClick={handlePush}
							className="flex-1 px-3 py-1.5 rounded text-xs font-medium"
							style={{
								background: "var(--bg-tertiary)",
								color: "var(--text-primary)",
							}}
						>
							Push
						</button>
						<button
							onClick={handleViewDiff}
							className="flex-1 px-3 py-1.5 rounded text-xs font-medium"
							style={{
								background: "var(--bg-tertiary)",
								color: "var(--text-primary)",
							}}
						>
							View Diff
						</button>
					</div>
				</div>

				{commits.length > 0 && (
					<div className="px-3 pb-3">
						<div
							className="text-[11px] uppercase tracking-wider mb-1"
							style={{ color: "var(--text-muted)" }}
						>
							Recent Commits
						</div>
						{commits.slice(0, 5).map((c) => (
							<div key={c.oid} className="py-0.5 truncate">
								<span className="font-mono" style={{ color: "var(--accent)" }}>
									{c.oid}
								</span>
								<span className="ml-2">{c.message.slice(0, 60)}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
