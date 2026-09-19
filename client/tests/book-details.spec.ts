import { expect, test } from '@playwright/test';

test('premium book description is public and shown before the reader', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4311/__reset');
  await request.post('http://127.0.0.1:4311/__premium');
  const protectedRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/reader/')) protectedRequests.push(request.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/books/test-book');
  await expect(page.getByRole('heading', { name: 'About this book' })).toBeVisible();
  await expect(page.locator('.book-description')).toHaveText('A test book for checking the reader.');
  await expect(page.getByRole('link', { name: 'Sign in to read' })).toHaveAttribute('href', '/login?next=%2Fbooks%2Ftest-book%2Fread');
  await expect(page.locator('.chapter-content')).toHaveCount(0);
  expect(protectedRequests).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/public-book-description.png', fullPage: true });
});

test('signed-in readers still see the description before opening chapters', async ({ page, context, request }) => {
  await request.post('http://127.0.0.1:4311/__reset');
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  await page.goto('/books/test-book');
  await expect(page.locator('.book-description')).toBeVisible();
  await page.getByRole('link', { name: 'Read book', exact: true }).click();
  await expect(page).toHaveURL(/\/books\/test-book\/read$/);
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 2');
});

test('an ended session clears the open chapter when the reader regains focus', async ({ page, context, request }) => {
  await request.post('http://127.0.0.1:4311/__reset');
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  await page.goto('/books/test-book/read');
  await expect(page.locator('.chapter-content')).toBeVisible();
  await page.route('**/api/account', route => route.fulfill({ status: 401, json: { success: false, error: { code: 'SESSION_ENDED' } } }));
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 401, json: { success: false } }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.chapter-content')).toHaveCount(0);
  await expect(page.locator('main').getByRole('alert')).toContainText('signed in elsewhere');
  await expect(page.getByRole('region', { name: 'Listen to this chapter' })).toHaveCount(0);
});
