import { useState } from "react";
import { useToastStore } from "../../stores/useToastStore";

export function GiteaTab() {
	const [isRunning, setIsRunning] = useState(false);
	const [url, setUrl] = useState("http://localhost:3000");
	const [repos, setRepos] = useState<{ name: string; description: string }[]>(
		[],
	);
	const { addToast } = useToastStore();

	const startGitea = async () => {
		try {
			const res = await fetch("/api/gitea/start", { method: "POST" });
			if (res.ok) {
				setIsRunning(true);
				addToast({
					type: "success",
					message: "Gitea started on http://localhost:3000",
				});
				loadRepos();
			}
		} catch {
			addToast({
				type: "error",
				message: "Failed to start Gitea. Ensure Docker is running.",
			});
		}
	};

	const loadRepos = async () => {
		try {
			const res = await fetch("/api/gitea/repos");
			if (res.ok) setRepos(await res.json());
		} catch {
			/* fail silently */
		}
	};

	return (
		<div className="p-3 space-y-3 text-xs">
			<div style={{ color: "var(--text-secondary)" }}>
				Local Git Forge &mdash; self-hosted Gitea for CI/CD, PRs, and workflows.
			</div>

			{!isRunning ? (
				<button
					onClick={startGitea}
					className="w-full py-1.5 rounded font-medium"
					style={{
						background: "var(--accent)",
						color: "var(--text-on-accent)",
					}}
				>
					Start Gitea
				</button>
			) : (
				<>
					<div className="flex items-center gap-2">
						<div
							className="w-2 h-2 rounded-full"
							style={{ background: "var(--success)" }}
						/>
						<span style={{ color: "var(--success)" }}>Running</span>
						<span style={{ color: "var(--text-muted)" }}>{url}</span>
					</div>
					<div className="space-y-1">
						{repos.length === 0 && (
							<div style={{ color: "var(--text-muted)" }}>
								No repos yet. Create one in the Gitea web UI.
							</div>
						)}
						{repos.map((r) => (
							<div
								key={r.name}
								className="p-2 rounded"
								style={{
									background: "var(--bg-surface)",
									border: "1px solid var(--border)",
								}}
							>
								<div className="font-medium" style={{ color: "var(--accent)" }}>
									{r.name}
								</div>
								{r.description && (
									<div
										className="text-[10px] mt-0.5"
										style={{ color: "var(--text-muted)" }}
									>
										{r.description}
									</div>
								)}
							</div>
						))}
					</div>
					<div className="flex gap-2">
						<button
							onClick={() => window.open(url, "_blank")}
							className="flex-1 py-1 rounded text-[11px]"
							style={{
								background: "var(--bg-tertiary)",
								color: "var(--text-primary)",
							}}
						>
							Open Gitea
						</button>
						<button
							onClick={loadRepos}
							className="flex-1 py-1 rounded text-[11px]"
							style={{
								background: "var(--bg-tertiary)",
								color: "var(--text-primary)",
							}}
						>
							Refresh
						</button>
					</div>
				</>
			)}
		</div>
	);
}
