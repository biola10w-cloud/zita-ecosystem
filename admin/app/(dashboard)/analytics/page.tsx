import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { getSessionToken } from '../../../lib/auth';

interface Stats {
  overview: { totalUsers: number; activeSubscriptions: number; trialSubscriptions: number; newUsersThisPeriod: number; activeReaders: number; chapterOpens: number; booksInProgress: number; completedBooks: number; averageProgress: number };
  topBooks: { id: string; title: string; authorName: string; readers: number; opens: number }[];
  dailyActiveUsers: { date: string; readers: number; opens: number }[];
}

export default async function AnalyticsPage({ searchParams }: { searchParams: { days?: string } }) {
  const days = [7, 30, 90].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  let stats: Stats | null = null;
  try {
    const response = await apiFetch<Stats>(`/analytics/dashboard?days=${days}`, getSessionToken());
    if (response.success) stats = response.data;
  } catch { /* Show an explicit unavailable state rather than zero counts. */ }
  const overview = stats?.overview;
  const cards = overview ? [
    ['Registered users', overview.totalUsers, 'All time'],
    ['Paid subscribers', overview.activeSubscriptions, 'Active, unexpired subscriptions now'],
    ['Trial subscribers', overview.trialSubscriptions, 'Unexpired trials now'],
    ['New users', overview.newUsersThisPeriod, `Last ${days} days`],
    ['Active readers', overview.activeReaders, 'Unique readers in this period'],
    ['Chapter opens', overview.chapterOpens, 'Includes repeat opens'],
    ['Books in progress', overview.booksInProgress, 'Reader–book pairs active in this period'],
    ['Completed books', overview.completedBooks, 'Completed reader–book pairs active in this period'],
    ['Average progress', `${overview.averageProgress}%`, 'Across reader–book pairs active in this period'],
  ] : [];
  const peak = Math.max(1, ...stats?.dailyActiveUsers.map((day) => day.readers) ?? []);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-primary">Reading analytics</h1><p className="text-sm text-gray-500">Understand your readers, books, and subscriptions.</p></div>
      <nav aria-label="Analytics period" className="flex gap-2">{[7, 30, 90].map((period) => <Link key={period} href={`/analytics?days=${period}`} aria-current={days === period ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${days === period ? 'bg-primary text-white' : 'bg-white text-gray-600 border'}`}>{period} days</Link>)}</nav>
    </div>
    {!stats ? <div role="alert" className="rounded-xl bg-red-50 p-6 text-red-700">Analytics are unavailable right now. <Link className="underline" href={`/analytics?days=${days}`}>Try again</Link></div> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, note]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="text-sm text-gray-500">{label}</h2><p className="my-2 text-3xl font-bold text-primary">{typeof value === 'number' ? value.toLocaleString('en-US') : value}</p><p className="text-xs text-gray-500">{note}</p></div>)}</div>
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold text-primary">Most read books</h2><p className="mb-4 text-sm text-gray-500">Ranked by unique readers in the selected period. Each person counts once per book.</p>
        {stats.topBooks.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-gray-500"><tr><th className="p-3">Rank</th><th className="p-3">Book</th><th className="p-3 text-right">Readers</th><th className="p-3 text-right">Chapter opens</th></tr></thead><tbody>{stats.topBooks.map((book, index) => <tr key={book.id} className="border-b last:border-0"><td className="p-3">{index + 1}</td><td className="p-3"><div className="font-semibold">{book.title}</div><div className="text-gray-500">{book.authorName}</div></td><td className="p-3 text-right">{book.readers}</td><td className="p-3 text-right">{book.opens}</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-gray-500">No reading activity recorded in this period yet.</p>}
      </section>
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold text-primary">Daily readers</h2><p className="mb-4 text-sm text-gray-500">Unique readers each day, in UTC. Today is still in progress.</p>
        <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead><tr className="text-gray-500"><th className="p-2">Date (UTC)</th><th className="p-2">Readers</th><th className="p-2 text-right">Chapter opens</th></tr></thead><tbody>{stats.dailyActiveUsers.map((day) => <tr key={day.date}><td className="p-2 whitespace-nowrap">{day.date}</td><td className="p-2 w-1/2"><div className="flex items-center gap-3"><span className="w-8">{day.readers}</span><span className="h-2 flex-1 rounded bg-gray-100"><span className="block h-2 rounded bg-primary" style={{ width: `${day.readers / peak * 100}%` }} /></span></div></td><td className="p-2 text-right">{day.opens}</td></tr>)}</tbody></table></div>
      </section>
      <p className="text-xs text-gray-500">Reading activity comes from recorded chapter opens and progress saves. Completion means reaching at least 99%. Progress figures describe the latest saved position; they do not measure time spent reading.</p>
    </>}
  </div>;
}
