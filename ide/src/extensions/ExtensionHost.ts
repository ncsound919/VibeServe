import { create } from 'zustand';
import type { Extension, ExtensionManifest, ExtensionContext } from './types';

interface ExtensionStore {
  extensions: Record<string, Extension>;
  events: Record<string, unknown[]>;
  
  loadExtension: (manifest: ExtensionManifest) => string;
  unloadExtension: (name: string) => void;
  enableExtension: (name: string) => void;
  disableExtension: (name: string) => void;
  getExtension: (name: string) => Extension | undefined;
  getEnabledExtensions: () => Extension[];
  
  emitEvent: (event: string, data?: unknown) => void;
  onExtensionEvent: (name: string, event: string, handler: (data: unknown) => void) => void;
}

const createContext = (extensionName: string, store: ExtensionStore): ExtensionContext => {
  const state: Record<string, unknown> = {};
  
  return {
    getState: (key: string) => state[key],
    setState: (key: string, value: unknown) => {
      state[key] = value;
    },
    emitEvent: (event: string, data?: unknown) => {
      store.getState().emitEvent(`${extensionName}:${event}`, data);
    },
    onEvent: (event: string, handler: (data: unknown) => void) => {
      const fullEvent = `${extensionName}:${event}`;
      const handlers = store.getState().events[fullEvent] || [];
      handlers.push(handler);
    },
  };
};

export const useExtensionHost = create<ExtensionStore>((set, get) => ({
  extensions: {},
  events: {},

  loadExtension: (manifest) => {
    const id = `${manifest.name}-${manifest.version}`;
    
    set((state) => ({
      extensions: {
        ...state.extensions,
        [id]: {
          manifest,
          enabled: true,
          loadedAt: Date.now(),
        },
      },
    }));
    
    return id;
  },

  unloadExtension: (name) => {
    set((state) => {
      const filtered = Object.fromEntries(
        Object.entries(state.extensions).filter(([key]) => !key.startsWith(name))
      );
      return { extensions: filtered };
    });
  },

  enableExtension: (name) => {
    set((state) => ({
      extensions: Object.fromEntries(
        Object.entries(state.extensions).map(([key, ext]) => [
          key,
          key.startsWith(name) ? { ...ext, enabled: true } : ext,
        ])
      ),
    }));
  },

  disableExtension: (name) => {
    set((state) => ({
      extensions: Object.fromEntries(
        Object.entries(state.extensions).map(([key, ext]) => [
          key,
          key.startsWith(name) ? { ...ext, enabled: false } : ext,
        ])
      ),
    }));
  },

  getExtension: (name) => {
    return Object.values(get().extensions).find(e => e.manifest.name === name);
  },

  getEnabledExtensions: () => {
    return Object.values(get().extensions).filter(e => e.enabled);
  },

  emitEvent: (event, data) => {
    set((state) => {
      const handlers = state.events[event] || [];
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (e) {
          console.error(`Event handler error for ${event}:`, e);
        }
      });
      
      return {
        events: {
          ...state.events,
          [event]: handlers,
        },
      };
    });
  },

  onExtensionEvent: (name, event, handler) => {
    const fullEvent = `${name}:${event}`;
    set((state) => ({
      events: {
        ...state.events,
        [fullEvent]: [...(state.events[fullEvent] || []), handler],
      },
    }));
  },
}));
