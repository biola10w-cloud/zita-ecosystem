// Read-only deployment smoke checks; does not create accounts or modify books.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');

(async () => {
  const origin = process.argv[2];
  assert.ok(origin && new URL(origin).protocol === 'https:', 'Supply the deployed HTTPS URL');
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('link', { name: 'Zita home', exact: true }).count(), 1);
    assert.equal(await page.getByText('The library is temporarily unavailable.', { exact: false }).count(), 0);
    const catalog = await page.request.get(`${origin}/api/catalog?page=1`);
    assert.equal(catalog.status(), 200);
    assert.ok(Array.isArray((await catalog.json()).data));
    for (const cover of await page.locator('.book-grid img, .featured-cover img').all()) {
      assert.ok(await cover.evaluate(image => image.complete && image.naturalWidth > 0), 'Published cover must render');
    }
    fs.mkdirSync('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/live-library-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'test-results/live-library-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.locator('header').getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Email', { exact: true }).waitFor();
    await page.screenshot({ path: 'test-results/live-login-mobile.png', fullPage: true });
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await page.getByRole('button', { name: 'Send reset link' }).waitFor();
    const unauthorized = await page.request.get(`${origin}/api/reader/test-book/0`);
    assert.equal(unauthorized.status(), 401);
    const translation = await page.request.post(`${origin}/api/reader/test-book/translations`, { data: { language: 'fr' } });
    assert.equal(translation.status(), 401);
    const account = await page.request.get(`${origin}/api/account`);
    assert.equal(account.status(), 401);
    await page.goto(`${origin}/community`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Good books. Great conversations.' }).waitFor();
    assert.equal(await page.getByText('The community is temporarily unavailable.', { exact: false }).count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: 'test-results/live-community-mobile.png', fullPage: true });
    const feed = await page.request.get(`${origin}/api/community/community/posts`);
    if (process.argv.includes('--allow-community-pending')) {
      assert.equal(feed.status(), 503);
      assert.ok((await feed.json()).error.message.includes('shared community is not available yet'));
      console.log('NOTE: shared community activation is blocked; verified the unavailable state.');
    } else {
      assert.equal(feed.status(), 200);
    }
    const communityPost = await page.request.post(`${origin}/api/community/community/posts`, { data: { body: 'Authorization check' } });
    assert.equal(communityPost.status(), 401);
    await page.goto(`${origin}/dashboard`, { waitUntil: 'networkidle' });
    assert.ok(page.url().includes('/login?next=/dashboard'));
    assert.deepEqual(errors, []);
    console.log('PASS: library, community, live catalog API, mobile layout, login, recovery, protected reader/dashboard/community posting, and browser runtime.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
