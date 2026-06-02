import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebglAddon } from "xterm-addon-webgl";
import "xterm/css/xterm.css";
import {
	ChevronRight,
	Circle,
	Copy,
	Play,
	Plus,
	Square,
	Trash2,
} from "lucide-react";

const TERM_THEME = {
	background: "#1a1a2e",
	foreground: "#e2e8f0",
	cursor: "#536dfe",
	selectionBackground: "#536dfe44",
	black: "#2d2d4a",
	red: "#f87171",
	green: "#34d399",
	yellow: "#fbbf24",
	blue: "#60a5fa",
	magenta: "#a78bfa",
	cyan: "#22d3ee",
	white: "#e2e8f0",
	brightBlack: "#64748b",
	brightRed: "#fca5a5",
	brightGreen: "#6ee7b7",
	brightYellow: "#fde68a",
	brightBlue: "#93c5fd",
	brightMagenta: "#c4b5fd",
	brightCyan: "#67e8f9",
	brightWhite: "#f8fafc",
};

type SplitMode = "single" | "vertical" | "horizontal";

const QUICK_COMMANDS = [
	{ label: "ls", cmd: "ls -la" },
	{ label: "pwd", cmd: "pwd" },
	{ label: "git status", cmd: "git status" },
	{ label: "git log", cmd: "git log --oneline -10" },
	{ label: "npm test", cmd: "npm test" },
	{ label: "npm run dev", cmd: "npm run dev" },
	{ label: "clear", cmd: "clear" },
];

function useTerminal(
	containerRef: React.RefObject<HTMLDivElement | null>,
	onInput?: (data: string) => void,
) {
	useEffect(() => {
		if (!containerRef.current) return;
		const term = new Terminal({
			fontSize: 13,
			fontFamily: "var(--font-mono)",
			theme: TERM_THEME,
		});
		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		try {
			term.loadAddon(new WebglAddon());
		} catch {
			/* WebGL fallback */
		}
		term.open(containerRef.current);
		fitAddon.fit();

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const ws = new WebSocket(
			`${protocol}//${window.location.host}/ws/terminal`,
		);
		let connected = false;
		ws.onopen = () => {
			connected = true;
		};
		ws.onclose = () => {
			connected = false;
		};
		ws.onerror = () => {
			connected = false;
		};
		ws.onmessage = (event) => {
			term.write(typeof event.data === "string" ? event.data : "");
		};
		term.onData((data) => {
			if (ws.readyState === WebSocket.OPEN) ws.send(data);
			onInput?.(data);
		});

		const observer = new ResizeObserver(() => fitAddon.fit());
		observer.observe(containerRef.current);

		(term as any).__sendCommand = (cmd: string) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(cmd + "\r");
				term.write(`\r\n$ ${cmd}\r\n`);
			}
		};
		(term as any).__clear = () => term.clear();
		(term as any).__isConnected = () => connected;
		(term as any).__ws = ws;

		return () => {
			observer.disconnect();
			ws.close();
			term.dispose();
		};
	}, []);
}

