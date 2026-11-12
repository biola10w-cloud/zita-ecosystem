import Link from 'next/link';

export default function NotFound() {
  return <main className="reader-main"><p className="eyebrow">Zita</p><h1>This page isn’t available.</h1><p>The book may have moved or may no longer be published.</p><Link className="button button-dark" href="/">Explore the library</Link></main>;
}
