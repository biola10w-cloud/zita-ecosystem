# Zita mobile

Continues the Flutter direction from GitHub PR #49 against the current `backend/`
API. The older PR's placeholder backend is not used. Native projects were
generated with Flutter 3.47.3 (Dart 3.13.3).

Implemented: registration/sign-in, secure session storage, token refresh,
paginated library, server-side title/author search, public book descriptions and
category labels, cover images, password-reset email requests, chapter reading, text size controls,
and saved-position resume. Reading position saves after scrolling stops, when
the app backgrounds, before changing chapters, and before leaving the reader.
Failed saves on exit offer a choice to stay or leave without saving. Background
saves are best-effort network requests; durable offline progress is not implemented.
Book access is enforced by the API.

Password recovery opens the existing HTTPS reset page from the reader's email;
readers return to the app to sign in with their new password. The mobile app
does not store reset tokens. On resume, the reader checks the current session
and clears chapter text if that session has been revoked.

## Run and check

Install Flutter 3.47.3, then run from this directory:

```sh
flutter pub get
flutter analyze
flutter test
flutter run --dart-define-from-file=config/production.json
```

The config contains only the public Railway API address. Never put backend secrets
in it. HTTPS is required except for loopback addresses in debug builds. An absent
or invalid URL prevents startup.

On September 10, 2026, the Railway API, admin, and worker deployments were healthy
at backend commit `04138c4`. A temporary unpublished draft passed admin login,
upload, worker encryption, KMS decryption, cover delivery, private-storage checks,
and unpublished-book access denial. All temporary test artifacts were removed.
This validates the publishing backend; mobile device integration with a published
book remains unverified.

## iOS release work still required

- Configure the real Apple bundle ID and development team in Xcode. The generated
  `com.zita.zitaApp` identifier is provisional, not an App Store registration.
- Replace the generated Flutter icons with approved Zita artwork.
- Implement account deletion across backend and clients, including subscription
  handling, personal-data removal, and invalidation of outstanding access tokens.
- Add approved privacy, support, and terms pages and links. Confirm the operator's
  identity, contact information, retention policy, and production processors.
- Finish native purchases and restore, or the chosen reader-app access model.
  This version does not sell subscriptions.
- Verify recovery email delivery and the browser-to-app return flow on devices,
  and finish device accessibility testing.
- Check SDK privacy manifests, export compliance, App Store privacy disclosures,
  age rating, screenshots, review credentials, and content rights.
- Test against Railway with a dedicated test account and a published book.
- On macOS with the supported Xcode toolchain, build:

```sh
flutter build ios --release --no-codesign --dart-define-from-file=config/production.json
# After configuring distribution signing:
flutter build ipa --dart-define-from-file=config/production.json
```

