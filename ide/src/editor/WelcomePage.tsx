import { useIDEStore } from '../stores/useIDEStore';

export function WelcomePage() {
  const { recentFiles } = useIDEStore();

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-6"
      style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
    >
      <div className="text-4xl font-bold" style={{ color: 'var(--accent)' }}>VS</div>
      <div className="text-lg" style={{ color: 'var(--text-secondary)' }}>VibeServe IDE</div>

      <div className="flex flex-col gap-2 text-xs">
        <ShortcutRow keys="Ctrl+P" description="Quick open file" />
        <ShortcutRow keys="Ctrl+Shift+P" description="Command palette" />
        <ShortcutRow keys="Ctrl+`" description="Toggle terminal" />
        <ShortcutRow keys="Ctrl+Shift+M" description="Toggle autonomy mode" />
      </div>

      {recentFiles.length > 0 && (
        <div className="mt-4">
          <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Recent Files</div>
          {recentFiles.slice(0, 5).map((path) => (
            <div
              key={path}
              className="text-xs py-1 cursor-pointer hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => {
                const name = path.split('/').pop() || path;
                const ext = path.split('.').pop() || 'plaintext';
                useIDEStore.getState().openFile(path, name, ext);
              }}
            >
              {path}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="px-2 py-0.5 rounded text-[11px] font-mono"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
      >
        {keys}
      </span>
      <span style={{ color: 'var(--text-muted)' }}>{description}</span>
    </div>
  );
}
