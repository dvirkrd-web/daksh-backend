import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../../entities/payment.entity';
import { UploadedFile } from '../../entities/uploaded-file.entity';
import { OrdersModule } from '../orders/orders.module';
import { ShippingModule } from '../shipping/shipping.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, UploadedFile]),
    OrdersModule,
    ShippingModule,
  ],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, RazorpayService],
})
export class PaymentsModule {}