An unsigned build checks compilation; it is not a TestFlight upload. The included
GitHub workflow runs analysis, tests, iOS simulator compilation, and an unsigned
iOS release build. Current results are available in
[draft PR #50](https://github.com/biola10w-cloud/zita-ecosystem/pull/50).
Neither native compilation check performs distribution signing or device testing.

This implementation is not yet ready for App Store submission.

## Mobile build work started October 5, 2026

The first update adds full-library search with pagination, stale-response
protection and retry, public descriptions before sign-in, multiple category
labels, book covers, password recovery, and reader session revalidation.
Sky-blue accents complement the existing green theme.

Validation: Flutter analysis passed, and all 16 API/session and widget tests
passed. New coverage checks public premium descriptions, paginated search,
out-of-order responses, recovery retries, and session revocation on resume.
These checks use fixtures; real-device testing and reset-email delivery still
need verification. This update has not been packaged or uploaded to either store.

The next update adds the shared community from the library's Community button,
with public discussions, authenticated posts/replies, likes, reports, recent/popular
sorting, pagination, and draft preservation on errors. Posts use the global
`community/posts` API. Community moderation still needs user blocking and the
remaining store-policy review before submission. Like counts come from the API;
the selected like state is currently remembered only during the screen visit.

The reader now offers all 19 translation languages supported by the API, bounded
polling while translations are prepared, original-language fallback, and RTL
Arabic text. New translations require the backend translation provider to be
configured; service errors are shown without pretending a translation is ready.

Listen to chapter uses `flutter_tts` with the device's available voices. It speaks
the displayed language, offers three speed settings, chunks long chapters, and
stops on chapter/language changes, reader disposal, session revocation, or app
backgrounding. Voice availability varies by device. There is no audio file export
or background narration in this version. Android declares the TTS service query.

Validation for this second update: static analysis passed and all 26 tests passed,
including community actions, speech cancellation, and translation polling/error
recovery. Speech tests use a fake engine; native voice playback and native
compilation still require device/build validation. A read-only production check
found `GOOGLE_TRANSLATE_API_KEY` absent on the API service; configure the provider
on API and worker before offering new machine translations. `flutter doctor`
also confirmed that this workstation has no Android SDK installed.

The account update adds My reading with statistics and saved-book resume,
current subscription status/access, password recovery and sign-out. Account
deletion requires the current password and explicit confirmation. The backend
cancels linked Stripe billing before removal; readers with Apple/Google billing
are told to cancel through their store. Personal data and sessions are removed
with the user, and owned uploads enter the durable file cleanup queue.

Community user blocking is stored on the account. Authenticated feeds and replies
exclude both sides of a block; blocked authors cannot receive replies from the
blocked reader. Blocking and unblocking are accessible in Community and My reading.
Public, signed-out discussions remain public. These backend changes require
`20261005160000_user_blocks` before deployment. This migration and the API/worker
update are deployed. The website's `/delete-account` page is live for deletion
outside the installed app; public `/privacy` and `/support` pages are also live.

New App Store/Google Play purchases and restore are still unimplemented in mobile.
The app currently consumes existing account entitlements only. Native receipt
ownership validation and authenticated store notifications must be finished and
tested before enabling purchases. Store release also
needs terms, native privacy/support links, final icons, iOS identifiers/signing,
and physical Android/iOS testing. Android release builds now require an upload
key and never use debug signing. See [Android release instructions](ANDROID_RELEASE.md)
for unsigned CI compilation followed by private local signing.

GitHub Mobile checks now builds an Android debug APK artifact and continues the
iOS simulator/unsigned release compilation checks. The debug APK is for development
testing, not Play Store submission. No signing keys or store credentials are in Git.

## Release checkpoint — September 17, 2026

- GitHub [Mobile checks run 34468123632](https://github.com/biola10w-cloud/zita-ecosystem/actions/runs/34468123632)
  passed for commit `b101299`: formatting, analysis, tests, iOS simulator
  compilation, and unsigned iOS release compilation all succeeded.
- The production API `/health` returned HTTP 200 with status `ok`.
- The public `/api/v1/books` endpoint returned HTTP 200 with an empty library
  (`total: 0`). A published book is required before validating chapter reading
  and saved-position resume against production.
- Flutter detected Windows, Chrome, and Edge only; no physical mobile device
  was connected. Native device integration remains unverified.
- Next: provide a dedicated reader test account and a published book, then test
  sign-in, chapter navigation, progress saving, app restart/resume, and sign-out
  on a mobile device. iOS distribution signing and TestFlight remain separate
  release steps.

## Verification in this workspace — October 6, 2026

- Flutter static analysis passed with no issues.
- All 31 mobile tests passed, covering discovery, account management, community,
  translation, listening controls, sessions, and reading. The final community
  navigation adjustment also passed the eight account/community tests.
- All 22 targeted backend account, billing, blocking, and community tests passed;
  backend type checking and Prisma schema validation passed.
- The reader website production build and all six account-deletion/community
  browser tests passed using mock API data. No live accounts were deleted.
- A local debug asset-bundle build could not complete because the Android SDK is
  not installed. Native iOS compilation runs on the GitHub macOS runner; no
  physical-device test has been performed here.
- This batch requires deployment of the backend migration/API and reader website.
  The earlier backend Dockerfile repair was deployed separately.

## Public homepage refresh — 1.0.1+2

The native homepage now introduces ZITA before sign-in, with an illustrated
reading/listening hero, a custom vector book-mark logo, and bundled OFL-licensed
Lora typography. Public actions explain voice reading, translation availability,
and saved reading progress, and open the global community. Create account opens
registration directly; Explore books scrolls to the public catalog.

Category chips and a searchable category/subcategory picker use the existing
public API. Category filtering combines with title/author search, persists during
pagination, and discards stale responses after a filter change. Book descriptions
remain public. No sample books are added to the live library. Android/iOS display
names now match the owner's revised name, ZITA; the package name remains unchanged.

The phone preview is generated from real Flutter widgets by the homepage test,
with optional `ZITA_PREVIEW_DIR` on Windows. It is not a substitute for testing the
updated bundle on a physical Android phone. Version code 2 must replace code 1 in
the existing Play internal testing track; no new app listing or upload key is needed.

### Career discovery homepage (1.0.2+3)

The public homepage uses the blue/white palette, responsive illustrated hero,
featured and compact catalogue cards with real descriptions/categories, and
session-only recent searches. Motion respects the device reduced-animation setting.
Book details and shared community actions are functional. Illustrative readership
counts, ratings, avatars and editor endorsements are not published as real data.
Dedicated 60-second audio previews, saved-book lists and live discussion previews
remain separate feature work; the existing reader supports device voice playback.

### Book-summary branding (1.0.3+4)

The header matches the blue Flutter symbol shown in the owner's supplied launcher
screenshot, alongside ZITA and an explicit Book summaries descriptor. The hero
explains reading/listening to book summaries and uses a blue gradient, blue
illustration details and blue catalogue badges. The existing launcher icon is
already the supplied symbol.

### Subscription navigation fix (pending next mobile release)

Premium-content denials now open a dedicated subscription page via View
subscription. Book details and My reading link to the same page. Existing
entitlements can be refreshed, and returning to the reader retries protected
content. Sign-out clears the displayed subscription. New purchases remain
unavailable until Google Play products and native billing are connected.

Owner-selected pricing: USD 5 monthly. Proposed Play product: com.zita.monthly;
base plan: monthly, auto-renewing. No annual plan or trial is configured by this
change. Display localized store prices once billing is connected, rather than
using the backend's older hardcoded plan catalogue. Backend receipt ownership,
purchase verification and notification handling must be checked before sales.

Validation: static analysis and all 38 Flutter tests pass, including navigation
from a denied chapter, refreshed access, and clearing access on sign-out.

### Temporary tester reading access (1.0.4+5)

READING_TEST_EMAILS is an explicit comma-separated allowlist of ZITA login emails.
Only matching signed-in users can open premium published books without paying.
Drafts remain inaccessible and stored prices/subscriptions are unchanged.
Remove an email to revoke its testing access; clear the list to disable this mode.
The obsolete READING_TEST_ACCESS global switch is not supported.
The access-policy endpoint requires authentication and does not expose the list.

### Phase 2 mobile structure (1.0.4+5)

Matches the navigation and signed-in home arrangement in zita_app_preview.html:
Home, Explore, Library and Profile tabs; fixed category controls; horizontal
Continue Reading cards; a featured book; and a two-column Trending grid.
Community remains a separate shared page. Blue branding and the public
book-summary introduction are preserved. Library uses actual reading progress;
empty collections do not display sample books or invented statistics.

Validation: Flutter analysis and 40 tests pass, including category navigation,
library progress, logout clearing private progress, and tester access display.

### Phase 2 screen interfaces (1.0.5+6)

Login uses the preview's logo-led welcome layout, filled rounded fields and
full-width sign-in action. Home keeps the four-tab catalogue structure with
white surfaces, blue category controls and softer cards. The reader uses a
compact title/chapter toolbar, translation and text settings panels, and a
fixed progress/narration dock. Community uses avatar rows, indented replies,
header sorting and a fixed composer for its global discussion feed.

The public introduction, real catalogue, authentication, tester allowlist,
progress saving, translation, narration, posting and moderation remain wired
to the existing services. No preview sample books or discussions are seeded.
All 41 tests pass; narrow-phone checks include stationary reader controls and
a reachable composer. Rendered previews use test fixtures, not live user data.

### Public home and continuous narration (1.0.6+7)

Signed-out visitors now use the same Phase 2 home shell and category/featured/
Trending layout, with a compact book-summary introduction and sign-in/register
actions. Personal reading progress remains restricted to signed-in readers.

Narration supports Pause/Resume at the last reported word, Stop, installed voice
selection and an explicitly labelled lower-pitched male-style preset. Android
voice metadata does not reliably identify gender; the preset adjusts pitch and
does not claim to install a new male voice. Actual voices depend on the device.
Narration reads all text chunks, saves completed chapters, advances automatically
and stops at book end. Settings persist across chapters. Manual chapter/language
changes, access failures and backgrounding cancel automatic continuation.
Backgrounding pauses current speech; this is foreground narration, not a
background audio service. Devices without word progress may repeat the current
chunk on resume. Physical-device speech quality/word-offset checks remain with
testers.

Validation: all 44 tests pass, covering resume offsets, lower-pitch selection,
complete-book narration, public discovery and existing reading/community flows.

### Homepage advert carousel (1.0.7+8)

Both public and signed-in Home show a swipeable picture carousel above the main
content, with previous/next arrows and accessible page indicators. It uses ZITA
promotions and available book covers until campaign images are supplied.

Edit assets/home_adverts.json to set title, subtitle, button, imageUrl (an HTTPS
image address), and action (explore or community). Empty or failed images fall
back to existing ZITA artwork. Campaign configuration is bundled in the app,
so changing it requires a new app build; this is not an admin upload system.
Use landscape images, keep important artwork centred, and check the crop.
The carousel does not automatically rotate or interrupt reading.
