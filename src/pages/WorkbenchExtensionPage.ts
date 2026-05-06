import { Page, FrameLocator } from '@playwright/test';
import { SocketNavigationPage } from './SocketNavigationPage';

export class WorkbenchExtensionPage extends SocketNavigationPage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToWorkbenchDetails(): Promise<void> {
    return this.withTiming(async () => {
      this.logger.info('Navigating to workbench details');
      await this.navigateToNGSIEMCaseExtension();
      this.logger.success('Navigated to workbench details');
    }, 'Navigate to workbench details');
  }

  async openExtension(extensionName: string): Promise<FrameLocator> {
    await this.navigateToWorkbenchDetails();
    return this.expandExtensionInSocket(extensionName);
  }

  async verifyExtensionExists(extensionName: string): Promise<void> {
    await this.navigateToWorkbenchDetails();
    return this.verifyExtensionInSocket(extensionName);
  }
}
