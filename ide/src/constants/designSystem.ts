export const DesignSystemConstraints = {
	min_wcag_level: "AA" as "AA" | "AAA",
} as const;

export type WCAGLevel = "AA" | "AAA";

export function getWCAGLevel(): WCAGLevel {
	if (typeof localStorage === "undefined")
		return DesignSystemConstraints.min_wcag_level;
	const stored = localStorage.getItem("vs:wcagLevel");
	if (stored === "AAA") return "AAA";
	return "AA";
}

export const ALL_SHORTCUTS = [
	{
		keys: "Cmd+I",
		action: "Agent mode — describe & edit code",
		category: "Agent",
	},
	{ keys: "Cmd+P", action: "Quick file search", category: "Files" },
	{ keys: "Cmd+K", action: "Command palette", category: "General" },
	{ keys: "Cmd+Shift+P", action: "Command palette", category: "General" },
	{ keys: "Cmd+`", action: "Toggle terminal", category: "View" },
	{ keys: "Cmd+B", action: "Toggle sidebar", category: "View" },
	{ keys: "Cmd+J", action: "Toggle bottom panel", category: "View" },
	{ keys: "Cmd+Shift+A", action: "Toggle AI / chat panel", category: "View" },
	{ keys: "Cmd+S", action: "Save file", category: "Editor" },
	{ keys: "Cmd+F", action: "Find in file", category: "Editor" },
	{ keys: "Cmd+Shift+R", action: "Run pipeline", category: "Pipeline" },
	{
		keys: "Cmd+1..6",
		action: "Navigate tabs (Composer..Changes)",
		category: "Navigation",
	},
	{ keys: "Cmd+,", action: "Open settings", category: "Navigation" },
	{ keys: "Tab", action: "Accept ghost-text completion", category: "Editor" },
	{
		keys: "Escape",
		action: "Close modals / exit vim insert",
		category: "General",
	},
	{
		keys: "Cmd+Shift+O",
		action: "Open dashboard overview",
		category: "Navigation",
	},
	{
		keys: "Cmd+/",
		action: "Open keyboard shortcuts reference",
		category: "General",
	},
	{
		keys: "Cmd+Shift+M",
		action: "Cycle autonomy mode (ide/copilot/pipeline)",
		category: "General",
	},
];

export const SHORTCUT_CATEGORIES = [
	"Agent",
	"Editor",
	"Files",
	"View",
	"Navigation",
	"Pipeline",
	"General",
];
