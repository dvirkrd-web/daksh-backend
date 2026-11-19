import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { CustomerGuard } from '../../common/guards/auth.guards';
import { CreateOrderDto } from '../orders/dto/order.dto';
import { UpiPaymentDto } from './dto/upi-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(CustomerGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Step 1: backend creates the order + Razorpay order. */
  @Post('create-order')
  createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.paymentsService.createPaymentOrder(user.id, dto);
  }

  /** Step 3: backend verifies the signature and confirms the order. */
  @Post('verify')
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(user.id, dto);
  }

  /**
   * UPI (manual) payment: the customer already paid the business UPI ID
   * in their UPI app and submits the 12-digit UTR. Creates the order in
   * pending_payment — it becomes a real order only after an admin
   * verifies the UTR in the dashboard.
   */
  @Post('upi-order')
  createUpiOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpiPaymentDto,
  ) {
    return this.paymentsService.createUpiOrder(user.id, dto);
  }
}
