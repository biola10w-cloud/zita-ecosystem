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
`20261005160000_user_blocks` before deployment. The website includes a
`/delete-account` page for deletion outside the installed app; it is not live
until the reader website and API release are deployed.

New App Store/Google Play purchases and restore are still unimplemented in mobile.
The app currently consumes existing account entitlements only. Native receipt
ownership validation and authenticated store notifications must be finished and
tested before enabling purchases. Store release also
needs approved privacy/terms/support pages, final icons and identifiers, signing,
and physical Android/iOS testing. The Android release configuration still uses
the generated debug signing configuration and must not be submitted as-is.

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
