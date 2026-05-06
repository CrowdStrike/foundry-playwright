import { Page, expect, FrameLocator } from '@playwright/test';
import { SocketNavigationPage } from './SocketNavigationPage';

export class AutomatedLeadsExtensionPage extends SocketNavigationPage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToAutomatedLeads(): Promise<void> {
    return this.withTiming(async () => {
      this.logger.info('Navigating to Automated Leads page');

      await this.navigateToPath('/foundry/home', 'Foundry home');
      await this.page.waitForLoadState('domcontentloaded');

      const menuButton = this.page.getByTestId('nav-trigger');
      await menuButton.click();
      await this.page.waitForLoadState('domcontentloaded');

      const ngsiemButton = this.page.getByTestId('popout-button').filter({ hasText: /Next-Gen SIEM/i });
      await ngsiemButton.click();
      await this.page.waitForLoadState('domcontentloaded');

      const automatedLeadsLink = this.page.getByTestId('section-link').filter({ hasText: /Automated leads/i });
      await automatedLeadsLink.waitFor({ state: 'visible', timeout: 10000 });
      await automatedLeadsLink.click();

      await this.page.waitForLoadState('domcontentloaded');

      const pageTitle = this.page.locator('h1, [role="heading"]').first();
      await expect(pageTitle).toBeVisible({ timeout: 10000 });

      this.logger.success('Navigated to Automated Leads page');
    }, 'Navigate to Automated Leads');
  }

  async navigateToLeadDetails(): Promise<void> {
    return this.withTiming(async () => {
      this.logger.info('Navigating to lead details');

      await this.navigateToAutomatedLeads();

      const firstLeadRow = this.page.getByRole('row').nth(1).getByRole('link').or(
        this.page.getByRole('row').nth(1).getByRole('button')
      ).first();
      await firstLeadRow.waitFor({ state: 'visible', timeout: 15000 });
      await firstLeadRow.click();

      await this.page.waitForLoadState('domcontentloaded');

      this.logger.success('Navigated to lead details');
    }, 'Navigate to lead details');
  }

  async openExtension(extensionName: string): Promise<FrameLocator> {
    await this.navigateToLeadDetails();
    return this.expandExtensionInSocket(extensionName);
  }

  async verifyExtensionExists(extensionName: string): Promise<void> {
    await this.navigateToLeadDetails();
    return this.verifyExtensionInSocket(extensionName);
  }
}
