import { contextBridge, ipcRenderer } from 'electron';

// Expose window controls
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  
  // Window state listeners
  onMaximized: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_e, isMaximized) => callback(isMaximized));
  },
  
  // Menu events
  onMenuNewFile: (callback: () => void) => {
    ipcRenderer.on('menu:new-file', () => callback());
  },
  onMenuOpen: (callback: () => void) => {
    ipcRenderer.on('menu:open', () => callback());
  },
  onMenuSave: (callback: () => void) => {
    ipcRenderer.on('menu:save', () => callback());
  },
  
  // Shortcuts
  onNewAgent: (callback: () => void) => {
    ipcRenderer.on('shortcut:new-agent', () => callback());
  },
  
  // Platform info
  platform: process.platform,
});

// Type declarations for renderer
declare global {
  interface Window {
    electronAPI: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onMaximized: (callback: (isMaximized: boolean) => void) => void;
      onMenuNewFile: (callback: () => void) => void;
      onMenuOpen: (callback: () => void) => void;
      onMenuSave: (callback: () => void) => void;
      onNewAgent: (callback: () => void) => void;
      platform: string;
    };
  }
}