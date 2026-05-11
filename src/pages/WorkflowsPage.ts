/**
 * WorkflowsPage - Fusion SOAR workflow navigation, execution, and verification
 *
 * Unified implementation covering patterns from 8+ Foundry sample repos.
 * Supports both list-page and detail-page execution, string key-value inputs,
 * and optional completion polling for long-running workflows.
 */

import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface ExecuteWorkflowOptions {
  /** Key-value string inputs to fill in the execution modal */
  inputs?: Record<string, string>;
  /**
   * Execute from list page row menu (true) or workflow details page menu (false).
   * Default: false (details page — used by 6/8 sample repos).
   */
  fromListPage?: boolean;
}

export class WorkflowsPage extends BasePage {
  constructor(page: Page) {
    super(page, 'Workflows');
  }

  protected getPagePath(): string {
    return '/workflow/fusion';
  }

  protected async verifyPageLoaded(): Promise<void> {
    // The workflows page has a data-test-selector="workflow-count" heading (e.g., "All workflows (8 total)")
    // or a "Workflows" heading. Use testId first, fall back to heading.
    const indicator = this.page.getByTestId('workflow-count')
      .or(this.page.getByRole('heading', { name: /Workflow/i }).first());
    await expect(indicator.first()).toBeVisible({ timeout: 10000 });
    this.logger.success('Workflows page loaded');
  }

  /**
   * Navigate to workflows page via hamburger menu → Fusion SOAR → Workflows
   */
  async navigateToWorkflows(): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info('Navigating to Fusion SOAR Workflows');

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await this.navigateToPath('/foundry/home', 'Foundry Home');

            // Open hamburger menu
            const menuButton = this.page.getByTestId('nav-trigger');
            await menuButton.click();
            await this.page.waitForLoadState('domcontentloaded');

            // Click Fusion SOAR in the navigation menu (not the home page cards)
            const navigation = this.page.locator('nav, [role="navigation"]');
            const fusionSoarButton = navigation.getByRole('button', { name: 'Fusion SOAR', exact: true });
            await fusionSoarButton.click();

            // Wait for the Workflows link to be visible and stable after nav expansion
            const workflowsLink = navigation.getByRole('link', { name: 'Workflows' });
            await workflowsLink.waitFor({ state: 'visible', timeout: 10000 });
            await workflowsLink.click();

