import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => { await request.post('http://127.0.0.1:4311/__reset'); });

test('reader translates content and can return to original after unavailable translation', async ({ page, context }) => {
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  await page.goto('/books/test-book/read');
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 2');
  await page.getByLabel('Reading language').selectOption('fr');
  await expect(page.locator('.chapter-content')).toContainText('Bonjour');
  await expect(page.locator('.chapter-content')).toHaveAttribute('lang', 'fr');
  await page.getByLabel('Reading language').selectOption('de');
  await expect(page.locator('main').getByRole('alert')).toContainText('Automatic translation is not available yet');
  await expect(page.locator('.chapter-content')).toHaveCount(0);
  await page.getByLabel('Reading language').selectOption('sw');
  await expect(page.locator('main').getByRole('alert')).toContainText('Automatic translation is not available yet');
  await page.getByLabel('Reading language').selectOption('en');
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 2');
});

test('listening supports pause, resume, speed and stops when the chapter changes', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  await page.addInitScript(() => {
    const calls = { speak: 0, cancel: 0, pause: 0, resume: 0, rate: 0 };
    (window as any).__speechCalls = calls;
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [{ name: 'Test English', lang: 'en-US', voiceURI: 'test' }],
      addEventListener() {}, removeEventListener() {},
      speak(part: any) { calls.speak++; calls.rate = part.rate; },
      cancel() { calls.cancel++; }, pause() { calls.pause++; }, resume() { calls.resume++; },
    } });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(public text: string) {} } });
  });
  await page.goto('/books/test-book/read');
  await page.getByLabel('Listening speed').selectOption('1.5');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  const calls = await page.evaluate(() => (window as any).__speechCalls);
  expect(calls).toMatchObject({ speak: 1, pause: 1, resume: 1, rate: 1.5 });
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 3');
  expect(await page.evaluate(() => (window as any).__speechCalls.cancel)).toBeGreaterThan(calls.cancel);
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/reader-listening-mobile.png' });
});

test('translation preparation hides original text and can be canceled', async ({ page, context }) => {
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  await page.route('**/api/reader/test-book/translations', route => route.fulfill({ json: { success: true, data: { status: 'PROCESSING' } } }));
  await page.goto('/books/test-book/read');
  await expect(page.locator('.chapter-content')).toBeVisible();
  await page.getByLabel('Reading language').selectOption('fr');
  await expect(page.getByText('Preparing the French translation', { exact: false })).toBeVisible();
  await expect(page.locator('.chapter-content')).toHaveCount(0);
  await page.getByLabel('Reading language').selectOption('en');
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 2');
});

