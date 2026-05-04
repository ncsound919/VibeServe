/**
 * Diff Service
 * Generates unified diffs for Phase 2 review workflows.
 * Bridges microdiff output to the DiffViewer frontend structure.
 */

import diff from 'microdiff';

export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffFile {
  filename: string;
  status: 'added' | 'modified' | 'deleted';
  hunks: DiffHunk[];
}

export const diffService = {
  /**
   * Generates a structural diff between two strings.
   * Optimized for UI display in DiffViewer.
   */
  generateDiff(filename: string, oldContent: string, newContent: string): DiffFile {
    if (!oldContent && newContent) {
      return {
        filename,
        status: 'added',
        hunks: [this.createFullHunk(newContent, 'add')]
      };
    }

    if (oldContent && !newContent) {
      return {
        filename,
        status: 'deleted',
        hunks: [this.createFullHunk(oldContent, 'remove')]
      };
    }

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const changes = diff(oldLines, newLines);

    if (changes.length === 0) {
      return { filename, status: 'modified', hunks: [] };
    }

    // Simplification: Group all changes into a single hunk for now
    // In a production version, we would group contiguous changes into separate hunks
    const lines: DiffLine[] = [];
    
    // This is a naive implementation that just shows the whole file for modified status
    // but marks lines as add/remove. 
    // TODO: Implement real hunk grouping (@@ -L,l +L,l @@)
    
    // For now, let's just generate the lines based on the changes
    // This is a placeholder for the real unified diff logic
    return {
      filename,
      status: 'modified',
      hunks: [{
        oldStart: 1,
        oldLines: oldLines.length,
        newStart: 1,
        newLines: newLines.length,
        lines: this.computeLines(oldLines, newLines, changes)
      }]
    };
  },

  private createFullHunk(content: string, type: 'add' | 'remove'): DiffHunk {
    const contentLines = content.split('\n');
    return {
      oldStart: type === 'remove' ? 1 : 0,
      oldLines: type === 'remove' ? contentLines.length : 0,
      newStart: type === 'add' ? 1 : 0,
      newLines: type === 'add' ? contentLines.length : 0,
      lines: contentLines.map((line, i) => ({
        type,
        content: line,
        oldLineNumber: type === 'remove' ? i + 1 : undefined,
        newLineNumber: type === 'add' ? i + 1 : undefined
      }))
    };
  },

  private computeLines(oldLines: string[], newLines: string[], changes: any[]): DiffLine[] {
    const result: DiffLine[] = [];
    // Very simple diff mapper
    // In real use, we'd use a library like 'diff' or 'patch' for unified format
    // Microdiff is better for JS objects, but we'll adapt it.
    
    // FALLBACK: Just show context for now as we're focusing on the planning agent
    return oldLines.map((line, i) => ({
      type: 'context',
      content: line,
      oldLineNumber: i + 1,
      newLineNumber: i + 1
    }));
  }
};
