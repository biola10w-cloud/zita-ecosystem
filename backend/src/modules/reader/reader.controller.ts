import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ReaderService } from './reader.service';

const progressSchema = z.object({
  chapterIndex:   z.number().int().min(0),
  scrollPosition: z.number().min(0).max(1),
});

const highlightSchema = z.object({
  chapterIndex: z.number().int().min(0),
  startOffset:  z.number().int().min(0),
  endOffset:    z.number().int().min(0),
  text:         z.string().min(1).max(2000),
  color:        z.string().default('#FFD700'),
  note:         z.string().max(500).optional(),
});

export const ReaderController = {
  async getChapterContent(request: FastifyRequest, reply: FastifyReply) {
    const { slug, index } = request.params as { slug: string; index: string };
    const { language } = request.query as { language?: string };
    const userId = request.user!.sub;

    const content = await ReaderService.getChapterContent(
      userId,
      slug,
      parseInt(index),
      language,
    );

    // Content is streamed for in-app reading only — never cached or saved
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    reply.header('Content-Disposition', 'inline');
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.send({ success: true, data: { content } });
  },

  async getChapterAudio(request: FastifyRequest, reply: FastifyReply) {
    const { slug, index } = request.params as { slug: string; index: string };
    const { language } = request.query as { language?: string };
    const userId = request.user!.sub;

    const result = await ReaderService.getChapterAudio(
      userId,
      slug,
      parseInt(index),
      language,
    );

    if (result.status === 'READY') {
      // Audio is streamed for in-app playback only — never cached or saved
      reply.header('Content-Type', 'audio/mpeg');
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      reply.header('Content-Disposition', 'inline');
      reply.header('X-Content-Type-Options', 'nosniff');
      return reply.send(result.audio);
    }

    // Not generated yet — client should poll (e.g. every few seconds)
    return reply.status(202).send({ success: true, data: { status: result.status } });
  },

  async saveProgress(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const body = progressSchema.parse(request.body);
    const userId = request.user!.sub;

    await ReaderService.saveProgress(
      userId,
      slug,
      body.chapterIndex,
      body.scrollPosition,
    );

    return reply.send({ success: true, data: null });
  },

  async getProgress(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const progress = await ReaderService.getProgress(request.user!.sub, slug);
    return reply.send({ success: true, data: progress });
  },

  async saveHighlight(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const body = highlightSchema.parse(request.body);
    const userId = request.user!.sub;

    const highlight = await ReaderService.saveHighlight(
      userId, slug,
      body.chapterIndex, body.startOffset, body.endOffset,
      body.text, body.color, body.note,
    );

    return reply.status(201).send({ success: true, data: highlight });
  },

  async getHighlights(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const highlights = await ReaderService.getHighlights(request.user!.sub, slug);
    return reply.send({ success: true, data: highlights });
  },
};
