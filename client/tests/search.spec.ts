import { test, expect } from '@playwright/test';

test('homepage searches the server by title or author and clears empty results', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4311/__reset');
  await page.goto('/');
  const search = page.getByRole('textbox', { name: 'Search by title or author' });
  await expect(search).toBeVisible();
  for (const query of ['quiet', 'ZITA TEST AUTHOR']) {
    const response = page.waitForResponse((r) => r.url().includes('/api/catalog?') && new URL(r.url()).searchParams.get('search') === query);
    await search.fill(query); await response;
    await expect(page.locator('.book-card')).toContainText('A Quiet Morning');
  }
  await search.fill('no such book');
  await expect(page.getByRole('heading', { name: 'No matching books' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page.locator('.book-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.book-card')).toHaveCount(1);
});

test('search paginates server results, resets for a new query, and retries failures', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4311/__reset');
  const requested: URL[] = [];
  let fail = false;
  await page.route('**/api/catalog?*', async (route) => {
    const url = new URL(route.request().url()); requested.push(url);
    const second = url.searchParams.get('page') === '2';
    const data = Array.from({ length: second ? 1 : 24 }, (_, i) => ({ id: `${second}-${i}`, slug: `result-${second}-${i}`, title: second ? 'Beyond the first page' : `Result ${i}`, authorName: 'Search Author', tags: [], coverUrl: null, estimatedMinutes: 10, isPremium: false }));
    await route.fulfill({ status: fail ? 503 : 200, json: { success: !fail, data } });
  });
  await page.goto('/');
  const search = page.getByRole('textbox', { name: 'Search by title or author' });
  await search.fill('Search Author');
  await expect(page.locator('.book-card')).toHaveCount(24);
  await page.getByRole('button', { name: 'Load more books' }).click();
  await expect(page.locator('.book-card')).toHaveCount(25);
  expect(requested.at(-1)?.searchParams.get('search')).toBe('Search Author');
  fail = true;
  await search.fill('Another title');
  await expect(page.locator('main').getByRole('alert')).toContainText('Unable to load books');
  expect(requested.at(-1)?.searchParams.get('page')).toBe('1');
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.book-card')).toHaveCount(24);
});
