import { useEffect } from 'react';
import { useIDEStore } from '../stores/useIDEStore';

export function useKeyboardShortcuts() {
  const store = useIDEStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (ctrl && !shift && e.key === 'p') { e.preventDefault(); store.setActivePanel('explorer'); }
      if (ctrl && shift && e.key === 'P') { e.preventDefault(); /* Phase 2: open cmdk */ }
      if (ctrl && !shift && e.key === 'b') { e.preventDefault(); store.toggleSidebar(); }
      if (ctrl && shift && e.key === 'F') { e.preventDefault(); store.setActivePanel('search'); }
      if (ctrl && shift && e.key === 'G') { e.preventDefault(); store.setActivePanel('git'); }
      if (ctrl && !shift && e.key === '`') { e.preventDefault(); store.toggleBottomPanel(); }
      if (ctrl && !shift && e.key === ',') { e.preventDefault(); store.setActivePanel('settings'); }
      if (ctrl && shift && e.key === 'M') {
        e.preventDefault();
        const modes = ['ide', 'copilot', 'pipeline'] as const;
        const idx = modes.indexOf(store.autonomyMode);
        store.setAutonomyMode(modes[(idx + 1) % modes.length]);
      }
      if (ctrl && !shift && e.key === 'j') { e.preventDefault(); store.toggleBottomPanel(); }
      if (ctrl && shift && e.key === 'I') { e.preventDefault(); store.setActivePanel('integrations'); }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [store]);
}
