import * as OTPAuth from 'otpauth';

export const baseURL = (process.env.FALCON_BASE_URL ?? 'https://falcon.us-2.crowdstrike.com').replace(/\/+$/, '');

export async function getUserCredentials() {
  const email = process.env.FALCON_USERNAME;
  const password = process.env.FALCON_PASSWORD;
  const secret = process.env.FALCON_AUTH_SECRET;

  if (!email) {
    throw new Error('FALCON_USERNAME environment variable is not set');
  }
  if (!password) {
    throw new Error('FALCON_PASSWORD environment variable is not set');
  }

  return { email, password, secret };
}

export function getTotp(secret: string): string {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });

  return totp.generate();
}
