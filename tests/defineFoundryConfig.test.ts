import { describe, it, expect } from 'vitest';
import { defineFoundryConfig } from '../src';

describe('defineFoundryConfig', () => {
  it('returns a valid Playwright config with default values', () => {
    const config = defineFoundryConfig();

    expect(config.testDir).toBe('./tests');
    expect(config.fullyParallel).toBe(true);
    expect(config.reporter).toBe('list');
    expect(config.use?.testIdAttribute).toBe('data-test-selector');
    expect(config.use?.trace).toBe('on-first-retry');
    expect(config.use?.screenshot).toBe('only-on-failure');
  });

  it('creates 4 projects in the standard pipeline', () => {
    const config = defineFoundryConfig();

    expect(config.projects).toHaveLength(4);

    const names = config.projects!.map((p) => p.name);
    expect(names).toEqual(['setup', 'app-install', 'chromium', 'app-uninstall']);
  });

  it('sets correct project dependencies', () => {
    const config = defineFoundryConfig();
    const projects = config.projects!;

    // setup has no dependencies
    expect(projects[0].dependencies).toBeUndefined();

    // app-install depends on setup
    expect(projects[1].dependencies).toEqual(['setup']);

    // chromium depends on setup and app-install
    expect(projects[2].dependencies).toEqual(['setup', 'app-install']);

    // app-uninstall depends on chromium
    expect(projects[3].dependencies).toEqual(['chromium']);
  });

  it('points setup/install/uninstall projects at library setup dir', () => {
    const config = defineFoundryConfig();
    const projects = config.projects!;

    // setup, app-install, app-uninstall should have testDir pointing to library
    expect(projects[0].testDir).toContain('setup');
    expect(projects[1].testDir).toContain('setup');
    expect(projects[3].testDir).toContain('setup');

    // chromium should NOT have its own testDir (inherits from top-level)
    expect(projects[2].testDir).toBeUndefined();
  });

  it('allows overriding timeout', () => {
    const config = defineFoundryConfig({ timeout: 120_000 });

    expect(config.timeout).toBe(120_000);
  });

  it('allows overriding reporter', () => {
    const config = defineFoundryConfig({ reporter: 'html' });

    expect(config.reporter).toBe('html');
  });

  it('allows overriding testDir', () => {
    const config = defineFoundryConfig({ testDir: './e2e/tests' });

    expect(config.testDir).toBe('./e2e/tests');
  });

  it('merges custom use options', () => {
    const config = defineFoundryConfig({
      use: { baseURL: 'https://falcon.example.com' },
    });

    expect(config.use?.baseURL).toBe('https://falcon.example.com');
    expect(config.use?.testIdAttribute).toBe('data-test-selector');
  });

  it('allows replacing projects entirely', () => {
    const customProjects = [{ name: 'custom', testMatch: /custom/ }];
    const config = defineFoundryConfig({ projects: customProjects });

    expect(config.projects).toHaveLength(1);
    expect(config.projects![0].name).toBe('custom');
  });
});
