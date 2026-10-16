import Link from 'next/link';
import { APP_NAME, APP_OWNER, SUPPORT_EMAIL } from '../lib/app-info';

export function InfoPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="info-page">
    <Link className="info-brand" href="/">{APP_NAME}</Link>
    <h1>{title}</h1>
    <p className="info-owner">Operated by {APP_OWNER} · <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    {children}
  </main>;
}

export function InfoFooter() {
  return <footer className="info-footer">
    <nav aria-label="Support and privacy"><Link href="/support">Support</Link><Link href="/privacy">Privacy policy</Link><Link href="/delete-account">Delete account</Link></nav>
    <small>{APP_NAME} · {APP_OWNER}</small>
  </footer>;
}
