import { Matches } from 'class-validator';
import { CreateOrderDto } from '../../orders/dto/order.dto';

/**
 * UPI (manual) payment — the customer pays the exact order amount by
 * scanning the DAKSH UPI QR (or the business UPI ID) in any UPI app,
 * then submits the 12-digit UTR from the payment receipt.
 *
 * No gateway is involved: the order is created in pending_payment and
 * only becomes a real order when an admin checks the UTR in the
 * business UPI app and verifies it (POST /admin/orders/:id/verify-upi-
 * payment). Money is never trusted from the app alone.
 */
export class UpiPaymentDto extends CreateOrderDto {
  /** 12-digit UPI reference number from the customer's payment receipt. */
  @Matches(/^\d{12}$/, {
    message:
      'utr must be the 12-digit UPI reference number from your payment receipt',
  })
  utr: string;
}
