import { Command } from "cmdk";
import { useEffect, useState } from "react";
import {
	listCategories,
	listQuickActions,
	VIBESERVE_TOOL_CATALOG,
} from "../server/toolCatalog";
import { useIDEStore } from "../stores/useIDEStore";

interface CommandItem {
	id: string;
	name: string;
	category: string;
	keywords?: string;
	perform: () => void;
}

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<CommandItem[]>([]);
	const store = useIDEStore();

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "P" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
				e.preventDefault();
				setOpen((o) => !o);
			}
			if (e.key === "Escape" && open) {
				setOpen(false);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const commands: CommandItem[] = [
			{
				id: "explorer",
				name: "Explorer: Focus on Files View",
				category: "View",
				keywords: "sidebar files tree",
				perform: () => {
					store.setActivePanel("explorer");
					setOpen(false);
				},
			},
			{
				id: "search",
				name: "Search: Find in Files",
				category: "View",
				keywords: "find grep global",
				perform: () => {
					store.setActivePanel("search");
					setOpen(false);
				},
			},
			{
				id: "git",
				name: "Git: Source Control",
				category: "View",
				keywords: "commit push pull branch",
				perform: () => {
					store.setActivePanel("git");
					setOpen(false);
				},
			},
			{
				id: "debug",
				name: "Debug: Start Debugging",
				category: "Debug",
				keywords: "launch f5 breakpoint",
				perform: () => {
					store.setActivePanel("debug");
					setOpen(false);
				},
			},
			{
				id: "terminal",
				name: "Terminal: Toggle Integrated Terminal",
				category: "Terminal",
				keywords: "console shell bash",
				perform: () => {
					store.toggleBottomPanel();
					setOpen(false);
				},
			},
			{
				id: "settings",
				name: "Preferences: Open Settings",
				category: "Preferences",
				keywords: "config options",
				perform: () => {
					store.setActivePanel("settings");
					setOpen(false);
				},
			},
			{
				id: "integrations",
				name: "Integrations: Open Panel",
				category: "View",
				keywords: "github google drive vault",
				perform: () => {
					store.setActivePanel("integrations");
					setOpen(false);
				},
			},
			{
				id: "tools",
				name: "VibeServe: Open Tool Catalog",
				category: "VibeServe",
				keywords: "mcp tools catalog palette",
				perform: () => {
					store.setActivePanel("tools");
					setOpen(false);
				},
			},
			{
				id: "agenda",
				name: "VibeServe: Open Agenda",
				category: "VibeServe",
				keywords: "goals initiatives backlog",
				perform: () => {
					store.setActivePanel("agenda");
					setOpen(false);
				},
			},
			{
				id: "library",
				name: "VibeServe: Open Career Library",
				category: "VibeServe",
				keywords: "symbols search components",
				perform: () => {
					store.setActivePanel("career-library");
					setOpen(false);
				},
			},
			{
				id: "zen",
				name: "View: Toggle Zen Mode",
				category: "View",
				keywords: "fullscreen focus distraction-free",
				perform: () => setOpen(false),
			},
			{
				id: "pipeline",
				name: "Pipeline: Run Build Pipeline",
				category: "Pipeline",
				keywords: "build deploy architect code review",
				perform: () => {
					store.setAutonomyMode("pipeline");
					setOpen(false);
				},
			},
			{
				id: "sidebar",
				name: "View: Toggle Sidebar",
				category: "View",
				keywords: "hide panel",
				perform: () => {
					store.toggleSidebar();
					setOpen(false);
				},
			},
			{
				id: "ai",
				name: "View: Toggle AI Panel",
				category: "View",
				keywords: "composer copilot",
				perform: () => {
					store.toggleAiPanel();
					setOpen(false);
				},
			},
			{
				id: "reload",
				name: "Developer: Reload Window",
				category: "Developer",
				keywords: "refresh restart",
				perform: () => {
					window.location.reload();
				},
			},
		];

		// Quick actions: every VibeServe MCP tool the user can launch with one click.
		for (const t of VIBESERVE_TOOL_CATALOG) {
			commands.push({
				id: `tool:${t.name}`,
				name: `VibeServe: ${t.title} (${t.name})`,
				category: `VibeServe · ${t.category}`,
				keywords: `${t.name} ${t.title} ${t.description} ${t.category} ${t.scope}`,
				perform: () => {
					store.setActivePanel("tools");
					// Defer the event so the panel mounts and registers its listener first.
					setTimeout(() => {
						try {
							window.dispatchEvent(
								new CustomEvent("vibeserve:openTool", { detail: t.name }),
							);
						} catch {
							/* ignore */
						}
					}, 30);
					setOpen(false);
				},
			});
		}

		setItems(commands);
	}, [open, store]);

	const filter = (value: string, search: string, keywords?: string[]) => {
		const ext = (value + " " + (keywords?.join(" ") ?? "")).toLowerCase();
		const s = search.toLowerCase();
		if (ext.includes(s)) return 1;
		return 0;
	};

	const staticCategories = [
		"View",
		"Terminal",
		"Debug",
		"Pipeline",
		"Preferences",
		"Developer",
		"VibeServe",
	];
	const toolCategories = Array.from(
		new Set(
			items
				.filter((i) => i.category.startsWith("VibeServe · "))
				.map((i) => i.category),
		),
	).sort();

	return (
		<Command.Dialog
			open={open}
			onOpenChange={setOpen}
			label="Command Palette"
			filter={filter}
		>
			<div
				style={{
					background: "var(--bg-surface)",
					border: "1px solid var(--border)",
					borderRadius: "8px",
					overflow: "hidden",
					width: "520px",
				}}
			>
				<Command.Input
					placeholder="Search commands, files, symbols, VibeServe tools..."
					autoFocus
					style={{
						width: "100%",
						padding: "12px 16px",
						background: "transparent",
						border: "none",
						outline: "none",
						color: "var(--text-primary)",
						fontSize: "14px",
						fontFamily: "var(--font-sans)",
						borderBottom: "1px solid var(--border)",
					}}
				/>
				<Command.List
					style={{ maxHeight: "420px", overflow: "auto", padding: "4px" }}
				>
					<Command.Empty
						style={{
							padding: "24px",
							textAlign: "center",
							color: "var(--text-muted)",
							fontSize: "12px",
						}}
					>
						No results found
					</Command.Empty>
					{staticCategories.map((cat) => {
						const groupItems = items.filter((i) => i.category === cat);
						if (groupItems.length === 0) return null;
						return (
							<Command.Group key={cat} heading={cat}>
								{groupItems.map((item) => (
									<Command.Item
										key={item.id}
										value={item.name}
										keywords={item.keywords ? [item.keywords] : undefined}
										onSelect={item.perform}
									>
										{item.name}
									</Command.Item>
								))}
							</Command.Group>
						);
					})}
					{toolCategories.length > 0 && (
						<Command.Group heading="VibeServe Tools">
							{items
								.filter((i) => i.category.startsWith("VibeServe · "))
								.map((item) => (
									<Command.Item
										key={item.id}
										value={item.name}
										keywords={item.keywords ? [item.keywords] : undefined}
										onSelect={item.perform}
									>
										{item.name.replace(/^VibeServe: /, "")}
									</Command.Item>
								))}
						</Command.Group>
					)}
				</Command.List>
				<div
					style={{
						borderTop: "1px solid var(--border)",
						padding: "8px 16px",
						fontSize: "11px",
						color: "var(--text-muted)",
						display: "flex",
						gap: "12px",
					}}
				>
					<span>↑↓ Navigate</span>
					<span>↵ Execute</span>
					<span>Esc Close</span>
				</div>
			</div>
		</Command.Dialog>
	);
}
