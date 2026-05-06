![CrowdStrike Falcon](/images/cs-logo.png?raw=true)

# @crowdstrike/foundry-playwright

[Playwright](https://playwright.dev/) end-to-end (E2E) test infrastructure for [Falcon Foundry](https://www.crowdstrike.com/platform/foundry/) apps. Provides page objects, authentication, configuration, and utilities so each app only needs to write its app-specific tests.

## Installation

```sh
npm install -D @crowdstrike/foundry-playwright
# or
pnpm add -D @crowdstrike/foundry-playwright
```

## Quickstart

### 1. Set up your app's `e2e/` directory

Create an `e2e/` directory in your Foundry app:

```
my-foundry-app/
├── e2e/
│   ├── .env                    # Local credentials (git-ignored)
│   ├── playwright.config.ts
│   └── tests/
│       └── my-app.spec.ts      # Your app-specific tests
├── manifest.yml
└── ...
```

Create a `.env` file with your credentials:

```sh
FALCON_BASE_URL=https://falcon.us-2.crowdstrike.com
FALCON_USERNAME=your-email@example.com
FALCON_PASSWORD=your-password
FALCON_AUTH_SECRET=your-totp-secret
APP_NAME=Your App Name
```

### 2. Create your `playwright.config.ts`

```ts
import { defineFoundryConfig } from '@crowdstrike/foundry-playwright';

export default defineFoundryConfig();
```

That's it. The library provides the standard 4-project pipeline automatically:

1. **setup**: authenticate and save session state
2. **app-install**: install the app via App Catalog
3. **chromium**: run your tests
4. **app-uninstall**: clean up

Authentication, app install, and app uninstall are handled by built-in setup/teardown tests in the library. You only need to write your app-specific tests in `tests/`.

The library automatically loads your `.env` file for local development (skipped when `CI` is set).

You can override any default:

```ts
export default defineFoundryConfig({
  timeout: 120_000,
  reporter: 'html',
});
```

### 3. Write your tests

```ts
// tests/my-app.spec.ts
import { test, expect } from '@playwright/test';
import {
  WorkflowsPage,
  DetectionExtensionPage,
} from '@crowdstrike/foundry-playwright';

test('execute workflow', async ({ page }) => {
  const workflows = new WorkflowsPage(page);
  await workflows.navigateToWorkflows();
  await workflows.executeAndVerifyWorkflow('My Workflow');
});

test('extension renders in detection details', async ({ page }) => {
  const detections = new DetectionExtensionPage(page);
  const frame = await detections.openExtension('my-extension');
  await expect(frame.getByText('My App')).toBeVisible();
});
```

### Apps with configuration screens

If your app has configuration screens during install (API credentials, comboboxes, etc.), create a local `tests/app-install.setup.ts` and point `defineFoundryConfig` at it:

```ts
// tests/app-install.setup.ts
import { test as setup } from '@playwright/test';
import { AppCatalogPage, config } from '@crowdstrike/foundry-playwright';

setup('install app', async ({ page }) => {
  const catalog = new AppCatalogPage(page);
  await catalog.installApp(config.appName, {
    configureSettings: async (page) => {
      // Use field labels from the install form. Inspect with Playwright MCP
      // to discover the exact names for your app's API integration fields
      await page.getByRole('textbox', { name: 'Name', exact: true }).fill('My Integration');
      await page.getByRole('textbox', { name: 'Instance' }).fill('dev12345');
      await page.getByRole('textbox', { name: 'Username' }).fill('test_user');
      await page.getByRole('textbox', { name: 'Password' }).fill('test_password');
    },
  });
});
```

```ts
// playwright.config.ts
import { defineFoundryConfig } from '@crowdstrike/foundry-playwright';

export default defineFoundryConfig({
  appInstallDir: './tests',
});
```

### Important: one app at a time

Do not run `npm test` in multiple Foundry apps simultaneously using the same Falcon account. Concurrent login attempts trigger rate-limiting and will temporarily lock the account, causing all test runs to fail.

## Examples

These Falcon Foundry sample apps use `@crowdstrike/foundry-playwright` for their E2E tests:

| App | Config | Tests |
|-----|--------|-------|
| [Functions with Python](https://github.com/CrowdStrike/foundry-sample-functions-python) | [playwright.config.ts](https://github.com/CrowdStrike/foundry-sample-functions-python/blob/main/e2e/playwright.config.ts) | [e2e/tests/](https://github.com/CrowdStrike/foundry-sample-functions-python/tree/main/e2e/tests) |
| [Triage with MITRE ATT&CK](https://github.com/CrowdStrike/foundry-sample-mitre) | [playwright.config.ts](https://github.com/CrowdStrike/foundry-sample-mitre/blob/main/e2e/playwright.config.ts) | [e2e/tests/](https://github.com/CrowdStrike/foundry-sample-mitre/tree/main/e2e/tests) |
| [Falcon LogScale](https://github.com/CrowdStrike/foundry-sample-logscale) | [playwright.config.ts](https://github.com/CrowdStrike/foundry-sample-logscale/blob/main/e2e/playwright.config.ts) | [e2e/tests/](https://github.com/CrowdStrike/foundry-sample-logscale/tree/main/e2e/tests) |

## What's included

### Page objects

| Class | Purpose |
|-------|---------|
| `AppCatalogPage` | Install, uninstall, and navigate to apps |
| `AppManagerPage` | Find and navigate to apps in App Manager |
| `BasePage` | Abstract base with `smartClick`, `waitAndAct`, retry support |
| `DetectionExtensionPage` | Navigate to Endpoint Detections, expand extensions, return iframe FrameLocator |
| `FoundryHomePage` | Navigate to Foundry home, verify title |
| `HostManagementPage` | Navigate to host management, retrieve host IDs |
| `WorkflowsPage` | Search, open, execute, and verify Fusion SOAR workflows |

### Configuration

| Export | Purpose |
|--------|---------|
| `defineFoundryConfig()` | Wraps Playwright's `defineConfig` with the standard pipeline |
| `TestConfig` / `config` | Centralized env var management and timeouts |

### Utilities

| Export | Purpose |
|--------|---------|
| `SmartWaiter` | Intelligent waiting (`waitForVisible`, `waitForPageLoad`, `waitForCondition`) |
| `RetryHandler` | Exponential backoff retry with Playwright error filtering |
| `Logger` / `logger` | Structured logging with step counters and performance timing |

### Auth

| Export | Purpose |
|--------|---------|
| `authenticate()` | CSRF token flow with TOTP 2FA |
| `getUserCredentials()` | Read credentials from environment |
| `AuthFile` | Path to stored auth state (`playwright/.auth/user.json`) |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FALCON_BASE_URL` | No | Falcon console URL (default: `https://falcon.us-2.crowdstrike.com`) |
| `FALCON_USERNAME` | Yes | Login email |
| `FALCON_PASSWORD` | Yes | Login password |
| `FALCON_AUTH_SECRET` | Yes | TOTP secret for 2FA |
| `APP_NAME` | Yes | App name as shown in App Catalog |
| `CI` | No | Set automatically in CI; adjusts timeouts and retries |
| `DEBUG` | No | Set to `true` for verbose logging |

## `defineFoundryConfig` options

| Option | Type | Default |
|--------|------|---------|
| `testDir` | `string` | `'./tests'` |
| `appInstallDir` | `string` | Library built-in (override for apps with config screens) |
| `timeout` | `number` | 60s (CI) / 45s (local) |
| `expectTimeout` | `number` | 10s (CI) / 8s (local) |
| `actionTimeout` | `number` | 15s (CI) / 10s (local) |
| `navigationTimeout` | `number` | 30s (CI) / 20s (local) |
| `retries` | `number` | 2 (CI) / 0 (local) |
| `reporter` | `string` | `'list'` |
| `use` | `object` | Merged with defaults (`testIdAttribute: 'data-test-selector'`, etc.) |
| `projects` | `array` | Replaces the default 4-project pipeline if provided |

## Development

Requires **Node.js >= 24**.

```sh
# Install dependencies
pnpm install

# Type-check
pnpm lint:types

# Lint (ESLint + type-check)
pnpm lint

# Fix lint issues
pnpm lint:fix

# Run tests
pnpm test

# Build
pnpm build
```

### Releasing

1. Update `CHANGELOG.md`: replace `TBD` with today's date and add a new `## [Unreleased]` section above it.
2. Bump the version in `package.json`.
3. Commit, tag, and push:

```sh
git add package.json CHANGELOG.md
git commit -m "Release v0.5.0"
git tag v0.5.0
git push origin main --tags
```

4. Create a GitHub Release from the tag. The `release.yml` workflow publishes to npm automatically when a release is published.

## Related

- [@crowdstrike/foundry-js](https://github.com/CrowdStrike/foundry-js): Foundry JavaScript SDK
- [Falcon Foundry sample apps](https://developer.crowdstrike.com/docs/samples/): sample apps on GitHub that use this library for E2E testing
- [Falcon Foundry documentation](https://docs.crowdstrike.com/r/en-US/er9g8gmh/c3d64B8e): platform documentation for building custom Falcon apps
