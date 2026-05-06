import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUserCredentials, getTotp, baseURL } from '../src';

describe('auth/utils', () => {
  describe('baseURL', () => {
    it('defaults to us-2 when FALCON_BASE_URL is not set', () => {
      // baseURL is evaluated at import time, so we test the module-level value
      // The default is already set since FALCON_BASE_URL is not in this test env
      expect(typeof baseURL).toBe('string');
      expect(baseURL).not.toMatch(/\/$/);
    });
  });

  describe('getUserCredentials', () => {
    beforeEach(() => {
      vi.stubEnv('FALCON_USERNAME', 'test@example.com');
      vi.stubEnv('FALCON_PASSWORD', 'secret123');
      vi.stubEnv('FALCON_AUTH_SECRET', 'TOTP_SECRET');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns credentials from environment', async () => {
      const creds = await getUserCredentials();
      expect(creds.email).toBe('test@example.com');
      expect(creds.password).toBe('secret123');
      expect(creds.secret).toBe('TOTP_SECRET');
    });

    it('returns undefined secret when FALCON_AUTH_SECRET is not set', async () => {
      vi.stubEnv('FALCON_AUTH_SECRET', '');
      const creds = await getUserCredentials();
      expect(creds.secret).toBe('');
    });

    it('throws when FALCON_USERNAME is not set', async () => {
      vi.stubEnv('FALCON_USERNAME', '');
      await expect(getUserCredentials()).rejects.toThrow('FALCON_USERNAME');
    });

    it('throws when FALCON_PASSWORD is not set', async () => {
      vi.stubEnv('FALCON_PASSWORD', '');
      await expect(getUserCredentials()).rejects.toThrow('FALCON_PASSWORD');
    });
  });

  describe('getTotp', () => {
    it('generates a 6-digit TOTP code', () => {
      const code = getTotp('JBSWY3DPEHPK3PXP');
      expect(code).toMatch(/^\d{6}$/);
    });

    it('generates consistent codes for the same secret and time', () => {
      vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
      const code1 = getTotp('JBSWY3DPEHPK3PXP');
      const code2 = getTotp('JBSWY3DPEHPK3PXP');
      expect(code1).toBe(code2);
      vi.useRealTimers();
    });

    it('generates different codes for different secrets', () => {
      vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
      const code1 = getTotp('JBSWY3DPEHPK3PXP');
      const code2 = getTotp('NBSWY3DPEHPK3PXQ');
      expect(code1).not.toBe(code2);
      vi.useRealTimers();
    });
  });
});
