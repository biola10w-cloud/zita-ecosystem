import { prisma } from '../../shared/db/prisma';

export interface CreateCommentInput {
  userId:   string;
  bookSlug: string;
  body:     string;
  parentId?: string;
}

export interface ListCommentsQuery {
  bookSlug: string;
  page:     number;
  limit:    number;
  sort:     'recent' | 'popular';
}

export class CommunityService {
  // â”€â”€â”€ List top-level comments (with first replies inline) â”€â”€â”€â”€â”€â”€â”€â”€

  static async listComments(query: ListCommentsQuery) {
    const { bookSlug, page, limit, sort } = query;
    const skip = (page - 1) * limit;

    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      select: { id: true },
    });

    const orderBy = sort === 'popular'
      ? [{ likes: { _count: 'desc' as const } }, { createdAt: 'desc' as const }]
      : [{ createdAt: 'desc' as const }];

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: {
          bookId:    book.id,
          parentId:  null,       // Top-level only
          isDeleted: false,
        },
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          // Include first 3 replies inline
          replies: {
            where: { isDeleted: false },
            take: 3,
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              _count: { select: { likes: true } },
            },
          },
          _count: {
            select: { likes: true, replies: true },
          },
        },
      }),
      prisma.comment.count({
        where: { bookId: book.id, parentId: null, isDeleted: false },
      }),
    ]);

    return {
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // â”€â”€â”€ Create comment or reply â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async createComment(input: CreateCommentInput) {
    const { userId, bookSlug, body, parentId } = input;

    const { ModerationService } = await import('../../shared/moderation/moderation.service');
    const moderation = await ModerationService.checkText(body);
    if (moderation.flagged) {
      const err: any = new Error('Your comment violates our community guidelines');
      err.statusCode = 400;
      err.code = 'CONTENT_FLAGGED';
      throw err;
    }

    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      select: { id: true },
    });

    // If a parentId is provided, validate it exists and belongs to this book
    let parentAuthorId: string | null = null;
    if (parentId) {
      const parent = await prisma.comment.findFirst({
        where: { id: parentId, bookId: book.id, isDeleted: false },
      });
      if (!parent) {
        const err: any = new Error('Parent comment not found');
        err.statusCode = 404;
        throw err;
      }
      // Prevent deep nesting — only one level of replies
      if (parent.parentId !== null) {
        const err: any = new Error('Cannot reply to a reply');
        err.statusCode = 400;
        err.code = 'NESTING_TOO_DEEP';
        throw err;
      }
      parentAuthorId = parent.userId;
    }

    const comment = await prisma.comment.create({
      data: {
        userId,
        bookId: book.id,
        body: body.trim(),
        parentId,
      },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    // Notify the parent comment's author (best-effort, never blocks the request)
    if (parentAuthorId && parentAuthorId !== userId) {
      const { PushService } = await import('../../shared/push/push.service');
      PushService.sendToUser(
        parentAuthorId,
        'New reply on your comment',
        `${comment.user.displayName}: ${comment.body.slice(0, 100)}`,
        { bookSlug, commentId: comment.id },
      ).catch(() => {});
    }

    return comment;
  }

  // â”€â”€â”€ Edit comment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async updateComment(
    commentId: string,
    userId: string,
    body: string,
  ) {
    const comment = await prisma.comment.findUniqueOrThrow({
      where: { id: commentId },
    });

    if (comment.userId !== userId) {
      const err: any = new Error('Cannot edit another user\'s comment');
      err.statusCode = 403;
      throw err;
    }

    if (comment.isDeleted) {
      const err: any = new Error('Cannot edit a deleted comment');
      err.statusCode = 400;
      throw err;
    }

    return prisma.comment.update({
      where: { id: commentId },
      data: { body: body.trim(), updatedAt: new Date() },
    });
  }

  // â”€â”€â”€ Soft-delete comment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async deleteComment(commentId: string, userId: string, userRole: string) {
    const comment = await prisma.comment.findUniqueOrThrow({
      where: { id: commentId },
    });

    // Owner or moderator/admin can delete
    const canDelete = comment.userId === userId ||
      ['ADMIN', 'MODERATOR'].includes(userRole);

    if (!canDelete) {
      const err: any = new Error('Cannot delete this comment');
      err.statusCode = 403;
      throw err;
    }

    // Soft delete â€” preserve thread structure, show "[deleted]" in UI
    await prisma.comment.update({
      where: { id: commentId },
      data: {
        isDeleted: true,
        body: '[This comment has been deleted]',
      },
    });
  }

  // â”€â”€â”€ Like / unlike comment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async likeComment(commentId: string, userId: string) {
    await prisma.commentLike.upsert({
      where: { userId_commentId: { userId, commentId } },
      create: { userId, commentId },
      update: {},
    });
  }

  static async unlikeComment(commentId: string, userId: string) {
    await prisma.commentLike.deleteMany({
      where: { userId, commentId },
    });
  }

  // â”€â”€â”€ Report comment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async reportComment(
    commentId: string,
    reporterId: string,
    reason: string,
    details?: string,
  ) {
    // Prevent duplicate reports from the same user
    const existing = await prisma.report.findFirst({
      where: { commentId, reporterId },
    });

    if (existing) {
      const err: any = new Error('You have already reported this comment');
      err.statusCode = 409;
      throw err;
    }

    return prisma.report.create({
      data: {
        commentId,
        reporterId,
        reason: reason as any,
        details,
      },
    });
  }

  // â”€â”€â”€ Get replies for a comment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getReplies(parentId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [replies, total] = await Promise.all([
      prisma.comment.findMany({
        where: { parentId, isDeleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
          _count: { select: { likes: true } },
        },
      }),
      prisma.comment.count({ where: { parentId, isDeleted: false } }),
    ]);

    return {
      replies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}
