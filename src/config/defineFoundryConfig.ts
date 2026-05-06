/**
 * defineFoundryConfig - Wraps Playwright's defineConfig with
 * the standard 4-project pipeline used by all Foundry E2E tests:
 *   setup (authenticate) → app-install → chromium (tests) → app-uninstall
 */

import * as path from 'path';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import { AuthFile } from '../constants/AuthFile';

// Load .env for local development (CI provides env vars directly)
if (!process.env.CI) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require('@dotenvx/dotenvx');
    dotenv.config({ path: '.env' });
  } catch {
    // dotenvx not installed — env vars must be set externally
  }
}

/** Directory containing the library's built-in setup/teardown tests */
const librarySetupDir = path.resolve(__dirname, '..', 'setup');

export interface FoundryConfigOptions {
  /** Directory containing test files. Default: './tests' */
  testDir?: string;

  /**
   * Directory containing a custom app-install.setup.ts.
   * Use this when your app has configuration screens during install.
   * If not set, the library's built-in install test is used.
   */
  appInstallDir?: string;

  /** Test timeout in ms. Default: 60s CI / 45s local */
  timeout?: number;

  /** Expect assertion timeout in ms. Default: 10s CI / 8s local */
  expectTimeout?: number;

  /** Action timeout in ms. Default: 15s CI / 10s local */
  actionTimeout?: number;

  /** Navigation timeout in ms. Default: 30s CI / 20s local */
  navigationTimeout?: number;

  /** Number of retries. Default: 2 CI / 0 local */
  retries?: number;

  /** Reporter name or config. Default: 'list' */
  reporter?: PlaywrightTestConfig['reporter'];

  /** Additional Playwright `use` options merged into every project */
  use?: PlaywrightTestConfig['use'];

  /** Override or extend the default projects array. Replaces default if provided. */
  projects?: PlaywrightTestConfig['projects'];

  /** Any other Playwright config options passed through directly */
  extra?: Omit<PlaywrightTestConfig, 'testDir' | 'timeout' | 'expect' | 'reporter' | 'use' | 'projects'>;
}

/**
 * Create a Playwright config with the standard Foundry 4-project pipeline.
 *
 * Usage in a consumer's playwright.config.ts:
 * ```ts
 * import { defineFoundryConfig } from '@crowdstrike/foundry-playwright';
 * export default defineFoundryConfig({ timeout: 120_000 });
 * ```
 */
export function defineFoundryConfig(options: FoundryConfigOptions = {}) {
  const isCI = !!process.env.CI;

  const timeout = options.timeout ?? (isCI ? 60_000 : 45_000);
  const expectTimeout = options.expectTimeout ?? (isCI ? 10_000 : 8_000);
  const actionTimeout = options.actionTimeout ?? (isCI ? 15_000 : 10_000);
  const navigationTimeout = options.navigationTimeout ?? (isCI ? 30_000 : 20_000);
  const retries = options.retries ?? (isCI ? 2 : 0);
  const reporter = options.reporter ?? 'list';
  const testDir = options.testDir ?? './tests';

  const defaultProjects: PlaywrightTestConfig['projects'] = [
    {
      name: 'setup',
      testDir: librarySetupDir,
      testMatch: /authenticate\.setup\.[jt]s/,
    },
    {
      name: 'app-install',
      testDir: options.appInstallDir ?? librarySetupDir,
      testMatch: /app-install\.setup\.[jt]s/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AuthFile,
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AuthFile,
      },
      dependencies: ['setup', 'app-install'],
    },
    {
      name: 'app-uninstall',
      testDir: librarySetupDir,
      testMatch: /app-uninstall\.teardown\.[jt]s/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AuthFile,
      },
      dependencies: ['chromium'],
    },
  ];

  return defineConfig({
    testDir,
    fullyParallel: true,
    forbidOnly: isCI,
    retries,
    timeout,
    expect: {
      timeout: expectTimeout,
    },
    reporter,
    use: {
      testIdAttribute: 'data-test-selector',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: isCI ? 'off' : 'retain-on-failure',
      actionTimeout,
      navigationTimeout,
      ...options.use,
    },
    projects: options.projects ?? defaultProjects,
    ...options.extra,
  });
}
