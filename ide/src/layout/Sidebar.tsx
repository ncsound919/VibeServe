import {
	Activity,
	Brain,
	ChevronDown,
	ChevronRight,
	ClipboardList,
	Cpu,
	Database,
	Eye,
	FileCode,
	GitCompare,
	History,
	Package,
	Settings,
	Shield,
	Sparkles,
	Terminal,
	Trophy,
	Wand2,
} from "lucide-react";
import { type ElementType, useState } from "react";
import { cn } from "../lib/utils";
import { SystemManifest } from "./SystemManifest";

// Re-export TabName from the store (source of truth) for backward compatibility
export type { TabName } from "../stores/useAppStore";

import type { TabName } from "../stores/useAppStore";

const PRIMARY_ITEMS: { icon: ElementType; label: TabName }[] = [
	{ icon: Sparkles, label: "Composer" },
	{ icon: FileCode, label: "Editor" },
	{ icon: ClipboardList, label: "Review" },
	{ icon: Wand2, label: "Magic" },
	{ icon: Database, label: "Memory" },
	{ icon: Eye, label: "Preview" },
];

const ADVANCED_ITEMS: { icon: ElementType; label: TabName }[] = [
	{ icon: Activity, label: "Pipeline" },
	{ icon: Shield, label: "Audit" },
	{ icon: GitCompare, label: "Changes" },
	{ icon: Settings, label: "Settings" },
	{ icon: Package, label: "Extensions" },
	{ icon: Cpu, label: "System" },
	{ icon: Trophy, label: "Agent Eval" },
	{ icon: Brain, label: "Mission Control" },
];

interface SidebarProps {
	activeTab: TabName;
	onTabChange: (tab: TabName) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
	const [advancedOpen, setAdvancedOpen] = useState(false);

	return (
		<aside
			className="w-20 lg:w-64 border-r border-[#21262d] min-h-[calc(100vh-64px)] hidden md:flex flex-col bg-[#161b22]/50"
			role="navigation"
			aria-label="Main navigation"
		>
			<nav className="p-3 flex flex-col gap-0.5 flex-1">
				{PRIMARY_ITEMS.map((item) => (
					<button
						key={item.label}
						id={`nav-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
						aria-label={item.label}
						aria-current={activeTab === item.label ? "page" : undefined}
						onClick={() => onTabChange(item.label)}
						className={cn(
							"flex items-center gap-3 p-2.5 rounded-lg transition-all group focus-visible:ring-2 focus-visible:ring-[#58a6ff]/50",
							activeTab === item.label
								? "bg-[#1f6feb]/10 text-[#58a6ff] border border-[#1f6feb]/20"
								: "text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]",
						)}
					>
						<item.icon size={18} />
						<span className="hidden lg:block text-sm font-medium">
							{item.label}
						</span>
					</button>
				))}

				<button
					onClick={() => setAdvancedOpen(!advancedOpen)}
					className={cn(
						"flex items-center gap-3 p-2.5 rounded-lg transition-all group mt-2 text-[#484f58] hover:text-[#8b949e] hover:bg-[#21262d] focus-visible:ring-2 focus-visible:ring-[#58a6ff]/50",
					)}
					aria-expanded={advancedOpen}
					aria-controls="advanced-nav-items"
					aria-label="Toggle advanced navigation"
				>
					{advancedOpen ? (
						<ChevronDown size={14} />
					) : (
						<ChevronRight size={14} />
					)}
					<span className="hidden lg:block text-xs font-semibold uppercase tracking-wider">
						Advanced
					</span>
				</button>

				{advancedOpen &&
					ADVANCED_ITEMS.map((item) => (
						<button
							key={item.label}
							id={`nav-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
							aria-label={item.label}
							aria-current={activeTab === item.label ? "page" : undefined}
							onClick={() => onTabChange(item.label)}
							className={cn(
								"flex items-center gap-3 p-2.5 rounded-lg transition-all group focus-visible:ring-2 focus-visible:ring-[#58a6ff]/50",
								activeTab === item.label
									? "bg-[#1f6feb]/10 text-[#58a6ff] border border-[#1f6feb]/20"
									: "text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]",
							)}
						>
							<item.icon size={18} />
							<span className="hidden lg:block text-sm font-medium">
								{item.label}
							</span>
						</button>
					))}
			</nav>
			<SystemManifest />
		</aside>
	);
};
