import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeOrder } from '../../common/serializers';
import { Order } from '../../entities/order.entity';
import { Payment } from '../../entities/payment.entity';
import { UploadedFile } from '../../entities/uploaded-file.entity';
import { CreateOrderDto } from '../orders/dto/order.dto';
import { OrdersService } from '../orders/orders.service';
import { UpiPaymentDto } from './dto/upi-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { RazorpayService } from './razorpay.service';

/**
 * Payment flow (project rule: the app is NEVER trusted):
 *  1. create-order — backend prices the cart from the DB, creates a
 *     pending_payment order + a Razorpay order, stores a payments row.
 *  2. The app collects money through Razorpay checkout.
 *  3. verify — backend checks the Razorpay signature with the key
 *     secret; only then is the payment captured and the order confirmed.
 *  4. The Razorpay webhook independently confirms capture/failure, so
 *     an order is never lost if the app closes mid-flow.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(UploadedFile)
    private readonly files: Repository<UploadedFile>,
    private readonly ordersService: OrdersService,
    private readonly razorpay: RazorpayService,
  ) {}

  async createPaymentOrder(userId: string, dto: CreateOrderDto) {
    if (!this.razorpay.isConfigured()) {
      throw new ServiceUnavailableException(
        'Payment gateway is not configured on the server. Please contact support.',
      );
    }
    const order = await this.ordersService.createDraftOrder(userId, dto);

    let rpOrder;
    try {
      rpOrder = await this.razorpay.createOrder(order.totalPaise, order.orderNo);
    } catch (err) {
      throw new ServiceUnavailableException(
        `Payment could not be started: ${(err as Error).message}`,
      );
    }

    await this.payments.save(
      this.payments.create({
        orderId: order.id,
        gateway: 'razorpay',
        gatewayOrderId: rpOrder.id,
        gatewayPaymentId: null,
        amountPaise: order.totalPaise,
        method: null,
        status: 'created',
        signatureVerified: false,
        webhookPayload: null,
      }),
    );

    // Shape consumed by the app's PaymentOrder.fromJson.
    return {
      razorpay_order_id: rpOrder.id,
      key_id: this.razorpay.keyId(),
      amount_paise: order.totalPaise,
      currency: 'INR',
      backend_order_id: order.id,
      backend_order_no: order.orderNo,
      order: { id: order.id, order_no: order.orderNo, status: order.status },
    };
  }

  /**
   * UPI (manual) payment — creates the order in pending_payment plus a
   * payments row with method 'upi' and the customer's payment proof:
   * the 12-digit UTR (stored in gateway_payment_id) and/or the storage
   * key of a payment screenshot the customer uploaded through the
   * normal uploads flow (stored in screenshot_key). At least one proof
   * is required.
   *
   * Deliberately NO Razorpay isConfigured() gate here: UPI is paid
   * directly to the business UPI ID and verified by an admin. The order
   * is NOT a real order yet — it becomes `received` only when an admin
   * verifies the proof (AdminService.verifyUpiPayment), and it is hidden
   * from the customer's order list until then (OrdersService.listForUser).
   */
  async createUpiOrder(userId: string, dto: UpiPaymentDto) {
    const utr = dto.utr?.trim() ? dto.utr.trim() : null;
    if (utr && !/^\d{12}$/.test(utr)) {
      throw new BadRequestException(
        'UTR must be the 12-digit UPI reference number from your payment receipt.',
      );
    }

    let screenshotKey: string | null = null;
    if (dto.screenshot_storage_key) {
      screenshotKey = await this.resolveScreenshotKey(
        userId,
        dto.screenshot_storage_key,
      );
    }

    if (!utr && !screenshotKey) {
      throw new BadRequestException(
        'Please provide either the 12-digit UTR from your payment receipt or a screenshot of your payment.',
      );
    }

    const order = await this.ordersService.createDraftOrder(userId, dto);

    await this.payments.save(
      this.payments.create({
        orderId: order.id,
        gateway: 'upi',
        gatewayOrderId: `upi-${order.orderNo}`,
        gatewayPaymentId: utr,
        screenshotKey,
        amountPaise: order.totalPaise,
        method: 'upi',
        status: 'created',
        signatureVerified: false,
        webhookPayload: null,
      }),
    );

    // Shape consumed by the app: the created order (still pending_payment)
    // plus the submitted proof and amount for the confirmation screen.
    return {
      order: serializeOrder(order),
      utr,
      screenshot_key: screenshotKey,
      amount_paise: order.totalPaise,
      backend_order_id: order.id,
      backend_order_no: order.orderNo,
    };
  }

  /**
   * A payment screenshot is accepted only if it is a CONFIRMED upload
   * (POST /uploads/confirm created the row) that belongs to the caller —
   * the same ownership rule the order flow applies to print files, so a
   * customer can never attach someone else's screenshot as proof.
   */
  private async resolveScreenshotKey(
    userId: string,
    storageKey: string,
  ): Promise<string> {
    if (!storageKey.startsWith(`uploads/${userId}/`)) {
      throw new BadRequestException(
        'The payment screenshot does not belong to your account. Please upload it again.',
      );
    }
    const file = await this.files.findOne({ where: { storageKey } });
    if (!file || file.userId !== userId) {
      throw new BadRequestException(
        'The payment screenshot was not found. Please upload it again.',
      );
    }
    return file.storageKey;
  }

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const payment = await this.payments.findOne({
      where: { gatewayOrderId: dto.razorpay_order_id },
    });
    if (!payment) {
      throw new NotFoundException('Payment record not found.');
    }
    const order = await this.ordersService.loadFullOrder(payment.orderId);
    if (order.userId !== userId) {
      throw new NotFoundException('Payment record not found.');
    }
    if (dto.order_id && dto.order_id !== order.id) {
      throw new BadRequestException('Order mismatch for this payment.');
    }

    // Idempotent: webhook may have confirmed this already.
    if (payment.status === 'captured') {
      return { order: serializeOrder(order) };
    }

    const valid = this.razorpay.verifyPaymentSignature(
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );
    if (!valid) {
      throw new BadRequestException(
        'Payment verification failed. If money was deducted, it will be confirmed automatically or refunded by your bank.',
      );
    }

    payment.gatewayPaymentId = dto.razorpay_payment_id;
    payment.signatureVerified = true;
    payment.status = 'captured';
    payment.method = await this.razorpay.fetchPaymentMethod(
      dto.razorpay_payment_id,
    );
    await this.payments.save(payment);

    const confirmed = await this.ordersService.confirmOrderPaid(
      order.id,
      'system',
      'Payment verified (checkout signature).',
    );
    return { order: serializeOrder(confirmed) };
  }

  /**
   * Razorpay webhook. Signature is verified over the raw body before
   * anything is trusted. Handlers are idempotent — Razorpay retries
   * webhooks, and the checkout verify path may have run first.
   */
  async handleWebhook(rawBody: Buffer, signature: string) {
    if (!this.razorpay.webhookConfigured()) {
      throw new ServiceUnavailableException(
        'Razorpay webhook secret is not configured on the server.',
      );
    }
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature.');
    }

    let payload: {
      event?: string;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook payload.');
    }

    const event = payload.event ?? '';
    const entity = payload.payload?.payment?.entity;
    if (
      (event === 'payment.captured' || event === 'payment.failed') &&
      entity &&
      typeof entity.order_id === 'string'
    ) {
      const payment = await this.payments.findOne({
        where: { gatewayOrderId: entity.order_id },
      });
      if (payment) {
        payment.webhookPayload = payload as Record<string, unknown>;
        if (event === 'payment.captured' && payment.status !== 'captured') {
          payment.status = 'captured';
          payment.gatewayPaymentId =
            typeof entity.id === 'string' ? entity.id : payment.gatewayPaymentId;
          payment.method =
            typeof entity.method === 'string' ? entity.method : payment.method;
          await this.payments.save(payment);
          await this.ordersService.confirmOrderPaid(
            payment.orderId,
            'webhook',
            'Payment captured (Razorpay webhook).',
          );
        } else if (event === 'payment.failed' && payment.status === 'created') {
          payment.status = 'failed';
          payment.gatewayPaymentId =
            typeof entity.id === 'string' ? entity.id : payment.gatewayPaymentId;
          await this.payments.save(payment);
        } else {
          await this.payments.save(payment);
        }
      }
    }
    return { received: true };
  }
}
