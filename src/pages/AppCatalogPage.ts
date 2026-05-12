/**
 * AppCatalogPage - App installation, uninstallation, and navigation
 *
 * Unified implementation merging battle-tested patterns from:
 * - category-blocking: dual-strategy navigation, 404 retry handler
 * - logscale: toast dismissal after install
 * - functions-python: pluggable configureSettings callback
 */

import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * App-specific configuration to run between permissions and install.
 * Apps with API credential screens (ServiceNow, Anomali, etc.) provide this.
 * Apps with no config screens pass nothing.
 */
export interface InstallConfig {
  /** Handle app-specific configuration screens after permissions. Return when done. */
  configureSettings?: (page: Page) => Promise<void>;
}

/**
 * Options for navigating to an installed app via the Custom Apps menu.
 */
export interface AppNavigationOptions {
  /** Link text/pattern to click inside the Custom Apps submenu (e.g., /data ingestion/i) */
  appLinkPattern?: RegExp;
  /** Use scoped list selector (getByRole('list', { name: appName })) instead of link pattern */
  useScopedList?: boolean;
}

export class AppCatalogPage extends BasePage {
  constructor(page: Page) {
    super(page, 'AppCatalogPage');
  }

  protected getPagePath(): string {
    return '/foundry/app-catalog';
  }

  protected async verifyPageLoaded(): Promise<void> {
    await this.waiter.waitForVisible(
      this.page.locator('text=App Catalog').or(this.page.locator('text=Apps')),
      { description: 'App Catalog page' }
    );

    this.logger.success('App Catalog page loaded successfully');
  }

  /**
   * Search for app in catalog and navigate to its detail page
   */
  private async searchAndNavigateToApp(appName: string): Promise<void> {
    this.logger.info(`Searching for app '${appName}' in catalog`);

    const filterParam = encodeURIComponent(`name:~'${appName}'`);
    await this.page.goto(`${this.getBaseURL()}/foundry/app-catalog?filter=${filterParam}`);
    await this.page.waitForLoadState('domcontentloaded');

    const appLink = this.page.getByRole('link', { name: appName, exact: true });

    try {
      await this.waiter.waitForVisible(appLink, {
        description: `App '${appName}' link in catalog`,
        timeout: 30000
      });
      this.logger.success(`Found app '${appName}' in catalog`);
      await this.smartClick(appLink, `App '${appName}' link`);
      await this.page.waitForLoadState('domcontentloaded');
    } catch {
      throw new Error(`Could not find app '${appName}' in catalog. Make sure the app is deployed.`);
    }
  }

  /**
   * Check if app is installed
   */
  async isAppInstalled(appName: string): Promise<boolean> {
    this.logger.step(`Check if app '${appName}' is installed`);

    await this.searchAndNavigateToApp(appName);

    const installLink = this.page.getByRole('link', { name: 'Install now' });
    const hasInstallLink = await this.elementExists(installLink, 3000);

    const isInstalled = !hasInstallLink;
    this.logger.info(`App '${appName}' installation status: ${isInstalled ? 'Installed' : 'Not installed'}`);

    return isInstalled;
  }

  /**
   * Install app if not already installed.
   * Pass an InstallConfig with configureSettings to handle app-specific config screens.
   */
  async installApp(appName: string, installConfig?: InstallConfig): Promise<boolean> {
    this.logger.step(`Install app '${appName}'`);

    const isInstalled = await this.isAppInstalled(appName);
    if (isInstalled) {
      this.logger.info(`App '${appName}' is already installed`);
      return false;
    }

    // Click Install now link
    this.logger.info('App not installed, looking for Install now link');
    const installLink = this.page.getByRole('link', { name: 'Install now' });

    await this.waiter.waitForVisible(installLink, { description: 'Install now link' });
    await this.smartClick(installLink, 'Install now link');
    this.logger.info('Clicked Install now, waiting for install page to load');

    await this.page.waitForURL(/\/foundry\/app-catalog\/[^/]+\/install$/, { timeout: 10000 });
    await this.page.waitForLoadState('domcontentloaded');

    // Handle permissions dialog
    await this.handlePermissionsDialog();

    // App-specific configuration (API credentials, comboboxes, etc.)
    if (installConfig?.configureSettings) {
      this.logger.info('Running app-specific configuration...');
      await this.page.getByRole('textbox').or(this.page.getByRole('combobox'))
        .or(this.page.getByRole('button', { name: /next setting/i }))
        .first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
      await installConfig.configureSettings(this.page);
    }

    // Click final install button
    await this.clickInstallAppButton();

    // Wait for installation to complete
    await this.waitForInstallation(appName);

    // Dismiss any toast notifications left from install
    await this.dismissToasts();

    this.logger.success(`App '${appName}' installed successfully`);
    return true;
  }

