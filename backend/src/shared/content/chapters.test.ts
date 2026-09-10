import { expect, it } from 'vitest';
import { parseChapters } from './chapters';

it('preserves the first line of plain text', () => {
  expect(parseChapters('First line.\nSecond line.', 0)).toEqual([
    { title: 'Chapter 1', content: 'First line.\nSecond line.' },
  ]);
});
it('uses a heading as the title and retains the body', () => {
  expect(parseChapters('=== CHAPTER 1 ===\n# Start\nFirst line.\n=== CHAPTER 2 ===\nSecond chapter.', 0)).toEqual([
    { title: 'Start', content: 'First line.' },
    { title: 'Chapter 2', content: 'Second chapter.' },
  ]);
});
it('ignores whitespace before a chapter marker', () => {
  expect(parseChapters('\n\n=== CHAPTER 1 ===\n# Start\nBody', 0)).toEqual([
    { title: 'Start', content: 'Body' },
  ]);
});
