import { useEffect, useState } from "react";
import { useToastStore } from "../../stores/useToastStore";

interface Snippet {
	id: string;
	title: string;
	language: string;
	content: string;
	tags: string;
	created_at: string;
}

export function VaultTab() {
	const [activeSection, setActiveSection] = useState<"snippets" | "secrets">(
		"snippets",
	);
	const [snippets, setSnippets] = useState<Snippet[]>([]);
	const [snippetQuery, setSnippetQuery] = useState("");
	const [showNewSnippet, setShowNewSnippet] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newLang, setNewLang] = useState("");
	const [newContent, setNewContent] = useState("");
	const [newTags, setNewTags] = useState("");
	const { addToast } = useToastStore();

	const [secretKey, setSecretKey] = useState("");
	const [secretValue, setSecretValue] = useState("");
	const [secrets, setSecrets] = useState<{ key: string; value: string }[]>([]);

	const loadSnippets = async () => {
		try {
			const res = await fetch("/api/vault/snippets");
			if (res.ok) setSnippets(await res.json());
		} catch {
			/* fail silently */
		}
	};

	useEffect(() => {
		loadSnippets();
	}, []);

	const saveSnippet = async () => {
		if (!newTitle.trim() || !newContent.trim()) return;
		try {
			await fetch("/api/vault/snippets", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: newTitle,
					language: newLang,
					content: newContent,
					tags: newTags,
				}),
			});
			addToast({ type: "success", message: "Snippet saved" });
			setShowNewSnippet(false);
			setNewTitle("");
			setNewLang("");
			setNewContent("");
			setNewTags("");
			loadSnippets();
		} catch {
			addToast({ type: "error", message: "Failed to save snippet" });
		}
	};

	const addSecret = async () => {
		if (!secretKey.trim() || !secretValue.trim()) return;
		setSecrets([
			...secrets,
			{
				key: secretKey.trim(),
				value: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
			},
		]);
		try {
			await fetch("/api/vault/secrets", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: secretKey, value: secretValue }),
			});
			addToast({
				type: "success",
				message: "Secret saved to Credential Manager",
			});
			setSecretKey("");
			setSecretValue("");
		} catch {
			addToast({ type: "error", message: "Failed to store secret" });
		}
	};

	const filteredSnippets = snippets.filter(
		(s) =>
			!snippetQuery ||
			s.title.toLowerCase().includes(snippetQuery.toLowerCase()) ||
			s.tags.toLowerCase().includes(snippetQuery.toLowerCase()),
	);

	return (
		<div className="p-3 space-y-3 text-xs">
			<div className="flex gap-2">
				<button
					onClick={() => setActiveSection("snippets")}
					className="flex-1 py-1.5 rounded text-[11px] font-medium"
					style={{
						background:
							activeSection === "snippets"
								? "var(--accent)"
								: "var(--bg-tertiary)",
						color:
							activeSection === "snippets"
								? "var(--text-on-accent)"
								: "var(--text-muted)",
					}}
				>
					Snippets
				</button>
				<button
					onClick={() => setActiveSection("secrets")}
					className="flex-1 py-1.5 rounded text-[11px] font-medium"
					style={{
						background:
							activeSection === "secrets"
								? "var(--accent)"
								: "var(--bg-tertiary)",
						color:
							activeSection === "secrets"
								? "var(--text-on-accent)"
								: "var(--text-muted)",
					}}
				>
					Secrets
				</button>
			</div>

			{activeSection === "snippets" && (
				<div className="space-y-2">
					<div className="flex gap-2">
						<input
							value={snippetQuery}
							onChange={(e) => setSnippetQuery(e.target.value)}
							placeholder="Search snippets..."
							className="flex-1 px-3 py-1.5 rounded"
							style={{
								background: "var(--bg-surface)",
								color: "var(--text-primary)",
								border: "1px solid var(--border)",
							}}
						/>
						<button
							onClick={() => setShowNewSnippet(true)}
							className="px-2 py-1.5 rounded"
							style={{
								background: "var(--accent)",
								color: "var(--text-on-accent)",
								fontSize: "11px",
							}}
						>
							+ New
						</button>
					</div>

					{showNewSnippet && (
						<div
							className="space-y-2 p-3 rounded"
							style={{
								background: "var(--bg-surface)",
								border: "1px solid var(--border)",
							}}
						>
							<input
								value={newTitle}
								onChange={(e) => setNewTitle(e.target.value)}
								placeholder="Title"
								className="w-full px-2 py-1 rounded"
								style={{
									background: "var(--bg-tertiary)",
									color: "var(--text-primary)",
									border: "1px solid var(--border)",
								}}
							/>
							<input
								value={newLang}
								onChange={(e) => setNewLang(e.target.value)}
								placeholder="Language (typescript, python, etc.)"
								className="w-full px-2 py-1 rounded"
								style={{
									background: "var(--bg-tertiary)",
									color: "var(--text-primary)",
									border: "1px solid var(--border)",
								}}
							/>
							<textarea
								value={newContent}
								onChange={(e) => setNewContent(e.target.value)}
								placeholder="Code..."
								rows={4}
								className="w-full px-2 py-1 rounded font-mono resize-none"
								style={{
									background: "var(--bg-tertiary)",
									color: "var(--text-primary)",
									border: "1px solid var(--border)",
								}}
							/>
							<input
								value={newTags}
								onChange={(e) => setNewTags(e.target.value)}
								placeholder="Tags (comma separated)"
								className="w-full px-2 py-1 rounded"
								style={{
									background: "var(--bg-tertiary)",
									color: "var(--text-primary)",
									border: "1px solid var(--border)",
								}}
							/>
							<div className="flex gap-2">
								<button
									onClick={saveSnippet}
									className="px-3 py-1 rounded"
									style={{
										background: "var(--success)",
										color: "var(--text-on-accent)",
									}}
								>
									Save
								</button>
								<button
									onClick={() => setShowNewSnippet(false)}
									className="px-3 py-1 rounded"
									style={{
										background: "var(--bg-tertiary)",
										color: "var(--text-muted)",
									}}
								>
									Cancel
								</button>
							</div>
						</div>
					)}

					{filteredSnippets.map((s) => (
						<div
							key={s.id}
							className="p-2 rounded"
							style={{
								background: "var(--bg-surface)",
								border: "1px solid var(--border)",
							}}
						>
							<div className="flex justify-between">
								<span
									className="font-medium"
									style={{ color: "var(--text-primary)" }}
								>
									{s.title}
								</span>
								<span
									className="text-[10px]"
									style={{ color: "var(--accent)" }}
								>
									{s.language}
								</span>
							</div>
							<div
								className="mt-1 font-mono text-[11px] truncate"
								style={{ color: "var(--text-muted)" }}
							>
								{s.content.slice(0, 80)}
							</div>
							{s.tags && (
								<div className="flex gap-1 mt-1">
									{s.tags.split(",").map((t, i) => (
										<span
											key={i}
											className="text-[9px] px-1.5 py-0.5 rounded"
											style={{
												background: "var(--bg-tertiary)",
												color: "var(--text-secondary)",
											}}
										>
											{t.trim()}
										</span>
									))}
								</div>
							)}
						</div>
					))}
				</div>
			)}

			{activeSection === "secrets" && (
				<div className="space-y-2">
					<div
						className="text-[11px]"
						style={{ color: "var(--text-secondary)" }}
					>
						Secrets are stored in Windows Credential Manager (encrypted).
					</div>
					<div className="flex gap-2">
						<input
							value={secretKey}
							onChange={(e) => setSecretKey(e.target.value)}
							placeholder="Key (e.g. OPENAI_API_KEY)"
							className="flex-1 px-3 py-1.5 rounded"
							style={{
								background: "var(--bg-surface)",
								color: "var(--text-primary)",
								border: "1px solid var(--border)",
							}}
						/>
					</div>
					<input
						type="password"
						value={secretValue}
						onChange={(e) => setSecretValue(e.target.value)}
						placeholder="Value"
						className="w-full px-3 py-1.5 rounded"
						style={{
							background: "var(--bg-surface)",
							color: "var(--text-primary)",
							border: "1px solid var(--border)",
						}}
					/>
					<button
						onClick={addSecret}
						className="w-full py-1.5 rounded font-medium"
						style={{
							background: "var(--accent)",
							color: "var(--text-on-accent)",
						}}
					>
						Store Secret
					</button>

					{secrets.map((s, i) => (
						<div
							key={i}
							className="flex items-center gap-2 p-2 rounded"
							style={{
								background: "var(--bg-surface)",
								border: "1px solid var(--border)",
							}}
						>
							<span className="font-mono" style={{ color: "var(--accent)" }}>
								{s.key}
							</span>
							<span className="flex-1" />
							<span style={{ color: "var(--text-muted)" }}>{s.value}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
