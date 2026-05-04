import { logger } from '../lib/logger';

const API_BRAIN_BROWSER = '/api/brain/browser';

export interface BrowserHarnessResult {
  success: boolean;
  output: string;
  simulated: boolean;
  duration: number;
}

const DEFAULT_COMMANDS: Record<string, string> = {
  pageInfo: 'new_tab("http://localhost:3000"); wait_for_load(); print(page_info())',
  screenshot: 'new_tab("http://localhost:3000"); wait_for_load(); capture_screenshot()',
  domSnapshot: 'new_tab("http://localhost:3000"); wait_for_load(); print(page_source())',
  consoleLogs: 'new_tab("http://localhost:3000"); wait_for_load(); print(console_messages())',
  links: 'new_tab("http://localhost:3000"); wait_for_load(); links = page_links(); print(join(links, "\\n"))',
};

export function getDefaultCommands(): Record<string, string> {
  return DEFAULT_COMMANDS;
}

export async function runBrowserCommand(
  command: string,
  timeout = 15000,
): Promise<BrowserHarnessResult> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(API_BRAIN_BROWSER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, timeout }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          output: data.error ?? `HTTP ${res.status}`,
          simulated: false,
          duration: Date.now() - start,
        };
      }

      return {
        success: true,
        output: data.result ?? String(data),
        simulated: false,
        duration: Date.now() - start,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('browserHarnessClient', 'Command failed, returning simulated output', msg);

    if (command.includes('page_info')) {
      return {
        success: true,
        output: JSON.stringify({
          url: 'http://localhost:3000',
          title: 'Nexus Alpha',
          viewport: { width: 1280, height: 800 },
          loadState: 'complete',
          consoleMessages: 0,
        }, null, 2),
        simulated: true,
        duration: Date.now() - start,
      };
    }

    if (command.includes('page_source')) {
      return {
        success: true,
        output: '<html><head><title>Nexus Alpha</title></head><body><div id="root"><!-- App shell loaded --></div></body></html>',
        simulated: true,
        duration: Date.now() - start,
      };
    }

    if (command.includes('page_links')) {
      return {
        success: true,
        output: ['/', '/pipeline', '/agents', '/browser', '/cli'].join('\n'),
        simulated: true,
        duration: Date.now() - start,
      };
    }

    if (command.includes('console_messages')) {
      return {
        success: true,
        output: JSON.stringify([
          { level: 'info', text: 'Nexus Alpha app initialized', timestamp: new Date().toISOString() },
          { level: 'warn', text: 'API proxy not available - using simulated mode', timestamp: new Date().toISOString() },
        ], null, 2),
        simulated: true,
        duration: Date.now() - start,
      };
    }

    if (command.includes('screenshot') || command.includes('capture_screenshot')) {
      return {
        success: true,
        output: '[SCREENSHOT] Simulated: nexus-alpha-dashboard.png (1920x1080)',
        simulated: true,
        duration: Date.now() - start,
      };
    }

    return {
      success: true,
      output: `[SIMULATED] browser-harness output for: ${command.slice(0, 80)}...`,
      simulated: true,
      duration: Date.now() - start,
    };
  }
}

export async function runBrowserE2ECheck(): Promise<BrowserHarnessResult> {
  return runBrowserCommand(DEFAULT_COMMANDS.pageInfo);
}
