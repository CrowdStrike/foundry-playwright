import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '../src';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    // Reset singleton for each test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Logger as any)['_instance'] = undefined;
    vi.stubEnv('DEBUG', '');
    vi.stubEnv('CI', '');
    logger = Logger.getInstance();
  });

  it('returns a singleton instance', () => {
    const instance1 = Logger.getInstance();
    const instance2 = Logger.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('logs step messages with incrementing counter', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.step('TestPage', 'Navigate to home');
    logger.step('TestPage', 'Click button');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[1] TestPage: Navigate to home')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[2] TestPage: Click button')
    );

    consoleSpy.mockRestore();
  });

  it('logs success messages', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.success('App installed');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('App installed'));

    consoleSpy.mockRestore();
  });

  it('provides a scoped page logger via forPage()', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const pageLogger = logger.forPage('AppCatalog');
    pageLogger.step('Search for app');
    pageLogger.success('Found app');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('AppCatalog: Search for app')
    );

    consoleSpy.mockRestore();
  });

  it('suppresses debug messages when DEBUG is not set', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.debug('hidden message');

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('shows debug messages when DEBUG=true', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Logger as any)['_instance'] = undefined;
    vi.stubEnv('DEBUG', 'true');
    const debugLogger = Logger.getInstance();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    debugLogger.debug('visible message');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('visible message'));

    consoleSpy.mockRestore();
  });

  it('formats performance durations correctly', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.performance('Page load', 500);
    logger.performance('Full test', 2500);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('500ms'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2.50s'));

    consoleSpy.mockRestore();
  });
});
