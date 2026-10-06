import { redirect } from 'next/navigation';
import { hasReaderSession } from '../../lib/session';
import { Dashboard } from '../../components/dashboard';
export default async function Page() {
  if (!await hasReaderSession()) redirect('/login?next=/library');
  return <Dashboard libraryOnly />;
}
