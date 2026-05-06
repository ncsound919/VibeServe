/** @license SPDX-License-Identifier: Apache-2.0 */
import { lazy, Suspense, Component, useState, useEffect, useCallback, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { RefreshCcw, AlertTriangle } from 'lucide-react';
import { Header } from '../layout/Header';
import { Sidebar } from '../layout/Sidebar';
import { Footer } from '../layout/Footer';
import { OverviewTab } from './views/OverviewTab';
import { ComposerTab } from './views/ComposerTab';
import { LicenseGate } from './views/LicenseGate';
import { GlobalCommandBar } from './GlobalCommandBar';
import { useNexusApp } from '../hooks/useNexusApp';
import { TrajectorySidebar } from './TrajectorySidebar';
import { ChatPanel } from './ChatPanel';
import { InlineComposer } from './InlineComposer';
import { InlineDiffOverlay, type DiffChange } from './InlineDiffOverlay';
import { ShortcutsModal } from './ShortcutsModal';
import type { TabName } from '../stores/useAppStore';

// ── Per-tab error boundary ──────────────────────────────────────────────────
interface TabEBState { hasError: boolean; error: Error | null }
class TabErrorBoundary extends Component<{ name: string; children: ReactNode }, TabEBState> {
  constructor(props: { name: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): TabEBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error(`[VibeServe] Error in tab "${this.props.name}":`, error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center" role="alert" aria-live="assertive">
          <AlertTriangle className="text-amber-400" size={32} />
          <h2 className="text-lg font-semibold text-white">{this.props.name} failed to load</h2>
          <p className="text-sm text-gray-400 max-w-md">{this.state.error?.message}</p>
          <button
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Lazy views ──────────────────────────────────────────────────────────────
const CommandCenterTab = lazy(() => import('./views/CommandCenterTab').then(m => ({ default: m.CommandCenterTab })));
const PipelineTab = lazy(() => import('./views/PipelineTab').then(m => ({ default: m.PipelineTab })));
const SettingsTab = lazy(() => import('./views/SettingsTab').then(m => ({ default: m.SettingsTab })));
const ActivityTab = lazy(() => import('./views/ActivityTab').then(m => ({ default: m.ActivityTab })));
const HistoryTab = lazy(() => import('./views/HistoryTab').then(m => ({ default: m.HistoryTab })));
const AuditTab = lazy(() => import('./views/AuditTab').then(m => ({ default: m.AuditTab })));
const MissionControlTab = lazy(() => import('./views/MissionControlTab'));
const EditorTab = lazy(() => import('./views/EditorTab'));
const ChangesTab = lazy(() => import('./views/ChangesTab'));
const MemoryTab = lazy(() => import('./views/MemoryTab'));
const PreviewTab = lazy(() => import('../features/preview/MultimodalPreview').then(m => ({ default: m.MultimodalPreview })));
const ExtensionsTab = lazy(() => import('../features/extensions/ExtensionsPanel').then(m => ({ default: m.ExtensionsPanel })));
const SystemTab = lazy(() => import('../features/system/SystemPanel').then(m => ({ default: m.SystemPanel })));
const AgentEvalTab = lazy(() => import('./views/AgentEvalTab').then(m => ({ default: m.AgentEvalTab })));
const MagicTab = lazy(() => import('../features/composer/MagicComposer').then(m => ({ default: m.MagicComposer })));
const PlanReviewTab = lazy(() => import('./views/PlanReviewTab'));

// ── Suspense fallback ────────────────────────────────────────────────────────
function TabLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]" role="status" aria-label="Loading tab content">
      <motion.div
        className="w-8 h-8 rounded-full border-2 border-[#58a6ff]/30 border-t-[#58a6ff]"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      />
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const {
    data, loading, latency, appLicensed,
    activeTab, setActiveTab,
    nexusSystemStatus,
    activeRun,
    refetch,
  } = useNexusApp();

  const [chatOpen, setChatOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [diffChanges, setDiffChanges] = useState<DiffChange[]>([]);
  const [diffVisible, setDiffVisible] = useState(false);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);

  // Cmd+I handler
  useEffect(() => {
    let lastK = 0;
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'i' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setComposerOpen((prev) => !prev);
      }
      // Ctrl+K Ctrl+S sequence
      if (mod && e.key === 'k') {
        lastK = Date.now();
      }
      if (mod && e.key === 's' && Date.now() - lastK < 500) {
        e.preventDefault();
        setShortcutsVisible(true);
        lastK = 0;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleApplyChanges = useCallback((changes: DiffChange[]) => {
    setDiffChanges(changes);
    setDiffVisible(true);
    setComposerOpen(false);
  }, []);

  const handleDiffAcceptFile = useCallback(async (fileName: string) => {
    const change = diffChanges.find((c) => c.fileName === fileName);
    if (!change) return;

    setDiffChanges((prev) =>
      prev.map((c) =>
        c.fileName === fileName ? { ...c, verifying: true } : c,
      ),
    );

    try {
      await fetch('/api/editor/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fileName, content: change.newContent }),
      });

      setDiffChanges((prev) =>
        prev.map((c) =>
          c.fileName === fileName
            ? { ...c, applied: true, verifying: false, verified: true, verificationStatus: 'passing' }
            : c,
        ),
      );
    } catch {
      setDiffChanges((prev) =>
        prev.map((c) =>
          c.fileName === fileName
            ? { ...c, verifying: false, verificationStatus: 'failing' }
            : c,
        ),
      );
    }
  }, [diffChanges]);

  const handleDiffRejectFile = useCallback((fileName: string) => {
    setDiffChanges((prev) =>
      prev.map((c) => (c.fileName === fileName ? { ...c, rejected: true } : c)),
    );
  }, []);

  const handleDiffAcceptAll = useCallback(async () => {
    const pending = diffChanges.filter((c) => !c.applied && !c.rejected);
    for (const c of pending) {
      await handleDiffAcceptFile(c.fileName);
    }
    setDiffVisible(false);
    setDiffChanges([]);
  }, [diffChanges, handleDiffAcceptFile]);

  const handleDiffRejectAll = useCallback(() => {
    setDiffVisible(false);
    setDiffChanges([]);
  }, []);

  // Don't block render while license check is still loading
  if (appLicensed === false) return <LicenseGate onActivate={() => refetch()} />;

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col" role="application" aria-label="VibeServe IDE">
      {/* Top glow decoration */}
      <div className="pointer-events-none fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#58a6ff]/40 to-transparent" />

      <Header
        loading={loading}
        onRefresh={refetch}
        chatOpen={chatOpen}
        onChatToggle={() => setChatOpen((prev) => !prev)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 overflow-auto p-4 md:p-6" role="main" aria-label="Content area">
          <TabErrorBoundary name={activeTab}>
            <Suspense fallback={<TabLoader />}>
              {activeTab === 'Overview' && data && (
                <OverviewTab
                  data={data}
                  nexusSystemStatus={nexusSystemStatus}
                  onTabChange={(tab: string) => setActiveTab(tab as TabName)}
                />
              )}
              {activeTab === 'Composer' && <ComposerTab />}
              {activeTab === 'Command Center' && <CommandCenterTab />}
              {activeTab === 'Pipeline' && <PipelineTab />}
              {activeTab === 'Activity' && <ActivityTab />}
              {activeTab === 'History' && <HistoryTab />}
              {activeTab === 'Audit' && <AuditTab />}
              {activeTab === 'Mission Control' && <MissionControlTab />}
              {activeTab === 'Editor' && <EditorTab />}
              {activeTab === 'Changes' && <ChangesTab />}
              {activeTab === 'Memory' && <MemoryTab />}
              {activeTab === 'Preview' && <PreviewTab />}
              {activeTab === 'Extensions' && <ExtensionsTab />}
              {activeTab === 'System' && <SystemTab />}
              {activeTab === 'Settings' && <SettingsTab />}
              {activeTab === 'Agent Eval' && <AgentEvalTab />}
              {activeTab === 'Magic' && <MagicTab />}
              {activeTab === 'Review' && <PlanReviewTab />}
            </Suspense>
          </TabErrorBoundary>
        </main>

        <TrajectorySidebar />
        <ChatPanel isOpen={chatOpen} onToggle={() => setChatOpen(false)} />
      </div>

      <Footer />
      <GlobalCommandBar />

      {/* Cmd+I Inline Composer */}
      <InlineComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onApplyChanges={handleApplyChanges}
      />

      {/* Batch diff review after agent edits */}
      <InlineDiffOverlay
        changes={diffChanges}
        visible={diffVisible}
        onAcceptAll={handleDiffAcceptAll}
        onRejectAll={handleDiffRejectAll}
        onAcceptFile={handleDiffAcceptFile}
        onRejectFile={handleDiffRejectFile}
        onClose={() => {
          setDiffVisible(false);
          setDiffChanges([]);
        }}
      />

      {/* Keyboard shortcuts cheatsheet */}
      <ShortcutsModal visible={shortcutsVisible} onClose={() => setShortcutsVisible(false)} />
    </div>
  );
}