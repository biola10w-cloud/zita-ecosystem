import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/db/prisma';

const BCRYPT_ROUNDS = 12;

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role: 'READER' | 'MODERATOR' | 'ADMIN';
  preferredLanguage: string;
}

export interface UpdateUserInput {
  displayName?: string;
  preferredLanguage?: string;
}

export interface ListUsersQuery {
  page: number;
  limit: number;
  search?: string;
  role?: 'READER' | 'MODERATOR' | 'ADMIN';
}

export class AdminService {
  // ─── Create User ──────────────────────────────────────────────
  static async createUser(input: CreateUserInput) {
    const normalisedEmail = input.email.toLowerCase().trim();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalisedEmail },
    });

    if (existing) {
      const err: any = new Error('User with this email already exists');
      err.statusCode = 409;
      err.code = 'USER_EXISTS';
      throw err;
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: normalisedEmail,
        passwordHash,
        displayName: input.displayName.trim(),
        role: input.role,
        preferredLanguage: input.preferredLanguage,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        preferredLanguage: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    return user;
  }

  // ─── List Users with Pagination ───────────────────────────────
  static async listUsers(query: ListUsersQuery) {
    const skip = (query.page - 1) * query.limit;

    // Build filter
    const where: any = {};
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role) {
      where.role = query.role;
    }

    // Get total count
    const total = await prisma.user.count({ where });

    // Get paginated users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        preferredLanguage: true,
        isEmailVerified: true,
        createdAt: true,
      },
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
    });

    return {
      users,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  // ─── Get Single User ──────────────────────────────────────────
  static async getUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        preferredLanguage: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    return user;
  }

  // ─── Update User ──────────────────────────────────────────────
  static async updateUser(userId: string, input: UpdateUserInput) {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName ? input.displayName.trim() : undefined,
        preferredLanguage: input.preferredLanguage,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        preferredLanguage: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  // ─── Update User Role ─────────────────────────────────────────
  static async updateUserRole(userId: string, role: 'READER' | 'MODERATOR' | 'ADMIN') {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        preferredLanguage: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    return updated;
  }

  // ─── Delete User ──────────────────────────────────────────────
  static async deleteUser(userId: string) {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    // Cascade delete sessions, devices, and all related data
    await prisma.$transaction(async (tx) => {
      // Delete all sessions
      await tx.session.deleteMany({ where: { userId } });

      // Delete all devices
      await tx.device.deleteMany({ where: { userId } });

      // Delete user
      await tx.user.delete({ where: { id: userId } });
    });
  }

  // ─── Get Dashboard Stats ──────────────────────────────────────
  static async getStats() {
    const [totalUsers, adminCount, moderatorCount, readerCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'MODERATOR' } }),
      prisma.user.count({ where: { role: 'READER' } }),
    ]);

    return {
      totalUsers,
      byRole: {
        admin: adminCount,
        moderator: moderatorCount,
        reader: readerCount,
      },
    };
  }
}

