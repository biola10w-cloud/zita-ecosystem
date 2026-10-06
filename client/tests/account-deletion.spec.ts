import { test, expect } from '@playwright/test';

test('deletion page is public and requires sign-in before showing the form', async ({ page }) => {
  await page.goto('/delete-account');
  await expect(page.getByRole('heading', { name: 'Delete your Zita account' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to delete your account' })).toHaveAttribute('href', '/login?next=/delete-account');
  await expect(page.getByLabel('Current password')).toHaveCount(0);
});

test('confirmed deletion handles wrong passwords then clears both session cookies', async ({ page, context }) => {
  await context.addCookies(['zita_reader_session', 'zita_reader_refresh'].map(name => ({
    name, value: name.endsWith('refresh') ? 'refresh' : 'access', domain: 'localhost', path: '/',
  })));
  await page.goto('/delete-account');
  await page.getByLabel('Current password').fill('wrong');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Permanently delete account' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Your current password is incorrect.');
  expect((await context.cookies()).some(cookie => cookie.name === 'zita_reader_session')).toBe(true);
  await page.getByLabel('Current password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Permanently delete account' }).click();
  await expect(page.getByRole('status')).toContainText('Your Zita account has been deleted.');
  expect((await context.cookies()).filter(cookie => ['zita_reader_session', 'zita_reader_refresh'].includes(cookie.name))).toEqual([]);
});

test('deletion proxy rejects foreign origins and missing confirmation', async ({ context }) => {
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  expect((await context.request.delete('/api/account', { headers: { Origin: 'https://untrusted.example' },
    data: { password: 'TestPassword123!', confirmation: 'DELETE' } })).status()).toBe(403);
  expect((await context.request.delete('/api/account', { headers: { Origin: 'http://localhost:4310' },
    data: { password: 'TestPassword123!' } })).status()).toBe(400);
});
