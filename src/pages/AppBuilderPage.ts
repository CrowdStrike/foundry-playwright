import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { RetryHandler } from '../utils/SmartWaiter';

export class AppBuilderPage extends BasePage {
  constructor(page: Page) {
    super(page, 'AppBuilderPage');
  }

  protected getPagePath(): string {
    throw new Error('Direct path navigation not supported. Use navigateToAppDetailsPage() instead.');
  }

  protected async verifyPageLoaded(): Promise<void> {
    await this.page.getByRole('heading', { name: 'Logic', level: 3 }).waitFor({ state: 'visible', timeout: 10000 });
  }

  private async hasWorkflowProvisioningAlreadyBeenDisabled(appName: string): Promise<boolean> {
    return await RetryHandler.withPlaywrightRetry(
      async () => {
        this.logger.info('Checking if workflow provisioning has already been disabled in latest release');

        const filterParam = encodeURIComponent(`name:~'${appName}'`);
        await this.page.goto(`${this.getBaseURL()}/foundry/app-catalog?filter=${filterParam}`);
        await this.page.waitForLoadState('domcontentloaded');

        const appLink = this.page.getByRole('link', { name: appName, exact: true });
        await appLink.waitFor({ state: 'visible', timeout: 10000 });
        await appLink.click();
        await this.page.waitForLoadState('domcontentloaded');

        const releasesTab = this.page.getByRole('tab', { name: /Releases/i });
        await releasesTab.waitFor({ state: 'visible', timeout: 10000 });
        await releasesTab.click();
        await this.page.waitForLoadState('domcontentloaded');

        const releaseNotesCell = this.page.locator('table tbody tr:first-child td:nth-child(2)').first();
        await releaseNotesCell.waitFor({ state: 'visible', timeout: 10000 });

        const releaseNotesText = await releaseNotesCell.textContent();
        const hasMarker = releaseNotesText?.includes('E2E test: Disabled workflow provisioning') || false;

        if (hasMarker) {
          this.logger.info('Latest release notes indicate workflow provisioning already disabled - skipping');
        } else {
          this.logger.info('Latest release notes do not contain provisioning marker - will check and disable if needed');
        }

        return hasMarker;
      },
      'Check release notes for workflow provisioning marker'
    );
  }

  private async navigateToAppDetailsPage(appName: string): Promise<void> {
    await RetryHandler.withPlaywrightRetry(
      async () => {
        const menuButton = this.page.locator('button:has-text("Menu"), button[aria-label*="menu"]').first();
        await menuButton.click();

        const appManagerLink = this.page.locator('text=/App manager/i').first();
        await appManagerLink.waitFor({ state: 'visible' });
        await appManagerLink.click();
        await this.page.waitForLoadState('domcontentloaded');

        const appLink = this.page.locator(`a:has-text("${appName}")`).first();
        await appLink.waitFor({ state: 'visible' });
        await appLink.click();
        await this.page.waitForLoadState('domcontentloaded');

        this.logger.info('Navigated to App details page');
      },
      'Navigate to App details page'
    );
  }

