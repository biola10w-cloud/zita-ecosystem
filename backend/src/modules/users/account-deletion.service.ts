import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/db/prisma';
import { StripeService } from '../subscriptions/stripe.service';

export class AccountDeletionService {
  static async delete(userId: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }, include: { subscription: true },
    });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      throw Object.assign(new Error('Your current password is incorrect.'), { statusCode: 400 });
    }
    const subscription = user.subscription;
    if (subscription?.platform === 'STRIPE') {
      if (!subscription.stripeSubscriptionId && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(subscription.status)) {
        throw Object.assign(new Error('Billing could not be confirmed. Please contact support before deleting your account.'), { statusCode: 409 });
      }
      if (subscription.stripeSubscriptionId) {
        // Cancellation failure leaves the account intact for a safe retry.
        await StripeService.cancelForAccountDeletion(subscription.stripeSubscriptionId);
      }
    }
    await prisma.$transaction(async tx => {
      const current = await tx.user.findUnique({ where: { id: userId }, include: { subscription: true } });
      if (!current) return;
      if (current.passwordHash !== user.passwordHash ||
          current.subscription?.stripeSubscriptionId !== subscription?.stripeSubscriptionId ||
          current.subscription?.originalTransactionId !== subscription?.originalTransactionId) {
        throw Object.assign(new Error('Your account changed. Please review it and retry deletion.'), { statusCode: 409 });
      }
      // Clean up user-owned uploads through the durable book cleanup queue.
      const books = await tx.book.findMany({ where: { authorId: userId }, select: { id: true, slug: true } });
      if (books.length) {
        await tx.deletedBook.createMany({ data: books, skipDuplicates: true });
        await tx.book.deleteMany({ where: { authorId: userId } });
      }
      await tx.analyticsEvent.deleteMany({ where: { userId } });
      // Cascades sessions, devices, reset tokens, reading data, purchases,
      // comments, likes, reports, blocks and the local subscription record.
      await tx.user.delete({ where: { id: userId } });
    }, { isolationLevel: 'Serializable' });
  }
}