  /**
   * Handle permissions dialog if present
   */
  private async handlePermissionsDialog(): Promise<void> {
    const acceptButton = this.page.getByRole('button', { name: /accept.*continue/i });

    if (await this.elementExists(acceptButton, 15000)) {
      this.logger.info('Permissions dialog detected, accepting');
      await this.smartClick(acceptButton, 'Accept and continue button');
      await this.waiter.delay(2000);
    }
  }

  /**
   * Click the final install button. Handles both "Save and install" (new) and "Install app" (old).
   */
  private async clickInstallAppButton(): Promise<void> {
    const installButton = this.page.getByRole('button', { name: 'Save and install' })
      .or(this.page.getByRole('button', { name: 'Install app' }));

    // Brief delay for form to enable button
    await this.waiter.delay(1000);

    await this.smartClick(installButton, 'Install button');
    this.logger.info('Clicked install button');
  }

  /**
   * Wait for installation to complete via toast messages
   */
  private async waitForInstallation(appName: string): Promise<void> {
    this.logger.info('Waiting for installation to complete...');

    await Promise.race([
      this.page.waitForURL(/\/foundry\/(app-catalog|home)/, { timeout: 15000 }),
      this.page.waitForLoadState('domcontentloaded')
    ]).catch(() => {});

    // Wait for "installing" toast
    const installingMessage = this.page.getByText(/installing/i).first();

    try {
      await installingMessage.waitFor({ state: 'visible', timeout: 30000 });
      this.logger.success('Installation started - "installing" message appeared');
    } catch {
      throw new Error(`Installation failed to start for app '${appName}' - "installing" message never appeared.`);
    }

    // Wait for final status toast
    const installedMessage = this.page.getByText(`${appName} installed`).first();
    const errorMessage = this.page.getByText(`Error installing ${appName}`).first();

    try {
      const result = await Promise.race([
        installedMessage.waitFor({ state: 'visible', timeout: 60000 }).then(() => 'success'),
        errorMessage.waitFor({ state: 'visible', timeout: 60000 }).then(() => 'error')
      ]);

      if (result === 'error') {
        const errorText = await errorMessage.textContent();
        const cleanError = errorText?.replace(/\s+/g, ' ').trim() || 'Unknown error';
        throw new Error(`Installation failed for app '${appName}': ${cleanError}`);
      }
      this.logger.success('Installation completed successfully - "installed" message appeared');
    } catch (error) {
      if ((error as Error).message.includes('Installation failed')) {
        throw error;
      }
      throw new Error(`Installation status unclear for app '${appName}' - timed out waiting for status after 60 seconds`, { cause: error });
    }

    // Brief catalog status verification
    this.logger.info('Checking catalog status briefly (installation already confirmed by toast)...');
    const baseUrl = new URL(this.page.url()).origin;
    await this.page.goto(`${baseUrl}/foundry/app-catalog?q=${encodeURIComponent(appName)}`);
    await this.page.waitForLoadState('domcontentloaded');

    const statusText = this.page.locator('[data-test-selector="status-text"]').filter({ hasText: /installed/i });
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const isVisible = await statusText.isVisible().catch(() => false);

      if (isVisible) {
        this.logger.success('Catalog status verified - shows Installed');
        return;
      }

      if (attempt < maxAttempts - 1) {
        this.logger.info(`Catalog status not yet updated, waiting 5s before refresh (attempt ${attempt + 1}/${maxAttempts})...`);
        await this.waiter.delay(5000);
        await this.page.reload({ waitUntil: 'domcontentloaded' });
      }
    }