  private async deployAppFromBuilder(): Promise<void> {
    await RetryHandler.withPlaywrightRetry(
      async () => {
        this.logger.info('Deploying app changes');

        const currentUrl = this.page.url();
        if (currentUrl.includes('/foundry/app-manager/')) {
          const editAppLink = this.page.locator('a:has-text("Edit app")').first();
          await editAppLink.waitFor({ state: 'visible', timeout: 10000 });
          await editAppLink.click();
          await this.page.waitForURL(/.*\/foundry\/app-builder\/.*\/draft\/.*/, { timeout: 10000 });
          await this.page.waitForLoadState('domcontentloaded');
        }

        const deployModalHeading = this.page.getByRole('heading', { name: 'Commit deployment' });
        const isModalOpen = await deployModalHeading.isVisible({ timeout: 1000 }).catch(() => false);

        if (!isModalOpen) {
          const appBuilderLink = this.page.locator('nav[aria-label="Breadcrumb"] a:has-text("App builder")').first();
          await appBuilderLink.waitFor({ state: 'visible', timeout: 10000 });
          await appBuilderLink.click();
          await this.page.waitForLoadState('domcontentloaded');

          const deployButton = this.page.locator('button:has-text("Deploy")').first();
          await deployButton.waitFor({ state: 'visible' });
          await deployButton.click();

          await deployModalHeading.waitFor({ state: 'visible', timeout: 10000 });
          await this.page.waitForLoadState('domcontentloaded');
        }

        const modal = this.page.locator('dialog, [role="dialog"]').filter({ hasText: 'Commit deployment' });
        await modal.waitFor({ state: 'visible', timeout: 15000 });

        const changeTypeButton = modal.getByRole('button', { name: 'Change type' });
        await changeTypeButton.waitFor({ state: 'visible', timeout: 15000 });
        await changeTypeButton.click();

        await this.page.locator('[role="listbox"], [role="menu"]').waitFor({ state: 'visible', timeout: 5000 });
        await this.page.keyboard.press('ArrowDown');
        await this.page.keyboard.press('Enter');

        const changeLogField = this.page.locator('textarea').last();
        await changeLogField.waitFor({ state: 'visible', timeout: 10000 });
        const changeLogValue = await changeLogField.inputValue().catch(() => '');

        if (!changeLogValue) {
          await changeLogField.fill('E2E test: Disabled workflow provisioning');
        }

        const deployModalButton = this.page.getByRole('button', { name: 'Deploy' }).last();
        await deployModalButton.click();

        await this.page.waitForSelector('text=/Deployed|deployment.*successful/i', { timeout: 120000 });

        const progressScreen = this.page.locator('text="Deployment in progress"');
        const isProgressVisible = await progressScreen.isVisible().catch(() => false);
        if (isProgressVisible) {
          this.logger.info('Waiting for deployment progress screen to complete');
          await progressScreen.waitFor({ state: 'hidden', timeout: 60000 });
        }

        await this.page.waitForURL(/.*\/foundry\/app-builder\/.*\/draft\/.*/, { timeout: 30000 });
        await this.page.waitForLoadState('domcontentloaded');

        this.logger.success('App deployed successfully');
      },
      'Deploy app'
    );
  }

