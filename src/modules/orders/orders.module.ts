import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from '../../entities/coupon.entity';
import { Order } from '../../entities/order.entity';
import { OrderStatusHistory } from '../../entities/order-status-history.entity';
import { Product } from '../../entities/product.entity';
import { ProductPrice } from '../../entities/product-price.entity';
import { UploadedFile } from '../../entities/uploaded-file.entity';
import { AddressesModule } from '../addresses/addresses.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderStatusHistory,
      UploadedFile,
      Product,
      ProductPrice,
      Coupon,
    ]),
    AddressesModule,
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PricingService],
  exports: [OrdersService, PricingService],
})
export class OrdersModule {}
