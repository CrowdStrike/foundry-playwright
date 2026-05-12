![CrowdStrike Falcon](/images/cs-logo.png?raw=true)

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.1] - TBD

### Fixed

- Increase permissions dialog detection timeout from 3s to 15s in `AppCatalogPage` to accommodate slower CI environments
- Wait for form elements to render before invoking `configureSettings` callback during app install
- Replace `page.waitForTimeout()` with Node.js `setTimeout` in WorkflowsPage and SmartWaiter polling loops (Playwright anti-pattern)
- Replace discouraged `page.waitForSelector()` with locator-based `.waitFor()` in AppBuilderPage
- Remove invalid `{ timeout }` option passed to `waitForLoadState()` (silently ignored by Playwright)
- Add retry loop to sidebar navigation methods to handle DOM re-renders during menu interaction

## [0.5.0] - 2026-05-07

Initial release of `@crowdstrike/foundry-playwright`, an end-to-end (E2E) test infrastructure library for Falcon Foundry apps.

### Page Objects

- **`AppCatalogPage`**: Install, uninstall, and navigate to apps via the Foundry App Catalog. Supports a pluggable `configureSettings` callback for apps with configuration screens.
- **`AppManagerPage`**: Find and navigate to apps in App Manager.
- **`BasePage`**: Abstract base with `smartClick`, `waitAndAct`, retry support, and structured logging.
- **`DetectionExtensionPage`**: Navigate to Endpoint Detections, expand extensions, and return an iframe `FrameLocator`.
- **`FoundryHomePage`**: Navigate to Foundry home and verify the page title.
- **`HostManagementPage`**: Navigate to host management and retrieve host IDs.
- **`WorkflowsPage`**: Search, open, execute, and verify Falcon Fusion SOAR workflows.

### Configuration

- **`defineFoundryConfig()`**: Wraps Playwright's `defineConfig` with a standard 4-project pipeline (setup → app-install → chromium → app-uninstall).
- **`TestConfig` / `config`**: Lazy singleton for centralized env var management with CI-aware timeout defaults.

### Utilities

- **`SmartWaiter`**: Intelligent waiting with `waitForVisible`, `waitForPageLoad`, and `waitForCondition`.
- **`RetryHandler`**: Configurable retry with exponential/linear backoff. `withPlaywrightRetry` selectively retries timeout/waiting/not-found errors but not assertion failures.
- **`Logger` / `logger`**: Structured logging with step counters, performance timing, and scoped page loggers.

### Auth

- **`authenticate()`**: CSRF token flow with TOTP 2FA via `otpauth`.
- **`getUserCredentials()`**: Reads credentials from environment variables.
- Built-in `authenticate.setup.ts` handles login automatically in the pipeline.

### Built-in Setup/Teardown

- **`app-install.setup.ts`**: Default app install via `AppCatalogPage.installApp()`. Override with `appInstallDir` for apps needing custom install flows.
- **`app-uninstall.teardown.ts`**: Automatic app cleanup after tests.
- **`authenticate.setup.ts`**: Session authentication with stored state.
