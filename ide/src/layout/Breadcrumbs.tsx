import { useIDEStore } from '../stores/useIDEStore';

export function Breadcrumbs() {
  const { tabs, activeTabId } = useIDEStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (!activeTab) return null;

  const parts = activeTab.path.split('/').filter(Boolean);

  return (
    <div
      className="flex items-center gap-1 px-3 shrink-0 text-xs overflow-x-auto"
      style={{
        height: '24px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span style={{ color: 'var(--border)' }}>›</span>}
          <span
            className={`px-1 rounded hover:opacity-80 cursor-default ${i === parts.length - 1 ? 'font-medium' : ''}`}
            style={{ color: i === parts.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}
          >
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}
