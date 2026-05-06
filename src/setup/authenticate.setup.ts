import { authenticate } from '../auth/authenticate';
import { baseURL, getUserCredentials } from '../auth/utils';
import { expect, request, test as setup } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { AuthFile } from '../constants/AuthFile';

let requestContext: APIRequestContext;

setup('authenticate', async () => {
  requestContext = await request.newContext({ baseURL });

  const { email, password, secret } = await getUserCredentials();

  await authenticate(requestContext, { email, password, secret });

  const authVerifyResponse = await requestContext.post('/api2/auth/verify', {
    data: { checks: [] },
  });

  expect(authVerifyResponse.ok()).toBe(true);
  await requestContext.storageState({ path: AuthFile });
});
