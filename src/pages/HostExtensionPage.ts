import { Page, expect, FrameLocator } from '@playwright/test';
import { SocketNavigationPage } from './SocketNavigationPage';

export class HostExtensionPage extends SocketNavigationPage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToHostDetails(): Promise<void> {
    return this.withTiming(async () => {
      this.logger.info('Navigating to host details panel');

      await this.navigateToPath('/foundry/home', 'Foundry home');
      await this.page.waitForLoadState('domcontentloaded');

      const menuButton = this.page.getByTestId('nav-trigger');
      await menuButton.click();
      await this.page.waitForLoadState('domcontentloaded');

      const hostSetupButton = this.page.getByRole('button', { name: /Host setup and management/ });
      await hostSetupButton.click();
      await this.page.waitForLoadState('domcontentloaded');

      const manageEndpointsButton = this.page.getByRole('button', { name: 'Manage endpoints' });
      await manageEndpointsButton.waitFor({ state: 'visible', timeout: 10000 });
      const isExpanded = await manageEndpointsButton.getAttribute('aria-expanded');
      if (isExpanded !== 'true') {
        await manageEndpointsButton.click();
        await this.waiter.delay(500);
      }

      const hostManagementLink = this.page.getByRole('link', { name: 'Host management' });
      await hostManagementLink.click();
      await this.page.waitForLoadState('domcontentloaded');

      const heading = this.page.getByRole('heading', { name: /host.*management/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });

      const firstHostRow = this.page.locator('tbody tr').first();
      await firstHostRow.waitFor({ state: 'visible', timeout: 15000 });
      await firstHostRow.click();
      await this.page.waitForLoadState('domcontentloaded');

      this.logger.success('Navigated to host details panel');
    }, 'Navigate to host details');
  }

  async openExtension(extensionName: string): Promise<FrameLocator> {
    await this.navigateToHostDetails();
    return this.expandExtensionInSocket(extensionName);
  }

  async verifyExtensionExists(extensionName: string): Promise<void> {
    await this.navigateToHostDetails();
    return this.verifyExtensionInSocket(extensionName);
  }
}
