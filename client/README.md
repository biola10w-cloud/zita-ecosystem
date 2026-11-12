# Zita reader web frontend

Production: https://client-three-ruddy.vercel.app

Reader dashboard: https://client-three-ruddy.vercel.app/dashboard

Updated September 18, 2026 in the existing Vercel project `zita3/client`.
Deployment ID: `dpl_5Dib1WnP1r2n78oNUeHE9tzkR6WG`.
The server-side `API_BASE_URL` points to
`https://zita-ecosystem-production.up.railway.app/api/v1`.

## Included flows

- Responsive public library, category filters, search across loaded titles,
  pagination, empty states, and recoverable service errors.
- Registration, sign-in, sign-out, password recovery and reset forms.
- A personal My Reading dashboard with verified account details, reading
  streak, completed-book and session counts, saved reading progress, and
  highlights from the existing analytics API. Sign-in and registration default
  to this dashboard; a requested book return path still takes precedence.
  Expired sessions refresh before loading account details; invalid sessions
  return to sign-in.
- Home, Explore, Library, and Profile bottom navigation matching
  `../zita_app_preview.html`, with its navy/gold palette, DM Sans/Lora typography,
  rounded cards and sepia reader. Sky blue is a secondary accent, as requested.
  Book areas stay empty until real books are published; no sample books or
  invented activity statistics are seeded. The preview's hours-read figure is
  replaced by the actual session count available from the API.
- HttpOnly session cookies and automatic token refresh for reader requests.
- Chapter navigation, text-size controls, progress saving and saved-position
  restoration. Failed saves keep chapter navigation in place and offer retry.
- Public book details at `/books/[slug]` show the uploaded description before
  reading, including premium titles, without requiring authentication or a
  subscription. Protected reading now lives at `/books/[slug]/read`.
- Protected chapter proxy, safe post-login return paths, and distinct missing
  book and service-error pages.

## Development and verification

Use Node.js 24, then run `npm ci`. Copy `.env.example` to `.env.local` and set
`API_BASE_URL` to the intended backend. Run `npm run dev` on port 3001.

Run `npm run build`, then `npm test`. Tests use Chrome, an isolated fixture API
on port 4311, and the production frontend build on port 4310. No production
accounts or books are created by these tests. On systems without Chrome, install
Chrome or change the browser channel in `playwright.config.ts`.

Read-only deployed checks:

```sh
node tests/verify-live.cjs https://client-three-ruddy.vercel.app
```

Verified on September 18, 2026:

- Production build and TypeScript checks passed locally and on Vercel.
- All 22 browser regression tests passed, including Community posting, replies,
  likes, reports, session recovery, failed-post draft preservation, dashboard entry,
  registration/sign-in redirects, protected account data, expired sessions,
  mobile sizing, opening a book at its saved position, reading-statistics
  rendering, failure states, and empty catalogs with no featured placeholders.
- Dependency audit reported zero vulnerabilities. Next.js uses the patched
  15.5.24 release, with a PostCSS 8.5.28 override for its transitive dependency.
- Public deployment checks passed for the library, live catalog API, mobile
  sizing, login/recovery navigation, unauthorized reader access and browser
  runtime. Desktop and mobile screenshots were inspected.
- The API statistics query was repaired for the current Prisma schema and
  deployed to Railway (`38ce6d5d-c579-440b-aa76-169da0e8f07e`). Four streak
  regression tests and a read-only production-schema check passed. The check
  used a nonexistent user ID and changed no records.

## Remaining content and integration checks

The production catalog now contains the published premium summary
`the-alchemist-tlb4qp` (9 chapters). The public listing, chapter metadata,
sign-in gate and discussion page were checked. A same-origin cover proxy fixes
the backend's cross-origin image restriction. Full live chapter reading still
requires testing with a dedicated reader account with premium access.
Reading and account flows were tested against the
fixture API; no production reader account was created. Password-reset email
delivery still needs verification with the configured email provider.

Progress saves on backgrounding/page exit are best-effort network requests;
offline progress storage is not implemented. The frontend does not sell
subscriptions. Premium access remains enforced by the backend.

This update aligns the implemented web screens with the saved preview. The
preview's subscription checkout and highlight
creation controls are not implemented in this web frontend; existing saved
highlights can be viewed on the dashboard. No sample content was published.

Community is one shared feed at `/community`, open to discussion of any book,
including titles outside the catalog. It is also linked from the reader and
bottom navigation. Previous `/community/[slug]` links redirect to the feed.
Visitors can read; signed-in readers can post, reply, like/unlike and report.
Existing published-book discussions appear alongside new general posts.
New posts have no book association. The backend requires migration
`20260919010000_global_community` and the new `/community/posts` routes before
this feed can operate. The frontend reports unavailable service truthfully and
preserves failed drafts. No sample posts or books are created.

The shared-feed API deployment was rejected by Railway's expired-trial check.
The database migration has NOT been applied. After restoring Railway, apply
the checked-in migration with the normal Prisma deployment process and deploy
the API before declaring shared posting available. Do not work around this by
storing general posts under a dummy book or by using browser-local storage.

Pending release: public book details and single-session enforcement are local
changes, not yet deployed. Access JWTs now include an exact session ID checked
on every protected backend request. Login serializes on the user row and revokes
previous sessions; refresh rechecks its session under that same lock. A new
login ends previous sessions across web/native/admin clients, even when device
fingerprints match. Old JWTs without a session ID must refresh or sign in again.
The web reader checks account access every 15 seconds while visible and when
regaining focus, clearing chapter text and narration when access ends.

Local verification: production frontend build and backend TypeScript build
passed. `node backend/scripts/verify-single-session.cjs` (from the workspace
root, after building backend) verifies revocation/refresh races with real JWTs
and bcrypt against an in-memory session store; it does not replace a production
database concurrency test. Browser tests cover public premium descriptions,
explicit reading entry and clearing an ended reader session.

Final deployment/live-check commands were blocked by automatic approval review
because the Codex usage limit was reached. Railway also still reports an expired
trial. Restore access before retrying deployment; do not claim these local
changes are active on the live app.

The reader includes device-based text-to-speech with pause/resume, stop, speed,
and voice selection. A matching voice must be installed on the reader's device;
keep the page open while listening. Audio stops when changing chapters or language.
The language selector requests an access-controlled book translation and waits
for completion before displaying translated text. It never substitutes original
text for an unavailable translation. Narration uses the selected language.

Automatic translation is blocked until `GOOGLE_TRANSLATE_API_KEY` is configured
securely on both Railway services, `zita-ecosystem` and `zita-worker`, with Google
Cloud Translation API enabled. Both services currently lack this key. Existing
completed translations remain readable. Failed translations can be retried by
the admin. No provider credential should be entered into frontend code or chat.

The September 19 backend deployment was rejected because the Railway trial
expired. Reactivate Railway and deploy the reader API changes before enabling
new reader-requested translations. The frontend handles this unavailable route
with a clear message and allows returning to the original language.

To deploy future changes, run `npx vercel deploy --prod` from this directory
after the build and tests pass. The linked project is recorded in the ignored
`.vercel/project.json`. Source edits from this session remain uncommitted.
