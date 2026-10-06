import { prisma } from '../../shared/db/prisma';
import { S3Service } from '../../shared/storage/s3';
import { coverContentType } from '../../shared/storage/cover';
import { encryptionQueue, translationQueue } from '../../shared/queue/queues';
import { nanoid } from 'nanoid';
import { categoryFilter, categorySelection, flattenCategories } from '../books/book-categories';

export interface CreateBookInput {
  title:            string;
  authorName:       string;
  description:      string;
  contentType:      'BOOK' | 'STORY' | 'SUMMARY';
  language:         string;
  estimatedMinutes: number;
  isPremium:        boolean;
  price?:           number;
  tags:             string[];
  categoryId?:      string;
  categoryIds?:     string[];
}

export class AdminService {
  private static async validateCategories(categoryIds: string[]) {
    const count = await prisma.category.count({ where: { id: { in: categoryIds } } });
    if (count !== categoryIds.length) {
      throw Object.assign(new Error('One or more selected categories no longer exist.'), { statusCode: 400 });
    }
  }

  static async getBook(bookId: string) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { id: bookId },
      select: {
        id: true, slug: true, title: true, authorName: true, description: true,
        contentType: true, language: true, estimatedMinutes: true, isPremium: true,
        price: true, isPublished: true, coverUrl: true,
        category: { select: { id: true, name: true, slug: true } },
        categories: categorySelection,
        tags: { select: { tag: { select: { name: true } } } },
      },
    });
    return { ...book, categories: flattenCategories(book), tags: book.tags.map(({ tag }) => tag.name) };
  }

  static async updateBook(bookId: string, input: Omit<CreateBookInput, 'categoryId' | 'price'> & { categoryIds: string[]; price?: number | null }) {
    const categoryIds = [...new Set(input.categoryIds)];
    await AdminService.validateCategories(categoryIds);
    const tags = [...new Set(input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
    await prisma.book.update({
      where: { id: bookId },
      data: {
        title: input.title, authorName: input.authorName, description: input.description,
        contentType: input.contentType, language: input.language,
        estimatedMinutes: input.estimatedMinutes, isPremium: input.isPremium, price: input.price ?? null,
        categoryId: categoryIds[0] ?? null,
        categories: { deleteMany: {}, create: categoryIds.map((categoryId) => ({ categoryId })) },
        tags: { deleteMany: {}, create: tags.map((name) => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } })) },
      },
    });
    return AdminService.getBook(bookId);
  }

  static async deleteBook(bookId: string) {
    await prisma.$transaction(async (tx) => {
      const book = await tx.book.findUniqueOrThrow({ where: { id: bookId }, select: { id: true, slug: true } });
      await tx.deletedBook.create({ data: book });
      // Dependent chapters, categories, purchases, progress and comments cascade.
      // Analytics events remain, with their book reference cleared by the FK.
      await tx.book.delete({ where: { id: bookId } });
    });
  }

  // â”€â”€â”€ Create book + trigger encryption pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async createBook(
    input: CreateBookInput,
    rawFileBuffer: Buffer,
    coverBuffer: Buffer,
    coverMimeType: string,
  ) {
    return AdminService.persistBook(input, rawFileBuffer, coverBuffer, coverMimeType, null);
  }

  // â”€â”€â”€ Author self-publish â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Authors publish their own original work. contentType is always
   * BOOK (never SUMMARY -- summaries of other authors are admin-only)
   * and the book is linked to the author's account via authorId.
   */
  static async createAuthorBook(
    authorId: string,
    authorDisplayName: string,
    input: Omit<CreateBookInput, 'authorName' | 'contentType'>,
    rawFileBuffer: Buffer,
    coverBuffer: Buffer,
    coverMimeType: string,
  ) {
    return AdminService.persistBook(
      { ...input, authorName: authorDisplayName, contentType: 'BOOK' },
      rawFileBuffer,
      coverBuffer,
      coverMimeType,
      authorId,
    );
  }

  private static async persistBook(
    input: CreateBookInput,
    rawFileBuffer: Buffer,
    coverBuffer: Buffer,
    coverMimeType: string,
    authorId: string | null,
  ) {
    if (!coverContentType(coverBuffer) || coverContentType(coverBuffer) !== coverMimeType) {
      throw Object.assign(new Error('Cover must be a JPEG, PNG, or WebP image.'), { statusCode: 415 });
    }
    // Generate a stable slug from the title
    const baseSlug = input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const uniqueSuffix = nanoid(6).toLowerCase();
    const slug = `${baseSlug}-${uniqueSuffix}`;

    const categoryIds = [...new Set(input.categoryIds ?? (input.categoryId ? [input.categoryId] : []))];
    await AdminService.validateCategories(categoryIds);

    // 1. Upload normalized source text to a private temporary S3 location.
    //    The source DOCX has already been discarded by the route handler and
    //    this object is deleted by the encryption worker after processing.
    const rawS3Key = `temp/normalized/${slug}-${Date.now()}.txt`;
    await S3Service.uploadPrivateSource(rawS3Key, rawFileBuffer);

    // 2. Upload cover (public asset)
    const coverKey = `covers/${slug}`;
    const coverUrl = await S3Service.uploadPublicAsset(
      coverKey,
      coverBuffer,
      coverMimeType,
    );

    // 3. Upsert tags
    const tagRecords = await Promise.all(
      input.tags.map((name) =>
        prisma.tag.upsert({
          where: { name: name.toLowerCase() },
          create: { name: name.toLowerCase() },
          update: {},
        }),
      ),
    );

    // 5. Create book record (not yet published â€” awaiting encryption)
    const book = await prisma.book.create({
      data: {
        title:            input.title,
        slug,
        authorName:       input.authorName,
        authorId,
        description:      input.description,
        coverUrl,
        contentType:      input.contentType as any,
        language:         input.language,
        totalChapters:    0,              // Set by encryption worker
        estimatedMinutes: input.estimatedMinutes,
        isPremium:        input.isPremium,
        price:            input.price ?? null,
        categoryId:       categoryIds[0] ?? null,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        isPublished:      false,          // Published after encryption
        encryptedFileKey: 'pending',      // Set by encryption worker
        fileIv:           'pending',
        fileAuthTag:      'pending',
        tags: {
          create: tagRecords.map((tag) => ({ tagId: tag.id })),
        },
      },
    });

    // 6. Queue encryption job
    const encryptionJob = await encryptionQueue.add(
      {
        bookId:       book.id,
        rawS3Key,
        chapterCount: 0,  // Worker will auto-detect from content
      },
      { priority: 1 },
    );

    return {
      book,
      encryptionJobId: encryptionJob.id,
    };
  }

  // â”€â”€â”€ List all books (published + unpublished/pending encryption) â”€

  static async listBooks(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;

    const where = search
      ? { OR: [{ title: { contains: search, mode: 'insensitive' as const } }, { authorName: { contains: search, mode: 'insensitive' as const } }] }
      : {};

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          authorName: true,
          contentType: true,
          coverUrl: true,
          isPublished: true,
          isPremium: true,
          price: true,
          totalChapters: true,
          encryptedFileKey: true,
          createdAt: true,
          category: { select: { id: true, name: true } },
          categories: categorySelection,
        },
      }),
      prisma.book.count({ where }),
    ]);

    return {
      books: books.map((b) => ({
        ...b,
        categories: flattenCategories(b),
        encryptionStatus: b.encryptedFileKey === 'pending' ? 'PENDING' : 'READY',
        encryptedFileKey: undefined,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // â”€â”€â”€ Publish a book (after encryption is complete) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async publishBook(bookId: string) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { id: bookId },
    });

    // Ensure encryption is done
    if (book.encryptedFileKey === 'pending') {
      const err: any = new Error('Book encryption is still in progress');
      err.statusCode = 409;
      err.code = 'ENCRYPTION_PENDING';
      throw err;
    }

    return prisma.book.update({
      where: { id: bookId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  // â”€â”€â”€ Request translation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async requestTranslation(bookId: string, targetLanguage: string) {
    // Prevent duplicate translation requests
    const existing = await prisma.bookTranslation.findUnique({
      where: { bookId_language: { bookId, language: targetLanguage } },
    });

    if (existing && ['PENDING', 'PROCESSING', 'COMPLETED'].includes(existing.status)) {
      const err: any = new Error(
        `Translation to ${targetLanguage} already exists (status: ${existing.status})`,
      );
      err.statusCode = 409;
      throw err;
    }

    const translation = await prisma.bookTranslation.upsert({
      where: { bookId_language: { bookId, language: targetLanguage } },
      create: { bookId, language: targetLanguage, status: 'PENDING' },
      update: { status: 'PENDING' },
    });

    const job = await translationQueue.add({
      bookId,
      targetLanguage,
      translationId: translation.id,
    });

    return { translation, jobId: job.id };
  }

  // â”€â”€â”€ Category management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Nested tree (top-level categories + subcategories) for the admin upload form. */
  static async listCategories() {
    const categories = await prisma.category.findMany({
      where: { parentId: null }, orderBy: { name: 'asc' },
      include: { children: { orderBy: { name: 'asc' } } },
    });
    return Promise.all(categories.map(async (category) => ({
      ...category,
      _count: { books: await prisma.book.count({ where: categoryFilter(category.id, 'id', false) }) },
      children: await Promise.all(category.children.map(async (child) => ({
        ...child, _count: { books: await prisma.book.count({ where: categoryFilter(child.id, 'id', false) }) },
      }))),
    })));
  }

  static async createCategory(name: string, icon?: string, parentId?: string) {
    if (parentId) {
      await prisma.category.findUniqueOrThrow({ where: { id: parentId } });
    }

    const baseSlug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Prefix child slugs with the parent's slug to avoid collisions
    // between subcategories that share a name across different parents
    // (e.g. "Innovation" under both Business and Technology).
    let slug = baseSlug;
    if (parentId) {
      const parent = await prisma.category.findUniqueOrThrow({ where: { id: parentId } });
      slug = `${parent.slug}-${baseSlug}`;
    }

    return prisma.category.create({
      data: { name: name.trim(), slug, icon, parentId: parentId ?? null },
    });
  }

  // â”€â”€â”€ List users with filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async listUsers(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email:       { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          createdAt: true,
          subscription: {
            select: { status: true, currentPeriodEnd: true },
          },
          _count: {
            select: { comments: true, highlights: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // â”€â”€â”€ Update user role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async updateUserRole(userId: string, role: 'READER' | 'MODERATOR' | 'ADMIN') {
    return prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: { id: true, email: true, role: true },
    });
  }

  // â”€â”€â”€ List pending reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async listReports(status: string = 'PENDING', page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: { status: status as any },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          comment: {
            include: {
              user: {
                select: { id: true, displayName: true },
              },
              book: {
                select: { id: true, title: true, slug: true },
              },
            },
          },
        },
      }),
      prisma.report.count({ where: { status: status as any } }),
    ]);

    return {
      reports,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // â”€â”€â”€ Review a report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async reviewReport(
    reportId: string,
    action: 'ACTIONED' | 'DISMISSED',
    reviewerId: string,
  ) {
    const report = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      include: { comment: true },
    });

    await prisma.$transaction(async (tx) => {
      // Update report status
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: action as any,
          reviewedAt: new Date(),
        },
      });

      // If actioned, delete the offending comment
      if (action === 'ACTIONED') {
        await tx.comment.update({
          where: { id: report.commentId },
          data: {
            isDeleted: true,
            body: '[Removed by moderator]',
          },
        });
      }
    });
  }
}
