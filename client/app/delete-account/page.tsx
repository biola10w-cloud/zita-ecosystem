import Link from 'next/link';
import { hasReaderSession } from '../../lib/session';
import { DeleteAccountForm } from '../../components/delete-account-form';

export default async function DeleteAccountPage() {
  const signedIn = await hasReaderSession();
  return <main className="auth-page"><Link href="/">Zita</Link><section className="auth-panel">
    <h1>Delete your Zita account</h1>
    <p>This permanently removes your profile, reading progress, highlights, posts, likes and purchases. Your own published uploads will also be removed. You will be signed out on all devices.</p>
    <p>A linked Stripe subscription will be cancelled. Apple and Google Play subscriptions must be cancelled in their store settings to prevent further charges. You can still delete your account now. Payment-provider billing records are separate.</p>
    <p><a href="https://apps.apple.com/account/subscriptions">Manage Apple subscriptions</a> · <a href="https://play.google.com/store/account/subscriptions">Manage Google Play subscriptions</a></p>
    {signedIn ? <DeleteAccountForm /> : <p><Link className="button button-dark" href="/login?next=/delete-account">Sign in to delete your account</Link></p>}
    <p><Link href="/forgot-password">Forgot your password?</Link> · <Link href="/dashboard">Back to your account</Link></p>
  </section></main>;
}
