import { Page, expect } from '@playwright/test';
import { SocketNavigationPage } from './SocketNavigationPage';

export class HostManagementPage extends SocketNavigationPage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToHostManagement(): Promise<void> {
    return this.withTiming(
      async () => {
        this.logger.info('Navigating to Host Management page');

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

        this.logger.success('Navigated to Host Management page');
      },
      'Navigate to Host Management'
    );
  }

  async getFirstHostId(): Promise<string | null> {
    return this.withTiming(
      async () => {
        this.logger.info('Retrieving first host ID from host management');

        await this.navigateToHostManagement();

        await this.page.waitForLoadState('domcontentloaded');

        await this.page.getByText('Hostname').first().waitFor({ state: 'visible', timeout: 10000 });

        try {
          const hostId = await this.page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runs in browser context
            const doc = (globalThis as any).document;
            const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */);
            const pattern = /^[a-f0-9]{32}$/i;

            let node = walker.nextNode();
            while (node) {
              const text = node.textContent?.trim() || '';
              if (pattern.test(text)) {
                return text;
              }
              node = walker.nextNode();
            }
            return null;
          });

          if (hostId) {
            this.logger.success(`Found host ID: ${hostId}`);
            return hostId;
          }

          this.logger.warn('No valid host ID found on page');
          return null;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to find host ID: ${msg}`);
          this.logger.info('This may indicate no hosts are available in the CID');
          return null;
        }
      },
      'Get first host ID'
    );
  }

  async hasHosts(): Promise<boolean> {
    return this.withTiming(
      async () => {
        await this.navigateToHostManagement();

        const noHostsMessage = this.page.getByText(/no hosts found|no data/i);
        const hasNoHostsMessage = await noHostsMessage.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasNoHostsMessage) {
          this.logger.info('No hosts found in CID');
          return false;
        }

        const hostRows = this.page.locator('tbody tr');
        const rowCount = await hostRows.count();

        if (rowCount > 0) {
          this.logger.success(`Found ${rowCount} host(s) in CID`);
          return true;
        } else {
          this.logger.info('No hosts found in CID');
          return false;
        }
      },
      'Check if hosts exist'
    );
  }
}
