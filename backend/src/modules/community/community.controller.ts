import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CommunityService } from './community.service';

const listQuerySchema = z.object({
  page:  z.string().default('1').transform(Number),
  limit: z.string().default('20').transform(Number),
  sort:  z.enum(['recent', 'popular']).default('recent'),
});

const createCommentSchema = z.object({
  body:     z.string().min(1).max(2000).trim(),
  parentId: z.string().cuid().optional(),
});

const updateCommentSchema = z.object({
  body: z.string().min(1).max(2000).trim(),
});

const reportSchema = z.object({
  reason:  z.enum(['SPAM', 'HARASSMENT', 'SPOILER', 'INAPPROPRIATE', 'OTHER']),
  details: z.string().max(500).optional(),
});

export const CommunityController = {
  async listComments(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const query = listQuerySchema.parse(request.query);

    const result = await CommunityService.listComments({
      bookSlug: slug,
      ...query,
    });

    return reply.send({
      success: true,
      data: result.comments,
      meta: result.pagination,
    });
  },

  async createComment(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const body = createCommentSchema.parse(request.body);
    const userId = request.user!.sub;

    const comment = await CommunityService.createComment({
      userId,
      bookSlug: slug,
      body: body.body,
      parentId: body.parentId,
    });

    return reply.status(201).send({ success: true, data: comment });
  },

  async updateComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { body } = updateCommentSchema.parse(request.body);
    const updated = await CommunityService.updateComment(id, request.user!.sub, body);
    return reply.send({ success: true, data: updated });
  },

  async deleteComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await CommunityService.deleteComment(id, request.user!.sub, request.user!.role);
    return reply.send({ success: true, data: null });
  },

  async likeComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await CommunityService.likeComment(id, request.user!.sub);
    return reply.send({ success: true, data: null });
  },

  async unlikeComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await CommunityService.unlikeComment(id, request.user!.sub);
    return reply.send({ success: true, data: null });
  },

  async reportComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = reportSchema.parse(request.body);
    await CommunityService.reportComment(id, request.user!.sub, body.reason, body.details);
    return reply.status(201).send({ success: true, data: null });
  },

  async getReplies(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const query = listQuerySchema.parse(request.query);
    const result = await CommunityService.getReplies(id, query.page, query.limit);
    return reply.send({ success: true, data: result.replies, meta: result.pagination });
  },
};
