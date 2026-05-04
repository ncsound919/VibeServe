import * as path from 'path';
import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { getTemplateForDescription, listTemplates } from '../core/agents/templates/registry';
import { useGuardrailsStore } from './guardrailsService';
import { initAppMetadata } from '../server/editorService';
import type { TechStack, GenerationResult as CoreGenerationResult } from '../core/agents/types';

export interface AppSpec {
  templateId?: string;
  techStack?: Partial<TechStack>;
  userId: string;
}

export interface GenerationResult extends Partial<CoreGenerationResult> {
  appPath: string;
  success: boolean;
  message?: string;
  templateId?: string;
  files?: string[];
}

/**
 * Nexus Alpha Coding Agent Service — Core engine for "prompt → project scaffold" generation.
 *
 * Responsibilities:
 *  - Create a clean output directory per generation
 *  - Delegate scaffold writing to the selected template
 *  - Produce a deterministic, reviewable GenerationResult
 *  - Never write outside generated-apps/{id}/
 */
export class CodingAgentService {
  private readonly OUT_DIR = path.resolve(process.cwd(), 'generated-apps');

  /** Generate a project scaffold from a natural-language description */
  async generateApp(spec: AppSpec): Promise<GenerationResult> {
    const id = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const appRoot = path.resolve(this.OUT_DIR, id);

    try {
      // --- Guard 1: never overwrite an existing app ID ---
      if (existsSync(appRoot)) {
        return { appPath: appRoot, success: false, message: `App ID already exists: ${id}` };
      }

      mkdirSync(appRoot, { recursive: true });
      initAppMetadata(id, spec.userId);

      // --- Guard 2: enforce allowed output boundary ---
      if (!appRoot.startsWith(this.OUT_DIR + path.sep)) {
        return { appPath: appRoot, success: false, message: 'Path traversal rejected' };
      }

      // --- Guard 3: description length guard ---
      if (spec.description.trim().length < 3) {
        return { appPath: appRoot, success: false, message: 'Description too short (min 3 chars)' };
      }

      // --- Delegate scaffold writing ---
      let template = null;
      if (spec.templateId) {
        template = listTemplates().find(t => t.appType === spec.templateId);
      }
      if (!template) {
        template = getTemplateForDescription(spec.description);
      }

      if (template?.scaffold) {
        await template.scaffold(appRoot, spec);
      } else {
        // Fallback: write a README placeholder so the dir is never empty
        this.writeFile(path.join(appRoot, 'README.md'),
          `# Nexus Generated App\n\nPrompt: ${spec.description}\n`);
      }

      // --- Enumerate written files for traceability ---
      const files = this.walkFiles(appRoot);

      return {
        appPath: appRoot,
        success: true,
        message: `Generated via template: ${template.appType}`,
        templateId: template.appType,
        files,
      };
    } catch (err) {
      return {
        appPath: appRoot,
        success: false,
        message: (err as Error).message,
      };
    }
  }

  private writeFile(fp: string, content: string): void {
    const { validateAction } = useGuardrailsStore.getState();
    const { allowed, reason } = validateAction('file_write', fp);
    if (!allowed) throw new Error(reason);

    mkdirSync(path.dirname(fp), { recursive: true });
    writeFileSync(fp, content, 'utf-8');
  }

  /** Walk appRoot and return a flat list of relative file paths */
  private walkFiles(root: string, rel = ''): string[] {
    const entries = readdirSync(root);
    const out: string[] = [];
    for (const e of entries) {
      const fp = path.join(root, e);
      const rfp = rel ? `${rel}/${e}` : e;
      if (statSync(fp).isDirectory()) {
        out.push(...this.walkFiles(fp, rfp));
      } else {
        out.push(rfp);
      }
    }
    return out;
  }
}

export default CodingAgentService;
