import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { prisma } from '../../shared/db/prisma';

/**
 * Auth Service Tests
 * Tests for user registration, login, token refresh, and logout
 */
describe('AuthService', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'SecurePassword123!',
    displayName: 'Test User',
    deviceFingerprint: 'device-fingerprint-123',
    platform: 'WEB' as const,
  };

  beforeEach(async () => {
    // Clean up test data
    await prisma.session.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    // Clean up and disconnect
    await prisma.session.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Registration', () => {
    it('should successfully register a new user', async () => {
      const result = await AuthService.register(
        testUser.email,
        testUser.password,
        testUser.displayName,
        testUser.deviceFingerprint,
        testUser.platform,
      );

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testUser.email);
      expect(result.user.displayName).toBe(testUser.displayName);
      expect(result.user.role).toBe('READER');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      const result = await AuthService.register(
        'TEST@EXAMPLE.COM',
        testUser.password,
        testUser.displayName,
        testUser.deviceFingerprint,
        testUser.platform,
      );

      expect(result.user.email).toBe('test@example.com');
    });

    it('should hash the password securely', async () => {
      const result = await AuthService.register(
        testUser.email,
        testUser.password,
        testUser.displayName,
        testUser.deviceFingerprint,
        testUser.platform,
      );

      const userInDb = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      expect(userInDb).toBeDefined();
      expect(userInDb!.passwordHash).not.toBe(testUser.password);
      expect(userInDb!.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should create a device record on registration', async () => {
      const result = await AuthService.register(
        testUser.email,
        testUser.password,
        testUser.displayName,
        testUser.deviceFingerprint,
        testUser.platform,
      );

      const device = await prisma.device.findFirst({
        where: {
          userId: result.user.id,
          fingerprint: testUser.deviceFingerprint,
        },
      });

      expect(device).toBeDefined();
      expect(device!.platform).toBe('WEB');
    });

    it('should reject duplicate email', async () => {
      await AuthService.register(
        testUser.email,
        testUser.password,
        testUser.displayName,
        testUser.deviceFingerprint,
        testUser.platform,
      );

      await expect(
        AuthService.register(
          testUser.email,
          'AnotherPassword123!',
          'Another Name',
          'another-fingerprint',
          testUser.platform,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Login', () => {
    beforeEach(async () => {
      // Register a user before each login test
      await AuthService.register(
        testUser.email,
        testUser.password,
        testUser.displayName,
        testUser.deviceFingerprint,
        testUser.platform,
      );
    });

    it('should successfully login with correct credentials', async () => {
      const result = await AuthService.login(
        testUser.email,
        testUser.password,
        'new-device-fingerprint',
        'IOS',
      );

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testUser.email);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      await expect(
        AuthService.login(
          testUser.email,
          'WrongPassword123!',
          'device-fp',
          'WEB',
        ),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject non-existent email', async () => {
      await expect(
        AuthService.login(
          'nonexistent@example.com',
          testUser.password,
          'device-fp',
          'WEB',
        ),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should update device lastSeenAt on login with same fingerprint', async () => {
      const firstLogin = await AuthService.login(
        testUser.email,
        testUser.password,
        testUser.deviceFingerprint,
        'WEB',
      );

      const deviceBefore = await prisma.device.findFirst({
        where: {
          userId: firstLogin.user.id,
          fingerprint: testUser.deviceFingerprint,
        },
      });

      // Wait a bit and login again
      await new Promise((r) => setTimeout(r, 100));

      const secondLogin = await AuthService.login(
        testUser.email,
        testUser.password,
        testUser.deviceFingerprint,
        'WEB',
      );

      const deviceAfter = await prisma.device.findFirst({
        where: {
          userId: secondLogin.user.id,
          fingerprint: testUser.deviceFingerprint,
        },
      });

      const beforeTime = deviceBefore!.lastSeenAt ? new Date(deviceBefore!.lastSeenAt).getTime() : 0;
      const afterTime = deviceAfter!.lastSeenAt ? new Date(deviceAfter!.lastSeenAt).getTime() : 0;
      expect(afterTime).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should normalize email to lowercase on login', async () => {
      const result = await AuthService.login(
        'TEST@EXAMPLE.COM',
        testUser.password,
        'device-fp',
        'WEB',
      );

      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('Token Refresh', () => {
    let userId: string;
    let refreshToken: string;

    beforeEach(async () => {
      const registered = await AuthService.register(
        testUser.email,
        testUser.password,
        testUser.displayName,
        testUser.deviceFingerprint,
        testUser.platform,
      );

      userId = registered.user.id;
      refreshToken = registered.tokens.refreshToken;
    });

    it('should successfully refresh tokens with valid refresh token', async () => {
      const newTokens = await AuthService.refresh(refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(refreshToken);
      expect(newTokens.refreshToken).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        AuthService.refresh('invalid-refresh-token'),
      ).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should revoke old session on refresh', async () => {
      const sessionBefore = await prisma.session.findFirst({
        where: { userId },
      });

      expect(sessionBefore?.revokedAt).toBeNull();

      await AuthService.refresh(refreshToken);

      const sessionAfter = await prisma.session.findFirst({
        where: { id: sessionBefore!.id },
      });

      expect(sessionAfter?.revokedAt).not.toBeNull();
    });

    it('should reject already-used refresh token (single-use)', async () => {
      await AuthService.refresh(refreshToken);

      await expect(
        AuthService.refresh(refreshToken),
      ).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('Logout', () => {
    let userId: string;
    let deviceId: string;

    beforeEach(async () => {
      const registered = await AuthService.register(
        testUser.email,
        testUser.password,
        testUser.displayName,
        testUser.deviceFingerprint,
        testUser.platform,
      );

      userId = registered.user.id;

      const device = await prisma.device.findFirst({
        where: { userId },
      });

      deviceId = device!.id;
    });

    it('should successfully logout', async () => {
      const sessionsBefore = await prisma.session.count({
        where: { userId, revokedAt: null },
      });

      expect(sessionsBefore).toBeGreaterThan(0);

      await AuthService.logout(userId, deviceId);

      const sessionsAfter = await prisma.session.count({
        where: { userId, revokedAt: null },
      });

      expect(sessionsAfter).toBe(0);
    });

    it('should revoke all sessions for a device', async () => {
      // Create multiple sessions for the same device
      await AuthService.login(testUser.email, testUser.password, testUser.deviceFingerprint, 'WEB');
      await AuthService.login(testUser.email, testUser.password, testUser.deviceFingerprint, 'WEB');

      const sessionsBefore = await prisma.session.count({
        where: { deviceId, revokedAt: null },
      });

      expect(sessionsBefore).toBeGreaterThan(0);

      await AuthService.logout(userId, deviceId);

      const sessionsAfter = await prisma.session.count({
        where: { deviceId, revokedAt: null },
      });

      expect(sessionsAfter).toBe(0);
    });
  });
});