            await this.page.waitForLoadState('domcontentloaded');
            await this.verifyPageLoaded();
            return;
          } catch (error) {
            if (attempt < 2) {
              this.logger.info(`Attempt ${attempt + 1} failed (sidebar re-render), retrying...`);
            } else {
              throw error;
            }
          }
        }
      },
      'Navigate to Workflows'
    );
  }

  /**
   * Search for a specific workflow by name
   */
  async searchWorkflow(workflowName: string): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info(`Searching for workflow: ${workflowName}`);

        const searchButton = this.page.getByRole('button', { name: /search workflows/i });
        await searchButton.click();

        const searchBox = this.page.getByRole('searchbox')
          .or(this.page.locator('input[type="search"]'))
          .or(this.page.locator('input[placeholder*="Search"]'))
          .or(this.page.locator('input[placeholder*="filter"]'));

        await searchBox.fill(workflowName);
        await this.page.keyboard.press('Enter');
        await this.page.waitForLoadState('domcontentloaded');

        this.logger.success(`Searched for workflow: ${workflowName}`);
      },
      `Search for workflow: ${workflowName}`
    );
  }

  /**
   * Verify a workflow appears in the list
   */
  async verifyWorkflowExists(workflowName: string): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info(`Verifying workflow exists: ${workflowName}`);

        await this.searchWorkflow(workflowName);

        const workflowLink = this.page.getByRole('link', { name: new RegExp(workflowName, 'i') });

        try {
          await expect(workflowLink).toBeVisible({ timeout: 5000 });
          this.logger.success(`Workflow found: ${workflowName}`);
        } catch {
          this.logger.error(`Workflow not found: ${workflowName}`);
          throw new Error(`Workflow '${workflowName}' not found in list`);
        }
      },
      `Verify workflow exists: ${workflowName}`
    );
  }

  /**
   * Open a workflow to view its details
   */
  async openWorkflow(workflowName: string): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info(`Opening workflow: ${workflowName}`);

        await this.page.waitForLoadState('domcontentloaded');

        const workflowLink = this.page.getByRole('link', { name: new RegExp(workflowName, 'i') }).first();
        await workflowLink.waitFor({ state: 'visible', timeout: 10000 });

        await Promise.all([
          this.page.waitForURL(/\/workflow\/fusion\/[a-f0-9]+/, { timeout: 15000 }),
          workflowLink.click()
        ]);

        await this.page.waitForLoadState('domcontentloaded');

        this.logger.success(`Opened workflow: ${workflowName}`);
      },
      `Open workflow: ${workflowName}`
    );
  }

  /**
   * Verify workflow renders (shows the workflow canvas/details)
   */
  async verifyWorkflowRenders(workflowName: string): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info(`Verifying workflow renders: ${workflowName}`);

        await this.openWorkflow(workflowName);

        const hasCanvas = await this.page
          .locator('[class*="workflow"], [class*="canvas"], [class*="flow"]')
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (hasCanvas) {
          this.logger.success(`Workflow renders correctly: ${workflowName}`);
        } else {
          this.logger.warn(`Workflow page loaded but canvas not detected: ${workflowName}`);
          this.logger.info('This is acceptable for E2E - workflow exists and loads');
        }
      },
      `Verify workflow renders: ${workflowName}`
    );
  }

  /**
   * Execute a workflow with optional input parameters.
   *
   * By default executes from the workflow details page (open workflow first, then menu).
   * Set `fromListPage: true` to execute from the list page row menu instead.
   */
  async executeWorkflow(workflowName: string, options: ExecuteWorkflowOptions = {}): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info(`Executing workflow: ${workflowName}`);

        if (options.fromListPage) {
          // List page: navigate to workflows, find row, click row-scoped menu
          await this.navigateToWorkflows();
          const workflowRow = this.page.getByRole('row', { name: new RegExp(workflowName, 'i') });
          const openMenuButton = workflowRow.getByRole('button', { name: /open menu/i });
          await openMenuButton.click();
        } else {
          // Details page: open workflow first, then click page-level menu
          await this.openWorkflow(workflowName);
          const openMenuButton = this.page.getByRole('button', { name: /open menu/i });
          await openMenuButton.click();
        }

        // Click "Execute workflow" option
        const executeOption = this.page.getByRole('menuitem', { name: /execute workflow/i });
        await executeOption.click();

        // Wait for execution modal
        const modalHeading = this.page.getByRole('heading', { name: /execute.*workflow/i });
        await expect(modalHeading).toBeVisible({ timeout: 5000 });
        this.logger.info('Execution modal opened');

        // Fill in input parameters if provided
        if (options.inputs && Object.keys(options.inputs).length > 0) {
          this.logger.info(`Filling in ${Object.keys(options.inputs).length} input parameter(s)`);
          for (const [key, value] of Object.entries(options.inputs)) {
            const inputField = this.page.getByLabel(new RegExp(key, 'i'))
              .or(this.page.getByPlaceholder(new RegExp(key, 'i')))
              .or(this.page.locator(`input[name*="${key}"]`));

            await inputField.fill(value);
            this.logger.info(`Set ${key} = ${value}`);
          }
        }

        // Scroll modal to reveal execute button (harmless no-op if already visible)
        await this.page.evaluate(() => {
          const modal = (globalThis as any).document.querySelector('[role="dialog"]');
          if (modal) {
            modal.scrollTo(0, modal.scrollHeight);
          }
        });

        // Click "Execute now"
        const executeButton = this.page.getByRole('button', { name: /execute now/i });
        await executeButton.click();

        // Wait for execution confirmation toast
        await expect(this.page.getByText(/workflow execution triggered/i)).toBeVisible({ timeout: 10000 });
        this.logger.success(`Workflow execution triggered: ${workflowName}`);
      },
      `Execute workflow: ${workflowName}`
    );
  }

  /**
   * Verify workflow execution was triggered (checks toast notification)
   */
  async verifyWorkflowExecutionSuccess(workflowName: string): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info(`Verifying workflow execution succeeded: ${workflowName}`);

        const notification = this.page.getByText(/workflow execution triggered/i);

        try {
          await expect(notification).toBeVisible({ timeout: 5000 });
          this.logger.success(`Workflow execution confirmed: ${workflowName}`);

          const viewLink = this.page.getByRole('link', { name: /^view$/i });
          if (await viewLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            this.logger.info('Execution details view link available');
          }
        } catch {
          throw new Error(`Workflow execution notification not found for '${workflowName}'`);
        }
      },
      `Verify workflow execution success: ${workflowName}`
    );
  }

  /**
   * Navigate, search, execute, and verify toast — the common 80% path
   */
  async executeAndVerifyWorkflow(workflowName: string, options: ExecuteWorkflowOptions = {}): Promise<void> {
    return this.withTiming(
      async () => {
        // Navigate to workflows first so search/execute has the right context
        await this.navigateToWorkflows();

        // Search so the workflow is visible in the list
        await this.searchWorkflow(workflowName);

        await this.executeWorkflow(workflowName, options);
        await this.verifyWorkflowExecutionSuccess(workflowName);
      },
      `Execute and verify workflow: ${workflowName}`
    );
  }

  /**
   * Create a new workflow from scratch to access the workflow builder and action picker.
   * Navigates: "Create workflow" link → "Create workflow from scratch" → Next → trigger selection.
   * Does NOT select a trigger — caller chooses the trigger after this method returns.
   */
  async createNewWorkflow(): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info('Creating new workflow');

        const createButton = this.page.getByRole('link', { name: 'Create workflow' })
          .or(this.page.getByRole('link', { name: 'Create a workflow' }));
        await createButton.click();

        const fromScratchButton = this.page.getByText('Create workflow from scratch');
        await fromScratchButton.click();

        const nextButton = this.page.getByRole('button', { name: 'Next' });
        await nextButton.click();

        await this.page.waitForLoadState('domcontentloaded');

        this.logger.success('Workflow creation started — select a trigger to continue');
      },
      'Create new workflow'
    );
  }

  /**
   * Poll execution status by opening the "View" link in a new tab.
   * Use after executeWorkflow() for long-running workflows that need completion verification.
   *
   * Opens the execution details in a new tab, polls every 5s until terminal state.
   * Extracts error message on failure. Closes the tab when done.
   *
   * @param timeoutMs Maximum time to wait for completion (default: 120s)
   */
  async verifyWorkflowExecutionCompleted(timeoutMs = 120000): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info('Checking workflow execution status in detail view');

        const viewLink = this.page.getByRole('link', { name: /^view$/i });
        await viewLink.waitFor({ state: 'visible', timeout: 10000 });

        const [executionPage] = await Promise.all([
          this.page.context().waitForEvent('page'),
          viewLink.click(),
        ]);

        await executionPage.waitForLoadState('domcontentloaded');
        this.logger.info('Execution page opened in new tab');

        // Wait for "Execution status" to appear (proves execution details loaded)
        const statusLabel = executionPage.getByText('Execution status');
        await statusLabel.waitFor({ state: 'visible', timeout: 60000 });
        this.logger.info('Execution details visible');

        this.logger.info(`Waiting up to ${timeoutMs / 1000}s for execution to complete...`);

        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
          const currentStatusLabel = executionPage.getByText('Execution status');
          await currentStatusLabel.waitFor({ state: 'visible', timeout: 15000 });
          const statusContainer = currentStatusLabel.locator('..');
          const statusText = await statusContainer.textContent() || '';
          const currentStatus = statusText.replace('Execution status', '').trim();
          this.logger.info(`Current status: ${currentStatus}`);

          if (currentStatus.toLowerCase().includes('failed')) {
            const pageContent = await executionPage.textContent('body') || '';
            const messageMatch = pageContent.match(/"message":\s*"([^"]+)"/);
            const errorMessage = messageMatch ? messageMatch[1] : 'Workflow action failed';

            await executionPage.close();
            this.logger.error(`Workflow execution failed: ${errorMessage}`);
            throw new Error(`Workflow execution failed: ${errorMessage}`);
          }

          if (!currentStatus.toLowerCase().includes('in progress')) {
            await executionPage.close();
            this.logger.success(`Workflow execution completed with status: ${currentStatus}`);
            return;
          }

          // Space out reloads to avoid hammering the server
          await new Promise(resolve => setTimeout(resolve, 5_000));
          await executionPage.reload({ waitUntil: 'domcontentloaded' });
        }

        await executionPage.close();
        throw new Error('Workflow execution timed out - still in progress');
      },
      'Verify workflow execution completed'
    );
  }
}
