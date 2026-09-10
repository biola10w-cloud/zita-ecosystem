import { FastifyInstance } from 'fastify';
import { S3Service } from '../../shared/storage/s3';
import { coverContentType } from '../../shared/storage/cover';

export async function assetsRoutes(app: FastifyInstance) {
  // Only raster covers are public. Never accept arbitrary bucket keys here.
  app.get<{ Params: { name: string } }>('/covers/:name', async (request, reply) => {
    const { name } = request.params;
    if (!/^[a-z0-9_-]{1,220}$/.test(name)) return reply.code(404).send();
    try {
      const bytes = await S3Service.downloadEncryptedContent(`public/covers/${name}`);
      const contentType = coverContentType(bytes);
      if (!contentType) return reply.code(404).send();
      return reply.type(contentType)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'public, max-age=3600')
        .send(bytes);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return reply.code(404).send();
      throw error;
    }
  });
}
