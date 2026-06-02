import { useEffect, useState } from "react";
import { useIDEStore } from "../../stores/useIDEStore";

const DEFAULT_BINDINGS: { command: string; key: string }[] = [
	{ command: "explorer.toggle", key: "Ctrl+B" },
	{ command: "search.files", key: "Ctrl+Shift+F" },
	{ command: "git.panel", key: "Ctrl+Shift+G" },
	{ command: "terminal.toggle", key: "Ctrl+`" },
	{ command: "settings.open", key: "Ctrl+," },
	{ command: "palette.open", key: "Ctrl+Shift+P" },
	{ command: "pipeline.run", key: "Ctrl+Shift+R" },
];

export function KeybindingEditor() {
	const [bindings, setBindings] = useState<{ command: string; key: string }[]>(
		() => {
			const saved = localStorage.getItem("vibeserve-keybindings");
			return saved ? JSON.parse(saved) : DEFAULT_BINDINGS;
		},
	);
	const [recording, setRecording] = useState<string | null>(null);

	useEffect(() => {
		localStorage.setItem("vibeserve-keybindings", JSON.stringify(bindings));
	}, [bindings]);

	const startRecording = (command: string) => {
		setRecording(command);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!recording) return;
		e.preventDefault();
		const parts: string[] = [];
		if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
		if (e.shiftKey) parts.push("Shift");
		if (e.altKey) parts.push("Alt");
		if (!["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
			parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
		}
		const key = parts.join("+");
		setBindings((b) =>
			b.map((bi) => (bi.command === recording ? { ...bi, key } : bi)),
		);
		setRecording(null);
	};

	return (
		<div className="p-3 text-xs" onKeyDown={handleKeyDown} tabIndex={0}>
			<div
				className="text-[11px] font-semibold uppercase mb-2"
				style={{ color: "var(--text-secondary)" }}
			>
				Keyboard Shortcuts
			</div>
			{bindings.map((b) => (
				<div
					key={b.command}
					className="flex items-center justify-between py-2"
					style={{ borderBottom: "1px solid var(--border)" }}
				>
					<span style={{ color: "var(--text-primary)" }}>{b.command}</span>
					<button
						onClick={() => startRecording(b.command)}
						className="px-3 py-1 rounded font-mono text-[11px] min-w-[100px]"
						style={{
							background:
								recording === b.command
									? "var(--accent)"
									: "var(--bg-tertiary)",
							color:
								recording === b.command
									? "var(--text-on-accent)"
									: "var(--text-muted)",
						}}
					>
						{recording === b.command ? "Press keys..." : b.key}
					</button>
				</div>
			))}
		</div>
	);
}