test('library search, categories, and reader sign-in gate', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.book-grid').getByRole('heading', { name: 'A Quiet Morning' })).toBeVisible();
  await page.getByRole('button', { name: 'Search books', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search loaded books' }).fill('unmatched');
  await expect(page.getByRole('heading', { name: 'No matching books' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Mindfulness', exact: true }).click();
  await page.locator('.book-grid').getByRole('heading', { name: 'A Quiet Morning' }).click();
  await expect(page.getByRole('link', { name: 'Sign in to read' })).toBeVisible();
});

test('login resumes saved chapter and saves chapter navigation', async ({ page, request }) => {
  await page.goto('/login?next=/books/test-book/read');
  await page.getByLabel('Email', { exact: true }).fill('reader@example.test');
  await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 2');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 3');
  const state = await (await request.get('http://127.0.0.1:4311/__state')).json();
  expect(state.data.progress.chapterIndex).toBe(2);
  await page.reload();
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 3');
});

test('refresh-only cookie recovers the reader session', async ({ page, context, request }) => {
  await context.addCookies([{ name: 'zita_reader_refresh', value: 'refresh', domain: 'localhost', path: '/' }]);
  await page.goto('/books/test-book/read');
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 2');
  const state = await (await request.get('http://127.0.0.1:4311/__state')).json();
  expect(state.data.refreshes).toBe(1);
});

test('failed saves keep the current chapter open and allow retry', async ({ page, context, request }) => {
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  await page.goto('/books/test-book/read');
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 2');
  await request.post('http://127.0.0.1:4311/__failure', { data: { save: true } });
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await expect(page.getByText('Your place could not be saved.', { exact: false })).toBeVisible();
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 2');
  await request.post('http://127.0.0.1:4311/__failure', { data: { save: false } });
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 3');
});

test('catalog outages show a retry action, not an empty catalog', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4311/__failure', { data: { catalog: true } });
  await page.goto('/');
  await expect(page.locator('.empty-state[role="alert"]')).toContainText('temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('mobile library and login fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/login']) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('registration and logout return to a signed-out library', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Display name').fill('Test Reader');
  await page.getByLabel('Email', { exact: true }).fill('reader@example.test');
  await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:4310/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome, Test Reader.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.locator('header').getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
});

test('password recovery request and reset screens', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill('reader@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
  await page.goto('/reset-password?token=reset-token');
  await page.getByLabel('New password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('status')).toContainText('Your password has been updated');
});

test('login rejects external redirect destinations', async ({ page }) => {
  await page.goto('/login?next=javascript:alert(1)');
  await page.getByLabel('Email', { exact: true }).fill('reader@example.test');
  await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:4310/');
});

test('reader dashboard is the default sign-in destination and links to books', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('reader@example.test');
  await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:4310/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome, Test Reader.' })).toBeVisible();
  await expect(page.getByText('reader@example.test', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await page.getByRole('heading', { name: 'A Quiet Morning' }).click();
  await expect(page.locator('.chapter-content')).toContainText('Chapter text 2');
});

test('signed-out dashboard redirects to sign-in', async ({ page, request }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('http://localhost:4310/login?next=/dashboard');
  const response = await request.get('/api/account');
  expect(response.status()).toBe(401);
});

test('dashboard renews an expired access session and remains reachable from library', async ({ page, context, request }) => {
  await context.addCookies([{ name: 'zita_reader_refresh', value: 'refresh', domain: 'localhost', path: '/' }]);
  await page.goto('/');
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Test Reader.' })).toBeVisible();
  const state = await (await request.get('http://127.0.0.1:4311/__state')).json();
  expect(state.data.refreshes).toBe(1);
});

test('invalid dashboard session returns to sign-in without a loop', async ({ page, context }) => {
  await context.addCookies([{ name: 'zita_reader_refresh', value: 'expired', domain: 'localhost', path: '/' }]);
  await page.goto('/dashboard');
  await expect(page).toHaveURL('http://localhost:4310/login?next=/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('preview dashboard shows real activity and saved highlights', async ({ page, context }) => {
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  await page.goto('/dashboard');
  await expect(page.locator('.streak-number')).toHaveText('3');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '47');
  await expect(page.locator('.highlight-card blockquote')).toHaveText('A small moment of attention can change a day.');
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Library', exact: true })).toBeVisible();
});

test('empty live-style catalog has no sample books or featured placeholders', async ({ page, request, context }) => {
  await request.post('http://127.0.0.1:4311/__empty');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.book-card')).toHaveCount(0);
  await expect(page.locator('.featured-card')).toHaveCount(0);
  await expect(page.getByText('Your library is ready.', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/preview-aligned-empty-home.png', fullPage: true });
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  await page.goto('/dashboard');
  await expect(page.locator('.streak-number')).toHaveText('0');
  await expect(page.locator('.progress-book')).toHaveCount(0);
  await expect(page.locator('.highlight-card blockquote')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/preview-aligned-empty-dashboard.png', fullPage: true });
});

test('activity outages do not invent zero statistics', async ({ page, request, context }) => {
  await request.post('http://127.0.0.1:4311/__failure', { data: { stats: true } });
  await context.addCookies([{ name: 'zita_reader_session', value: 'access', domain: 'localhost', path: '/' }]);
  await page.goto('/dashboard');
  await expect(page.locator('.dashboard-error')).toContainText('temporarily unavailable');
  await expect(page.locator('.streak-number')).toHaveText('—');
});
