import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage } from '../../components/info-page';
import { APP_NAME, SUPPORT_EMAIL } from '../../lib/app-info';

export const metadata: Metadata = { title: `Privacy policy | ${APP_NAME}` };

export default function PrivacyPage() {
  return <InfoPage title="Privacy policy">
    <p>Last updated: October 6, 2026. This policy describes information handled by {APP_NAME}, including its website and mobile app.</p>
    <section><h2>Information used to provide the service</h2><ul>
      <li><strong>Account information:</strong> email address, display name, password hash, account role, and language preference.</li>
      <li><strong>Sign-in information:</strong> device identifier, platform, session tokens, and sign-in activity used to authenticate you and enforce one active session per account.</li>
      <li><strong>Reading activity:</strong> books opened, chapter positions, progress, reading events, highlights, and likes used to resume reading and show your reading statistics.</li>
      <li><strong>Community information:</strong> posts, replies, likes, reports, and blocked-reader relationships used to provide and moderate discussions.</li>
      <li><strong>Uploads:</strong> book content, cover images, descriptions, and other details submitted by people with publishing access.</li>
      <li><strong>Access and billing records:</strong> purchase or subscription identifiers, status, platform, and dates when associated with your account. Payment processing is handled by the relevant provider.</li>
      <li><strong>Support and technical information:</strong> messages you send to support and request or error information processed by our hosting services, such as IP addresses and connection details, to operate and troubleshoot the service.</li>
    </ul></section>
    <section><h2>What other readers can see</h2><p>Community discussions are public, including your display name and the content you post. Published book information and covers are visible to readers. Avoid posting private information. Blocking filters discussions for signed-in readers; it does not make a public post private.</p></section>
    <section><h2>Service providers and processing</h2><p>We use Railway for API and database hosting, Vercel for the website, and Amazon Web Services for book storage and encryption-key services. Support emails are handled through Gmail. The website loads fonts from Google Fonts, which receives connection information when your browser requests them. These providers process information needed to supply their services, which may involve processing outside your country.</p>
      <p>Where enabled, email delivery, error monitoring, and billing integrations process information needed for those features. Our integrations include SendGrid, Sentry, Stripe, Apple, and Google Play. Their use depends on the feature and service configuration.</p>
      <p>When machine translation is enabled, book text and the requested language are sent to the translation provider. Voice reading passes the displayed text to your device or browser speech service; whether that service processes speech locally or remotely depends on the voice and device settings.</p></section>
    <section><h2>Cookies, storage, and security</h2><p>The website uses session cookies to keep you signed in. The mobile app stores authentication credentials using secure device storage. The service uses password hashing, authenticated access, HTTPS connections, and encrypted book storage. These measures do not eliminate every security risk.</p></section>
    <section><h2>Retention and account deletion</h2><p>Account and reading records remain in the active service until your account is deleted. You can start deletion from your account in the app or the <Link href="/delete-account">account-deletion page</Link>. Confirmation requires your current password.</p>
      <p>Successful deletion removes your profile, sessions, device records, reading data, highlights, posts, likes, reports, block relationships, and local purchase and subscription records. Your own uploaded books are removed from the catalog and their stored files are queued for cleanup. Other readers’ replies may remain as separate posts.</p>
      <p>Deletion from the active database does not necessarily remove copies immediately from infrastructure backups, technical logs, cached files, support correspondence, or payment-provider records. Those copies are subject to the relevant provider’s retention and deletion processes. Contact support about retained information or a specific deletion request.</p>
      <p>A linked Stripe subscription is cancelled as part of account deletion; if cancellation fails, deletion does not proceed. Apple and Google Play subscriptions must be cancelled separately in the store.</p></section>
    <section><h2>Your questions and choices</h2><p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to ask about your information, request access or correction, or get help with deletion. We may need to verify account ownership before acting on a request.</p>
      <p>Updates to this policy will be published here with a revised date.</p></section>
  </InfoPage>;
}
