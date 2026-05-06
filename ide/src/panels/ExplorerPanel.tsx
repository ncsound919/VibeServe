import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createFileTree,
  useVirtualize,
  useVisibleNodes,
  useSelections,
  useTraits,
  useRovingFocus,
  useHotkeys,
  useObserver,
  Node,
  isDir,
  isFile,
  type FileTreeNode,
  type FileTree as FileTreeType,
} from 'exploration';
import { fileService, type FileEntry } from '../services/fileService';
import { useIDEStore } from '../stores/useIDEStore';

const ROOT = '';

export function ExplorerPanel() {
  const windowRef = useRef<HTMLDivElement>(null);
  const [fileTree, setFileTree] = useState<FileTreeType<any> | null>(null);

  const getNodes = useCallback(async (parent: any, factory: any) => {
    const dirPath = parent?.data?.meta?.path ?? ROOT;
    try {
      const entries = await fileService.listDir(dirPath);
      return entries
        .filter((e: FileEntry) => !e.name.startsWith('.') || e.name === '.git')
        .map((e: FileEntry) => {
          if (e.type === 'directory') {
            return factory.createDir({ name: e.name, meta: { path: e.path, type: e.type } });
          }
          return factory.createFile({ name: e.name, meta: { path: e.path, type: e.type } });
        });
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const tree = createFileTree(getNodes);
    setFileTree(tree);
    return () => { tree.dispose(); };
  }, [getNodes]);

  if (!fileTree) return <div className="p-4 text-xs" style={{ color: 'var(--text-muted)' }}>Loading workspace...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Explorer
      </div>
      <div ref={windowRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollBehavior: 'smooth' }}>
        <ExplorerFileTree fileTree={fileTree} windowRef={windowRef} />
      </div>
    </div>
  );
}

function ExplorerFileTree({ fileTree, windowRef }: { fileTree: FileTreeType<any>; windowRef: React.RefObject<HTMLDivElement> }) {
  const { openFile } = useIDEStore();
  const visibleNodes = useVisibleNodes(fileTree) as any[];
  const virtualize = useVirtualize(fileTree, { windowRef, nodeHeight: 28 }) as any;
  const selections = useSelections(fileTree, visibleNodes) as any;
  const traits = useTraits(fileTree, ['selected', 'focused']) as any;
  const rovingFocus = useRovingFocus(fileTree) as any;
  useHotkeys(fileTree, { windowRef, selections, rovingFocus });

  const prevHeadRef = useRef<number | null>(null);

  const handleSelect = useCallback((node: FileTreeNode<any>) => {
    if (isFile(node)) {
      const meta = node.data.meta;
      if (meta) {
        const ext = (meta.path.split('.').pop() as string) || 'plaintext';
        const filename = (meta.path.split('/').pop() as string) || meta.path;
        openFile(meta.path, filename, ext);
      }
    }
    if (isDir(node)) {
      fileTree.expand(node as any);
    }
  }, [fileTree, openFile]);

  useObserver(selections.didChange, (selectedIds: any) => {
    traits.clear('selected');
    for (const id of selectedIds) {
      traits.add('selected', id);
    }
    const head = selections.head as number | null;
    if (head !== null && head !== prevHeadRef.current) {
      prevHeadRef.current = head;
      const node = fileTree.getById(head);
      if (node) handleSelect(node);
    } else if (head === null) {
      prevHeadRef.current = null;
    }
  });

  useObserver(rovingFocus.didChange, (focusedId: any) => {
    traits.clear('focused');
    traits.add('focused', focusedId);
  });

  return (
    <div style={{ height: visibleNodes.length * 28, position: 'relative' }}>
      {virtualize.map(({ key, node, tree, style }: any) => (
        <Node
          key={key}
          node={node}
          tree={tree}
          index={node.index}
          style={style}
          plugins={[selections as any, rovingFocus as any, traits as any]}
        >
          <div className="flex items-center gap-1.5 h-full px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-4 h-4 flex items-center justify-center text-[10px]">
              {isDir(node) ? '📁' : '📄'}
            </span>
            <span className="truncate">{node.data.name}</span>
          </div>
        </Node>
      ))}
    </div>
  );
}
