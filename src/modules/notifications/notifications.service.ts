import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { FirebasePushSender } from './fcm.sender';

export interface NotifyInput {
  userId: string;
  title: string;
  body: string;
  type: 'order' | 'payment' | 'shipping' | 'promo';
  orderId?: string | null;
}

/**
 * Records every notification in the database (the in-app notification
 * centre reads these rows), then attempts an FCM push when the customer
 * has a device token AND Firebase is configured. `sent_via` is set to
 * 'fcm' only when the push was actually dispatched — when Firebase is
 * not configured the notification is stored and logged, never faked.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly pushSender: FirebasePushSender,
  ) {}

  async notify(input: NotifyInput): Promise<Notification> {
    const row = await this.notifications.save(
      this.notifications.create({
        userId: input.userId,
        title: input.title,
        body: input.body,
        type: input.type,
        orderId: input.orderId ?? null,
        isRead: false,
        sentVia: null,
      }),
    );

    const user = await this.users.findOne({ where: { id: input.userId } });
    if (user?.fcmToken && this.pushSender.isConfigured()) {
      const sent = await this.pushSender.sendToToken(
        user.fcmToken,
        input.title,
        input.body,
        input.orderId ? { order_id: input.orderId } : {},
      );
      if (sent) {
        row.sentVia = 'fcm';
        await this.notifications.save(row);
      }
    } else {
      this.logger.log(
        `Notification stored (push not sent — ${user?.fcmToken ? 'Firebase not configured' : 'no device token'}): "${input.title}" for user ${input.userId}`,
      );
    }
    return row;
  }
}
