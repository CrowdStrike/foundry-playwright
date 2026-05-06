import { expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { getTotp, getUserCredentials } from './utils';

/**
 * Authenticate with the Falcon console via API
 */
export async function authenticate(
  request: APIRequestContext,
  { email, password, secret }: { email: string; password: string; secret?: string }
): Promise<void> {
  // get CSRF Token
  const csrfResponse = await request.post('/api2/auth/csrf', {});
  let { csrf_token } = await csrfResponse.json();

  // attempt standard login
  const loginResponse = await request.post('/auth/login', {
    headers: {
      'x-csrf-token': csrf_token,
    },
    data: {
      username: email,
      password,
    },
  });

  await expect(loginResponse).toBeOK();

  const loginResult = await loginResponse.json();
  const totpStep = loginResult.steps?.find(({ type }: { type: string }) => type === 'urn:cs:sf:otp-device:totp');

  if (totpStep) {
    const { enroll, verify } = totpStep;

    if (enroll) {
      throw new Error(
        "You must complete 2FA enrollment for this account and save the account's encrypted `secret` with the account credentials",
      );
    } else if (!secret) {
      throw new Error(
        "You must save this account's encrypted `secret` with the account credentials",
      );
    } else if (verify) {
      csrf_token = loginResult.csrf_token;

      await expect(async () => {
        const passcode = getTotp(secret);

        const verifyResponse = await request.post(`/api2/${verify}`, {
          headers: {
            'x-csrf-token': csrf_token,
          },
          data: { passcode },
        });

        await expect(verifyResponse).toBeOK();
      }).toPass();

      const twoFactorLoginResponse = await request.post('/auth/login', {
        headers: {
          'x-csrf-token': csrf_token,
        },
        data: { username: email },
      });

      await expect(twoFactorLoginResponse).toBeOK();
    }
  }
}

/**
 * Authenticates a user with the specified role and returns the authenticated request context
 */
export async function getAuthenticatedRequest(
  request: APIRequestContext
): Promise<APIRequestContext> {
  const credentials = await getUserCredentials();
  await authenticate(request, credentials);
  return request;
}
