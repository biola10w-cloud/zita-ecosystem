import { redirect } from 'next/navigation';
import { hasReaderSession } from '../../lib/session';
import { Dashboard } from '../../components/dashboard';

export default async function DashboardPage() {
  if (!await hasReaderSession()) redirect('/login?next=/dashboard');
  return <Dashboard />;
}
