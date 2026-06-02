import { Icons } from "../lib/icons";
import { type PanelId, useIDEStore } from "../stores/useIDEStore";

const PANELS: {
	id: PanelId;
	icon: React.FC;
	tooltip: string;
	shortcut: string;
}[] = [
	{
		id: "explorer",
		icon: Icons.Explorer,
		tooltip: "Explorer",
		shortcut: "Ctrl+B",
	},
	{
		id: "search",
		icon: Icons.Search,
		tooltip: "Search",
		shortcut: "Ctrl+Shift+F",
	},
	{
		id: "git",
		icon: Icons.Git,
		tooltip: "Source Control",
		shortcut: "Ctrl+Shift+G",
	},
	{ id: "debug", icon: Icons.Debug, tooltip: "Debug", shortcut: "F5" },
	{
		id: "agenda",
		icon: Icons.Agenda,
		tooltip: "Agenda",
		shortcut: "Ctrl+Shift+A",
	},
	{
		id: "background",
		icon: Icons.Background,
		tooltip: "Background Work",
		shortcut: "Ctrl+Shift+B",
	},
	{
		id: "career-library",
		icon: Icons.Library,
		tooltip: "Career Library",
		shortcut: "Ctrl+Shift+L",
	},
	{
		id: "suggestions",
		icon: Icons.Suggestions,
		tooltip: "Active Suggestions",
		shortcut: "Ctrl+Shift+S",
	},
	{
		id: "tools",
		icon: Icons.Tools,
		tooltip: "VibeServe Tools",
		shortcut: "Ctrl+Shift+T",
	},
	{
		id: "integrations",
		icon: Icons.Integrations,
		tooltip: "Integrations",
		shortcut: "Ctrl+Shift+I",
	},
	{
		id: "settings",
		icon: Icons.Settings,
		tooltip: "Settings",
		shortcut: "Ctrl+,",
	},
];

export function ActivityBar() {
	const { activePanel, sidebarOpen, setActivePanel } = useIDEStore();

	return (
		<div
			className="flex flex-col items-center shrink-0 gap-1 py-2"
			style={{
				width: "var(--activity-bar-width)",
				background: "var(--bg-secondary)",
				borderRight: "1px solid var(--border)",
			}}
		>
			{PANELS.map((p) => (
				<button
					key={p.id}
					onClick={() => setActivePanel(p.id)}
					title={`${p.tooltip} (${p.shortcut})`}
					className="w-12 h-12 flex items-center justify-center rounded-md transition-colors relative group"
					style={{
						color:
							activePanel === p.id && sidebarOpen
								? "var(--text-primary)"
								: "var(--text-muted)",
						background:
							activePanel === p.id && sidebarOpen
								? "var(--bg-tertiary)"
								: "transparent",
					}}
				>
					<p.icon />
					{activePanel === p.id && sidebarOpen && (
						<div
							className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r"
							style={{ background: "var(--accent)" }}
						/>
					)}
					<span
						className="absolute left-14 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
						style={{
							background: "var(--bg-surface)",
							color: "var(--text-primary)",
							border: "1px solid var(--border)",
						}}
					>
						{p.tooltip}
					</span>
				</button>
			))}
		</div>
	);
}
