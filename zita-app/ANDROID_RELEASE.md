# Android testing build

Application ID: `com.zita.zita_app` (retain for future updates).
Display name: **ZITA THE APP**. Current version: `1.0.0+1`.
The owner confirmed no APK or AAB has previously been uploaded to Google Play.

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
- The bundle has **not** been uploaded to Google Play. In Play Console, select
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
   `-Bundle` (the downloaded unsigned AAB) and `-JavaHome` (a JDK 17 directory).
   The script signs locally, verifies the signature strictly against the upload
   keystore, and writes a signed AAB, public certificate, verification output and
   SHA-256 checksum under the ignored `release-artifacts/android/1.0.0-1/` folder.
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
