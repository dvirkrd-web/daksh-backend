import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { FirebasePushSender } from './fcm.sender';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User])],
  providers: [NotificationsService, FirebasePushSender],
  exports: [NotificationsService],
})
export class NotificationsModule {}
