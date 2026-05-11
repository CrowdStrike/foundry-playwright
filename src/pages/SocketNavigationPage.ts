import { Page, expect, FrameLocator } from '@playwright/test';
import { BasePage } from './BasePage';

export class SocketNavigationPage extends BasePage {
  constructor(page: Page) {
    super(page, 'Socket Navigation');
  }

  protected getPagePath(): string {
    throw new Error('Socket navigation does not have a direct path - use menu navigation');
  }

  protected async verifyPageLoaded(): Promise<void> {}

  async navigateToEndpointDetections(): Promise<void> {
    return this.withTiming(async () => {
      this.logger.info('Navigating to Endpoint Detections page');

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.navigateToPath('/foundry/home', 'Foundry home');
          await this.page.waitForLoadState('domcontentloaded');

          const menuButton = this.page.getByTestId('nav-trigger');
          await menuButton.click();
          await this.page.waitForLoadState('domcontentloaded');

          const endpointSecurityButton = this.page.getByRole('button', { name: /Endpoint security/ });
          await endpointSecurityButton.click();

          const monitorButton = this.page.getByRole('button', { name: 'Monitor', exact: true });
          await monitorButton.waitFor({ state: 'visible', timeout: 15000 });
          const isExpanded = await monitorButton.getAttribute('aria-expanded');
          if (isExpanded !== 'true') {
            await monitorButton.click();
            await this.waiter.delay(500);
          }

          const endpointDetectionsLink = this.page.getByRole('link', { name: /Endpoint detections/ });
          await endpointDetectionsLink.click();

          await this.page.waitForLoadState('domcontentloaded');

          const pageTitle = this.page.locator('h1, h2').filter({ hasText: /Detections/i }).first();
          await expect(pageTitle).toBeVisible({ timeout: 10000 });

          this.logger.success('Navigated to Endpoint Detections page');
          return;
        } catch (error) {
          if (attempt < 2) {
            this.logger.info(`Attempt ${attempt + 1} failed (sidebar re-render), retrying...`);
          } else {
            throw error;
          }
        }
      }
    }, 'Navigate to Endpoint Detections');
  }

  async navigateToNGSIEMCases(): Promise<void> {
    return this.withTiming(async () => {
      this.logger.info('Navigating to NGSIEM Cases page');

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.navigateToPath('/foundry/home', 'Foundry home');
          await this.page.waitForLoadState('domcontentloaded');

          const menuButton = this.page.getByTestId('nav-trigger');
          await menuButton.click();
          await this.page.waitForLoadState('domcontentloaded');

          const ngsiemButton = this.page.getByTestId('popout-button').filter({ hasText: /Next-Gen SIEM/i });
          await ngsiemButton.click();
          await this.page.waitForLoadState('domcontentloaded');

          const casesLink = this.page.getByTestId('section-link').filter({ hasText: /Cases/i });
          await casesLink.waitFor({ state: 'visible', timeout: 10000 });
          await casesLink.click();

          await this.page.waitForLoadState('domcontentloaded');

          const pageTitle = this.page.locator('h1, [role="heading"]').first();
          await expect(pageTitle).toBeVisible({ timeout: 10000 });

          this.logger.success('Navigated to NGSIEM Cases page');
          return;
        } catch (error) {
          if (attempt < 2) {
            this.logger.info(`Attempt ${attempt + 1} failed (sidebar re-render), retrying...`);
          } else {
            throw error;
          }
        }
      }
    }, 'Navigate to NGSIEM Cases');
  }

  async openFirstDetection(): Promise<void> {
    return this.withTiming(async () => {
      await this.page.waitForLoadState('domcontentloaded');

      const firstDetectionButton = this.page.locator('[role="gridcell"] button').first();
      await firstDetectionButton.waitFor({ state: 'visible', timeout: 10000 });
      await firstDetectionButton.click();

      await this.page.waitForLoadState('domcontentloaded');
    }, 'Open first detection');
  }

  async openFirstCaseDetail(): Promise<void> {
    return this.withTiming(async () => {
      await this.page.waitForLoadState('domcontentloaded');

      const firstCaseButton = this.page.locator('[role="gridcell"] button, [role="row"]:has([role="gridcell"]) a').first();
      await firstCaseButton.waitFor({ state: 'visible', timeout: 15000 });
      await firstCaseButton.click();

      const dialog = this.page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: 15000 });

      const seeFullCaseLink = dialog.getByRole('link', { name: /See full case/i });
      await seeFullCaseLink.waitFor({ state: 'visible', timeout: 10000 });
      await seeFullCaseLink.click();

      await this.page.waitForLoadState('domcontentloaded');
    }, 'Open first case detail');
  }

  async waitForGraphAndClickNode(searchTerm: string = 'e'): Promise<void> {
    return this.withTiming(async () => {
      const graphContainer = this.page.locator('.keylines-container, canvas, svg').first();
      await graphContainer.waitFor({ state: 'visible', timeout: 30000 });
      await this.page.waitForLoadState('domcontentloaded');

      let searchBox = this.page.getByRole('searchbox').first();
      const searchBoxVisible = await searchBox.isVisible().catch(() => false);

      if (!searchBoxVisible) {
        const searchButton = this.page.getByRole('button', { name: 'Search on graph' });
        await searchButton.waitFor({ state: 'visible', timeout: 10000 });
        await searchButton.click();
        await searchBox.waitFor({ state: 'visible', timeout: 5000 });
      }

      await searchBox.clear();
      await searchBox.fill(searchTerm);

      const resultButtons = this.page.locator('button').filter({ hasText: /Matches/i });
      await resultButtons.first().waitFor({ state: 'visible', timeout: 10000 });
      await resultButtons.first().click();

      await this.page.waitForLoadState('domcontentloaded');
    }, 'Wait for graph and click node');
  }

  async navigateToCaseExtension(): Promise<void> {
    return this.withTiming(async () => {
      await this.openFirstCaseDetail();
      await this.waitForGraphAndClickNode();
    }, 'Navigate to case extension');
  }

  async navigateToNGSIEMCaseExtension(): Promise<void> {
    return this.withTiming(async () => {
      await this.navigateToNGSIEMCases();
      await this.navigateToCaseExtension();
    }, 'Navigate to NGSIEM case extension');
  }

  private async scrollToExtension(extensionName: string): Promise<void> {
    const extensionButton = this.page.getByRole('button', { name: new RegExp(extensionName, 'i') }).first();

    for (let attempt = 0; attempt < 10; attempt++) {
      const visible = await extensionButton.isVisible().catch(() => false);
      if (visible) {
        await extensionButton.scrollIntoViewIfNeeded({ timeout: 5000 });
        return;
      }
      await this.page.keyboard.press('End');
      await this.page.waitForLoadState('domcontentloaded');
    }

    await extensionButton.scrollIntoViewIfNeeded({ timeout: 10000 });
  }

  async verifyExtensionInSocket(extensionName: string): Promise<void> {
    return this.withTiming(async () => {
      await this.scrollToExtension(extensionName);

      const extensionButton = this.page.getByRole('button', { name: new RegExp(extensionName, 'i') }).first();
      await expect(extensionButton).toBeVisible({ timeout: 10000 });

      this.logger.success(`Extension "${extensionName}" found in socket`);
    }, `Verify extension "${extensionName}" in socket`);
  }

  async expandExtensionInSocket(extensionName: string): Promise<FrameLocator> {
    return this.withTiming(async () => {
      this.logger.info(`Expanding extension: ${extensionName}`);

      await this.scrollToExtension(extensionName);

      const extensionButton = this.page.getByRole('button', { name: new RegExp(extensionName, 'i') }).first();
      await expect(extensionButton).toBeVisible({ timeout: 10000 });

      const isExpanded = await extensionButton.getAttribute('aria-expanded');
      if (isExpanded === 'false' || isExpanded === null) {
        await extensionButton.click();
      }

      await expect(this.page.locator('iframe[name="portal"]')).toBeVisible({ timeout: 15000 });

      this.logger.success(`Extension "${extensionName}" expanded`);
      return this.page.frameLocator('iframe[name="portal"]');
    }, `Expand extension "${extensionName}"`);
  }

  async clickExtensionTab(extensionName: string): Promise<void> {
    return this.withTiming(async () => {
      const tab = this.page.getByRole('tab', { name: new RegExp(extensionName, 'i') });
      await tab.click({ force: true });
    }, `Click extension tab "${extensionName}"`);
  }
}
