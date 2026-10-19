# Android testing build

Application ID: `com.zita.zita_app` (retain for future updates).
Display name: **ZITA**. Current version: `1.0.7+8`.
The first build has been uploaded to Google Play internal testing by the owner.

## Homepage picture carousel

- Version: `1.0.7+8`; source: `517ea143f6884aa14db296dfc4d42edabb29a888`.
- Public and signed-in home carousel with three starter ZITA promotions,
  image support, swipe navigation, arrows and page indicators.
- All 45 tests and static analysis passed.
- Signed file: `release-artifacts/android/1.0.7-8/ZITA-THE-APP-1.0.7-8.aab`.
- SHA-256: `cdbb6d89d643f4bd447de06bacf1675a9c54852ae011d3d9b53f68d03234fefc`.
- Strict signature, bundletool, package, original certificate and version checks
  passed. Not uploaded to Google Play or tested on a physical device by us.

## Public homepage and continuous narration

- Version: `1.0.6+7`; source: `0ac07ed5f74d2ff5d6dd4545ea5b9b911e1e1e53`.
- Public Phase 2 home, word-position pause/resume, installed voice selection,
  lower-pitched male-style preset and automatic narration through book end.
- All 44 tests and static analysis passed. Physical-device audio verification
  remains with testers; available voices/progress precision depend on device.
- Signed file: `release-artifacts/android/1.0.6-7/ZITA-THE-APP-1.0.6-7.aab`.
- SHA-256: `f08a778757650776a3a43d24b44ff5abb39e8a11749b5a8d971ee465259920f7`.
- Local compilation, strict signature and bundletool validation passed.
  Original package/certificate and non-debuggable version 1.0.6 (7) verified.
- Not uploaded to Google Play by us.

## Preview-style screen update

- Version: `1.0.5+6`; source: `b13a58d095825bf35e1af158bcde955be3160660`.
- Preview-style login, home surfaces, reader toolbar and fixed narration dock,
  and global community feed with header sorting and fixed composer.
- All 41 Flutter tests pass; final community/layout checks also pass.
- Signed file: `release-artifacts/android/1.0.5-6/ZITA-THE-APP-1.0.5-6.aab`.
- SHA-256: `fddaf3ba85b753205eb92c9e5e5c53a89e7101c7e6bf6f9114b63b6998e5b3c7`.
- Local release compilation, strict signature and bundletool validation passed.
  Package, original certificate, ZITA label and non-debuggable manifest verified.
- Not uploaded to Play or tested on a physical device by us.

## Phase 2 structure and tester access update

- Version: `1.0.4+5`; source: `4e7e16167fcfb70c8868b9854696d407b42d34ae`.
- Built locally after GitHub Actions could not start due to account billing.
- Four tabs: Home, Explore, Library, Profile. Category browsing, horizontal
  Continue Reading, featured book and Trending grid follow the Phase 2 preview.
- Approved testers see reading access without subscription prompts.
- Static analysis and all 40 Flutter tests passed before release compilation.
- Signed file: `release-artifacts/android/1.0.4-5/ZITA-THE-APP-1.0.4-5.aab`.
- SHA-256: `be48227f6f7a586d0e794651cec964925d0129a7cde63297b4c3ab2495ee64c6`.
- Strict signature and bundletool validation passed. Package, original upload
  certificate, ZITA label, version code 5 and non-debuggable manifest verified.
- Not uploaded to Google Play or tested on a physical device by us. Upload this
  AAB to a new release in the existing internal testing track.

## Supplied logo and book-summary branding update

