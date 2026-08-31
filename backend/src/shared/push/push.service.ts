import admin from 'firebase-admin';
import fs from 'fs';
import { config } from '../../config';
import { prisma } from '../db/prisma';

let app: admin.app.App | null = null;

function getApp(): admin.app.App {
  if (!config.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
    const err: any = new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY_PATH is not configured — set it in .env to send push notifications',
    );
    err.code = 'PUSH_NOT_CONFIGURED';
    throw err;
  }

  if (!app) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(config.FIREBASE_SERVICE_ACCOUNT_KEY_PATH, 'utf8'),
    );

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return app;
}

export class PushService {
  static isConfigured(): boolean {
    return !!config.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
  }

  static async sendToToken(
    pushToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await getApp().messaging().send({
      token: pushToken,
      notification: { title, body },
      data,
    });
  }

  /**
   * Send to every device the user is currently registered on
   * (best-effort — individual token failures don't stop the others).
   */
  static async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!PushService.isConfigured()) return; // Silently skip if not set up

    const devices = await prisma.device.findMany({
      where: { userId, pushToken: { not: null } },
      select: { pushToken: true },
    });

    await Promise.all(
      devices.map((d) =>
        PushService.sendToToken(d.pushToken!, title, body, data).catch((err) =>
          console.error(`[push] Failed to notify token ${d.pushToken}:`, err.message),
        ),
      ),
    );
  }
}
