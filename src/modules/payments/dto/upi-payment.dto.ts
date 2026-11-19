import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CreateOrderDto } from '../../orders/dto/order.dto';

/**
 * UPI (manual) payment — the customer pays the exact order amount by
 * scanning the DAKSH UPI QR (or the business UPI ID) in any UPI app,
 * then submits ONE of two proofs:
 *
 *   - `utr`: the 12-digit UPI reference number from the payment
 *     receipt, or
 *   - `screenshot_storage_key`: the storage key of the payment
 *     screenshot, uploaded beforehand through the normal uploads flow
 *     (presign → PUT → confirm), exactly like a print file.
 *
 * At least one proof is required (enforced in PaymentsService, which
 * also checks the screenshot really is a confirmed upload belonging
 * to the caller). No gateway is involved: the order is created in
 * pending_payment and only becomes a real order when an admin checks
 * the proof against the business UPI app and verifies it
 * (POST /admin/orders/:id/verify-upi-payment). Money is never trusted
 * from the app alone.
 */
export class UpiPaymentDto extends CreateOrderDto {
  /** 12-digit UPI reference number from the customer's payment receipt. */
  @IsOptional()
  @Matches(/^\d{12}$/, {
    message:
      'utr must be the 12-digit UPI reference number from your payment receipt',
  })
  utr?: string;

  /**
   * Storage key of the confirmed payment-screenshot upload
   * (uploads/<userId>/… — the key returned by POST /uploads/presign and
   * confirmed by POST /uploads/confirm).
   */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  screenshot_storage_key?: string;
}
