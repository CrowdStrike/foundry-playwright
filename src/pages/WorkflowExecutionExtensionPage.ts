import { Page, expect, FrameLocator } from '@playwright/test';
import { SocketNavigationPage } from './SocketNavigationPage';

export class WorkflowExecutionExtensionPage extends SocketNavigationPage {
  private executionPage: Page | null = null;

  constructor(page: Page) {
    super(page);
  }

  async navigateToWorkflows(): Promise<void> {
    return this.withTiming(async () => {
      this.logger.info('Navigating to Workflows page');

      await this.navigateToPath('/foundry/home', 'Foundry home');
      await this.page.waitForLoadState('domcontentloaded');

      const menuButton = this.page.getByTestId('nav-trigger');
      await menuButton.click();
      await this.page.waitForLoadState('domcontentloaded');

      const fusionSoarButton = this.page.getByTestId('popout-button').filter({ hasText: /Fusion SOAR/i });
      await fusionSoarButton.click();
      await this.page.waitForLoadState('domcontentloaded');

      const workflowsLink = this.page.getByTestId('section-link').filter({ hasText: /Workflows/i });
      await workflowsLink.waitFor({ state: 'visible', timeout: 10000 });
      await workflowsLink.click();

      await this.page.waitForLoadState('domcontentloaded');

      const pageTitle = this.page.locator('h1, [role="heading"]').first();
      await expect(pageTitle).toBeVisible({ timeout: 10000 });

      this.logger.success('Navigated to Workflows page');
    }, 'Navigate to Workflows');
  }

  async navigateToWorkflowExecution(): Promise<void> {
    return this.withTiming(async () => {
      this.logger.info('Navigating to workflow execution details');

      await this.navigateToWorkflows();

      const loader = this.page.locator('[data-test-selector="falcon-overlay-loader"]');
      await loader.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});

      const executionLogTab = this.page.locator('[data-test-selector="fusion-nav-details-link"]')
        .filter({ hasText: /Execution log/i });
      await executionLogTab.waitFor({ state: 'visible', timeout: 10000 });
      await executionLogTab.click({ force: true });
      await this.page.waitForLoadState('domcontentloaded');
      await loader.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});

      const firstExecution = this.page.locator('table a, [role="grid"] a, table tbody tr').first();
      await firstExecution.waitFor({ state: 'visible', timeout: 15000 });

      const [newPage] = await Promise.all([
        this.page.context().waitForEvent('page', { timeout: 15000 }).catch(() => null),
        firstExecution.click(),
      ]);

      if (newPage) {
        await newPage.waitForLoadState('domcontentloaded');
        this.logger.info('Workflow execution opened in new tab');
        this.executionPage = newPage;
      } else {
        await this.page.waitForLoadState('domcontentloaded');
      }

      this.logger.success('Navigated to workflow execution details');
    }, 'Navigate to workflow execution');
  }

  async openExtension(extensionName: string): Promise<FrameLocator> {
    await this.navigateToWorkflowExecution();
    const helper = new SocketNavigationPage(this.executionPage ?? this.page);
    return await helper.expandExtensionInSocket(extensionName);
  }

  async verifyExtensionExists(extensionName: string): Promise<void> {
    await this.navigateToWorkflowExecution();
    const helper = new SocketNavigationPage(this.executionPage ?? this.page);
    await helper.verifyExtensionInSocket(extensionName);
  }
}
