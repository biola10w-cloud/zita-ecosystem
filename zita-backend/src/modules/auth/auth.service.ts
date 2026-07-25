import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { prisma } from '../../shared/db/prisma';
import { config } from '../../config';
import { loadPrivateKey, JwtPayload } from '../../shared/middleware/authenticate';

const BCRYPT_ROUNDS = 12;

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
}

export interface LoginResult {
  user: {
    id:                string;
    email:             string;
    displayName:       string;
    avatarUrl:         string | null;
    role:              string;
    preferredLanguage: string;
  };
  tokens: AuthTokens;
}

export class AuthService {

  // ─── Register ────────────────────────────────────────────────
  static async register(
    email: string,
    password: string,
    displayName: string,
    deviceFingerprint: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
  ): Promise<LoginResult> {
    const normalisedEmail = email.toLowerCase().trim();
    const passwordHash    = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { user, device } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: normalisedEmail, passwordHash, displayName: displayName.trim(), role: 'READER' },
      });
      const device = await tx.device.create({
        data: { userId: user.id, fingerprint: deviceFingerprint, platform },
      });
      return { user, device };
    });

    const tokens = await AuthService.issueTokens(user, device.id);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role, preferredLanguage: user.preferredLanguage },
      tokens,
    };
  }

  // ─── Login ───────────────────────────────────────────────────
  static async login(
    email: string,
    password: string,
    deviceFingerprint: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
  ): Promise<LoginResult> {
    const normalisedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalisedEmail } });

    // Constant-time comparison — prevents timing-based user enumeration
    const passwordMatch = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000');

    if (!user || !passwordMatch) {
      const err: any = new Error('Invalid email or password');
      err.statusCode = 401; err.code = 'INVALID_CREDENTIALS'; throw err;
    }

    const device = await prisma.device.upsert({
      where:  { userId_fingerprint: { userId: user.id, fingerprint: deviceFingerprint } },
      update: { lastSeenAt: new Date(), platform },
      create: { userId: user.id, fingerprint: deviceFingerprint, platform },
    });

    const tokens = await AuthService.issueTokens(user, device.id);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role, preferredLanguage: user.preferredLanguage },
      tokens,
    };
  }

  // ─── Refresh ─────────────────────────────────────────────────
  static async refresh(refreshToken: string): Promise<AuthTokens> {
    const sessions = await prisma.session.findMany({
      where: { expiresAt: { gt: new Date() }, revokedAt: null },
      include: { user: true },
      take: 1000,
    });

    let matched = null;
    for (const s of sessions) {
      if (await bcrypt.compare(refreshToken, s.refreshToken)) {
        matched = s; break;
      }
    }

    if (!matched) {
      const err: any = new Error('Invalid or expired refresh token');
      err.statusCode = 401; err.code = 'INVALID_REFRESH_TOKEN'; throw err;
    }

    // Single-use rotation — revoke old, issue new in one transaction
    return prisma.$transaction(async (tx) => {
      await tx.session.update({ where: { id: matched!.id }, data: { revokedAt: new Date() } });
      return AuthService.issueTokens(matched!.user, matched!.deviceId, tx);
    });
  }

  // ─── Logout ──────────────────────────────────────────────────
  static async logout(userId: string, deviceId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
  }

  // ─── Get current user ─────────────────────────────────────────
  static async getCurrentUser(userId: string) {
    return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, email: true, displayName: true, avatarUrl: true,
        role: true, preferredLanguage: true, createdAt: true,
        subscription: {
          select: { status: true, currentPeriodEnd: true, trialEnd: true },
        },
      },
    });
  }

  // ─── Issue tokens (internal) ──────────────────────────────────
  private static async issueTokens(
    user:     { id: string; email: string; role: string },
    deviceId: string,
    tx?:      any,
  ): Promise<AuthTokens> {
    const db = tx ?? prisma;

    // loadPrivateKey() reads JWT_PRIVATE_KEY env var first (Railway),
    // then falls back to JWT_PRIVATE_KEY_PATH file (local dev)
    const privateKey = loadPrivateKey();

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, deviceId } as Omit<JwtPayload, 'iat' | 'exp'>,
      privateKey,
      { algorithm: 'RS256', expiresIn: config.JWT_ACCESS_EXPIRY as any },
    );

    const rawRefreshToken    = nanoid(64);
    const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);
    const expiresAt          = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db.session.create({
      data: { userId: user.id, deviceId, refreshToken: hashedRefreshToken, expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
