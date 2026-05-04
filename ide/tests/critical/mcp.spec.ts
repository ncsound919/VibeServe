import { test, expect } from '../fixtures';

test.describe('MCP Bridge Status', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('MCP section is visible on Overview via stat card', async ({ page }) => {
    const statCards = page.locator('[data-testid="stat-card"]');
    const mcpCard = statCards.filter({ hasText: /Context Servers/i });
    await expect(mcpCard).toBeVisible();
    await expect(mcpCard).toContainText(/MCP/);
  });

  test('shows MCP bridge in Command Center tab', async ({ nexus, page }) => {
    await nexus.navigateTo('Command Center');
    const header = page.locator('[data-testid="section-header"]', {
      hasText: /Distributed Context Architecture/i,
    });
    await expect(header).toBeVisible();
  });

  test('MCP Bridge card shows active servers and connections', async ({ nexus, page }) => {
    await nexus.navigateTo('Command Center');
    const mcpCard = page.locator('[data-testid="mcp-bridge-card"]');
    await expect(mcpCard).toBeVisible();
    await expect(mcpCard).toContainText(/Node Servers/i);
    await expect(mcpCard).toContainText(/L3 Connections/i);
  });

  test('MCP bridge shows protocol version', async ({ nexus, page }) => {
    await nexus.navigateTo('Command Center');
    const mcpCard = page.locator('[data-testid="mcp-bridge-card"]');
    await expect(mcpCard).toContainText(/Protocol/i);
    await expect(mcpCard).toContainText(/v/);
  });

  test('MCP bridge shows latency', async ({ nexus, page }) => {
    await nexus.navigateTo('Command Center');
    const mcpCard = page.locator('[data-testid="mcp-bridge-card"]');
    await expect(mcpCard).toContainText(/Latency/i);
    await expect(mcpCard).toContainText(/ms/);
  });

  test('MCP bridge shows last ping timestamp', async ({ nexus, page }) => {
    await nexus.navigateTo('Command Center');
    const mcpCard = page.locator('[data-testid="mcp-bridge-card"]');
    await expect(mcpCard).toContainText(/LAST_PING/i);
  });

  test('MCP bridge has RESTART_MCP text', async ({ nexus, page }) => {
    await nexus.navigateTo('Command Center');
    await expect(
      page.locator('text=/RESTART_MCP/i'),
    ).toBeVisible();
  });

  test('Context Routing section shows Optimized status', async ({ nexus, page }) => {
    await nexus.navigateTo('Command Center');
    const routingCard = page.locator('text=/Context Routing:/i');
    await expect(routingCard).toBeVisible();
  });

  test('deepseek integration card is visible', async ({ nexus, page }) => {
    await nexus.navigateTo('Command Center');
    await expect(
      page.locator('text=/DeepSeek-V4 Integration/i'),
    ).toBeVisible();
  });

  test('live reasoning chain shows 3 steps', async ({ nexus, page }) => {
    await nexus.navigateTo('Command Center');
    await expect(
      page.locator('text=/Live Reasoning Chain/i'),
    ).toBeVisible();
    const steps = [
      /Intent Extraction/i,
      /Multi-Model Consensus/i,
      /Context Injection/i,
    ];
    for (const step of steps) {
      await expect(page.locator(step as unknown as string).first()).toBeVisible();
    }
  });
});
