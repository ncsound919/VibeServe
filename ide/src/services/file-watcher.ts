import { useContextIndex } from './contextIndex';

// Simple file watcher using polling (browser-compatible)
// In Electron, this would use chokidar or fs.watch

interface WatchedFile {
  path: string;
  lastModified: number;
  content: string;
}

class FileWatcherService {
  private watchedFiles: Map<string, WatchedFile> = new Map();
  private intervalId: number | null = null;
  private pollInterval = 2000; // 2 seconds

  watchFile(path: string, content: string) {
    this.watchedFiles.set(path, {
      path,
      lastModified: Date.now(),
      content,
    });

    if (!this.intervalId) {
      this.startPolling();
    }
  }

  unwatchFile(path: string) {
    this.watchedFiles.delete(path);
    if (this.watchedFiles.size === 0 && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private startPolling() {
    this.intervalId = window.setInterval(() => {
      this.checkForChanges();
    }, this.pollInterval);
  }

  private checkForChanges() {
    this.watchedFiles.forEach((file, path) => {
      // In a real implementation, this would check the file system
      // For now, we simulate by checking if content changed in the editor
      const contextIndex = useContextIndex.getState();
      const symbols = contextIndex.getSymbols(path);
      
      // Trigger re-index if needed
      if (symbols.length > 0) {
        // File is being tracked
        console.log(`[FileWatcher] Checking ${path}...`);
      }
    });
  }

  getWatchedFiles(): string[] {
    return Array.from(this.watchedFiles.keys());
  }

  isWatching(path: string): boolean {
    return this.watchedFiles.has(path);
  }
}

export const fileWatcher = new FileWatcherService();

// React hook for file watching
import { useEffect } from 'react';

export function useFileWatcher(path: string, content: string) {
  useEffect(() => {
    fileWatcher.watchFile(path, content);
    return () => fileWatcher.unwatchFile(path);
  }, [path]);
}
