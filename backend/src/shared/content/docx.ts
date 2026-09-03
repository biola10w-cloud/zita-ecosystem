import mammoth = require('mammoth');
import { parse } from 'node-html-parser';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_NORMALIZED_CONTENT_BYTES = 20 * 1024 * 1024;

export function isSupportedBookFile(filename: string, mimeType: string): boolean {
  const extension = filename.toLowerCase().split('.').pop();
  return extension === 'txt' || extension === 'md' || extension === 'docx' || mimeType === DOCX_MIME_TYPE;
}

/**
 * Converts a private source document into the plain chapter format consumed by
 * the encryption worker. The original DOCX buffer is intentionally discarded.
 */
export async function normalizeBookContent(
  filename: string,
  mimeType: string,
  source: Buffer,
): Promise<Buffer> {
  if (!isSupportedBookFile(filename, mimeType)) {
    const error: any = new Error('Content must be a .txt, .md, or .docx file');
    error.statusCode = 415;
    error.code = 'UNSUPPORTED_CONTENT_TYPE';
    throw error;
  }

  const extension = filename.toLowerCase().split('.').pop();
  const text = extension === 'docx' || mimeType === DOCX_MIME_TYPE
    ? chapterTextFromDocxHtml((await mammoth.convertToHtml({ buffer: source })).value, filename)
    : source.toString('utf8').trim();

  if (!text) {
    const error: any = new Error('The uploaded document does not contain readable text');
    error.statusCode = 422;
    error.code = 'EMPTY_BOOK_CONTENT';
    throw error;
  }

  const content = Buffer.from(text, 'utf8');
  if (content.byteLength > MAX_NORMALIZED_CONTENT_BYTES) {
    const error: any = new Error('The extracted book text exceeds the 20 MB processing limit');
    error.statusCode = 413;
    error.code = 'BOOK_CONTENT_TOO_LARGE';
    throw error;
  }

  return content;
}

export function chapterTextFromDocxHtml(html: string, filename: string): string {
  const root = parse(html);
  const nodes = root.querySelectorAll('h1, h2, h3, p, li');
  const fallbackTitle = filename.replace(/\.docx$/i, '').replace(/[-_]+/g, ' ').trim() || 'Untitled';
  const lines: string[] = [];
  let chapterCount = 0;

  for (const node of nodes) {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    if (/^h[1-3]$/i.test(node.tagName)) {
      chapterCount += 1;
      lines.push(`=== CHAPTER ${chapterCount} ===`, `# ${text}`);
      continue;
    }

    if (chapterCount === 0) {
      chapterCount = 1;
      lines.push(`=== CHAPTER ${chapterCount} ===`, `# ${fallbackTitle}`);
    }

    lines.push(node.tagName.toLowerCase() === 'li' ? `- ${text}` : text);
  }

  return lines.join('\n\n').trim();
}