  private async releaseAppFromBuilder(): Promise<void> {
    await RetryHandler.withPlaywrightRetry(
      async () => {
        this.logger.info('Releasing app version');

        await this.page.waitForLoadState('domcontentloaded');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runs in browser context via page.evaluate
        await this.page.evaluate(() => (globalThis as any).window.scrollTo(0, 0));

        const successToast = this.page.locator('text="App deployed successfully"');
        const isToastVisible = await successToast.isVisible().catch(() => false);
        if (isToastVisible) {
          this.logger.info('Waiting for success toast to disappear');
          await successToast.waitFor({ state: 'hidden', timeout: 30000 });
        }

        const releaseButton = this.page.getByTestId('release-button');
        await releaseButton.waitFor({ state: 'visible', timeout: 15000 });

        await releaseButton.evaluate((btn) => (btn as any).click());

        const releaseModalHeading = this.page.getByRole('heading', { name: 'Commit release' });
        await releaseModalHeading.waitFor({ state: 'visible', timeout: 15000 });

        const modal = this.page.locator('dialog, [role="dialog"]').filter({ hasText: 'Commit release' });
        await modal.waitFor({ state: 'visible', timeout: 15000 });

        const changeTypeButton = modal.getByRole('button', { name: 'Change type' });
        await changeTypeButton.waitFor({ state: 'visible', timeout: 15000 });
        await changeTypeButton.click();

        const listbox = this.page.locator('[role="listbox"]');
        await listbox.waitFor({ state: 'visible', timeout: 5000 });

        await this.page.evaluate(() => {
          const event = new (globalThis as any).KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true });
          (globalThis as any).document.activeElement?.dispatchEvent(event);
        });

        await this.page.evaluate(() => {
          const event = new (globalThis as any).KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
          (globalThis as any).document.activeElement?.dispatchEvent(event);
        });

        const releaseNotesField = this.page.getByRole('textbox', { name: 'Release notes' });
        await releaseNotesField.waitFor({ state: 'visible', timeout: 10000 });
        await releaseNotesField.fill('E2E test: Disabled workflow provisioning');

        const releaseModalButton = this.page.getByRole('button', { name: 'Release' }).last();
        await releaseModalButton.click();

        await this.page.waitForSelector('text="Deployment released successfully"', { timeout: 30000 });

        const releaseToast = this.page.locator('text="Deployment released successfully"');
        await releaseToast.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

        await this.page.waitForLoadState('domcontentloaded');

        this.logger.success('App released successfully');
      },
      'Release app'
    );
  }

  /**
   * Disable workflow provisioning for all workflow templates.
   * Call this before installApp() for apps that don't have valid API credentials.
   * Navigates to App Manager, edits each workflow to disable "Provision on install",
   * then deploys and releases a new version.
   */
  async disableWorkflowProvisioning(appName: string): Promise<void> {
    this.logger.info('Starting to disable workflow provisioning for all templates');

    const alreadyDisabled = await this.hasWorkflowProvisioningAlreadyBeenDisabled(appName);
    if (alreadyDisabled) {
      this.logger.success('Workflow provisioning already disabled in previous release - skipping');
      return;
    }

    await this.navigateToAppDetailsPage(appName);

    const logicSectionHeading = this.page.getByRole('heading', { name: 'Logic', level: 3 });
    await logicSectionHeading.scrollIntoViewIfNeeded();
    await logicSectionHeading.waitFor({ state: 'visible', timeout: 10000 });

    const logicGrid = logicSectionHeading.locator('../..').getByRole('grid').first();
    await logicGrid.waitFor({ state: 'visible', timeout: 10000 });

    const workflowRows = logicGrid.locator('tbody tr').filter({ hasText: 'Workflow template' });
    const workflowCount = await workflowRows.count();
    this.logger.info(`Found ${workflowCount} workflow template(s)`);

    if (workflowCount === 0) {
      this.logger.warn('No workflow templates found - skipping provisioning disable');
      return;
    }

    const processedWorkflows = new Set<string>();
    let changesMade = false;

    for (let i = 0; i < workflowCount; i++) {
      await RetryHandler.withPlaywrightRetry(
        async () => {
          if (!this.page.url().includes('/foundry/app-manager/')) {
            await this.navigateToAppDetailsPage(appName);
          }

          const currentLogicHeading = this.page.getByRole('heading', { name: 'Logic', level: 3 });
          await currentLogicHeading.scrollIntoViewIfNeeded();
          await currentLogicHeading.waitFor({ state: 'visible', timeout: 10000 });

          const currentLogicGrid = currentLogicHeading.locator('../..').getByRole('grid').first();
          const currentWorkflowRows = currentLogicGrid.locator('tbody tr').filter({ hasText: 'Workflow template' });
          const currentRow = currentWorkflowRows.nth(i);

          const workflowLink = currentRow.locator('a').first();
          const workflowName = await workflowLink.textContent() || `Workflow ${i + 1}`;
          const trimmedName = workflowName.trim();

          if (processedWorkflows.has(trimmedName)) {
            this.logger.info(`Skipping already processed workflow: ${trimmedName}`);
            return;
          }

          this.logger.info(`Processing workflow: ${trimmedName}`);
          processedWorkflows.add(trimmedName);

          const menuButton = currentRow.getByLabel('Open menu');
          await menuButton.waitFor({ state: 'visible', timeout: 10000 });
          await menuButton.click();

          const editMenuItem = this.page.getByRole('menuitem', { name: 'Edit' });
          await editMenuItem.waitFor({ state: 'visible', timeout: 5000 });
          await editMenuItem.click();

          await this.page.waitForURL(/.*\/app-builder\/.*\/automation\/workflows\/.*\/edit/, { timeout: 15000 });
          await this.page.waitForLoadState('domcontentloaded');

          const workflowCanvas = this.page.getByRole('heading', { name: /Graphical representation area/ });
          await workflowCanvas.waitFor({ state: 'attached', timeout: 15000 });

          const settingsButton = this.page.getByRole('button', { name: 'Settings' });
          await settingsButton.waitFor({ state: 'visible', timeout: 15000 });
          await settingsButton.click();

          const settingsDialog = this.page.getByRole('heading', { name: 'Workflow template details' });
          await settingsDialog.waitFor({ state: 'visible', timeout: 15000 });

          const provisionToggle = this.page.locator('[role="switch"][aria-label="Provision on install"]');
          await provisionToggle.waitFor({ state: 'visible', timeout: 10000 });

          await this.page.waitForLoadState('domcontentloaded');

          // Wait for the toggle state to stabilize
          let isChecked = await provisionToggle.getAttribute('aria-checked') === 'true';
          let stableCheckCount = 0;
          let previousState = isChecked;

          for (let attempt = 0; attempt < 5; attempt++) {
            await this.waiter.delay(500);
            isChecked = await provisionToggle.getAttribute('aria-checked') === 'true';

            if (isChecked === previousState) {
              stableCheckCount++;
              if (stableCheckCount >= 2) {
                break;
              }
            } else {
              this.logger.info(`Toggle state changed from ${previousState} to ${isChecked}, waiting for stability`);
              stableCheckCount = 0;
              previousState = isChecked;
            }
          }

          this.logger.info(`Final toggle state: aria-checked="${isChecked}" for workflow: ${trimmedName}`);

          if (!isChecked) {
            this.logger.info(`Provisioning already disabled for: ${trimmedName}`);
            const dialog = this.page.getByRole('dialog');
            const closeButton = dialog.getByRole('button', { name: 'Close' });
            await closeButton.click();
            return;
          }

          this.logger.info(`Disabling provisioning for: ${trimmedName}`);
          await provisionToggle.click();
          changesMade = true;

          await this.page.waitForSelector('[role="switch"][aria-label="Provision on install"][aria-checked="false"]', { timeout: 5000 });

          const dialog = this.page.getByRole('dialog');
          const closeButton = dialog.getByRole('button', { name: 'Close' });
          await closeButton.click();

          const saveButton = this.page.getByRole('button', { name: 'Save and exit' });
          await saveButton.waitFor({ state: 'visible' });
          await saveButton.click();

          const result = await Promise.race([
            this.page.locator('text=/Workflow template updated/i').waitFor({ state: 'visible', timeout: 15000 }).then(() => 'success'),
            this.page.locator('text="Issues"').first().waitFor({ state: 'visible', timeout: 15000 }).then(() => 'errors')
          ]).catch(() => 'timeout');

          if (result === 'errors') {
            const errorItems = this.page.locator('text=/property.*contains/i');
            const errorCount = await errorItems.count();
            const errors: string[] = [];

            for (let j = 0; j < errorCount; j++) {
              const errorText = await errorItems.nth(j).textContent();
              if (errorText) {
                const cleanedError = errorText.trim().replace(/\s+/g, ' ');
                if (cleanedError.toLowerCase().startsWith('property') && !errors.includes(cleanedError)) {
                  errors.push(cleanedError);
                }
              }
            }

            if (errors.length === 0) {
              const fallbackErrors = this.page.locator('text=/contains unknown variable|invalid|failed/i');
              const fallbackCount = await fallbackErrors.count();
              for (let j = 0; j < Math.min(fallbackCount, 5); j++) {
                const errorText = await fallbackErrors.nth(j).textContent();
                if (errorText) {
                  const cleanedError = errorText.trim().replace(/\s+/g, ' ');
                  if (cleanedError && !errors.includes(cleanedError)) {
                    errors.push(cleanedError);
                  }
                }
              }
            }

            const errorMessage = `Workflow "${trimmedName}" has validation errors that prevent saving:\n${errors.map(e => `  - ${e}`).join('\n')}`;
            this.logger.error(errorMessage);
            throw new Error(errorMessage);
          } else if (result === 'timeout') {
            throw new Error(`Timeout waiting for save confirmation or error panel for workflow "${trimmedName}"`);
          }

          this.logger.success(`Successfully disabled provisioning for: ${trimmedName}`);
          await this.page.waitForLoadState('domcontentloaded');
          await this.navigateToAppDetailsPage(appName);
        },
        `Disable provisioning for workflow ${i + 1}`
      );
    }

    this.logger.success(`Disabled provisioning for ${processedWorkflows.size} unique workflow template(s)`);

    if (changesMade) {
      this.logger.info('Changes were made - deploying and releasing app');
      await this.deployAppFromBuilder();
      await this.releaseAppFromBuilder();
    } else {
      this.logger.info('No changes needed - provisioning already disabled for all workflows');
    }
  }
}
