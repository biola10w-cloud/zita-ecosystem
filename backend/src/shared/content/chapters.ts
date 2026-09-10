export function parseChapters(
  rawText: string,
  expectedCount: number,
): Array<{ title: string; content: string }> {
  // Split on chapter markers
  const chapterPattern = /^=== CHAPTER \d+ ===/gm;
  const parts = rawText.split(chapterPattern).filter((part) => part.trim().length > 0);

  if (parts.length === 0) {
    // Fallback: split roughly equal parts if no markers
    const wordsPerChapter = Math.ceil(
      rawText.split(' ').length / Math.max(expectedCount, 1),
    );
    const words = rawText.split(' ');
    const chapters = [];

    for (let i = 0; i < words.length; i += wordsPerChapter) {
      chapters.push({
        title: `Chapter ${Math.floor(i / wordsPerChapter) + 1}`,
        content: words.slice(i, i + wordsPerChapter).join(' '),
      });
    }
    return chapters;
  }

  return parts.map((part, i) => {
    const lines = part.trim().split('\n');
    const title = lines[0]?.startsWith('#')
      ? lines[0].replace(/^#+\s*/, '')
      : `Chapter ${i + 1}`;
    const content = (lines[0]?.startsWith('#') ? lines.slice(1) : lines).join('\n').trim();
    return { title, content };
  });
}
