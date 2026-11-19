import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { AppConfiguration } from '../../config/configuration';

interface RazorpayOrderEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

interface RazorpayPaymentEntity {
  id: string;
  method?: string;
  status?: string;
}

interface RazorpayClientLike {
  orders: {
    create: (opts: Record<string, unknown>) => Promise<RazorpayOrderEntity>;
  };
  payments: { fetch: (id: string) => Promise<RazorpayPaymentEntity> };
}

/**
 * Thin wrapper over the official `razorpay` npm package.
 * Keys come only from the backend .env (RAZORPAY_KEY_ID /
 * RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET). When they are absent,
 * isConfigured() is false and callers fail with a clear configuration
 * error — a Razorpay order is never faked.
 */
@Injectable()
export class RazorpayService {
  // The razorpay package ships without bundled TS types in some
  // versions; require() keeps this wrapper type-safe at our boundary.
  private client: RazorpayClientLike | null = null;

  constructor(private readonly config: ConfigService<AppConfiguration>) {}

  private cfg(): AppConfiguration['razorpay'] {
    // The configuration factory always returns this object.
    return this.config.get('razorpay', { infer: true })!;
  }

  isConfigured(): boolean {
    const r = this.cfg();
    return !!(r.keyId && r.keySecret);
  }

  keyId(): string | null {
    return this.cfg().keyId;
  }

  private getClient(): RazorpayClientLike {
    const r = this.cfg();
    if (!r.keyId || !r.keySecret) {
      throw new ServiceUnavailableException(
        'Payment gateway is not configured on the server. Please contact support.',
      );
    }
    let client = this.client;
    if (!client) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Razorpay = require('razorpay');
      client = new Razorpay({
        key_id: r.keyId,
        key_secret: r.keySecret,
      }) as RazorpayClientLike;
      this.client = client;
    }
    return client;
  }

  async createOrder(
    amountPaise: number,
    receipt: string,
  ): Promise<RazorpayOrderEntity> {
    return this.getClient().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      payment_capture: 1,
    });
  }

  /**
   * Checkout signature check: HMAC-SHA256 of
   * "<razorpay_order_id>|<razorpay_payment_id>" with the key secret.
   * This — never the app's word — is what confirms a payment.
   */
  verifyPaymentSignature(
    gatewayOrderId: string,
    gatewayPaymentId: string,
    signature: string,
  ): boolean {
    const r = this.cfg();
    if (!r.keySecret) return false;
    const expected = createHmac('sha256', r.keySecret)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature ?? '', 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Webhook signature check over the exact raw request body. */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const r = this.cfg();
    if (!r.webhookSecret) return false;
    const expected = createHmac('sha256', r.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature ?? '', 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  webhookConfigured(): boolean {
    return !!this.cfg().webhookSecret;
  }

  /** Best-effort: the payment method (upi/card/…) straight from Razorpay. */
  async fetchPaymentMethod(gatewayPaymentId: string): Promise<string | null> {
    try {
      const payment = await this.getClient().payments.fetch(gatewayPaymentId);
      return payment.method ?? null;
    } catch {
      return null;
    }
  }
}
