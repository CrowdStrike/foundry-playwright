import { Page, Locator } from '@playwright/test';
import { logger } from './Logger';
import { config } from '../config/TestConfig';

export interface WaitOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  description?: string;
}

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  shouldRetry?: (error: Error) => boolean;
}

export class SmartWaiter {
  constructor(private page: Page, private pageName: string = 'Unknown') {}

  async waitForVisible(
    locator: Locator | string,
    options: WaitOptions = {}
  ): Promise<Locator> {
    const actualLocator = typeof locator === 'string'
      ? this.page.locator(locator)
      : locator;

    const { timeout = config.navigationTimeout, description } = options;
    const elementDesc = description || 'element';

    logger.debug(`Waiting for ${elementDesc} to be visible`, {
      page: this.pageName,
      timeout,
      selector: typeof locator === 'string' ? locator : 'locator'
    });

    await actualLocator.waitFor({
      state: 'visible',
      timeout
    });

    return actualLocator;
  }

  async waitForPageLoad(description: string = 'page load'): Promise<void> {
    logger.debug(`Waiting for ${description}`, { page: this.pageName });

    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForCondition(
    condition: () => Promise<boolean>,
    description: string,
    options: WaitOptions = {}
  ): Promise<void> {
    const { timeout = config.defaultTimeout, retryDelay = 500 } = options;

    logger.debug(`Waiting for condition: ${description}`, {
      page: this.pageName,
      timeout
    });

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        if (await condition()) {
          return;
        }
      } catch {
        // Continue polling on errors
      }

      await this.page.waitForTimeout(retryDelay);
    }

    throw new Error(`Timeout waiting for condition: ${description} after ${timeout}ms`);
  }

  async waitForMenuExpansion(): Promise<void> {
    await this.waitForCondition(
      async () => {
        const expandedMenus = await this.page.locator('[expanded], [aria-expanded="true"]').count();
        return expandedMenus > 0;
      },
      'navigation menu to expand',
      { timeout: 5000 }
    );
  }

  async waitForAppInstallationStatus(appName: string, expectedStatus: 'installed' | 'not-installed'): Promise<void> {
    await this.waitForCondition(
      async () => {
        const statusElements = await this.page.locator(`text=${appName}`).locator('../..').locator('text=Installed').count();
        const isInstalled = statusElements > 0;
        return expectedStatus === 'installed' ? isInstalled : !isInstalled;
      },
      `app ${appName} to be ${expectedStatus}`,
      { timeout: 60000 }
    );
  }

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = config.retryAttempts,
      delay = config.getRetryConfig().delay,
      backoff = 'exponential',
      shouldRetry = () => false
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();

        if (attempt > 1) {
          logger.success(`${operationName} succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxAttempts || !shouldRetry(lastError)) {
          logger.error(`${operationName} failed after ${attempt} attempts`, lastError);
          throw lastError;
        }

        const currentDelay = backoff === 'exponential'
          ? delay * Math.pow(2, attempt - 1)
          : delay;

        logger.retry(operationName, attempt, maxAttempts, lastError);

        await new Promise(resolve => setTimeout(resolve, currentDelay));
      }
    }

    throw lastError ?? new Error(`${operationName} failed: no attempts were made`);
  }

  static async withPlaywrightRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: RetryOptions = {}
  ): Promise<T> {
    return this.withRetry(
      operation,
      operationName,
      {
        ...options,
        shouldRetry: (error) => {
          if (error.message.includes('expect(')) {
            return false;
          }

          return error.message.includes('timeout') ||
                 error.message.includes('waiting for') ||
                 error.message.includes('not found') ||
                 (options.shouldRetry ? options.shouldRetry(error) : false);
        }
      }
    );
  }
}
