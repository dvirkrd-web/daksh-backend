import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderStatusHistory } from '../../entities/order-status-history.entity';
import { Shipment } from '../../entities/shipment.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShippingController } from './shipping.controller';
import { ShiprocketService } from './shiprocket.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shipment, OrderStatusHistory]),
    NotificationsModule,
  ],
  controllers: [ShippingController],
  providers: [ShiprocketService],
  exports: [ShiprocketService],
})
export class ShippingModule {}
