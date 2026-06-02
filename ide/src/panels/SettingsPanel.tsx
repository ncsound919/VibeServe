import {
	Check,
	Cpu,
	Database,
	Download,
	Eye,
	EyeOff,
	Hammer,
	HelpCircle,
	Key,
	Loader,
	MessageSquare,
	Monitor,
	Moon,
	Palette,
	Pencil,
	Radio,
	Save,
	Search,
	Sun,
	SwitchCamera,
	Terminal,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	ALL_SHORTCUTS,
	getWCAGLevel,
	SHORTCUT_CATEGORIES,
} from "../constants/designSystem";
import {
	type InteractionMode,
	useSettingsStore,
} from "../stores/useSettingsStore";

const LLM_PROVIDERS = [
	{
		id: "openai",
		name: "OpenAI",
		models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
	},
	{
		id: "deepseek",
		name: "DeepSeek",
		models: ["deepseek-chat", "deepseek-coder"],
	},
	{
		id: "openrouter",
		name: "OpenRouter",
		models: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o"],
	},
	{ id: "local", name: "Local (Ollama)", models: ["llama3.2", "codellama"] },
];

type SectionId =
	| "editor"
	| "llm"
	| "theme"
	| "mode"
	| "a11y"
	| "memory"
	| "shortcuts";

const MODE_OPTIONS: {
	id: InteractionMode;
	label: string;
	icon: typeof Hammer;
	description: string;
}[] = [
	{
		id: "build",
		label: "Build",
		icon: Hammer,
		description: "Full pipeline generation with code, tests, and review",
	},
	{
		id: "edit",
		label: "Edit",
		icon: Pencil,
		description: "Targeted edits on selected code without full regeneration",
	},
	{
		id: "chat",
		label: "Chat",
		icon: MessageSquare,
		description: "Conversational AI assistance with context awareness",
	},
	{
		id: "ask",
		label: "Ask",
		icon: HelpCircle,
		description: "Quick questions and answers about the codebase",
	},
];

export function SettingsPanel() {
	const settings = useSettingsStore();
	const [activeSection, setActiveSection] = useState<SectionId>("editor");

	useEffect(() => {
		const handler = () => setActiveSection("shortcuts");
		window.addEventListener("vibeserve:openShortcuts", handler);
		return () => window.removeEventListener("vibeserve:openShortcuts", handler);
	}, []);
	const [envVars, setEnvVars] = useState<Record<string, string>>({
		OPENAI_API_KEY: "",
		DEEPSEEK_API_KEY: "",
		OPENROUTER_API_KEY: "",
		LOCAL_LLM_URL: "",
	});
	const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

	const sections: { id: SectionId; label: string; icon: typeof Terminal }[] = [
		{ id: "editor", label: "Editor", icon: Terminal },
		{ id: "llm", label: "LLM", icon: Cpu },
		{ id: "theme", label: "Theme", icon: Palette },
		{ id: "mode", label: "Mode", icon: SwitchCamera },
		{ id: "a11y", label: "A11y", icon: Eye },
		{ id: "memory", label: "Memory", icon: Database },
		{ id: "shortcuts", label: "Shortcuts", icon: Key },
	];

	return (
		<div className="flex h-full">
			<div
				className="w-32 shrink-0 flex flex-col border-r border-[var(--border)]"
				style={{ background: "var(--bg-primary)" }}
			>
				{sections.map((s) => (
					<button
						key={s.id}
						onClick={() => setActiveSection(s.id)}
						className={`flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors ${
							activeSection === s.id
								? "bg-[var(--accent)]/10 text-[var(--accent)]"
								: "text-[var(--text-muted)] hover:bg-[var(--border)]/30"
						}`}
					>
						<s.icon className="w-4 h-4" />
						{s.label}
					</button>
				))}
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				{activeSection === "editor" && <EditorSettings settings={settings} />}
				{activeSection === "llm" && (
					<LLMSettings
						settings={settings}
						providers={LLM_PROVIDERS}
						envVars={envVars}
						setEnvVars={setEnvVars}
						showKeys={showKeys}
						setShowKeys={setShowKeys}
					/>
				)}
				{activeSection === "theme" && <ThemeSettings settings={settings} />}
				{activeSection === "mode" && <ModeSettings settings={settings} />}
				{activeSection === "a11y" && <A11ySettings />}
				{activeSection === "memory" && <MemorySettings />}
				{activeSection === "shortcuts" && <ShortcutsList />}
			</div>
		</div>
	);
}

function SettingRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-xs text-[var(--text-muted)]">{label}</span>
			{children}
		</div>
	);
}

