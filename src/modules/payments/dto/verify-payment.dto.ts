import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @MaxLength(80)
  razorpay_order_id: string;

  @IsString()
  @MaxLength(80)
  razorpay_payment_id: string;

  @IsString()
  @MaxLength(200)
  razorpay_signature: string;

  /** Our backend order id (returned by /payments/create-order). */
  @IsOptional()
  @IsUUID()
  order_id?: string;
}
