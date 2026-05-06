import { useIDEStore } from '../stores/useIDEStore';
import { Icons } from '../lib/icons';
import { useContextMenu } from '../hooks/useContextMenu';

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, pinTab, closeOtherTabs, closeAllTabs } = useIDEStore();

  return (
    <div
      className="flex items-center shrink-0 gap-0 overflow-x-auto"
      style={{
        height: 'var(--tab-bar-height)',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {tabs
        .sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1))
        .map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onSelect={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onPin={() => pinTab(tab.id)}
            onCloseOthers={() => closeOtherTabs(tab.id)}
            onCloseAll={closeAllTabs}
          />
        ))}

      <button
        className="w-8 h-full flex items-center justify-center hover:opacity-80 transition-opacity"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }))}
      >
        <Icons.Plus />
      </button>
    </div>
  );
}

interface TabProps {
  tab: { id: string; name: string; isDirty: boolean; isPinned: boolean };
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onPin: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
}

function Tab({ tab, isActive, onSelect, onClose, onPin, onCloseOthers, onCloseAll }: TabProps) {
  const { menu, onContextMenu } = useContextMenu([
    { label: 'Close', action: onClose },
    { label: 'Close Others', action: onCloseOthers },
    { label: 'Close All', action: onCloseAll },
    { label: '---', action: () => {} },
    { label: tab.isPinned ? 'Unpin' : 'Pin', action: onPin },
  ]);

  return (
    <>
      <div
        onClick={onSelect}
        onContextMenu={onContextMenu}
        className="flex items-center gap-1.5 h-full px-3 text-xs cursor-pointer border-r shrink-0 relative group select-none"
        style={{
          background: isActive ? 'var(--bg-surface)' : 'transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
          borderRightColor: 'var(--border)',
          borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        }}
      >
        {tab.isPinned && <Icons.Pin />}
        {tab.isDirty && <Icons.DirtyDot />}
        <span className="truncate max-w-[160px]">{tab.name}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
          style={{ background: 'transparent', color: 'var(--text-muted)' }}
        >
          <Icons.Close />
        </button>
      </div>
      {menu}
    </>
  );
}
