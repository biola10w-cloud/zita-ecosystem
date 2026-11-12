import type { Metadata } from 'next';
import './globals.css';
import { InfoFooter } from '../components/info-page';
import { APP_NAME } from '../lib/app-info';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'A focused library for intentional reading.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<InfoFooter /></body>
    </html>
  );
}
