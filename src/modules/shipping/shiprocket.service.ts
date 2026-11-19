import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus } from '../../common/order-status';
import { Order } from '../../entities/order.entity';
import { OrderStatusHistory } from '../../entities/order-status-history.entity';
import { Shipment } from '../../entities/shipment.entity';
import { NotificationsService } from '../notifications/notifications.service';

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';

/**
 * Shiprocket integration (Phase 6).
 *
 * Credentials come only from SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD in
 * the backend .env (an API user created in the Shiprocket panel).
 * Until they are set, every operation fails with a clear
 * "Shiprocket not configured" error — AWB numbers are NEVER invented.
 * When configured, this service performs the real flow:
 * login → create order → assign AWB → request pickup.
 */
@Injectable()
export class ShiprocketService {
  private readonly logger = new Logger(ShiprocketService.name);
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Shipment)
    private readonly shipments: Repository<Shipment>,
    @InjectRepository(OrderStatusHistory)
    private readonly history: Repository<OrderStatusHistory>,
    private readonly notifications: NotificationsService,
  ) {}

  isConfigured(): boolean {
    const email = this.config.get<string>('SHIPROCKET_EMAIL');
    const password = this.config.get<string>('SHIPROCKET_PASSWORD');
    return !!(email && password);
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Shiprocket is not configured on the server. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to the backend .env (Phase 6) to enable shipping.',
      );
    }
  }

  private async getToken(): Promise<string> {
    this.requireConfigured();
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.config.get<string>('SHIPROCKET_EMAIL'),
        password: this.config.get<string>('SHIPROCKET_PASSWORD'),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { token?: string };
    if (!res.ok || !body.token) {
      throw new ServiceUnavailableException(
        'Shiprocket login failed. Check SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD in .env.',
      );
    }
    this.token = body.token;
    // Shiprocket tokens live ~10 days; refresh after 9.
    this.tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
    return this.token;
  }

  private async api<T>(
    path: string,
    method: 'GET' | 'POST',
    payload?: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${SHIPROCKET_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const message =
        typeof body.message === 'string'
          ? body.message
          : `Shiprocket request failed (${res.status}).`;
      throw new BadRequestException(message);
    }
    return body as T;
  }

  /** PIN-code serviceability + available couriers/rates for a parcel. */
  async quote(pinCode: string, weightKg = 0.5) {
    this.requireConfigured();
    const pickupPostcode =
      this.config.get<string>('SHIPROCKET_PICKUP_POSTCODE') ?? '';
    if (!pickupPostcode) {
      throw new ServiceUnavailableException(
        'SHIPROCKET_PICKUP_POSTCODE is not set in .env — the pickup PIN code is required for rate checks.',
      );
    }
    return this.api(
      `/courier/serviceability/?pickup_postcode=${pickupPostcode}&delivery_postcode=${pinCode}&weight=${weightKg}&cod=0`,
      'GET',
    );
  }

  /**
   * Creates the Shiprocket shipment for a packed order, generates the
   * AWB and requests pickup. Stores everything on the shipments row.
   */
  async createShipmentForOrder(order: Order): Promise<Shipment> {
    this.requireConfigured();
    const existing = await this.shipments.findOne({
      where: { orderId: order.id },
    });
    if (existing?.awbCode) return existing;

    const address = order.address;
    const fullName = address.fullName ?? 'Customer';
    const [firstName, ...rest] = fullName.split(' ');
    const items = (order.items ?? []).map((item) => ({
      name: item.product?.name ?? 'Printed item',
      sku: item.product?.slug ?? 'print',
      units: item.qty,
      selling_price: Math.max(1, Math.round(item.unitPricePaise / 100)),
    }));

    const created = await this.api<{
      order_id?: number;
      shipment_id?: number;
    }>('/orders/create/adhoc', 'POST', {
      order_id: order.orderNo,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_location:
        this.config.get<string>('SHIPROCKET_PICKUP_LOCATION') ?? 'Primary',
      billing_customer_name: firstName,
      billing_last_name: rest.join(' ') || '.',
      billing_address: `${address.houseNo}, ${address.street}`,
      billing_city: address.villageCity,
      billing_pincode: address.pinCode,
      billing_state: address.state,
      billing_country: 'India',
      billing_phone: (address.mobile ?? '').replace(/\D/g, '').slice(-10),
      shipping_is_billing: true,
      order_items: items,
      payment_method: 'Prepaid',
      sub_total: Math.max(1, Math.round(order.totalPaise / 100)),
      length: 30,
      breadth: 22,
      height: 3,
      weight: 0.5,
    });

    const shipmentId = created.shipment_id;
    if (!shipmentId) {
      throw new BadRequestException(
        'Shiprocket did not return a shipment id for this order.',
      );
    }

    const awb = await this.api<{
      response?: { data?: { awb_code?: string; courier_name?: string } };
    }>('/courier/assign/awb', 'POST', { shipment_id: shipmentId });

    const awbCode = awb.response?.data?.awb_code ?? null;
    const courierName = awb.response?.data?.courier_name ?? null;

    let pickupStatus: string | null = null;
    try {
      const pickup = await this.api<{ response?: { pickup_status?: number } }>(
        '/courier/generate/pickup',
        'POST',
        { shipment_id: [shipmentId] },
      );
      pickupStatus =
        pickup.response?.pickup_status != null
          ? String(pickup.response.pickup_status)
          : 'requested';
    } catch (err) {
      // AWB exists; pickup can be re-requested from the Shiprocket panel.
      this.logger.warn(
        `Pickup request failed for ${order.orderNo}: ${(err as Error).message}`,
      );
      pickupStatus = 'failed';
    }

    const shipment = await this.shipments.save(
      this.shipments.create({
        id: existing?.id,
        orderId: order.id,
        provider: 'shiprocket',
        shiprocketOrderId:
          created.order_id != null ? String(created.order_id) : null,
        shipmentId: String(shipmentId),
        awbCode,
        courierName,
        pickupStatus,
        trackingUrl: awbCode
          ? `https://shiprocket.co/tracking/${awbCode}`
          : null,
        currentStatus: 'AWB Assigned',
        etd: null,
      }),
    );

    await this.notifications.notify({
      userId: order.userId,
      title: 'Order shipped',
      body: `Your order ${order.orderNo} has been shipped${courierName ? ` via ${courierName}` : ''}${awbCode ? ` (AWB ${awbCode})` : ''}.`,
      type: 'shipping',
      orderId: order.id,
    });
    return shipment;
  }

  /**
   * Shiprocket webhook: verifies the x-api-key token, then maps the
   * courier status onto the order flow. Idempotent — a webhook that
   * repeats the current status changes nothing.
   */
  async handleWebhook(headers: Record<string, unknown>, body: Record<string, unknown>) {
    const expected = this.config.get<string>('SHIPROCKET_WEBHOOK_TOKEN');
    if (!expected) {
      throw new ServiceUnavailableException(
        'Shiprocket webhook is not configured (SHIPROCKET_WEBHOOK_TOKEN missing).',
      );
    }
    const provided =
      (headers['x-api-key'] as string) ?? (headers['x_api_key'] as string);
    if (provided !== expected) {
      throw new BadRequestException('Invalid Shiprocket webhook token.');
    }

    const awb =
      typeof body.awb === 'string'
        ? body.awb
        : typeof body.awb_code === 'string'
          ? body.awb_code
          : null;
    const currentStatus =
      typeof body.current_status === 'string' ? body.current_status : null;
    if (!awb || !currentStatus) return { received: true };

    const shipment = await this.shipments.findOne({
      where: { awbCode: awb },
      relations: { order: true },
    });
    if (!shipment) return { received: true };
    if (shipment.currentStatus === currentStatus) return { received: true };

    shipment.currentStatus = currentStatus;
    await this.shipments.save(shipment);

    const mapped = mapShiprocketStatus(currentStatus);
    const order = shipment.order;
    if (mapped && order && order.status !== mapped) {
      order.status = mapped;
      await this.shipments.manager.getRepository(Order).save(order);
      await this.history.save(
        this.history.create({
          orderId: order.id,
          status: mapped,
          changedBy: 'webhook',
          adminId: null,
          note: `Courier update: ${currentStatus}`,
        }),
      );
      await this.notifications.notify({
        userId: order.userId,
        title:
          mapped === OrderStatus.Delivered
            ? 'Order delivered'
            : 'Order update',
        body: `Your order ${order.orderNo}: ${currentStatus}.`,
        type: 'shipping',
        orderId: order.id,
      });
    }
    return { received: true };
  }
}

function mapShiprocketStatus(status: string): string | null {
  const s = status.toLowerCase();
  if (s.includes('delivered') && !s.includes('out')) return OrderStatus.Delivered;
  if (s.includes('out for delivery')) return OrderStatus.OutForDelivery;
  if (s.includes('shipped') || s.includes('in transit') || s.includes('picked')) {
    return OrderStatus.Shipped;
  }
  return null;
}
