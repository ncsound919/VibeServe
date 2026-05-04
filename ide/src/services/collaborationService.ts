/**
 * Yjs Real-Time Collaboration Service
 * 
 * Integrates Yjs CRDT for:
 * - Real-time collaborative editing
 * - Shared cursors and selections
 * - Presence awareness
 * - Conflict-free document sync
 * 
 * Based on Yjs (21K stars) - fastest CRDT implementation
 */
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: { line: number; column: number };
  selection?: { start: number; end: number };
}

export interface CollaborationState {
  doc: Y.Doc;
  awareness: Map<number, CollaborationUser>;
  provider: IndexeddbPersistence | null;
}

export interface TextDocument {
  id: string;
  content: Y.Text;
  filename: string;
}

const userColors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];

class CollaborationService {
  private docs: Map<string, CollaborationState> = new Map();
  private currentUserId: string = '';
  private currentUserName: string = 'Anonymous';
  private currentUserColor: string = userColors[0];

  initialize(userId: string, userName: string): void {
    this.currentUserId = userId;
    this.currentUserName = userName;
    const colorIndex = Math.floor(Math.random() * userColors.length);
    this.currentUserColor = userColors[colorIndex];
  }

  createDocument(documentId: string, filename: string): TextDocument {
    let state = this.docs.get(documentId);
    
    if (!state) {
      const doc = new Y.Doc();
      
      const persistence = new IndexeddbPersistence(`nexus-collab-${documentId}`, doc);
      
      persistence.on('synced', () => {
        console.log('[Collaboration] Document synced to IndexedDB:', documentId);
      });

      const content = doc.getText(filename);
      
      state = {
        doc,
        awareness: new Map(),
        provider: persistence,
      };
      
      this.docs.set(documentId, state);
    }

    return {
      id: documentId,
      content: state.doc.getText(filename),
      filename,
    };
  }

  getDocument(documentId: string): Y.Doc | null {
    return this.docs.get(documentId)?.doc || null;
  }

  updateCursor(documentId: string, line: number, column: number): void {
    const state = this.docs.get(documentId);
    if (!state) return;

    const userMap = state.doc.getMap('users');
    userMap.set(this.currentUserId, {
      line,
      column,
      timestamp: Date.now(),
    });
  }

  updateSelection(documentId: string, start: number, end: number): void {
    const state = this.docs.get(documentId);
    if (!state) return;

    const selectionMap = state.doc.getMap('selections');
    selectionMap.set(this.currentUserId, {
      start,
      end,
      timestamp: Date.now(),
    });
  }

  getActiveUsers(documentId: string): CollaborationUser[] {
    const state = this.docs.get(documentId);
    if (!state) return [];

    const users: CollaborationUser[] = [];
    const userMap = state.doc.getMap('users') as any;
    
    userMap.forEach((value: any, key: string) => {
      if (key !== this.currentUserId && Date.now() - value.timestamp < 30000) {
        users.push({
          id: key,
          name: key.split('-')[0] || 'Anonymous',
          color: userColors[Math.abs(key.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % userColors.length],
          cursor: value.cursor,
        });
      }
    });

    return users;
  }

  getDocumentState(documentId: string): Uint8Array | null {
    const state = this.docs.get(documentId);
    if (!state) return null;
    return Y.encodeStateAsUpdate(state.doc);
  }

  mergeDocumentState(documentId: string, stateUpdate: Uint8Array): void {
    const state = this.docs.get(documentId);
    if (!state) return;
    Y.applyUpdate(state.doc, stateUpdate);
  }

  deleteDocument(documentId: string): void {
    const state = this.docs.get(documentId);
    if (state) {
      state.doc.destroy();
      if (state.provider) {
        state.provider.destroy();
      }
      this.docs.delete(documentId);
    }
  }

  observeChanges(documentId: string, callback: (event: Y.YEvent<any>[]) => void): () => void {
    const state = this.docs.get(documentId);
    if (!state) return () => {};

    const content = state.doc.getText('content');
    content.observe(callback);

    return () => content.unobserve(callback);
  }

  getCurrentUser() {
    return {
      id: this.currentUserId,
      name: this.currentUserName,
      color: this.currentUserColor,
    };
  }

  getAllDocuments(): string[] {
    return Array.from(this.docs.keys());
  }

  destroy(): void {
    this.docs.forEach((state) => {
      state.doc.destroy();
      if (state.provider) {
        state.provider.destroy();
      }
    });
    this.docs.clear();
  }
}

export const collaborationService = new CollaborationService();

export function createSharedDocument(documentId: string, filename: string): TextDocument {
  return collaborationService.createDocument(documentId, filename);
}

export function getCollaborators(documentId: string): CollaborationUser[] {
  return collaborationService.getActiveUsers(documentId);
}

export function updateCursorPosition(documentId: string, line: number, column: number): void {
  collaborationService.updateCursor(documentId, line, column);
}

export function updateSelectionRange(documentId: string, start: number, end: number): void {
  collaborationService.updateSelection(documentId, start, end);
}

export function getDocumentUpdate(documentId: string): Uint8Array | null {
  return collaborationService.getDocumentState(documentId);
}

export function mergeDocumentUpdate(documentId: string, update: Uint8Array): void {
  collaborationService.mergeDocumentState(documentId, update);
}

export { Y };
