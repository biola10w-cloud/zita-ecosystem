import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../shared/db/prisma';
import { CommunityService } from './community.service';

describe('CommunityService', () => {
  let userId: string;
  let userId2: string;
  let bookSlug: string;

  beforeEach(async () => {
    const user1 = await prisma.user.create({
      data: {
        email: `community-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: 'hash',
        displayName: 'Test User 1',
        role: 'READER',
      },
    });
    userId = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `community2-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: 'hash',
        displayName: 'Test User 2',
        role: 'READER',
      },
    });
    userId2 = user2.id;

    const book = await prisma.book.create({
      data: {
        title: 'Community Test Book',
        slug: `community-${Date.now()}-${Math.random()}`,
        authorName: 'Test Author',
        description: 'Testing community features',
        language: 'en',
        isPremium: false,
        isPublished: true,
        totalChapters: 3,
      },
    });
    bookSlug = book.slug;
  });

  afterAll(async () => {
    await prisma.report.deleteMany();
    await prisma.commentLike.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.book.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Comments CRUD', () => {
    it('should create a top-level comment', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'This is a great book!',
      });

      expect(comment).toBeDefined();
      expect(comment.userId).toBe(userId);
      expect(comment.body).toBe('This is a great book!');
      expect(comment.parentId).toBeNull();
      expect(comment.isDeleted).toBe(false);
    });

    it('should create a reply to a comment', async () => {
      const topLevel = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Original comment',
      });

      const reply = await CommunityService.createComment({
        userId: userId2,
        bookSlug,
        body: 'I agree!',
        parentId: topLevel.id,
      });

      expect(reply.parentId).toBe(topLevel.id);
      expect(reply.body).toBe('I agree!');
    });

    it('should prevent deep nesting (only 1 level of replies)', async () => {
      const topLevel = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Original',
      });

      const reply = await CommunityService.createComment({
        userId: userId2,
        bookSlug,
        body: 'Reply',
        parentId: topLevel.id,
      });

      await expect(
        CommunityService.createComment({
          userId,
          bookSlug,
          body: 'Reply to reply',
          parentId: reply.id,
        })
      ).rejects.toMatchObject({ code: 'NESTING_TOO_DEEP' });
    });

    it('should reject reply to non-existent parent', async () => {
      await expect(
        CommunityService.createComment({
          userId,
          bookSlug,
          body: 'Reply to nothing',
          parentId: 'non-existent-id',
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should update comment by author', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Original text',
      });

      const updated = await CommunityService.updateComment(comment.id, userId, 'Updated text');

      expect(updated.body).toBe('Updated text');
      expect(updated.id).toBe(comment.id);
    });

    it('should prevent non-author from updating', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Original',
      });

      await expect(
        CommunityService.updateComment(comment.id, userId2, 'Hacked!')
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should soft-delete comment', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'This will be deleted',
      });

      await CommunityService.deleteComment(comment.id, userId, 'READER');

      const deleted = await prisma.comment.findUnique({ where: { id: comment.id } });
      expect(deleted?.isDeleted).toBe(true);
      expect(deleted?.body).toBe('[This comment has been deleted]');
    });

    it('should allow moderator/admin to delete any comment', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Inappropriate comment',
      });

      await CommunityService.deleteComment(comment.id, userId2, 'MODERATOR');

      const deleted = await prisma.comment.findUnique({ where: { id: comment.id } });
      expect(deleted?.isDeleted).toBe(true);
    });

    it('should prevent non-owner non-moderator from deleting', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Comment',
      });

      await expect(
        CommunityService.deleteComment(comment.id, userId2, 'READER')
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('Comment Likes', () => {
    it('should like a comment', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Likeable comment',
      });

      await CommunityService.likeComment(comment.id, userId2);

      const likes = await prisma.commentLike.findMany({ where: { commentId: comment.id } });
      expect(likes).toHaveLength(1);
      expect(likes[0].userId).toBe(userId2);
    });

    it('should unlike a comment', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Comment to unlike',
      });

      await CommunityService.likeComment(comment.id, userId2);
      await CommunityService.unlikeComment(comment.id, userId2);

      const likes = await prisma.commentLike.findMany({ where: { commentId: comment.id } });
      expect(likes).toHaveLength(0);
    });

    it('should be idempotent - liking twice should be safe', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Comment',
      });

      await CommunityService.likeComment(comment.id, userId2);
      await CommunityService.likeComment(comment.id, userId2);

      const likes = await prisma.commentLike.findMany({ where: { commentId: comment.id } });
      expect(likes).toHaveLength(1);
    });

    it('should track like counts', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Popular comment',
      });

      await CommunityService.likeComment(comment.id, userId2);
      await CommunityService.likeComment(comment.id, userId);

      const likes = await prisma.commentLike.findMany({ where: { commentId: comment.id } });
      expect(likes).toHaveLength(2);
    });
  });

  describe('Comment Listing', () => {
    it('should list comments with pagination', async () => {
      for (let i = 0; i < 10; i++) {
        await CommunityService.createComment({
          userId,
          bookSlug,
          body: `Comment ${i + 1}`,
        });
      }

      const result = await CommunityService.listComments({
        bookSlug,
        page: 1,
        limit: 5,
        sort: 'recent',
      });

      expect(result.comments).toHaveLength(5);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.pages).toBe(2);
    });

    it('should sort comments by recent', async () => {
      const comment1 = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'First comment',
      });

      await new Promise((r) => setTimeout(r, 50));

      const comment2 = await CommunityService.createComment({
        userId: userId2,
        bookSlug,
        body: 'Second comment',
      });

      const result = await CommunityService.listComments({
        bookSlug,
        page: 1,
        limit: 10,
        sort: 'recent',
      });

      expect(result.comments[0].id).toBe(comment2.id);
      expect(result.comments[1].id).toBe(comment1.id);
    });

    it('should sort comments by popular (most likes)', async () => {
      const popular = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Popular comment',
      });

      await CommunityService.createComment({
        userId: userId2,
        bookSlug,
        body: 'Unpopular comment',
      });

      await CommunityService.likeComment(popular.id, userId2);
      await CommunityService.likeComment(popular.id, userId);

      const result = await CommunityService.listComments({
        bookSlug,
        page: 1,
        limit: 10,
        sort: 'popular',
      });

      expect(result.comments[0].id).toBe(popular.id);
    });

    it('should exclude deleted comments from listing', async () => {
      const comment1 = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Visible comment',
      });

      const comment2 = await CommunityService.createComment({
        userId: userId2,
        bookSlug,
        body: 'Deleted comment',
      });

      await CommunityService.deleteComment(comment2.id, userId2, 'READER');

      const result = await CommunityService.listComments({
        bookSlug,
        page: 1,
        limit: 10,
        sort: 'recent',
      });

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].id).toBe(comment1.id);
    });

    it('should include user information in comments', async () => {
      await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Comment with user info',
      });

      const result = await CommunityService.listComments({
        bookSlug,
        page: 1,
        limit: 10,
        sort: 'recent',
      });

      expect(result.comments[0].user).toBeDefined();
      expect(result.comments[0].user.displayName).toBe('Test User 1');
    });

    it('should include first 3 replies inline', async () => {
      const topLevel = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Top level',
      });

      for (let i = 0; i < 5; i++) {
        await CommunityService.createComment({
          userId: userId2,
          bookSlug,
          body: `Reply ${i + 1}`,
          parentId: topLevel.id,
        });
      }

      const result = await CommunityService.listComments({
        bookSlug,
        page: 1,
        limit: 10,
        sort: 'recent',
      });

      expect(result.comments[0].replies).toHaveLength(3);
    });
  });

  describe('Comment Reporting', () => {
    it('should report a comment', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Inappropriate content',
      });

      const report = await CommunityService.reportComment(
        comment.id,
        userId2,
        'INAPPROPRIATE',
        'This violates community guidelines'
      );

      expect(report).toBeDefined();
      expect(report.commentId).toBe(comment.id);
      expect(report.reporterId).toBe(userId2);
      expect(report.reason).toBe('INAPPROPRIATE');
      expect(report.status).toBe('PENDING');
    });

    it('should prevent duplicate reports from same user', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Bad comment',
      });

      await CommunityService.reportComment(comment.id, userId2, 'INAPPROPRIATE');

      await expect(
        CommunityService.reportComment(comment.id, userId2, 'HARASSMENT')
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should allow different users to report same comment', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Bad comment',
      });

      const admin = await prisma.user.create({
        data: {
          email: `admin-${Date.now()}-${Math.random()}@example.com`,
          passwordHash: 'hash',
          displayName: 'Admin User',
          role: 'ADMIN',
        },
      });

      await CommunityService.reportComment(comment.id, userId2, 'SPAM');
      await CommunityService.reportComment(comment.id, admin.id, 'HARASSMENT');

      const reports = await prisma.report.findMany({ where: { commentId: comment.id } });
      expect(reports).toHaveLength(2);
    });

    it('should accept report with details', async () => {
      const comment = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Spoiler alert!',
      });

      const report = await CommunityService.reportComment(
        comment.id,
        userId2,
        'SPOILER',
        'Contains major plot spoilers from chapter 5'
      );

      expect(report.details).toBe('Contains major plot spoilers from chapter 5');
    });
  });

  describe('Comment Replies', () => {
    it('should get paginated replies to a comment', async () => {
      const topLevel = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Original comment',
      });

      for (let i = 0; i < 5; i++) {
        await CommunityService.createComment({
          userId: userId2,
          bookSlug,
          body: `Reply ${i + 1}`,
          parentId: topLevel.id,
        });
      }

      const result = await CommunityService.getReplies(topLevel.id, 1, 3);

      expect(result.replies).toHaveLength(3);
      expect(result.pagination.total).toBe(5);
    });

    it('should order replies by creation time', async () => {
      const topLevel = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Original',
      });

      const reply1 = await CommunityService.createComment({
        userId: userId2,
        bookSlug,
        body: 'First reply',
        parentId: topLevel.id,
      });

      await new Promise((r) => setTimeout(r, 50));

      const reply2 = await CommunityService.createComment({
        userId: userId2,
        bookSlug,
        body: 'Second reply',
        parentId: topLevel.id,
      });

      const result = await CommunityService.getReplies(topLevel.id, 1, 10);

      expect(result.replies[0].id).toBe(reply1.id);
      expect(result.replies[1].id).toBe(reply2.id);
    });

    it('should return empty when no replies exist', async () => {
      const topLevel = await CommunityService.createComment({
        userId,
        bookSlug,
        body: 'Lonely comment',
      });

      const result = await CommunityService.getReplies(topLevel.id, 1, 10);

      expect(result.replies).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });
});
