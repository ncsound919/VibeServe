import { AgentQueue } from "./ai/AgentQueue";
import { ComposerPanel } from "./ai/ComposerPanel";
import { LivePreviewPane } from "./bottom/LivePreviewPane";
import { OutputPanel } from "./bottom/OutputPanel";
import { PipelineLog } from "./bottom/PipelineLog";
import { ProblemsPanel } from "./bottom/ProblemsPanel";
import { CommandPalette } from "./command/CommandPalette";
import { CodeEditor } from "./components/CodeEditor";
import { ToastContainer } from "./components/ToastContainer";
import { WelcomePage } from "./editor/WelcomePage";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePipeline } from "./hooks/usePipeline";
import { ActivityBar } from "./layout/ActivityBar";
import { Breadcrumbs } from "./layout/Breadcrumbs";
import { PanelBar } from "./layout/PanelBar";
import { StatusBar } from "./layout/StatusBar";
import { TabBar } from "./layout/TabBar";
import { TitleBar } from "./layout/TitleBar";
import { ActiveSuggestionsPanel } from "./panels/ActiveSuggestionsPanel";
import { AgendaPanel } from "./panels/AgendaPanel";
import { BackgroundWorkPanel } from "./panels/BackgroundWorkPanel";
import { CareerLibraryPanel } from "./panels/CareerLibraryPanel";
import { DebugPanel } from "./panels/DebugPanel";
import { ExplorerPanel } from "./panels/ExplorerPanel";
import { GitPanel } from "./panels/GitPanel";
import { IntegrationsPanel } from "./panels/IntegrationsPanel";
import { SearchPanel } from "./panels/SearchPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { ToolCatalogPanel } from "./panels/ToolCatalogPanel";
import { type PanelId, useIDEStore } from "./stores/useIDEStore";
import { TerminalPanel } from "./terminal/TerminalPanel";

const PANEL_COMPONENTS: Record<PanelId, React.FC> = {
	explorer: ExplorerPanel,
	search: SearchPanel,
	git: GitPanel,
	debug: DebugPanel,
	integrations: IntegrationsPanel,
	settings: SettingsPanel,
	agenda: AgendaPanel,
	background: BackgroundWorkPanel,
	"career-library": CareerLibraryPanel,
	suggestions: ActiveSuggestionsPanel,
	tools: ToolCatalogPanel,
};

const BOTTOM_COMPONENTS: Record<string, React.FC> = {
	problems: ProblemsPanel,
	output: OutputPanel,
	terminal: TerminalPanel,
	"pipeline-log": PipelineLog,
	preview: LivePreviewPane,
};

export default function App() {
	useKeyboardShortcuts();
	usePipeline();

	const {
		sidebarOpen,
		activePanel,
		aiPanelOpen,
		bottomPanelOpen,
		bottomPanelActive,
		tabs,
		activeTabId,
		autonomyMode,
	} = useIDEStore();
	const PanelComponent = PANEL_COMPONENTS[activePanel];
	const BottomComponent = BOTTOM_COMPONENTS[bottomPanelActive];
	const hasOpenFile = tabs.length > 0 && activeTabId;

	return (
		<div
			className="flex flex-col h-screen overflow-hidden"
			style={{ background: "var(--bg-primary)" }}
		>
			<TitleBar />
			<div className="flex flex-1 overflow-hidden">
				<ActivityBar />
				{sidebarOpen && (
					<div
						className="flex flex-col shrink-0 overflow-hidden"
						style={{
							width: "var(--sidebar-width)",
							background: "var(--bg-primary)",
							borderRight: "1px solid var(--border)",
						}}
					>
						<PanelComponent />
					</div>
				)}
				<div className="flex flex-col flex-1 min-w-0">
					{hasOpenFile && (
						<>
							<TabBar />
							<Breadcrumbs />
						</>
					)}
					<div
						className="flex-1 overflow-hidden"
						style={{ background: "var(--bg-surface)" }}
					>
						{hasOpenFile ? (
							<CodeEditor
								path={tabs.find((t) => t.id === activeTabId)?.path ?? ""}
								language={
									tabs.find((t) => t.id === activeTabId)?.language ??
									"plaintext"
								}
							/>
						) : (
							<WelcomePage />
						)}
					</div>
					{bottomPanelOpen && BottomComponent && (
						<div
							className="flex-shrink-0 overflow-hidden"
							style={{
								height: hasOpenFile ? "var(--bottom-panel-height)" : "50%",
								background: "var(--bg-primary)",
								borderTop: "1px solid var(--border)",
							}}
						>
							<BottomComponent />
						</div>
					)}
				</div>
				{aiPanelOpen &&
					(autonomyMode === "copilot" || autonomyMode === "pipeline") && (
						<div
							className="flex flex-col shrink-0 overflow-hidden"
							style={{
								width: "var(--ai-panel-width)",
								background: "var(--bg-primary)",
								borderLeft: "1px solid var(--border)",
							}}
						>
							<ComposerPanel />
							{autonomyMode === "pipeline" && <AgentQueue />}
						</div>
					)}
			</div>
			<PanelBar />
			<StatusBar />
			<ToastContainer />
			<CommandPalette />
		</div>
	);
}
