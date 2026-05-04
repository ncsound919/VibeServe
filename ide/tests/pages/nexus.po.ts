import { type Locator, type Page, expect } from '@playwright/test';

const TAB_IDS = {
  VibeCoder: 'nav-item-vibecoder',
  Overview: 'nav-item-overview',
  'Command Center': 'nav-item-command-center',
  Pipeline: 'nav-item-pipeline',
  Activity: 'nav-item-activity',
  History: 'nav-item-history',
  'YouTube Pulse': 'nav-item-youtube-pulse',
  'Repo Analysis': 'nav-item-repo-analysis',
  'LLM Wiki': 'nav-item-llm-wiki',
  Settings: 'nav-item-settings',
} as const;

export type TabName = keyof typeof TAB_IDS;

export class NexusApp {
  readonly page: Page;
  readonly main: Locator;
  readonly header: Locator;
  readonly sidebar: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.main = page.locator('main');
    this.header = page.locator('header');
    this.sidebar = page.locator('aside');
    this.footer = page.locator('footer');
  }

  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.waitForHydration();
  }

  async waitForHydration() {
    await this.page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.length > 100 && !text.includes('Initializing Nexus');
      },
      { timeout: 15000 },
    );
    await expect(this.main).toBeVisible({ timeout: 10000 });
  }

  async navigateTo(tab: TabName) {
    const id = TAB_IDS[tab];
    const btn = this.page.locator(`#${id}`);
    await btn.click();
    await this.page.waitForFunction(
      (expectedId) => {
        const el = document.getElementById(expectedId);
        return el?.classList.contains('text-emerald-400');
      },
      id,
      { timeout: 5000 },
    );
  }

  async mockApi(pattern: string, response: unknown) {
    await this.page.route(pattern, async (route) => {
      await route.fulfill({ json: response });
    });
  }

  async clearMocks() {
    await this.page.unrouteAll({ behavior: 'wait' });
  }

  getStatCards() {
    return this.page.locator('[data-testid="stat-card"]');
  }

  getStatCardValue(index: number) {
    return this.getStatCards().nth(index).locator('[data-testid="stat-value"]');
  }

  getStatCardTitle(index: number) {
    return this.getStatCards().nth(index).locator('[data-testid="stat-title"]');
  }

  getSectionHeader(name: string) {
    return this.page.locator(`[data-testid="section-header"]`, {
      hasText: name,
    });
  }
}
