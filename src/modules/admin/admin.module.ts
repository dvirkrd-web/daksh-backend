import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from '../../entities/admin-user.entity';
import { Order } from '../../entities/order.entity';
import { OrderStatusHistory } from '../../entities/order-status-history.entity';
import { Payment } from '../../entities/payment.entity';
import { SupportTicket } from '../../entities/support-ticket.entity';
import { User } from '../../entities/user.entity';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { ShippingModule } from '../shipping/shipping.module';
import { StorageModule } from '../storage/storage.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUser,
      Order,
      OrderStatusHistory,
      Payment,
      User,
      SupportTicket,
    ]),
    AuditModule,
    NotificationsModule,
    OrdersModule,
    ProductsModule,
    ShippingModule,
    StorageModule,
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminService],
})
export class AdminModule {}
