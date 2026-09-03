import { describe, expect, it } from 'vitest';
import { chapterTextFromDocxHtml, normalizeBookContent } from './docx';

describe('DOCX content normalization', () => {
  it('turns Word heading structure into encryption-worker chapters', () => {
    const result = chapterTextFromDocxHtml(
      '<h1>Introduction</h1><p>First paragraph.</p><h2>Next steps</h2><p>Second paragraph.</p>',
      'sample.docx',
    );

    expect(result).toContain('=== CHAPTER 1 ===\n\n# Introduction');
    expect(result).toContain('First paragraph.');
    expect(result).toContain('=== CHAPTER 2 ===\n\n# Next steps');
  });

  it('keeps supported plain-text uploads as text', async () => {
    await expect(normalizeBookContent('book.md', 'text/markdown', Buffer.from('# Title\n\nBody')))
      .resolves.toEqual(Buffer.from('# Title\n\nBody'));
  });

  it('rejects unsupported source formats', async () => {
    await expect(normalizeBookContent('book.pdf', 'application/pdf', Buffer.from('x')))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT_TYPE', statusCode: 415 });
  });
});
