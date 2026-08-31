import { prisma } from '../../shared/db/prisma';
import { AdminService, CreateBookInput } from '../admin/admin.service';

export class AuthorsService {
  // ─── Publish an original book under the author's own account ──

  static async createBook(
    authorId: string,
    authorDisplayName: string,
    input: Omit<CreateBookInput, 'authorName' | 'contentType'>,
    rawFileBuffer: Buffer,
    coverBuffer: Buffer,
    coverMimeType: string,
  ) {
    return AdminService.createAuthorBook(
      authorId,
      authorDisplayName,
      input,
      rawFileBuffer,
      coverBuffer,
      coverMimeType,
    );
  }

  // ─── List the author's own books (drafts + published) ─────────

  static async listMyBooks(authorId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where: { authorId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          coverUrl: true,
          contentType: true,
          isPublished: true,
          isPremium: true,
          price: true,
          totalChapters: true,
          createdAt: true,
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      prisma.book.count({ where: { authorId } }),
    ]);

    return {
      books,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}