function EditorSettings({
	settings,
}: {
	settings: ReturnType<typeof useSettingsStore>;
}) {
	const FONT_SIZES = [12, 13, 14, 15, 16, 18];
	const TAB_SIZES = [2, 4, 8];

	return (
		<div className="space-y-4">
			<h3 className="text-sm font-semibold text-[var(--text-primary)]">
				Editor Settings
			</h3>
			<SettingRow label="Font Size">
				<select
					value={settings.fontSize || 14}
					onChange={(e) => settings.setFontSize(Number(e.target.value))}
					className="px-2 py-1 text-xs rounded border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]"
				>
					{FONT_SIZES.map((s) => (
						<option key={s} value={s}>
							{s}px
						</option>
					))}
				</select>
			</SettingRow>
			<SettingRow label="Tab Size">
				<select
					value={settings.tabSize || 2}
					onChange={(e) => settings.setTabSize(Number(e.target.value))}
					className="px-2 py-1 text-xs rounded border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]"
				>
					{TAB_SIZES.map((s) => (
						<option key={s} value={s}>
							{s} spaces
						</option>
					))}
				</select>
			</SettingRow>
		</div>
	);
}

function LLMSettings({
	settings,
	providers,
	envVars,
	setEnvVars,
	showKeys,
	setShowKeys,
}: {
	settings: ReturnType<typeof useSettingsStore>;
	providers: typeof LLM_PROVIDERS;
	envVars: Record<string, string>;
	setEnvVars: React.Dispatch<React.SetStateAction<Record<string, string>>>;
	showKeys: Record<string, boolean>;
	setShowKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
	const [testStatus, setTestStatus] = useState<
		Record<string, "idle" | "testing" | "ok" | "fail">
	>({});
	const [testMessage, setTestMessage] = useState<Record<string, string>>({});

	const testConnection = async (providerId: string) => {
		setTestStatus((prev) => ({ ...prev, [providerId]: "testing" }));
		setTestMessage((prev) => ({ ...prev, [providerId]: "" }));
		try {
			const res = await fetch("/api/ai/test-connection", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ provider: providerId }),
			});
			const data = await res.json();
			if (res.ok && data.ok) {
				setTestStatus((prev) => ({ ...prev, [providerId]: "ok" }));
				setTestMessage((prev) => ({
					...prev,
					[providerId]: data.message || "Connection successful",
				}));
			} else {
				setTestStatus((prev) => ({ ...prev, [providerId]: "fail" }));
				setTestMessage((prev) => ({
					...prev,
					[providerId]: data.error || data.message || "Test failed",
				}));
			}
		} catch (e: any) {
			setTestStatus((prev) => ({ ...prev, [providerId]: "fail" }));
			setTestMessage((prev) => ({
				...prev,
				[providerId]: e?.message || "Network error",
			}));
		}
	};

	const providerKeyMap: Record<
		string,
		{ varName: string; label: string; placeholder: string }
	> = {
		openai: {
			varName: "OPENAI_API_KEY",
			label: "OpenAI API Key",
			placeholder: "sk-...",
		},
		deepseek: {
			varName: "DEEPSEEK_API_KEY",
			label: "DeepSeek API Key",
			placeholder: "sk-...",
		},
		openrouter: {
			varName: "OPENROUTER_API_KEY",
			label: "OpenRouter API Key",
			placeholder: "sk-or-...",
		},
		local: {
			varName: "LOCAL_LLM_URL",
			label: "Local LLM URL",
			placeholder: "http://localhost:11434/v1",
		},
	};

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
					Default Provider
				</h3>
				<p className="text-[10px] text-[var(--text-muted)] mb-3">
					Maps directly to DEFAULT_LLM_PROVIDER environment variable.
				</p>
				<div className="flex flex-wrap gap-2">
					{providers.map((p) => (
						<button
							key={p.id}
							onClick={() => settings.setDefaultProvider(p.id)}
							className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all ${
								settings.defaultProvider === p.id
									? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
									: "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
							}`}
						>
							<Radio
								className={`w-3 h-3 ${settings.defaultProvider === p.id ? "text-[var(--accent)]" : ""}`}
							/>
							{p.name}
						</button>
					))}
				</div>
			</div>

			<div className="border-t border-[var(--border)] pt-4">
				<h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
					Model Configuration
				</h3>
				<p className="text-[10px] text-[var(--text-muted)] mb-3">
					Per-provider API keys with test connection.
				</p>

				<div className="space-y-4">
					{providers.map((p) => {
						const keyInfo = providerKeyMap[p.id];
						const isVisible = showKeys[p.id] ?? false;
						const status = testStatus[p.id] ?? "idle";
						const message = testMessage[p.id] ?? "";

						return (
							<div
								key={p.id}
								className="p-3 rounded-lg border border-[var(--border)]"
								style={{ background: "var(--bg-surface)" }}
							>
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-medium text-[var(--text-primary)]">
										{p.name}
									</span>
									<span className="text-[10px] text-[var(--text-muted)]">
										{p.models.join(", ")}
									</span>
								</div>

								{keyInfo && (
									<div className="flex items-center gap-2 mb-2">
										<div className="relative flex-1">
											<input
												type={isVisible ? "text" : "password"}
												value={envVars[keyInfo.varName] || ""}
												onChange={(e) =>
													setEnvVars((prev) => ({
														...prev,
														[keyInfo.varName]: e.target.value,
													}))
												}
												placeholder={keyInfo.placeholder}
												className="w-full px-2 py-1 text-xs rounded border bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-primary)] pr-8"
											/>
											<button
												onClick={() =>
													setShowKeys((prev) => ({
														...prev,
														[p.id]: !isVisible,
													}))
												}
												className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
											>
												{isVisible ? (
													<EyeOff className="w-3 h-3" />
												) : (
													<Eye className="w-3 h-3" />
												)}
											</button>
										</div>
										<button
											onClick={() => testConnection(p.id)}
											disabled={status === "testing"}
											className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded font-medium disabled:opacity-50 whitespace-nowrap"
											style={{
												background:
													status === "ok"
														? "#22c55e"
														: status === "fail"
															? "#ef4444"
															: "var(--accent)",
												color: "var(--text-on-accent)",
											}}
										>
											{status === "testing" ? (
												<Loader className="w-3 h-3 animate-spin" />
											) : status === "ok" ? (
												<Check className="w-3 h-3" />
											) : status === "fail" ? (
												<X className="w-3 h-3" />
											) : (
												<Cpu className="w-3 h-3" />
											)}
											{status === "testing"
												? "Testing…"
												: status === "ok"
													? "Connected"
													: status === "fail"
														? "Failed"
														: "Test"}
										</button>
									</div>
								)}

								{message && (
									<p
										className="text-[10px]"
										style={{ color: status === "ok" ? "#22c55e" : "#ef4444" }}
									>
										{message}
									</p>
								)}
							</div>
						);
					})}
				</div>
			</div>

			<div className="border-t border-[var(--border)] pt-4">
				<SettingRow label="Active Model">
					<select
						value={settings.llmModel || ""}
						onChange={(e) => settings.setLLMModel?.(e.target.value)}
						className="px-2 py-1 text-xs rounded border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]"
					>
						{providers
							.find((p) => p.id === settings.llmProvider)
							?.models.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
					</select>
				</SettingRow>
				<div className="mt-2">
					<SettingRow label="Temperature">
						<input
							type="range"
							min="0"
							max="1"
							step="0.1"
							value={settings.temperature || 0.7}
							onChange={(e) =>
								settings.setTemperature?.(Number(e.target.value))
							}
							className="w-24"
						/>
						<span className="text-xs text-[var(--text-muted)] ml-2">
							{settings.temperature || 0.7}
						</span>
					</SettingRow>
				</div>
			</div>
		</div>
	);
}

function ThemeSettings({
	settings,
}: {
	settings: ReturnType<typeof useSettingsStore>;
}) {
	return (
		<div className="space-y-4">
			<h3 className="text-sm font-semibold text-[var(--text-primary)]">
				Theme
			</h3>
			<p className="text-[10px] text-[var(--text-muted)]">
				Choose your preferred appearance.
			</p>

			<div className="flex gap-2">
				{[
					{
						id: "dark" as const,
						label: "Dark",
						icon: Moon,
						preview: "#0d1117",
					},
					{
						id: "light" as const,
						label: "Light",
						icon: Sun,
						preview: "#ffffff",
					},
					{
						id: "system" as const,
						label: "System",
						icon: Monitor,
						preview: "#0a1929",
					},
				].map((t) => (
					<button
						key={t.id}
						onClick={() => settings.setTheme(t.id)}
						className={`flex-1 p-4 rounded-lg border text-center transition-all ${
							settings.theme === t.id
								? "border-[var(--accent)] bg-[var(--accent)]/10"
								: "border-[var(--border)] hover:border-[var(--text-muted)]"
						}`}
					>
						<t.icon
							className="w-5 h-5 mx-auto mb-2"
							style={{
								color:
									settings.theme === t.id
										? "var(--accent)"
										: "var(--text-muted)",
							}}
						/>
						<div
							className="w-full h-8 rounded mb-2"
							style={{
								background: t.preview,
								border: "1px solid var(--border)",
							}}
						/>
						<div className="text-xs text-[var(--text-primary)]">{t.label}</div>
					</button>
				))}
			</div>
		</div>
	);
}

function ModeSettings({
	settings,
}: {
	settings: ReturnType<typeof useSettingsStore>;
}) {
	return (
		<div className="space-y-4">
			<h3 className="text-sm font-semibold text-[var(--text-primary)]">
				Interaction Mode
			</h3>
			<p className="text-[10px] text-[var(--text-muted)]">
				Select how VibeServe interacts with you. Mode determines the depth and
				style of AI assistance.
			</p>

			<div className="grid grid-cols-2 gap-2">
				{MODE_OPTIONS.map((m) => (
					<button
						key={m.id}
						onClick={() => settings.setInteractionMode(m.id)}
						className={`p-3 rounded-lg border text-left transition-all ${
							settings.interactionMode === m.id
								? "border-[var(--accent)] bg-[var(--accent)]/10"
								: "border-[var(--border)] hover:border-[var(--text-muted)]"
						}`}
					>
						<m.icon
							className="w-4 h-4 mb-1.5"
							style={{
								color:
									settings.interactionMode === m.id
										? "var(--accent)"
										: "var(--text-muted)",
							}}
						/>
						<div className="text-xs font-medium text-[var(--text-primary)]">
							{m.label}
						</div>
						<div className="text-[10px] text-[var(--text-muted)] mt-0.5">
							{m.description}
						</div>
					</button>
				))}
			</div>
		</div>
	);
}

function A11ySettings() {
	const currentLevel = getWCAGLevel();
	const [level, setLevel] = useState<"AA" | "AAA">(currentLevel);
	const [showOverlay, setShowOverlay] = useState(
		typeof localStorage !== "undefined"
			? localStorage.getItem("vs:a11yOverlay") === "1"
			: false,
	);

	const saveLevel = (l: "AA" | "AAA") => {
		setLevel(l);
		try {
			localStorage.setItem("vs:wcagLevel", l);
		} catch {
			/* ignore */
		}
		window.dispatchEvent(
			new CustomEvent("vibeserve:wcagLevelChange", { detail: l }),
		);
	};

	const toggleOverlay = (v: boolean) => {
		setShowOverlay(v);
		try {
			localStorage.setItem("vs:a11yOverlay", v ? "1" : "0");
		} catch {
			/* ignore */
		}
		window.dispatchEvent(
			new CustomEvent("vibeserve:a11yOverlayChange", { detail: v }),
		);
	};

	return (
		<div className="space-y-4">
			<h3 className="text-sm font-semibold text-[var(--text-primary)]">
				Accessibility
			</h3>
			<p className="text-[10px] text-[var(--text-muted)]">
				WCAG enforcement level. Maps to{" "}
				<code className="text-[var(--accent)]">
					DesignSystemConstraints.min_wcag_level
				</code>
				.
			</p>

			<SettingRow label="WCAG Level">
				<div
					className="flex rounded overflow-hidden"
					style={{ background: "var(--bg-tertiary)" }}
				>
					{(["AA", "AAA"] as const).map((l) => (
						<button
							key={l}
							onClick={() => saveLevel(l)}
							className="px-3 py-1.5 text-[11px] font-mono font-medium transition-colors"
							style={{
								background: level === l ? "var(--accent)" : "transparent",
								color:
									level === l ? "var(--text-on-accent)" : "var(--text-muted)",
							}}
						>
							{l}
						</button>
					))}
				</div>
			</SettingRow>

			<SettingRow label="Overlay in preview">
				<button
					onClick={() => toggleOverlay(!showOverlay)}
					className="px-2 py-1 text-[11px] rounded"
					style={{
						background: showOverlay ? "var(--accent)" : "var(--bg-tertiary)",
						color: showOverlay ? "var(--text-on-accent)" : "var(--text-muted)",
					}}
				>
					{showOverlay ? "Always on" : "Off"}
				</button>
			</SettingRow>

			<div
				className="pt-2 px-2 py-2 rounded text-[10px]"
				style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
			>
				<strong className="text-[var(--text-primary)]">AA</strong> — 4.5:1
				contrast for normal text, 3:1 for large text (industry standard).
				<br />
				<strong className="text-[var(--text-primary)]">AAA</strong> — 7:1
				contrast for normal text, 4.5:1 for large text (highest conformance).
			</div>
		</div>
	);
}

function MemorySettings() {
	const [stats, setStats] = useState<{
		episodes: number;
		facts: number;
		semantic: number;
		size_bytes: number;
	} | null>(null);
	const [busy, setBusy] = useState(false);

	const loadStats = async () => {
		setBusy(true);
		try {
			const res = await fetch("/api/memory/stats");
			if (res.ok) {
				const data = await res.json();
				setStats(data);
			}
		} catch {
			/* ignore */
		} finally {
			setBusy(false);
		}
	};

	const clear = async () => {
		if (!confirm("Clear all session memory? This cannot be undone.")) return;
		setBusy(true);
		try {
			await fetch("/api/memory/clear", { method: "POST" });
			await loadStats();
		} catch {
			/* ignore */
		} finally {
			setBusy(false);
		}
	};

	const exportMemory = async () => {
		setBusy(true);
		try {
			const res = await fetch("/api/memory/export");
			if (res.ok) {
				const blob = await res.blob();
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `vibeserve-memory-${Date.now()}.json`;
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(url);
			}
		} catch {
			/* ignore */
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="space-y-4">
			<h3 className="text-sm font-semibold text-[var(--text-primary)]">
				Session Memory
			</h3>
			<p className="text-[10px] text-[var(--text-muted)]">
				VibeServe uses SQLite-backed memory via aiosqlite for session
				persistence.
			</p>

			<div
				className="px-3 py-2 rounded text-xs"
				style={{ background: "var(--bg-tertiary)" }}
			>
				{stats ? (
					<div className="grid grid-cols-2 gap-2">
						<span>
							Episodes: <strong>{stats.episodes}</strong>
						</span>
						<span>
							Facts: <strong>{stats.facts}</strong>
						</span>
						<span>
							Semantic: <strong>{stats.semantic}</strong>
						</span>
						<span>
							Size: <strong>{(stats.size_bytes / 1024).toFixed(1)} KB</strong>
						</span>
					</div>
				) : (
					<button
						onClick={loadStats}
						disabled={busy}
						className="text-[11px] underline"
						style={{ color: "var(--accent)" }}
					>
						{busy ? "Loading…" : "Load memory stats"}
					</button>
				)}
			</div>

			<div className="flex gap-2">
				<button
					onClick={exportMemory}
					disabled={busy}
					className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded"
					style={{
						background: "var(--bg-tertiary)",
						color: "var(--text-primary)",
					}}
				>
					<Download className="w-3 h-3" /> Export Memory
				</button>
				<button
					onClick={clear}
					disabled={busy}
					className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded"
					style={{
						background: "#ef444420",
						color: "#fca5a5",
						border: "1px solid #ef444440",
					}}
				>
					<Trash2 className="w-3 h-3" /> Clear Session
				</button>
			</div>
		</div>
	);
}

function ShortcutsList() {
	const [query, setQuery] = useState("");

	const filtered = useMemo(() => {
		if (!query.trim()) return ALL_SHORTCUTS;
		const q = query.toLowerCase();
		return ALL_SHORTCUTS.filter(
			(s) =>
				s.keys.toLowerCase().includes(q) ||
				s.action.toLowerCase().includes(q) ||
				s.category.toLowerCase().includes(q),
		);
	}, [query]);

	return (
		<div className="space-y-4">
			<h3 className="text-sm font-semibold text-[var(--text-primary)]">
				Keyboard Shortcuts
			</h3>
			<p className="text-[10px] text-[var(--text-muted)]">
				Press{" "}
				<kbd className="px-1 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded font-mono text-[10px]">
					Cmd+/
				</kbd>{" "}
				to open this reference.
			</p>

			<div className="relative">
				<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search shortcuts..."
					className="w-full pl-8 pr-3 py-2 text-xs rounded border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
				/>
			</div>

			<div className="space-y-3 max-h-[400px] overflow-y-auto">
				{SHORTCUT_CATEGORIES.map((category) => {
					const items = filtered.filter((s) => s.category === category);
					if (items.length === 0) return null;
					return (
						<div key={category}>
							<h4 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 px-1">
								{category}
							</h4>
							<div className="space-y-0.5">
								{items.map((s) => (
									<div
										key={s.keys + s.action}
										className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--border)]/30 transition-colors"
									>
										<kbd className="inline-flex items-center px-2 py-1 text-[10px] font-mono text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border)] rounded min-w-[90px] justify-center flex-shrink-0">
											{s.keys}
										</kbd>
										<span className="text-xs text-[var(--text-primary)]">
											{s.action}
										</span>
									</div>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
