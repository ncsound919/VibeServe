import { Keyboard, X } from "lucide-react";
import { motion } from "motion/react";

interface ShortcutEntry {
	keys: string;
	action: string;
	category: string;
}

const SHORTCUTS: ShortcutEntry[] = [
	{
		keys: "Ctrl+I",
		action: "Agent mode — describe & edit code",
		category: "Agent",
	},
	{ keys: "Ctrl+P", action: "Quick file search", category: "Files" },
	{ keys: "Ctrl+K / F1", action: "Command palette", category: "General" },
	{ keys: "Ctrl+Shift+P", action: "Command palette", category: "General" },
	{ keys: "Ctrl+`", action: "Toggle terminal", category: "View" },
	{ keys: "Ctrl+B", action: "Toggle sidebar", category: "View" },
	{ keys: "Ctrl+J", action: "Toggle bottom panel", category: "View" },
	{ keys: "Ctrl+Shift+A", action: "Toggle AI / chat panel", category: "View" },
	{ keys: "Ctrl+S", action: "Save file", category: "Editor" },
	{ keys: "Ctrl+F", action: "Find in file", category: "Editor" },
	{ keys: "Ctrl+Shift+R", action: "Run pipeline", category: "Pipeline" },
	{
		keys: "Ctrl+1..6",
		action: "Navigate tabs (Composer..Changes)",
		category: "Navigation",
	},
	{ keys: "Ctrl+,", action: "Open settings", category: "Navigation" },
	{ keys: "Tab", action: "Accept ghost-text completion", category: "Editor" },
	{
		keys: "Escape",
		action: "Close modals / exit vim insert",
		category: "General",
	},
	{
		keys: "Ctrl+Shift+O",
		action: "Open dashboard overview",
		category: "Navigation",
	},
];

const CATEGORIES = [
	"Agent",
	"Editor",
	"Files",
	"View",
	"Navigation",
	"Pipeline",
	"General",
];

interface ShortcutsModalProps {
	visible: boolean;
	onClose: () => void;
}

export function ShortcutsModal({ visible, onClose }: ShortcutsModalProps) {
	if (!visible) return null;

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onClose}
		>
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.95 }}
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-[640px] max-h-[80vh] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden"
			>
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-[#21262d]">
					<div className="flex items-center gap-2.5">
						<Keyboard className="w-5 h-5 text-[#58a6ff]" />
						<h2 className="text-base font-semibold text-[#c9d1d9]">
							Keyboard Shortcuts
						</h2>
					</div>
					<button
						onClick={onClose}
						className="p-1.5 rounded hover:bg-[#21262d] text-[#7d8590] hover:text-[#c9d1d9]"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Shortcuts */}
				<div className="overflow-y-auto p-4 space-y-5 max-h-[calc(80vh-100px)]">
					{CATEGORIES.map((category) => {
						const items = SHORTCUTS.filter((s) => s.category === category);
						if (items.length === 0) return null;
						return (
							<div key={category}>
								<h3 className="text-[11px] font-semibold text-[#7d8590] uppercase tracking-wider mb-2 px-1">
									{category}
								</h3>
								<div className="space-y-0.5">
									{items.map((s) => (
										<div
											key={s.keys + s.action}
											className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#21262d] transition-colors"
										>
											<kbd className="inline-flex items-center px-2 py-1 text-xs font-mono text-[#c9d1d9] bg-[#0d1117] border border-[#30363d] rounded-md min-w-[100px] justify-center flex-shrink-0">
												{s.keys}
											</kbd>
											<span className="text-sm text-[#c9d1d9]">{s.action}</span>
										</div>
									))}
								</div>
							</div>
						);
					})}
				</div>

				{/* Footer */}
				<div className="px-5 py-3 border-t border-[#21262d] bg-[#0d1117]/50">
					<p className="text-[10px] text-[#484f58] text-center">
						Press{" "}
						<kbd className="px-1 py-0.5 bg-[#161b22] border border-[#30363d] rounded font-mono">
							Ctrl+K Ctrl+S
						</kbd>{" "}
						anytime to see this cheatsheet
					</p>
				</div>
			</motion.div>
		</motion.div>
	);
}
