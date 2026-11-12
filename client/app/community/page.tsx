import { Discussion } from '../../components/community';
import { hasReaderSession } from '../../lib/session';
export default async function CommunityPage() {
  return <Discussion signedIn={await hasReaderSession()} />;
}
