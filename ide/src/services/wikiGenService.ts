/**
 * WikiGen Service — "Compile-First" Knowledge Synthesis
 * 
 * Inspired by Andrej Karpathy's ideology of maintaining a structured LLM Wiki.
 * This service synthesizes codebase complexity into high-density Markdown files
 * that agents use for grounding, reducing RAG noise and token waste.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

export interface WikiEntry {
  title: string;
  category: 'architecture' | 'api' | 'security' | 'components';
  content: string;
  lastUpdated: string;
}

export class WikiGenService {
  private readonly WIKI_DIR = path.resolve(process.cwd(), '.nexus_wiki');

  constructor() {
    if (!existsSync(this.WIKI_DIR)) {
      mkdirSync(this.WIKI_DIR, { recursive: true });
    }
  }

  /**
   * Synthesizes the current state of the codebase into the LLM Wiki.
   */
  async synthesizeWiki(appPath: string): Promise<void> {
    logger.info('WikiGen', `Synthesizing knowledge for: ${appPath}`);
    
    try {
      // 1. Generate Architecture Overview
      const archContent = this.generateArchitectureDoc(appPath);
      this.writeEntry({
        title: 'Architecture Overview',
        category: 'architecture',
        content: archContent,
        lastUpdated: new Date().toISOString()
      });

      // 2. Map API Contracts
      const apiContent = this.generateApiDoc(appPath);
      this.writeEntry({
        title: 'API Contracts',
        category: 'api',
        content: apiContent,
        lastUpdated: new Date().toISOString()
      });

      // 3. Update Master Index
      this.updateIndex();

      logger.info('WikiGen', 'Wiki synthesis completed successfully.');
    } catch (err) {
      logger.error('WikiGen', `Synthesis failed: ${(err as Error).message}`);
    }
  }

  private generateArchitectureDoc(appPath: string): string {
    // In a real implementation, this would use the PlannerAgent to summarize the tree
    return `# Architecture Overview: ${path.basename(appPath)}\n\n` +
           `## Core Modules\n` +
           `- **Entry**: src/main.tsx\n` +
           `- **State**: src/stores/\n` +
           `- **Services**: src/services/\n\n` +
           `## Conventions\n` +
           `- Use Functional Components with Tailwind CSS.\n` +
           `- Prefer Lucide icons for UI.\n`;
  }

  private generateApiDoc(appPath: string): string {
    return `# API Contracts\n\n` +
           `## Internal Services\n` +
           `- **VitalsService**: Web performance profiling.\n` +
           `- **WikiGenService**: Knowledge synthesis.\n` +
           `## Backend Routes\n` +
           `- POST /api/coding/plan\n` +
           `- POST /api/coding/search\n`;
  }

  private writeEntry(entry: WikiEntry): void {
    const fileName = `${entry.category}_${entry.title.toLowerCase().replace(/\s+/g, '_')}.md`;
    const fullPath = path.join(this.WIKI_DIR, fileName);
    
    const header = `---
title: ${entry.title}
category: ${entry.category}
lastUpdated: ${entry.lastUpdated}
---

`;
    writeFileSync(fullPath, header + entry.content, 'utf-8');
  }

  private updateIndex(): void {
    const files = readdirSync(this.WIKI_DIR).filter(f => f.endsWith('.md') && f !== 'index.md');
    let content = `# Nexus Alpha: Knowledge Wiki Index\n\n`;
    content += `This directory contains "compile-first" knowledge synthesized from the codebase.\n\n`;
    
    for (const f of files) {
      const title = f.replace('.md', '').split('_').slice(1).join(' ').toUpperCase();
      content += `- [${title}](./${f})\n`;
    }

    writeFileSync(path.join(this.WIKI_DIR, 'index.md'), content, 'utf-8');
  }

  /**
   * Returns the consolidated wiki content for agent context injection.
   */
  getWikiContext(): string {
    if (!existsSync(this.WIKI_DIR)) return "";
    
    const files = readdirSync(this.WIKI_DIR).filter(f => f.endsWith('.md'));
    let context = "--- NEXUS WIKI CONTEXT ---\n";
    
    for (const f of files) {
      context += `\nFILE: ${f}\n`;
      context += readFileSync(path.join(this.WIKI_DIR, f), 'utf-8');
    }
    
    return context + "\n--- END WIKI CONTEXT ---\n";
  }
}

export const wikiGenService = new WikiGenService();