export function TerminalPanel() {
	const [splitMode, setSplitMode] = useState<SplitMode>("single");
	const [showQuick, setShowQuick] = useState(false);
	const [connected, setConnected] = useState(false);
	const containerRef1 = useRef<HTMLDivElement>(null);
	const containerRef2 = useRef<HTMLDivElement>(null);
	const termARef = useRef<Terminal | null>(null);
	const termBRef = useRef<Terminal | null>(null);

	useTerminal(containerRef1);
	useTerminal(containerRef2);

	useEffect(() => {
		const id = setInterval(() => {
			const a = (containerRef1.current as any)?.__term || null;
			// We can't easily get the term instance; poll via the WS connection
			const ws = (window as any).__lastTermWS;
			setConnected(ws?.readyState === WebSocket.OPEN);
		}, 2000);
		return () => clearInterval(id);
	}, []);

	const cycleSplit = () => {
		setSplitMode((prev) =>
			prev === "single"
				? "vertical"
				: prev === "vertical"
					? "horizontal"
					: "single",
		);
	};

	const runQuick = (cmd: string) => {
		const ws = (containerRef1.current as any)?.querySelector ? null : null;
		// Use the global xterm registry if available
		const termEl = containerRef1.current;
		if (!termEl) return;
		// Find the xterm via the textarea trick
		const textarea = termEl.querySelector("textarea");
		if (!textarea) return;
		// Send through the WebSocket by simulating keypress
		const send = new KeyboardEvent("keydown", { key: "Enter" });
		const append = (text: string) => {
			const before = textarea.value;
			textarea.value = text + "\r";
			textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
		};
		append(cmd);
		setShowQuick(false);
	};

	const clearAll = () => {
		// xterm has a public clear() method — we need a ref. Workaround: send Ctrl+L (clear)
		const termEl = containerRef1.current;
		if (!termEl) return;
		// Use the textarea to send Ctrl+L which most shells map to clear
		const textarea = termEl.querySelector("textarea");
		if (textarea) {
			textarea.value = "\x0c";
			textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
		}
	};

	const copyLast = () => {
		const sel = window.getSelection()?.toString();
		if (sel) {
			navigator.clipboard.writeText(sel);
			return;
		}
		// Otherwise, copy the last line of the terminal by reading its text content
		const termEl = containerRef1.current;
		if (!termEl) return;
		const lines = termEl.querySelectorAll(".xterm-rows > div");
		const last = lines[lines.length - 1]?.textContent || "";
		if (last) navigator.clipboard.writeText(last);
	};

	const splitIcons: Record<SplitMode, string> = {
		single: "▦",
		vertical: "▯",
		horizontal: "▱",
	};
	const isSplit = splitMode !== "single";

	return (
		<div className="flex flex-col h-full w-full">
			<div
				className="flex items-center justify-between px-2 py-0.5"
				style={{
					borderBottom: "1px solid var(--border)",
					background: "var(--bg-secondary)",
				}}
			>
				<div className="flex items-center gap-2">
					<span
						className="text-[10px] font-semibold uppercase tracking-wider"
						style={{ color: "var(--text-muted)" }}
					>
						Terminal
					</span>
					<span
						className="flex items-center gap-1"
						title={connected ? "Process connected" : "Process disconnected"}
					>
						<Circle
							className="w-2 h-2"
							style={{
								color: connected ? "#22c55e" : "#ef4444",
								fill: connected ? "#22c55e" : "#ef4444",
							}}
						/>
						<span
							className="text-[9px] font-mono"
							style={{ color: "var(--text-muted)" }}
						>
							{connected ? "live" : "off"}
						</span>
					</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={() => setShowQuick((v) => !v)}
						className="px-1.5 py-0.5 rounded text-[10px] hover:opacity-80 flex items-center gap-0.5"
						style={{
							background: showQuick ? "var(--accent)" : "var(--bg-tertiary)",
							color: showQuick ? "var(--text-on-accent)" : "var(--text-muted)",
						}}
						title="Quick commands"
					>
						<Play className="w-2.5 h-2.5" /> Run
					</button>
					<button
						onClick={copyLast}
						className="px-1.5 py-0.5 rounded text-[10px] hover:opacity-80"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-muted)",
						}}
						title="Copy selection or last line"
					>
						<Copy className="w-2.5 h-2.5" />
					</button>
					<button
						onClick={clearAll}
						className="px-1.5 py-0.5 rounded text-[10px] hover:opacity-80"
						style={{
							background: "var(--bg-tertiary)",
							color: "var(--text-muted)",
						}}
						title="Clear (Ctrl+L)"
					>
						<Trash2 className="w-2.5 h-2.5" />
					</button>
					<button
						onClick={cycleSplit}
						className="px-1.5 py-0.5 rounded text-[10px] hover:opacity-80"
						style={{
							background: isSplit ? "var(--accent)" : "var(--bg-tertiary)",
							color: isSplit ? "var(--text-on-accent)" : "var(--text-muted)",
						}}
						title={`Split: ${splitMode}`}
					>
						{splitIcons[splitMode]}
					</button>
				</div>
			</div>
			{showQuick && (
				<div
					className="flex flex-wrap gap-1 p-1.5"
					style={{
						background: "var(--bg-tertiary)",
						borderBottom: "1px solid var(--border)",
					}}
				>
					{QUICK_COMMANDS.map((q) => (
						<button
							key={q.label}
							onClick={() => runQuick(q.cmd)}
							className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono hover:opacity-80"
							style={{
								background: "var(--bg-surface)",
								color: "var(--text-primary)",
							}}
							title={q.cmd}
						>
							<ChevronRight
								className="w-2.5 h-2.5"
								style={{ color: "var(--accent)" }}
							/>
							{q.label}
						</button>
					))}
				</div>
			)}
			<div
				className={`flex-1 flex ${splitMode === "horizontal" ? "flex-col" : ""}`}
			>
				<div
					ref={containerRef1}
					className={`${isSplit ? "flex-1" : "h-full w-full"}`}
					style={
						isSplit
							? {
									borderRight:
										splitMode === "vertical"
											? "1px solid var(--border)"
											: "none",
									borderBottom:
										splitMode === "horizontal"
											? "1px solid var(--border)"
											: "none",
								}
							: {}
					}
				/>
				{isSplit && <div ref={containerRef2} className="flex-1" />}
			</div>
		</div>
	);
}
