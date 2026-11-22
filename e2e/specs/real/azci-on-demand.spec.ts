import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openAgentBuilder } from '../mock/agents.helpers';
import { fetchJson, getAccessToken } from '../mock/helpers';

/**
 * LOCAL-ONLY real-provider verification of the Azure code-interpreter MCP tool's
 * on-demand files. Skipped unless AZCI_E2E=1, because it needs a running azureci
 * MCP server, the test agent, and a file already added to its MCP files pool.
 *
 *   AZCI_E2E=1 AZCI_AGENT_NAME="Azure Code Interpreter" AZCI_FILE=contract.docx \
 *   AZCI_EXPECT="Service Agreement" npx playwright test e2e/specs/real/azci-on-demand.spec.ts
 */

const AGENT_NAME = process.env.AZCI_AGENT_NAME ?? 'Azure Code Interpreter';
const USER_EMAIL = process.env.AZCI_USER ?? 'azci-test@local.test';
const USER_PASSWORD = process.env.AZCI_PASSWORD ?? 'AzciTest123!';
const FILE_NAME = process.env.AZCI_FILE ?? 'contract.docx';
const EXPECTED_TEXT = process.env.AZCI_EXPECT ?? 'Service Agreement';

type AgentSummary = { id: string; name: string };

async function selectAgentForChat(page: Page, agentName: string) {
  const form = await openAgentBuilder(page);
  await form.getByRole('combobox', { name: 'Agent', exact: true }).click();
  await page.getByRole('option', { name: agentName }).click();
  await expect(form.getByLabel('Agent name')).toHaveValue(agentName);
  await form.getByRole('button', { name: 'Select Agent' }).click();
  await expect(page.getByRole('textbox', { name: 'Message input' })).toBeVisible();
}

test.describe('azureci on-demand files (real provider)', () => {
  test.skip(process.env.AZCI_E2E !== '1', 'set AZCI_E2E=1 to run against a live azureci server');

  test('lists files without loading, then loads one on request', async ({ page }) => {
    test.setTimeout(240000);
    await page.context().clearCookies();
    await page.goto('/login');
    const loginForm = page.getByRole('form', { name: 'Login form' });
    if (await loginForm.isVisible().catch(() => false)) {
      await page.getByLabel('Email').fill(USER_EMAIL);
      await page.getByLabel('Password').fill(USER_PASSWORD);
      await page.getByTestId('login-button').click();
      await page.waitForURL(/\/c\//, { timeout: 30000 });
    }
    await page.goto('/c/new');

    const token = await getAccessToken(page);
    const agentsResponse = await fetchJson<AgentSummary[] | { agents?: AgentSummary[]; data?: AgentSummary[] }>(
      page,
      '/api/agents',
      token,
    );
    const agents = Array.isArray(agentsResponse)
      ? agentsResponse
      : (agentsResponse?.agents ?? agentsResponse?.data ?? []);
    const agent = agents.find((entry) => entry.name === AGENT_NAME);
    expect(agent, `agent "${AGENT_NAME}" should exist`).toBeTruthy();

    await selectAgentForChat(page, AGENT_NAME);

    const input = page.getByRole('textbox', { name: 'Message input' });
    await input.fill(
      'Without loading any files, use run_code to list /mnt/data and tell me which files are available.',
    );
    await input.press('Enter');
    await expect(page.getByText(FILE_NAME).last()).toBeVisible({ timeout: 180000 });
    await expect(page.getByText(/available|not loaded/i).last()).toBeVisible({ timeout: 30000 });

    const conversationId = page.url().split('/c/')[1]?.split('?')[0];
    expect(conversationId).toBeTruthy();

    await input.fill(`Now load ${FILE_NAME} with attach_files and print its contents.`);
    await input.press('Enter');
    await expect(page.getByText(EXPECTED_TEXT).last()).toBeVisible({ timeout: 180000 });
    // The tool ran: its result card carries the MCP server name.
    await expect(page.getByText('Azureci').last()).toBeVisible({ timeout: 30000 });
  });
});
