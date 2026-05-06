import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestConfig } from '../src';

function resetSingleton() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TestConfig as any)['_instance'] = undefined;
}

describe('TestConfig', () => {
  const requiredEnv = {
    FALCON_USERNAME: 'user@example.com',
    FALCON_PASSWORD: 'password123',
    FALCON_AUTH_SECRET: 'JBSWY3DPEHPK3PXP',
    APP_NAME: 'my-test-app',
  };

  beforeEach(() => {
    resetSingleton();
    vi.stubEnv('FALCON_USERNAME', requiredEnv.FALCON_USERNAME);
    vi.stubEnv('FALCON_PASSWORD', requiredEnv.FALCON_PASSWORD);
    vi.stubEnv('FALCON_AUTH_SECRET', requiredEnv.FALCON_AUTH_SECRET);
    vi.stubEnv('APP_NAME', requiredEnv.APP_NAME);
    vi.stubEnv('CI', '');
    vi.stubEnv('DEBUG', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetSingleton();
  });

  it('returns a singleton instance', () => {
    const a = TestConfig.getInstance();
    const b = TestConfig.getInstance();
    expect(a).toBe(b);
  });

  it('reads required environment variables', () => {
    const config = TestConfig.getInstance();
    expect(config.falconUsername).toBe('user@example.com');
    expect(config.falconPassword).toBe('password123');
    expect(config.authSecret).toBe('JBSWY3DPEHPK3PXP');
    expect(config.appName).toBe('my-test-app');
  });

  it('throws when required env vars are missing', () => {
    vi.stubEnv('FALCON_USERNAME', '');
    vi.stubEnv('FALCON_PASSWORD', '');
    expect(() => TestConfig.getInstance()).toThrow('Missing required environment variables');
  });

  it('uses default Falcon base URL when not set', () => {
    vi.stubEnv('FALCON_BASE_URL', '');
    const config = TestConfig.getInstance();
    expect(config.falconBaseUrl).toBe('https://falcon.us-2.crowdstrike.com');
  });

  it('strips trailing slashes from base URL', () => {
    vi.stubEnv('FALCON_BASE_URL', 'https://falcon.eu-1.crowdstrike.com///');
    const config = TestConfig.getInstance();
    expect(config.falconBaseUrl).toBe('https://falcon.eu-1.crowdstrike.com');
  });

  it('constructs apiBaseUrl from falconBaseUrl', () => {
    vi.stubEnv('FALCON_BASE_URL', 'https://falcon.eu-1.crowdstrike.com');
    const config = TestConfig.getInstance();
    expect(config.apiBaseUrl).toBe('https://falcon.eu-1.crowdstrike.com/api/v2');
  });

  describe('environment detection', () => {
    it('detects CI mode', () => {
      vi.stubEnv('CI', 'true');
      const config = TestConfig.getInstance();
      expect(config.isCI).toBe(true);
    });

    it('defaults to non-CI mode', () => {
      const config = TestConfig.getInstance();
      expect(config.isCI).toBe(false);
    });

    it('detects debug mode via DEBUG=true', () => {
      vi.stubEnv('DEBUG', 'true');
      const config = TestConfig.getInstance();
      expect(config.isDebugMode).toBe(true);
    });

    it('detects debug mode via NODE_ENV=debug', () => {
      vi.stubEnv('NODE_ENV', 'debug');
      const config = TestConfig.getInstance();
      expect(config.isDebugMode).toBe(true);
    });
  });

  describe('timeouts', () => {
    it('uses longer timeouts in CI', () => {
      vi.stubEnv('CI', 'true');
      const config = TestConfig.getInstance();
      expect(config.defaultTimeout).toBe(45000);
      expect(config.navigationTimeout).toBe(30000);
      expect(config.retryAttempts).toBe(3);
    });

    it('uses shorter timeouts locally', () => {
      const config = TestConfig.getInstance();
      expect(config.defaultTimeout).toBe(30000);
      expect(config.navigationTimeout).toBe(15000);
      expect(config.retryAttempts).toBe(2);
    });

    it('respects custom timeout overrides', () => {
      vi.stubEnv('DEFAULT_TIMEOUT', '99000');
      vi.stubEnv('NAVIGATION_TIMEOUT', '55000');
      vi.stubEnv('RETRY_ATTEMPTS', '5');
      const config = TestConfig.getInstance();
      expect(config.defaultTimeout).toBe(99000);
      expect(config.navigationTimeout).toBe(55000);
      expect(config.retryAttempts).toBe(5);
    });
  });

  describe('getPlaywrightTimeouts', () => {
    it('returns CI-appropriate action timeout', () => {
      vi.stubEnv('CI', 'true');
      const config = TestConfig.getInstance();
      const timeouts = config.getPlaywrightTimeouts();
      expect(timeouts.actionTimeout).toBe(15000);
      expect(timeouts.timeout).toBe(45000);
      expect(timeouts.navigationTimeout).toBe(30000);
    });

    it('returns local-appropriate action timeout', () => {
      const config = TestConfig.getInstance();
      const timeouts = config.getPlaywrightTimeouts();
      expect(timeouts.actionTimeout).toBe(10000);
    });
  });

  describe('getRetryConfig', () => {
    it('returns CI retry config', () => {
      vi.stubEnv('CI', 'true');
      const config = TestConfig.getInstance();
      const retry = config.getRetryConfig();
      expect(retry.delay).toBe(2000);
      expect(retry.backoff).toBe('exponential');
    });

    it('returns local retry config', () => {
      const config = TestConfig.getInstance();
      const retry = config.getRetryConfig();
      expect(retry.delay).toBe(1000);
    });
  });

  describe('getScreenshotConfig', () => {
    it('returns default screenshot config', () => {
      const config = TestConfig.getInstance();
      const screenshot = config.getScreenshotConfig();
      expect(screenshot.path).toBe('test-results');
      expect(screenshot.fullPage).toBe(true);
      expect(screenshot.type).toBe('png');
    });

    it('respects custom screenshot path', () => {
      vi.stubEnv('SCREENSHOT_PATH', '/tmp/screenshots');
      const config = TestConfig.getInstance();
      expect(config.getScreenshotConfig().path).toBe('/tmp/screenshots');
    });
  });

  describe('logSummary', () => {
    it('logs compact summary in CI', () => {
      vi.stubEnv('CI', 'true');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const config = TestConfig.getInstance();
      config.logSummary();

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CI')
      );
      consoleSpy.mockRestore();
    });

    it('logs verbose summary locally', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const config = TestConfig.getInstance();
      config.logSummary();

      expect(consoleSpy).toHaveBeenCalledTimes(7);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Base URL')
      );
      consoleSpy.mockRestore();
    });
  });
});
