import { test as setup } from '@playwright/test';
import { AppCatalogPage } from '../pages/AppCatalogPage';
import { config } from '../config/TestConfig';

setup('install app', async ({ page }) => {
  const catalog = new AppCatalogPage(page);
  await catalog.installApp(config.appName);
});
