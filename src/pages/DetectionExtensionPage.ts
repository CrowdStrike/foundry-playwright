import { Page, expect, FrameLocator } from '@playwright/test';
import { SocketNavigationPage } from './SocketNavigationPage';

export class DetectionExtensionPage extends SocketNavigationPage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to detections and open the first one.
   * Shorthand for navigateToEndpointDetections() + openFirstDetection().
   */
  async navigateToDetectionDetails(): Promise<void> {
    await this.navigateToEndpointDetections();
    await this.openFirstDetection();
  }

  /**
   * Find an extension button by name, scroll to it, expand it, and return the iframe FrameLocator.
   *
   * @param extensionName The visible name of the extension button (e.g., 'hello', 'Charlotte Toolkit')
   * @param options.exact Use exact name match (default: true)
   * @returns FrameLocator for the extension's iframe
   */
  async expandExtension(extensionName: string, options: { exact?: boolean } = {}): Promise<FrameLocator> {
    const exact = options.exact ?? true;

    return this.withTiming(
      async () => {
        this.logger.info(`Expanding extension: ${extensionName}`);

        const extensionButton = exact
          ? this.page.getByRole('button', { name: extensionName, exact: true })
          : this.page.getByRole('button', { name: new RegExp(extensionName, 'i') }).first();

        await extensionButton.scrollIntoViewIfNeeded({ timeout: 10000 });
        await expect(extensionButton).toBeVisible({ timeout: 10000 });

        const isExpanded = await extensionButton.getAttribute('aria-expanded');
        if (isExpanded === 'false' || isExpanded === null) {
          await extensionButton.click();
        }

        await expect(this.page.locator('iframe[name="portal"]')).toBeVisible({ timeout: 15000 });

        this.logger.success(`Extension "${extensionName}" expanded`);
        return this.page.frameLocator('iframe[name="portal"]');
      },
      `Expand extension: ${extensionName}`
    );
  }

  /**
   * Navigate to detection details and expand an extension in one call.
   * Returns the iframe FrameLocator for content verification.
   *
   * ```ts
   * const frame = await page.openExtension('hello');
   * await expect(frame.getByText('My App')).toBeVisible();
   * ```
   */
  async openExtension(extensionName: string, options: { exact?: boolean } = {}): Promise<FrameLocator> {
    await this.navigateToDetectionDetails();
    return this.expandExtension(extensionName, options);
  }

  /**
   * Verify an extension button exists in the detection details panel (without expanding it)
   */
  async verifyExtensionExists(extensionName: string): Promise<void> {
    return this.withTiming(
      async () => {
        const extensionButton = this.page.getByRole('button', { name: new RegExp(extensionName, 'i') }).first();
        await extensionButton.scrollIntoViewIfNeeded({ timeout: 10000 });
        await expect(extensionButton).toBeVisible({ timeout: 10000 });
        this.logger.success(`Extension '${extensionName}' found in detection details`);
      },
      `Verify extension exists: ${extensionName}`
    );
  }
}
