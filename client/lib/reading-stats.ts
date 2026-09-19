export interface ReadingBook {
  id: string; chapterIndex: number; percentComplete: number;
  book: { id: string; slug: string; title: string; authorName: string; coverUrl: string | null; totalChapters: number };
}
export interface ReadingStats {
  streakDays: number; completedBooks: number; totalSessions: number; highlightCount: number;
  inProgressBooks: ReadingBook[];
  highlights: { id: string; text: string; chapterIndex: number; book: { title: string; slug: string } }[];
}
