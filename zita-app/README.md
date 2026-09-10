# Zita mobile

Continues the Flutter direction from GitHub PR #49 against the current `backend/`
API. The older PR's placeholder backend is not used. Native projects were
generated with Flutter 3.47.3 (Dart 3.13.3).

Implemented: registration/sign-in, secure session storage, token refresh,
paginated library, search within loaded books, chapter reading, text size controls,
and saved-position resume. Reading position saves after scrolling stops, when
the app backgrounds, before changing chapters, and before leaving the reader.
Failed saves on exit offer a choice to stay or leave without saving. Background
saves are best-effort network requests; durable offline progress is not implemented.
Book access is enforced by the API.

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
- Finish password recovery UX and device accessibility testing.
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

## Verification in this workspace

- Flutter static analysis passed with no issues.
- All ten API/session and reader widget tests passed, including automatic progress
  saving and the exit flow when saving fails.
- A local debug asset-bundle build could not complete because the Android SDK is
  not installed. Native iOS compilation runs on the GitHub macOS runner; no
  physical-device test has been performed here.
- Railway successfully built and deployed the repaired backend Dockerfile.