- Version: `1.0.3+4`; source: `65cb63b126ac9178c39985d2a57ba19d71fb6a2c`.
- [Successful workflow](https://github.com/biola10w-cloud/zita-ecosystem/actions/runs/38311562967).
- Header matches the supplied launcher symbol, adds Book summaries, and uses a
  rewritten hero with blue gradients, illustration accents and badges.
- Static analysis and all 35 tests passed locally and in CI.
- Signed file: `release-artifacts/android/1.0.3-4/ZITA-THE-APP-1.0.3-4.aab`.
- SHA-256: `65d8e9bda115da9bc512bcf4a91db84e94a7e4fb59b7415a6c85db5ed64c9e4e`.
- Strict signature and bundletool validation passed; existing package and upload
  certificate retained. Manifest confirms ZITA, version 1.0.3, code 4 and a
  non-debuggable release. Not uploaded to Google Play or tested on a physical
  phone by us.

## Career discovery design update

- Version: `1.0.2+3`; source: `2b107c5af54cdabc45edefbf468a187dade12c64`.
- [Successful workflow](https://github.com/biola10w-cloud/zita-ecosystem/actions/runs/38309447037).
- All 35 tests and static analysis passed locally and in CI. Responsive layout
  checks cover narrow phones, wider screens and enlarged text.
- Signed file: `release-artifacts/android/1.0.2-3/ZITA-THE-APP-1.0.2-3.aab`.
- SHA-256: `aa09d0454e7e68d6bdbac722a0cfefe9146e8183110505d1eab1d2b8f24da250`.
- Strict signature and bundletool validation passed. Package, version code 3,
  version name 1.0.2, ZITA label and non-debuggable manifest verified. Uses the
  original upload certificate. Not uploaded to Google Play by us; physical-device
  verification remains with testers.
- New blue hero and catalogue design uses real book data. Sample reader totals,
  ratings, avatars and live discussion statistics are omitted. Dedicated audio
  previews and saved-book actions are not part of this release.

## Homepage update testing bundle

- Build source: `70e17a9f9d2bf626d0631699668c8e5032d0bae4`.
- [Successful workflow run](https://github.com/biola10w-cloud/zita-ecosystem/actions/runs/38276834727):
  analysis, all 34 tests and Android release compilation passed.
- Includes the illustrated public homepage, custom Zita wordmark, feature
  introductions, and category/subcategory browsing before registration.
- Locally signed file: `release-artifacts/android/1.0.1-2/ZITA-THE-APP-1.0.1-2.aab`
  at the repository root (49.25 MiB, excluded from source control).
- SHA-256: `0fd6289e6920669cadea4e2f6b6a8bc1eedba45d1d58dada0014f8b88534faf1`.
- Strict signature verification and bundletool validation passed. Manifest checks
  confirmed the existing package, version code 2, version name 1.0.1, display name
  ZITA and a non-debuggable release. The original upload certificate is retained.
  The bundled font license was verified in the AAB.
- This update has not been uploaded to Google Play or tested on a physical device
  by us. Upload it as a new release in the existing app's internal testing track.

## First verified testing bundle

- Build source: `419c50fa2401e9eaa6c7d00d69e7ffe5233fd9e0`.
- [Successful workflow run](https://github.com/biola10w-cloud/zita-ecosystem/actions/runs/37523350978):
  Flutter analysis, tests, release compilation and unsigned-artifact checks passed.
- Locally signed file: `release-artifacts/android/1.0.0-1/ZITA-THE-APP-1.0.0-1.aab`
  at the repository root (48.87 MiB, deliberately excluded from source control).
- SHA-256: `04eb6efefb82e328175b1cb835dc82535cbfbd262d7365d9b830576622f122da`.
- Strict JAR signature verification against the upload keystore passed. Google's
  bundletool 1.18.3 validated the signed bundle. Manifest checks confirmed the
  approved display name, package, version code 1, minimum SDK 24, target SDK 36,
  and a non-debuggable release. This has not been installed on a physical device.
- Upload certificate SHA-256:
  `8D:25:C6:67:C1:57:71:08:C7:B4:C3:76:E1:83:E1:C7:BD:25:ED:57:62:4C:23:73:7B:99:18:D3:E1:DC:7F:CE`.
- At preparation time, this bundle had not been uploaded to Google Play. The owner
  subsequently uploaded it for internal testing. In Play Console, select
  ZITA THE APP, then **Test and release → Testing → Internal testing → Create new
  release**. Configure Play App Signing and upload the signed `.aab` above. Add
  your test accounts and follow the console's review/rollout instructions.
  See [Google's testing guide](https://support.google.com/googleplay/android-developer/answer/9845334).

## Build and sign

1. Run the **Android release candidate** GitHub workflow for the desired commit.
   It runs analysis/tests and builds an explicitly unsigned release AAB. It never
   receives the private upload key or its passwords. Download the artifact from
   that exact successful run and verify its `SHA256SUMS.txt` and source commit.
2. Run `scripts/Sign-AndroidBundle.ps1` on the owner's Windows computer, supplying
   `-Bundle` (the downloaded unsigned AAB), `-JavaHome` (a JDK 17 directory), and
   `-Version '1.0.3-4'` (always match the build being signed).
   The script signs locally, verifies the signature strictly against the upload
   keystore, and writes a signed AAB, public certificate, verification output and
   SHA-256 checksum under the ignored `release-artifacts/android/<version>/` folder.
3. Upload only the signed AAB to Google Play's internal testing track. The unsigned
   workflow artifact cannot be submitted as a release. Configure Play App Signing
   in Play Console; the local key is the **upload key**, not Google's app signing key.
4. Install through the testing link and exercise login, reading/resume, voice,
   translation, community/reporting/blocking, subscription access and deletion.
   Build success is not store approval or a completed device test.

Normal release builds require real signing settings through `android/key.properties`
or `ZITA_UPLOAD_STORE_FILE`, `ZITA_UPLOAD_STORE_PASSWORD`, `ZITA_UPLOAD_KEY_ALIAS`
and `ZITA_UPLOAD_KEY_PASSWORD`. Missing settings fail closed. Only the explicit
`ZITA_BUILD_UNSIGNED=true` flag permits an unsigned intermediate. Debug builds
continue to use debug signing; release builds never fall back to it.

## Protect the upload key

The first key was generated with `scripts/New-UploadKey.ps1`. It refuses to replace
existing signing material. `.release-secrets/` at the repository root contains
the PKCS#12 keystore and the password protected with Windows DPAPI. Directory
permissions restrict access to the current Windows user; these files are ignored
by Git. No signing secrets have been uploaded to GitHub.

The DPAPI password file can be decrypted only by the same Windows account on this
computer. It is not a portable backup. Before relying on this key for future
releases, retain the keystore and password together in an owner-controlled secure
backup/password manager. Do not email them, commit them, or post them in chat.
Keep the same upload key for updates; loss may require Google's upload-key reset.

## Still required before public release

- Complete Play Console verification, listing, screenshots, content rating,
  audience and Data safety declarations; use the URLs in `STORE_DETAILS.md`.
- Add native support/privacy links, finish terms and confirm the access/purchase
  model. Translation configuration and real-device checks remain outstanding.
- Replace/approve the launcher artwork and review the complete store experience.
- Run the required closed test and apply for production access. Nothing here
  uploads to Play Console or makes the app publicly available.

References: [Flutter Android release guide](https://docs.flutter.dev/deployment/android),
[Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756).
