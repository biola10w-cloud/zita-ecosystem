import { expect, test } from '@playwright/test';

test('book covers render despite the backend same-origin policy', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4311/__reset');
  await request.post('http://127.0.0.1:4311/__cover');
  await page.goto('/');
  const cover = page.locator('.book-grid img').first();
  await expect(cover).toHaveAttribute('src', '/api/covers/test-book');
  await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const response = await request.get('/api/covers/test-book');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
  expect((await request.get('/api/covers/not.valid')).status()).toBe(404);
});