    this.logger.info(`Catalog status not updated yet, but toast confirmed installation - continuing`);
  }

  /**
   * Dismiss any visible toast notifications by clicking their close buttons.
   * Prevents UI overlay issues in subsequent test steps.
   */
  private async dismissToasts(): Promise<void> {
    const closeButtons = this.page.locator(
      '[role="alertdialog"] button[aria-label="Close"], [role="alert"] button[aria-label="Close"]'
    );
    const count = await closeButtons.count();
    for (let i = 0; i < count; i++) {
      await closeButtons.nth(i).click().catch(() => {});
    }
    if (count > 0) {
      this.logger.info(`Dismissed ${count} toast notification(s)`);
    }
  }

  /**
   * Navigate to an installed app using dual-strategy approach:
   * 1. Try "Open app" button from App Catalog detail page (fastest, most reliable)
   * 2. Fall back to Custom Apps menu with 5-attempt retry loop
   */
  async navigateToInstalledApp(appName: string, options?: AppNavigationOptions): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info(`Navigating to installed app '${appName}'`);

        // Strategy 1: Try "Open app" from the App Catalog detail page
        const openedViaCatalog = await this.tryOpenAppViaCatalog(appName);
        if (openedViaCatalog) return;

        // Strategy 2: Fall back to Custom Apps menu navigation
        this.logger.info('Falling back to Custom Apps menu navigation');
        await this.navigateViaCustomApps(appName, options);
      },
      `Navigate to ${appName} app`
    );
  }

  /**
   * Try to open the app via the "Open app" button on its App Catalog detail page.
   * Returns true if successful, false if the button wasn't available.
   */
  private async tryOpenAppViaCatalog(appName: string): Promise<boolean> {
    try {
      this.logger.info('Trying to open app via App Catalog "Open app" button');
      const baseUrl = this.getBaseURL();
      const filterParam = encodeURIComponent(`name:~'${appName}'`);
      await this.page.goto(`${baseUrl}/foundry/app-catalog?filter=${filterParam}`);
      await this.page.waitForLoadState('domcontentloaded');

      const appLink = this.page.getByRole('link', { name: appName, exact: true });
      await appLink.waitFor({ state: 'visible', timeout: 15000 });
      await appLink.click();

      const openAppButton = this.page.getByRole('button', { name: 'Open app' });
      await openAppButton.waitFor({ state: 'visible', timeout: 10000 });

      // Set up response listener BEFORE clicking to capture the page entity response
      const pageEntityResponse = this.page.waitForResponse(
        (resp) => resp.url().includes('/api2/ui-extensions/entities/pages/v1'),
        { timeout: 15000 }
      );
      await openAppButton.click();
      this.logger.success('Clicked "Open app" button from App Catalog');

      // Check for 404 (service sometimes needs time to register newly deployed pages)
      const response = await pageEntityResponse;
      if (response.status() === 404) {
        this.logger.warn('Page entity returned 404, retrying with reload...');
        await this.retryPageLoadAfter404();
      }

      const iframe = this.page.locator('iframe[name="portal"]');
      await iframe.waitFor({ state: 'visible', timeout: 30000 });
      return true;
    } catch (e) {
      this.logger.warn(`"Open app" button not available: ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * Retry page load after a 404 on the page entity endpoint.
   */
  private async retryPageLoadAfter404(maxRetries = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const retryResponse = this.page.waitForResponse(
        (resp) => resp.url().includes('/api2/ui-extensions/entities/pages/v1'),
        { timeout: 15000 }
      );
      await this.page.reload();
      await this.page.waitForLoadState('domcontentloaded');

      const response = await retryResponse;
      if (response.status() !== 404) {
        this.logger.success(`Page entity returned ${response.status()} on retry ${attempt}`);
        return;
      }
      this.logger.warn(`Page entity still 404 on retry ${attempt}/${maxRetries}`);
    }
  }

  /**
   * Navigate to app via Custom Apps menu with 5-attempt retry loop.
   * Handles platform flakiness where Custom Apps button doesn't appear on first load.
   */
  private async navigateViaCustomApps(appName: string, options?: AppNavigationOptions): Promise<void> {
    await this.navigateToPath('/foundry/home', 'Foundry home page');
    await this.page.waitForLoadState('domcontentloaded');

    let appFound = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const menuButton = this.page.getByTestId('nav-trigger');
      await menuButton.waitFor({ state: 'visible', timeout: 30000 });
      await menuButton.click();
      await this.waiter.delay(1500);

      const customAppsButton = this.page.getByRole('button', { name: 'Custom apps' });
      try {
        await customAppsButton.waitFor({ state: 'visible', timeout: 20000 });
        await customAppsButton.click();
        await this.waiter.delay(1500);
        this.logger.info(`Custom apps button found on attempt ${attempt}`);
      } catch {
        this.logger.warn(`Custom apps not visible on attempt ${attempt}, refreshing page...`);
        await this.page.reload();
        await this.page.waitForLoadState('domcontentloaded');
        await this.waiter.delay(3000);
        continue;
      }

      // Check if the app button appears in the submenu
      const appButtonCheck = this.page.getByRole('button', { name: appName, exact: false }).first();
      try {
        await appButtonCheck.waitFor({ state: 'visible', timeout: 10000 });
        appFound = true;
        this.logger.info(`App '${appName}' found in Custom apps menu on attempt ${attempt}`);
        break;
      } catch {
        this.logger.warn(`App '${appName}' not in Custom apps on attempt ${attempt}, refreshing page...`);
        await this.page.reload();
        await this.page.waitForLoadState('domcontentloaded');
        await this.waiter.delay(3000);
      }
    }
    if (!appFound) {
      throw new Error(`App '${appName}' not found in Custom apps menu after 5 attempts with page refresh`);
    }

    // Expand the app menu only if not already expanded
    const appButton = this.page.getByRole('button', { name: appName, exact: false }).first();
    await expect(appButton).toBeVisible({ timeout: 10000 });
    const isExpanded = await appButton.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await appButton.click();
      await this.waiter.delay(500);
    }

    // Click the app link
    if (options?.useScopedList) {
      const appList = this.page.getByRole('list', { name: appName, exact: true });
      const appLink = appList.getByTestId('section-link');
      await expect(appLink).toBeVisible({ timeout: 20000 });
      await this.smartClick(appLink, `${appName} link`);
    } else if (options?.appLinkPattern) {
      const appLink = this.page.getByRole('link', { name: options.appLinkPattern }).first();
      await expect(appLink).toBeVisible({ timeout: 20000 });
      await appLink.click();
    } else {
      // Default: click the first section-link in the app's list
      const appList = this.page.getByRole('list', { name: appName, exact: true });
      const appLink = appList.getByTestId('section-link');
      await expect(appLink).toBeVisible({ timeout: 20000 });
      await this.smartClick(appLink, `${appName} link`);
    }

    // Wait for navigation to app page
    await this.page.waitForURL(/\/foundry\/page\/[a-f0-9]+(\?.*)?$/, { timeout: 15000 });
    await this.page.waitForLoadState('domcontentloaded');

    this.logger.success(`Navigated to app '${appName}' via Custom Apps`);
  }

  /**
   * Uninstall app. Handles "Uninstall failed" status by retrying via "Retry uninstall".
   */
  async uninstallApp(appName: string): Promise<void> {
    this.logger.step(`Uninstall app '${appName}'`);

    try {
      await this.searchAndNavigateToApp(appName);

      // Check if already uninstalled
      const installLink = this.page.getByRole('link', { name: 'Install now' });
      if (await this.elementExists(installLink, 3000)) {
        this.logger.info(`App '${appName}' is already uninstalled`);
        return;
      }

      // Check if in "Uninstall failed" state from a previous attempt
      const uninstallFailed = this.page.getByText('Uninstall failed');
      if (await this.elementExists(uninstallFailed, 2000)) {
        this.logger.info('App is in "Uninstall failed" state, will retry uninstall');
        await this.retryUninstall(appName);
        return;
      }

      // Normal uninstall flow
      await this.performUninstall(appName, 'Uninstall app');

      // After clicking uninstall, check for success or failure
      const succeeded = await this.waitForUninstallOutcome(appName);
      if (!succeeded) {
        this.logger.warn('Uninstall failed on first attempt, retrying...');
        await this.retryUninstall(appName);
      }

    } catch (error) {
      this.logger.warn(`Failed to uninstall app '${appName}': ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Perform uninstall via menu: open menu, click the given menuitem, confirm in modal.
   */
  private async performUninstall(appName: string, menuItemName: string): Promise<void> {
    this.logger.info(`Uninstalling ${appName} via "${menuItemName}"`);
    const openMenuButton = this.page.getByRole('button', { name: 'Open menu' });
    await this.waiter.waitForVisible(openMenuButton, { description: 'Open menu button' });
    await this.smartClick(openMenuButton, 'Open menu button');

    const menuItem = this.page.getByRole('menuitem', { name: menuItemName });
    await this.waiter.waitForVisible(menuItem, { description: `${menuItemName} menuitem` });
    await this.smartClick(menuItem, `${menuItemName} menuitem`);

    const uninstallButton = this.page.getByRole('button', { name: 'Uninstall' });
    await this.waiter.waitForVisible(uninstallButton, { description: 'Uninstall confirmation button' });
    await this.smartClick(uninstallButton, 'Uninstall button');
  }

  /**
   * Wait for uninstall outcome: success message or "Uninstall failed" status.
   * Returns true if uninstall succeeded, false if it failed.
   */
  private async waitForUninstallOutcome(appName: string): Promise<boolean> {
    const successMessage = this.page.getByText(/has been uninstalled/i);
    const failedStatus = this.page.getByText('Uninstall failed');
    const notInstalledStatus = this.page.getByText('Not installed');

    const result = await Promise.race([
      successMessage.waitFor({ state: 'visible', timeout: 60000 }).then(() => 'success' as const),
      failedStatus.waitFor({ state: 'visible', timeout: 60000 }).then(() => 'failed' as const),
      notInstalledStatus.waitFor({ state: 'visible', timeout: 60000 }).then(() => 'success' as const)
    ]);

    if (result === 'success') {
      this.logger.success(`App '${appName}' uninstalled successfully`);
      return true;
    }

    return false;
  }

  /**
   * Retry uninstall when the app is in "Uninstall failed" state.
   * Uses "Retry uninstall" menuitem which appears in the 3-dot menu.
   */
  private async retryUninstall(appName: string, maxRetries = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.logger.info(`Retry uninstall attempt ${attempt}/${maxRetries}`);

      // Reload the page to ensure fresh state
      await this.searchAndNavigateToApp(appName);

      // Check if already uninstalled (previous retry may have succeeded)
      const installLink = this.page.getByRole('link', { name: 'Install now' });
      if (await this.elementExists(installLink, 3000)) {
        this.logger.success(`App '${appName}' is now uninstalled`);
        return;
      }

      await this.performUninstall(appName, 'Retry uninstall');

      const succeeded = await this.waitForUninstallOutcome(appName);
      if (succeeded) return;

      if (attempt < maxRetries) {
        this.logger.warn(`Retry uninstall attempt ${attempt} failed, waiting before next attempt...`);
        await this.waiter.delay(5000);
      }
    }

    throw new Error(`Failed to uninstall app '${appName}' after ${maxRetries} retry attempts`);
  }
}
