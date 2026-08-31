import crypto from 'crypto';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { prisma } from '../../shared/db/prisma';
import { config } from '../../config';
import { JwtPayload } from '../../shared/middleware/authenticate';

// Load RSA keys once at startup
const privateKey = fs.readFileSync(config.JWT_PRIVATE_KEY_PATH, 'utf8');
const publicKey  = fs.readFileSync(config.JWT_PUBLIC_KEY_PATH, 'utf8');

const BCRYPT_ROUNDS = 12; // High cost â€” tokens are long-lived

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    preferredLanguage: string;
  };
  tokens: AuthTokens;
}

export class AuthService {
  // â”€â”€â”€ Registration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async register(
    email: string,
    password: string,
    displayName: string,
    deviceFingerprint: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
  ): Promise<LoginResult> {
    // Normalise email
    const normalisedEmail = email.toLowerCase().trim();

    // Hash password â€” bcrypt with 12 rounds
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user + device in a transaction
    const { user, device } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalisedEmail,
          passwordHash,
          displayName: displayName.trim(),
          role: 'READER',
        },
      });

      const device = await tx.device.create({
        data: {
          userId: user.id,
          fingerprint: deviceFingerprint,
          platform,
        },
      });

      return { user, device };
    });

    const tokens = await AuthService.issueTokens(user, device.id);

    const { EmailService } = await import('../../shared/email/email.service');
    await EmailService.sendWelcomeEmail(user.email, user.displayName);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
      },
      tokens,
    };
  }

  // â”€â”€â”€ Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async login(
    email: string,
    password: string,
    deviceFingerprint: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
  ): Promise<LoginResult> {
    const normalisedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalisedEmail },
    });

    // Constant-time comparison to prevent user enumeration
    const passwordMatch = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000');

    if (!user || !passwordMatch) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Upsert device â€” same fingerprint = update lastSeen
    const device = await prisma.device.upsert({
      where: {
        userId_fingerprint: {
          userId: user.id,
          fingerprint: deviceFingerprint,
        },
      },
      update: {
        lastSeenAt: new Date(),
        platform,
      },
      create: {
        userId: user.id,
        fingerprint: deviceFingerprint,
        platform,
      },
    });

    const tokens = await AuthService.issueTokens(user, device.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
      },
      tokens,
    };
  }

  // â”€â”€â”€ Token refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async refresh(refreshToken: string): Promise<AuthTokens> {
    // Find session by refresh token hash
    // We store the bcrypt hash, not the raw token
    const sessions = await prisma.session.findMany({
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      include: { user: true },
      take: 1000, // Limit scan â€” in production use a Redis lookup
    });

    let matchedSession = null;
    for (const session of sessions) {
      const match = await bcrypt.compare(refreshToken, session.refreshToken);
      if (match) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      const err: any = new Error('Invalid or expired refresh token');
      err.statusCode = 401;
      err.code = 'INVALID_REFRESH_TOKEN';
      throw err;
    }

    // Rotate: revoke old session, issue new tokens
    // This is the key security property â€” refresh tokens are single-use
    const newTokens = await prisma.$transaction(async (tx) => {
      // Revoke old session
      await tx.session.update({
        where: { id: matchedSession!.id },
        data: { revokedAt: new Date() },
      });

      // Issue new tokens
      return AuthService.issueTokens(
        matchedSession!.user,
        matchedSession!.deviceId,
        tx,
      );
    });

    return newTokens;
  }

  // â”€â”€â”€ Logout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async logout(userId: string, deviceId: string): Promise<void> {
    // Revoke all sessions for this device
    await prisma.session.updateMany({
      where: {
        userId,
        deviceId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  // â”€â”€â”€ Password reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private static readonly RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Issue a password reset token and email it to the user.
   * Always resolves successfully (even if the email doesn't exist) to
   * avoid leaking which emails are registered.
   */
  static async requestPasswordReset(email: string, resetUrlBase: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) return; // Don't reveal whether the email exists

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + AuthService.RESET_TOKEN_TTL_MS),
      },
    });

    const { EmailService } = await import('../../shared/email/email.service');
    await EmailService.sendPasswordResetEmail(
      user.email,
      `${resetUrlBase}?token=${rawToken}`,
    );
  }

  static async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      const err: any = new Error('Invalid or expired reset token');
      err.statusCode = 400;
      err.code = 'INVALID_RESET_TOKEN';
      throw err;
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all existing sessions — force re-login everywhere
      prisma.session.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // â”€â”€â”€ Token issuance (internal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private static async issueTokens(
    user: { id: string; email: string; role: string },
    deviceId: string,
    tx?: any,
  ): Promise<AuthTokens> {
    const db = tx ?? prisma;

    // Access token â€” RS256 JWT, 15-minute expiry
    // Signed with private key; verified with public key (no DB lookup needed)
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        deviceId,
      } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: config.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
      },
    );

    // Refresh token â€” opaque 256-bit random value
    // We store a bcrypt hash (never the raw token) in the DB
    const rawRefreshToken  = nanoid(64);
    const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await db.session.create({
      data: {
        userId: user.id,
        deviceId,
        refreshToken: hashedRefreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken, // Only time the raw token is exposed
    };
  }
}
