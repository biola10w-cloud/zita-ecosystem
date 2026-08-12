import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

export async function runSeed() {
  try {
    const adminEmail = 'admin@zita.app';
    const adminPassword = 'Admin@ZITA2025!';

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log(`✓ Admin user already exists (ID: ${existingAdmin.id})`);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        displayName: 'Administrator',
        role: 'ADMIN',
        isEmailVerified: true,
      },
    });

    console.log(`✓ Admin user created (ID: ${admin.id}, Email: ${admin.email})`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

