import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { prisma } from '../../shared/db/prisma';

const registerSchema = z.object({
  email:             z.string().email(),
  password:          z.string().min(8).max(128),
  displayName:       z.string().min(2).max(50).trim(),
  deviceFingerprint: z.string().min(32).max(128),
  platform:          z.enum(['IOS', 'ANDROID', 'WEB']).default('WEB'),
});

const loginSchema = z.object({
  email:             z.string().email(),
  password:          z.string().min(1),
  deviceFingerprint: z.string().min(32).max(128),
  platform:          z.enum(['IOS', 'ANDROID', 'WEB']).default('WEB'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email:        z.string().email(),
  resetUrlBase: z.string().url(),
});

const resetPasswordSchema = z.object({
  token:       z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const AuthController = {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = registerSchema.parse(request.body);

    const result = await AuthService.register(
      body.email,
      body.password,
      body.displayName,
      body.deviceFingerprint,
      body.platform,
    );

    return reply.status(201).send({
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      },
    });
  },

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = loginSchema.parse(request.body);

    const result = await AuthService.login(
      body.email,
      body.password,
      body.deviceFingerprint,
      body.platform,
    );

    return reply.send({
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      },
    });
  },

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = refreshSchema.parse(request.body);
    const tokens = await AuthService.refresh(refreshToken);

    return reply.send({
      success: true,
      data: tokens,
    });
  },

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    await AuthService.logout(user.sub, user.deviceId);

    return reply.send({ success: true, data: null });
  },

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const { email, resetUrlBase } = forgotPasswordSchema.parse(request.body);
    await AuthService.requestPasswordReset(email, resetUrlBase);

    // Always returns success — never reveals whether the email exists
    return reply.send({ success: true, data: null });
  },

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const { token, newPassword } = resetPasswordSchema.parse(request.body);
    await AuthService.resetPassword(token, newPassword);

    return reply.send({ success: true, data: null });
  },

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user!.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        preferredLanguage: true,
        createdAt: true,
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            trialEnd: true,
          },
        },
      },
    });

    return reply.send({ success: true, data: user });
  },
};
