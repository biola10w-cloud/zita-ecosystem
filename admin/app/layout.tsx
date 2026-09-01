import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZITA Admin',
  description: 'ZITA — Book upload, categories, and moderation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-primary antialiased">{children}</body>
    </html>
  );
}
