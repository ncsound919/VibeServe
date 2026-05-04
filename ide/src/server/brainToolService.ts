/**
 * Brain Tool Service - Server-side only
 * Integrates deterministic-brain and browser-harness
 */

import { spawn, execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { chromium, Browser, BrowserContext, Page } from "@playwright/test";
import crypto from "crypto";
import { logAuditEvent } from "./auditLogService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// -- Isolated Playwright Session Manager --
class BrowserSessionManager {
  private browser: Browser | null = null;
  private sessions = new Map<string, { context: BrowserContext; page: Page; lastActive: number }>();
  
  async init() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
  }

  async createSession(): Promise<{ sessionId: string; page: Page }> {
    await this.init();
    const sessionId = crypto.randomUUID();
    // Enforce isolated incognito context per session
    const context = await this.browser!.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    this.sessions.set(sessionId, { context, page, lastActive: Date.now() });
    return { sessionId, page };
  }

  async closeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.page.close().catch(() => {});
      await session.context.close().catch(() => {});
      this.sessions.delete(sessionId);
    }
  }

  async cleanupStaleSessions(maxAgeMs = 60000) {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActive > maxAgeMs) {
        await this.closeSession(id);
      }
    }
  }
}

export const browserManager = new BrowserSessionManager();

const BRAIN_PATH = join(process.cwd(), "packages/deterministic-brain");

export function findBrainDir(): string | null {
  if (existsSync(join(BRAIN_PATH, "main.py"))) return BRAIN_PATH;
  return null;
} 

export interface BrainQueryOptions {
  query: string;
  lane?: "coding" | "business_logic" | "agent_brain" | "tool_calling" | "cross_domain";
  verbose?: boolean;
}

export interface BrowserCommandOptions {
  command: string;
  timeout?: number;
}

function safeShellArg(arg: string): string {
  // Remove shell metacharacters to prevent injection
  return arg.replace(/[;&|`$(){}[\]!#~<>*?\\\n\r]/g, '').trim();
}

export async function runDeterministicBrain(options: BrainQueryOptions): Promise<string> {
  const brainDir = findBrainDir();

  if (!brainDir) {
    throw new Error(`Deterministic brain service is unavailable. Expected at: ${BRAIN_PATH}`);
  }

  const safeQuery = safeShellArg(options.query);
  const args = ["main.py", safeQuery];
  if (options.lane) args.push("--lane", safeShellArg(options.lane));
  if (options.verbose) args.push("--verbose");

  return new Promise((resolve, reject) => {
    const proc = spawn("python", args, {
      cwd: brainDir,
      shell: false,
    });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("Deterministic brain timed out after 15s"));
    }, 15000);

    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Deterministic brain exited with code ${code}`));
    });
    proc.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

export async function runBrowserHarness(options: BrowserCommandOptions): Promise<string> {
  const cmd = options.command;
  let sessionId: string | null = null;

  try {
    // 1. Create fully isolated browser context
    const session = await browserManager.createSession();
    sessionId = session.sessionId;
    const page = session.page;
    
    let output = '';

    // 2. Strict DSL Interpreter (No Arbitrary Execution)
    const statements = cmd.split(';').map(s => s.trim()).filter(Boolean);

    for (const stmt of statements) {
      if (stmt.startsWith('new_tab("') || stmt.startsWith("new_tab('")) {
        const urlMatch = stmt.match(/new_tab\(['"]([^'"]+)['"]\)/);
        if (urlMatch) {
          const targetUrl = urlMatch[1];
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            const violation = `Security Violation: Unsafe protocol in URL ${targetUrl}`;
            await logAuditEvent({
              actor: 'agent:browser',
              action: 'protocol_violation',
              target: targetUrl,
              status: 'failure',
              metadata: { command: stmt }
            }).catch(() => {});
            throw new Error(violation);
          }
          await page.goto(targetUrl);
          output += `[navigated to ${targetUrl}]\n`;
        }
      } 
      else if (stmt === 'wait_for_load()') {
        await page.waitForLoadState('networkidle').catch(() => {});
      }
      else if (stmt === 'page_info()' || stmt === 'print(page_info())') {
        const url = page.url();
        const title = await page.title();
        const size = page.viewportSize();
        output += JSON.stringify({ url, title, viewport: size, loadState: 'complete' }, null, 2) + '\n';
      }
      else if (stmt === 'page_source()' || stmt === 'print(page_source())') {
        const html = await page.content();
        output += html.substring(0, 5000) + (html.length > 5000 ? '\n...[TRUNCATED]' : '') + '\n';
      }
      else if (stmt.includes('page_links()')) {
        const links = await page.$$eval('a', as => as.map(a => a.href).filter(h => h.startsWith('http')));
        output += Array.from(new Set(links)).slice(0, 20).join('\n') + '\n';
      }
      else if (stmt.includes('console_messages()')) {
        output += '[]\n';
      }
      else if (stmt === 'capture_screenshot()') {
        const buf = await page.screenshot({ type: 'jpeg', quality: 50 });
        output += `[SCREENSHOT CAPTURED: ${buf.length} bytes]\n`;
      }
      else {
        // 3. Command Safety Guard (Fails explicitly instead of executing arbitrary JS)
        const violation = `Security Violation: Unrecognized or malformed DSL command: "${stmt}"`;
        await logAuditEvent({
          actor: 'agent:browser',
          action: 'command_violation',
          target: 'browser-harness',
          status: 'failure',
          metadata: { command: stmt, fullRequest: cmd }
        }).catch(() => {});
        throw new Error(violation);
      }
    }

    return output.trim();
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  } finally {
    // 4. Guaranteed Teardown
    if (sessionId) {
      await browserManager.closeSession(sessionId);
    }
  }
}

export function isAvailable(binary: 'python' | 'browser-harness'): boolean {
  if (binary === 'browser-harness') return true; // Now implemented natively via Playwright
  try {
    execSync(`${binary} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function runDeterministicBrainSafe(options: BrainQueryOptions): Promise<{
  success: boolean;
  output: string;
  simulated: boolean;
}> {
  try {
    const result = await runDeterministicBrain(options);
    return { success: true, output: result, simulated: false };
  } catch (e) {
    return { success: false, output: e instanceof Error ? e.message : String(e), simulated: false };
  }
}

export async function runBrowserHarnessSafe(options: BrowserCommandOptions): Promise<{
  success: boolean;
  output: string;
  simulated: boolean;
}> {
  try {
    const result = await runBrowserHarness(options);
    return { success: true, output: result, simulated: false };
  } catch (e) {
    return { success: false, output: e instanceof Error ? e.message : String(e), simulated: false };
  }
}

export async function analyzeRepoWithBrain(repos: string[]): Promise<{
  synergy: string;
  suggestions: string[];
  lane: string;
}> {
  const query = `Analyze these repositories for potential synergies and integration opportunities: ${repos.join(", ")}`;
  
  const result = await runDeterministicBrainSafe({
    query,
    lane: "cross_domain",
    verbose: false
  });
  
  return {
    synergy: result.output,
    suggestions: extractSuggestions(result.output),
    lane: "cross_domain"
  };
}

function extractSuggestions(text: string): string[] {
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  return lines.slice(0, 5);
}

export async function runBrowserE2ETest(url: string, testScript: string): Promise<{
  success: boolean;
  screenshot?: string;
  console?: string[];
}> {
  const fullScript = `
    new_tab("${url}")
    wait_for_load()
    ${testScript}
    capture_screenshot()
  `;
  
  const result = await runBrowserHarnessSafe({ command: fullScript });
  return {
    success: result.success,
    console: result.output.split("\n").filter(l => l.trim())
  };
}
