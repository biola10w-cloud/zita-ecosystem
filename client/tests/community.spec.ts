import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => { await request.post('http://127.0.0.1:4311/__reset'); });

test('community is reachable, readable without login and empty without books', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'App navigation' }).getByRole('link', { name: 'Community' }).click();
  await expect(page.getByRole('heading', { name: 'Good books. Great conversations.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to join the conversation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start the conversation' })).toBeVisible();
  expect((await request.post('/api/community/community/posts', { data: { body: 'unauthorized' } })).status()).toBe(401);
  await request.post('http://127.0.0.1:4311/__empty');
  await page.goto('/community');
  await expect(page.getByRole('heading', { name: 'Start the conversation' })).toBeVisible();
  await expect(page.locator('.discussion-card')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/community-empty-mobile.png' });
});

test('readers can post, reply, like, unlike and report with session refresh', async ({ page, context, request }) => {
  await context.addCookies([{ name: 'zita_reader_refresh', value: 'refresh', domain: 'localhost', path: '/' }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/community');
  await request.post('http://127.0.0.1:4311/__empty');
  await page.getByLabel('Share your thoughts').fill('What did you think of the ending?');
  await page.getByRole('button', { name: 'Post discussion', exact: true }).click();
  const thread = page.locator('.comment-card').first();
  await expect(thread).toContainText('What did you think of the ending?');
  await thread.getByRole('button', { name: 'Like · 0', exact: true }).click();
  await expect(thread.getByRole('button', { name: 'Unlike · 1', exact: true })).toBeVisible();
  await thread.getByRole('button', { name: 'Unlike · 1', exact: true }).click();
  await expect(thread.getByRole('button', { name: 'Like · 0', exact: true })).toBeVisible();
  await thread.getByRole('button', { name: 'Replies', exact: true }).click();
  await thread.getByLabel('Your reply').fill('It made me see the character differently.');
  await thread.getByRole('button', { name: 'Post reply', exact: true }).click();
  await expect(page.locator('.comment-reply')).toContainText('It made me see the character differently.');
  await page.locator('.comment-reply').getByRole('button', { name: 'Like · 0', exact: true }).click();
  await expect(page.locator('.comment-reply').getByRole('button', { name: 'Unlike · 1', exact: true })).toBeVisible();
  await thread.getByRole('button', { name: 'Report', exact: true }).first().click();
  await thread.getByLabel('Report reason').selectOption('SPOILER');
  await thread.getByRole('button', { name: 'Submit report' }).click();
  await expect(thread.getByRole('status')).toContainText('sent for review');
  const state = (await (await request.get('http://127.0.0.1:4311/__state')).json()).data;
  expect(state.refreshes).toBe(1); expect(state.comments).toHaveLength(2); expect(state.reports).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/community-discussion-mobile.png', fullPage: true });
  await page.reload();
  await expect(page.locator('.comment-body').first()).toHaveText('What did you think of the ending?');
});

test('community failures preserve drafts and support retry', async ({ page, context, request }) => {
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  await page.goto('/community');
  await expect(page.getByRole('heading', { name: 'Start the conversation' })).toBeVisible();
  await request.post('http://127.0.0.1:4311/__community_failure', { data: { fail: true } });
  await page.getByLabel('Share your thoughts').fill('Keep my draft');
  await page.getByRole('button', { name: 'Post discussion' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('Community unavailable');
  await expect(page.getByLabel('Share your thoughts')).toHaveValue('Keep my draft');
  await request.post('http://127.0.0.1:4311/__community_failure', { data: { fail: false } });
  await page.getByRole('button', { name: 'Post discussion' }).click();
  await expect(page.locator('.comment-body')).toHaveText('Keep my draft');
});
