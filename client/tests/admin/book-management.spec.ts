import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request, context }) => {
  await request.post('http://127.0.0.1:4321/__reset');
  await context.addCookies([{ name: 'zita_admin_session', value: 'access', domain: 'localhost', path: '/' }]);
});

test('edits an existing upload with multiple categories and preserves changes after reload', async ({ page, request }) => {
  await page.goto('/books');
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Original Book');
  await expect(page.getByLabel('Personal Growth', { exact: true })).toBeChecked();
  await page.getByLabel('Title', { exact: true }).fill('Updated Book');
  await page.getByLabel('Business', { exact: true }).check();
  await page.getByLabel('Habits', { exact: true }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL('/books');
  await expect(page.getByRole('row').filter({ hasText: 'Updated Book' })).toContainText('Personal Growth, Habits, Business');
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page).toHaveURL('/books/book/edit');
  await page.reload();
  await expect(page.getByLabel('Business', { exact: true })).toBeChecked();
  const { data } = await (await request.get('http://127.0.0.1:4321/__state')).json();
  expect(data.edits[0].categoryIds).toEqual(['growth', 'habits', 'business']);
  expect(data.book.slug).toBe('original-book');
});

test('can cancel deletion, handles failures, then removes the book after confirmation', async ({ page, request }) => {
  await page.goto('/books');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Original Book' }).click();
  expect((await (await request.get('http://127.0.0.1:4321/__state')).json()).data.deletes).toBe(0);
  await request.post('http://127.0.0.1:4321/__failure', { data: { fail: true } });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Original Book' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Test service unavailable');
  await request.post('http://127.0.0.1:4321/__failure', { data: { fail: false } });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Original Book' }).click();
  await expect(page.getByRole('button', { name: 'Delete Original Book' })).toHaveCount(0);
  await expect(page.getByText('0 book(s)')).toBeVisible();
});

test('upload supports multiple category selections and edits can remove all categories', async ({ page, request }) => {
  await page.goto('/books/new');
  await page.getByLabel('Personal Growth', { exact: true }).check();
  await page.getByLabel('Business', { exact: true }).check();
  await expect(page.locator('input[name="categoryIds"]:checked')).toHaveCount(2);
  await page.goto('/books/book/edit');
  await page.getByLabel('Personal Growth', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL('/books');
  expect((await (await request.get('http://127.0.0.1:4321/__state')).json()).data.edits[0].categoryIds).toEqual([]);
});
