import sgMail from '@sendgrid/mail';
import { config } from '../../config';

const FROM_ADDRESS = config.EMAIL_FROM_ADDRESS ?? 'no-reply@zita.app';

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  if (!config.SENDGRID_API_KEY) {
    const err: any = new Error(
      'SENDGRID_API_KEY is not configured — set it in .env to send emails',
    );
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }
  sgMail.setApiKey(config.SENDGRID_API_KEY);
  initialized = true;
}

export class EmailService {
  static isConfigured(): boolean {
    return !!config.SENDGRID_API_KEY;
  }

  static async send(to: string, subject: string, html: string): Promise<void> {
    ensureInitialized();
    await sgMail.send({ to, from: FROM_ADDRESS, subject, html });
  }

  /** Best-effort send — logs failures instead of throwing (for non-critical emails). */
  static async sendSilently(to: string, subject: string, html: string): Promise<void> {
    if (!EmailService.isConfigured()) return; // Silently skip if not set up
    try {
      await EmailService.send(to, subject, html);
    } catch (err) {
      console.error(`[email] Failed to send "${subject}" to ${to}:`, err);
    }
  }

  static async sendWelcomeEmail(to: string, displayName: string): Promise<void> {
    await EmailService.sendSilently(
      to,
      'Welcome to ZITA 📚',
      `<p>Hi ${displayName},</p>
       <p>Welcome to ZITA — your reading ecosystem. Your 7-day free trial has started.</p>
       <p>Happy reading!</p>`,
    );
  }

  static async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    // Password reset is security-critical — do not swallow failures silently.
    await EmailService.send(
      to,
      'Reset your ZITA password',
      `<p>We received a request to reset your password.</p>
       <p><a href="${resetUrl}">Click here to reset your password</a> (expires in 1 hour).</p>
       <p>If you didn't request this, you can safely ignore this email.</p>`,
    );
  }

  static async sendTrialEndingEmail(to: string, displayName: string, daysLeft: number): Promise<void> {
    await EmailService.sendSilently(
      to,
      `Your ZITA trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      `<p>Hi ${displayName},</p>
       <p>Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Your subscription will
       continue automatically at $6.00/month unless you cancel.</p>`,
    );
  }

  static async sendReceiptEmail(to: string, displayName: string, amount: string, periodEnd: string): Promise<void> {
    await EmailService.sendSilently(
      to,
      'Your ZITA subscription receipt',
      `<p>Hi ${displayName},</p>
       <p>Thanks for your payment of ${amount}. Your subscription is active until ${periodEnd}.</p>`,
    );
  }
}
