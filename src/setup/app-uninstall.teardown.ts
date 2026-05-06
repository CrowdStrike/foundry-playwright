import { test as teardown } from '@playwright/test';
import { AppCatalogPage } from '../pages/AppCatalogPage';
import { config } from '../config/TestConfig';

teardown('uninstall app', async ({ page }) => {
  const catalog = new AppCatalogPage(page);
  await catalog.uninstallApp(config.appName);
});
