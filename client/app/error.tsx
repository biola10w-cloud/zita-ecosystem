'use client';

import Link from 'next/link';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="reader-main"><p className="eyebrow">Zita</p><h1>Let’s try that again.</h1><p>We couldn’t reach your reading space. Please try again in a moment.</p><div className="chapter-nav"><button className="button button-dark" onClick={reset}>Try again</button><Link className="button button-light" href="/">Back to library</Link></div></main>;
}
