import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import type { ReadingBook } from '../lib/reading-stats';

export function ReadingShelf({ books, horizontal = false }: { books: ReadingBook[]; horizontal?: boolean }) {
  return <div className={horizontal ? 'continue-scroll' : 'progress-list'}>{books.map((item) => {
    const percent = Math.round(Math.min(100, Math.max(0, item.percentComplete)));
    return <Link key={item.id} href={`/books/${encodeURIComponent(item.book.slug)}/read`} className="progress-book">
      <div className="progress-cover">{item.book.coverUrl ? <img src={`/api/covers/${encodeURIComponent(item.book.slug)}`} alt="" /> : <BookOpen size={24} />}</div>
      <div className="progress-info"><h3>{item.book.title}</h3><p>{percent}% complete · Chapter {item.chapterIndex + 1}</p><div className="reading-track" role="progressbar" aria-label={`${item.book.title} reading progress`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div></div>
      {!horizontal && <span className="read-pill">Read</span>}
    </Link>;
  })}</div>;
}
