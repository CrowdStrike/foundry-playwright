import { Page, FrameLocator } from '@playwright/test';
import { SocketNavigationPage } from './SocketNavigationPage';

export class CaseExtensionPage extends SocketNavigationPage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToCasePanel(): Promise<void> {
    return this.withTiming(async () => {
      this.logger.info('Navigating to case panel');

      await this.navigateToNGSIEMCases();
      await this.page.waitForLoadState('domcontentloaded');

      const firstCaseButton = this.page.locator('[role="gridcell"] button, [role="row"]:has([role="gridcell"]) a').first();
      await firstCaseButton.waitFor({ state: 'visible', timeout: 15000 });
      await firstCaseButton.click();

      const dialog = this.page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: 15000 });

      this.logger.success('Navigated to case panel');
    }, 'Navigate to case panel');
  }

  async openExtension(extensionName: string): Promise<FrameLocator> {
    await this.navigateToCasePanel();
    return this.expandExtensionInSocket(extensionName);
  }

  async verifyExtensionExists(extensionName: string): Promise<void> {
    await this.navigateToCasePanel();
    return this.verifyExtensionInSocket(extensionName);
  }
}
