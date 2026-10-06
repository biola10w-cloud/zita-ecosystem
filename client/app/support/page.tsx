import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage } from '../../components/info-page';
import { APP_NAME, SUPPORT_EMAIL } from '../../lib/app-info';

export const metadata: Metadata = { title: `Support | ${APP_NAME}` };

export default function SupportPage() {
  return <InfoPage title="Support">
    <section><h2>Contact us</h2><p>For help with reading, your account, book uploads, or a problem in the community, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      <p>Include the email address on your account, your device type, and the error message or steps that caused the problem. Never send your password or payment card details.</p></section>
    <section><h2>Account help</h2><ul>
      <li><Link href="/forgot-password">Reset your password</Link> if you cannot sign in.</li>
      <li><Link href="/delete-account">Delete your account and associated data</Link>. If you cannot access your account, contact us for help verifying ownership.</li>
      <li><Link href="/privacy">Read the privacy policy</Link> or email us with a data-access, correction, or deletion request.</li>
    </ul></section>
    <section><h2>Subscriptions</h2><p>If you subscribed through Apple or Google Play, manage or cancel the subscription in that store. Deleting the app or your account does not cancel a store subscription.</p>
      <p><a href="https://apps.apple.com/account/subscriptions">Manage Apple subscriptions</a> · <a href="https://play.google.com/store/account/subscriptions">Manage Google Play subscriptions</a></p>
      <p>For website billing questions, email support. New purchases are not available in the current mobile build.</p></section>
    <section><h2>Community and book concerns</h2><p>Use Report on a community post to flag abuse or inappropriate content. You can also email us about safety, copyright, or a book listing; include a link or title so we can locate it.</p></section>
  </InfoPage>;
}
