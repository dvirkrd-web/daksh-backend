import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ADMIN_TRANSITIONS,
  ORDER_STATUS_LABELS,
  OrderStatus,
} from '../../common/order-status';
import { serializeOrder, serializeTicket } from '../../common/serializers';
import { Order } from '../../entities/order.entity';
import { OrderStatusHistory } from '../../entities/order-status-history.entity';
import { Payment } from '../../entities/payment.entity';
import { SupportTicket } from '../../entities/support-ticket.entity';
import { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { ShiprocketService } from '../shipping/shiprocket.service';
import { StorageService } from '../storage/storage.service';

export interface AdminOrderQuery {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(OrderStatusHistory)
    private readonly history: Repository<OrderStatusHistory>,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly shiprocket: ShiprocketService,
  ) {}

  // ---------------- Dashboard ----------------

  async dashboard() {
    const statusRows: Array<{ status: string; count: string }> =
      await this.dataSource.query(
        `SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`,
      );
    const counts: Record<string, number> = {};
    let totalOrders = 0;
    for (const row of statusRows) {
      counts[row.status] = Number(row.count);
      if (row.status !== OrderStatus.PendingPayment) {
        totalOrders += Number(row.count);
      }
    }
    const salesRows: Array<{
      total: string;
      today: string;
      month: string;
      delivery: string;
    }> = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(total_paise), 0) AS total,
        COALESCE(SUM(total_paise) FILTER (WHERE created_at >= date_trunc('day', now())), 0) AS today,
        COALESCE(SUM(total_paise) FILTER (WHERE created_at >= date_trunc('month', now())), 0) AS month,
        COALESCE(SUM(delivery_paise), 0) AS delivery
      FROM orders
      WHERE status NOT IN ('cancelled', 'pending_payment')
    `);
    const s = salesRows[0];
    return {
      total_orders: totalOrders,
      new_orders: counts[OrderStatus.Received] ?? 0,
      pending_orders:
        (counts[OrderStatus.Received] ?? 0) +
        (counts[OrderStatus.Verification] ?? 0),
      printing_orders: counts[OrderStatus.Printing] ?? 0,
      shipped_orders: counts[OrderStatus.Shipped] ?? 0,
      delivered_orders: counts[OrderStatus.Delivered] ?? 0,
      counts_by_status: counts,
      total_sales_paise: Number(s.total),
      sales_today_paise: Number(s.today),
      sales_month_paise: Number(s.month),
      delivery_collected_paise: Number(s.delivery),
    };
  }

  // ---------------- Orders ----------------

  async listOrders(query: AdminOrderQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u')
      .leftJoinAndSelect('o.items', 'i')
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('o.status = :status', { status: query.status });
    } else {
      // Unpaid drafts are not real orders yet; hidden by default.
      qb.andWhere('o.status != :pp', { pp: OrderStatus.PendingPayment });
    }
    if (query.search) {
      const term = `%${query.search}%`;
      qb.andWhere(
        '(o.orderNo ILIKE :term OR u.name ILIKE :term OR u.mobile ILIKE :term)',
        { term },
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((o) => ({
        id: o.id,
        order_no: o.orderNo,
        status: o.status,
        subtotal_paise: o.subtotalPaise,
        delivery_paise: o.deliveryPaise,
        discount_paise: o.discountPaise,
        total_paise: o.totalPaise,
        item_count: (o.items ?? []).reduce((sum, i) => sum + i.qty, 0),
        customer: o.user
          ? { id: o.user.id, name: o.user.name, mobile: o.user.mobile }
          : null,
        created_at: o.createdAt ? o.createdAt.toISOString() : null,
      })),
      total,
      page,
      limit,
    };
  }

  /** Full order detail; every file carries a time-limited signed download URL. */
  async getOrderDetail(id: string) {
    const order = await this.ordersService.loadFullOrder(id);
    const json = serializeOrder(order, { admin: true }) as Record<
      string,
      unknown
    > & {
      items: Array<{ files: Array<Record<string, unknown>> }>;
    };

    const storageReady = this.storage.isConfigured();
    for (const item of json.items ?? []) {
      for (const file of item.files ?? []) {
        file.signed_url = storageReady
          ? await this.storage.presignGet(String(file.storage_key))
          : null;
        file.download_available = storageReady;
      }
    }

    // UPI payments may carry a payment-screenshot proof: expose its key
    // plus a time-limited signed URL, the same pattern as order files.
    const paymentRows = await Promise.all(
      (order.payments ?? []).map(async (p) => ({
        id: p.id,
        gateway: p.gateway,
        gateway_order_id: p.gatewayOrderId,
        gateway_payment_id: p.gatewayPaymentId,
        screenshot_key: p.screenshotKey,
        screenshot_url:
          p.screenshotKey && storageReady
            ? await this.storage.presignGet(p.screenshotKey)
            : null,
        amount_paise: p.amountPaise,
        method: p.method,
        status: p.status,
        signature_verified: p.signatureVerified,
        created_at: p.createdAt ? p.createdAt.toISOString() : null,
      })),
    );

    return {
      ...json,
      customer: order.user
        ? {
            id: order.user.id,
            name: order.user.name,
            mobile: order.user.mobile,
            email: order.user.email,
          }
        : null,
      payments: paymentRows,
    };
  }

  async updateStatus(
    adminId: string,
    id: string,
    newStatus: string,
    note: string | undefined,
    ip?: string,
  ) {
    const order = await this.ordersService.loadFullOrder(id);
    const allowed = ADMIN_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Order ${order.orderNo} is "${ORDER_STATUS_LABELS[order.status] ?? order.status}" and cannot move directly to "${ORDER_STATUS_LABELS[newStatus] ?? newStatus}". Allowed next: ${allowed.map((s) => ORDER_STATUS_LABELS[s] ?? s).join(', ') || 'none'}.`,
      );
    }
    const from = order.status;
    order.status = newStatus;
    await this.orders.save(order);
    await this.history.save(
      this.history.create({
        orderId: order.id,
        status: newStatus,
        changedBy: 'admin',
        adminId,
        note: note ?? null,
      }),
    );
    await this.audit.record({
      adminId,
      action: 'order.status_update',
      entity: 'order',
      entityId: order.id,
      ipAddress: ip ?? null,
      details: { from, to: newStatus, order_no: order.orderNo },
    });
    await this.notifications.notify({
      userId: order.userId,
      title: `Order ${ORDER_STATUS_LABELS[newStatus] ?? newStatus}`,
      body: `Your order ${order.orderNo} is now: ${ORDER_STATUS_LABELS[newStatus] ?? newStatus}.`,
      type:
        newStatus === OrderStatus.Shipped ||
        newStatus === OrderStatus.OutForDelivery ||
        newStatus === OrderStatus.Delivered
          ? 'shipping'
          : 'order',
      orderId: order.id,
    });
    return this.getOrderDetail(order.id);
  }

  // ---------------- UPI (manual) payment verification ----------------

  /**
   * Finds the UPI payment row awaiting verification on a pending_payment
   * order. Deliberately NOT done through the generic status endpoint:
   * pending_payment has no ADMIN_TRANSITIONS on purpose, so a Razorpay
   * order that was never paid can never be flipped to received by hand.
   */
  private async loadPendingUpiPayment(order: Order) {
    if (order.status !== OrderStatus.PendingPayment) {
      throw new BadRequestException(
        `Order ${order.orderNo} is "${ORDER_STATUS_LABELS[order.status] ?? order.status}" — only orders awaiting payment can have a UPI payment verified or rejected.`,
      );
    }
    const payment = (order.payments ?? []).find(
      (p) => p.method === 'upi' && p.status === 'created',
    );
    if (!payment) {
      throw new BadRequestException(
        `Order ${order.orderNo} has no UPI payment awaiting verification.`,
      );
    }
    return payment;
  }

  /**
   * Human-readable label for the proof a UPI customer submitted — the
   * UTR when they typed one, otherwise the payment screenshot. Used in
   * history notes, audit details and customer notifications so a
   * screenshot-only payment never reads as "UTR null".
   */
  private upiProofLabel(payment: Payment): string {
    if (payment.gatewayPaymentId) return `UTR ${payment.gatewayPaymentId}`;
    if (payment.screenshotKey) return 'payment screenshot';
    return 'no proof recorded';
  }

  /**
   * Admin verified the payment proof (UTR or screenshot) against the
   * business UPI/bank account. The payment is marked captured and the
   * order becomes a real order (`received`), exactly like a verified
   * Razorpay payment.
   */
  async verifyUpiPayment(adminId: string, id: string, ip?: string) {
    const order = await this.ordersService.loadFullOrder(id);
    const payment = await this.loadPendingUpiPayment(order);
    payment.status = 'captured';
    await this.payments.save(payment);
    await this.audit.record({
      adminId,
      action: 'order.upi_payment_verified',
      entity: 'order',
      entityId: order.id,
      ipAddress: ip ?? null,
      details: {
        order_no: order.orderNo,
        utr: payment.gatewayPaymentId,
        proof: payment.gatewayPaymentId ? 'utr' : 'screenshot',
      },
    });
    await this.ordersService.confirmOrderPaid(
      order.id,
      'system',
      `UPI payment verified by admin (${this.upiProofLabel(payment)}).`,
    );
    return this.getOrderDetail(order.id);
  }

  /**
   * Admin could NOT match the payment proof (UTR or screenshot) in the
   * business account. The payment is marked failed and the order is
   * cancelled — the customer is notified and can contact support if
   * money was actually deducted.
   */
  async rejectUpiPayment(adminId: string, id: string, ip?: string) {
    const order = await this.ordersService.loadFullOrder(id);
    const payment = await this.loadPendingUpiPayment(order);
    const proofLabel = this.upiProofLabel(payment);
    payment.status = 'failed';
    await this.payments.save(payment);
    order.status = OrderStatus.Cancelled;
    await this.orders.save(order);
    await this.history.save(
      this.history.create({
        orderId: order.id,
        status: OrderStatus.Cancelled,
        changedBy: 'admin',
        adminId,
        note: `UPI payment rejected by admin — ${proofLabel} could not be verified in the business account.`,
      }),
    );
    await this.audit.record({
      adminId,
      action: 'order.upi_payment_rejected',
      entity: 'order',
      entityId: order.id,
      ipAddress: ip ?? null,
      details: {
        order_no: order.orderNo,
        utr: payment.gatewayPaymentId,
        proof: payment.gatewayPaymentId ? 'utr' : 'screenshot',
      },
    });
    await this.notifications.notify({
      userId: order.userId,
      title: 'Payment not verified',
      body: `Your payment for order ${order.orderNo} could not be verified (${proofLabel}). The order was cancelled — please contact support if the money was deducted from your account.`,
      type: 'payment',
      orderId: order.id,
    });
    return this.getOrderDetail(order.id);
  }

  async addNote(adminId: string, id: string, note: string, ip?: string) {
    const order = await this.ordersService.loadFullOrder(id);
    const stamp = new Date().toISOString();
    order.internalNote = order.internalNote
      ? `${order.internalNote}\n[${stamp}] ${note}`
      : `[${stamp}] ${note}`;
    await this.orders.save(order);
    await this.audit.record({
      adminId,
      action: 'order.note_added',
      entity: 'order',
      entityId: order.id,
      ipAddress: ip ?? null,
      details: { order_no: order.orderNo },
    });
    return this.getOrderDetail(order.id);
  }

  /** Creates the Shiprocket shipment + AWB for a packed order (Phase 6). */
  async shipOrder(adminId: string, id: string, ip?: string) {
    const order = await this.ordersService.loadFullOrder(id);
    if (
      order.status !== OrderStatus.Packed &&
      order.status !== OrderStatus.Shipped
    ) {
      throw new BadRequestException(
        'Only a Packed order can be dispatched. Mark the order Packed first.',
      );
    }
    const shipment = await this.shiprocket.createShipmentForOrder(order);
    if (order.status === OrderStatus.Packed) {
      order.status = OrderStatus.Shipped;
      await this.orders.save(order);
      await this.history.save(
        this.history.create({
          orderId: order.id,
          status: OrderStatus.Shipped,
          changedBy: 'admin',
          adminId,
          note: `Shipped via Shiprocket${shipment.awbCode ? `, AWB ${shipment.awbCode}` : ''}.`,
        }),
      );
    }
    await this.audit.record({
      adminId,
      action: 'order.shipped',
      entity: 'order',
      entityId: order.id,
      ipAddress: ip ?? null,
      details: { order_no: order.orderNo, awb: shipment.awbCode },
    });
    return this.getOrderDetail(order.id);
  }

  // ---------------- Customers ----------------

  async listCustomers(search?: string, page = 1, limit = 20) {
    const term = search ? `%${search}%` : null;
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `
      SELECT u.id, u.name, u.mobile, u.email, u.is_active, u.created_at,
             COUNT(o.id)::int AS order_count,
             COALESCE(SUM(o.total_paise) FILTER (WHERE o.status NOT IN ('cancelled','pending_payment')), 0) AS total_spent_paise
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      ${term ? 'WHERE u.name ILIKE $1 OR u.mobile ILIKE $1 OR u.email ILIKE $1' : ''}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `,
      term ? [term] : [],
    );
    const totalRows: Array<{ count: string }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM users`,
    );
    return {
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        mobile: r.mobile,
        email: r.email,
        is_active: r.is_active,
        order_count: Number(r.order_count),
        total_spent_paise: Number(r.total_spent_paise),
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : r.created_at,
      })),
      total: Number(totalRows[0].count),
      page,
      limit,
    };
  }

  async getCustomer(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Customer not found.');
    const orders = await this.orders.find({
      where: { userId: id },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
    return {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      is_active: user.isActive,
      last_login_at: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      created_at: user.createdAt ? user.createdAt.toISOString() : null,
      orders: orders
        .filter((o) => o.status !== OrderStatus.PendingPayment)
        .map((o) => ({
          id: o.id,
          order_no: o.orderNo,
          status: o.status,
          total_paise: o.totalPaise,
          item_count: (o.items ?? []).reduce((s, i) => s + i.qty, 0),
          created_at: o.createdAt ? o.createdAt.toISOString() : null,
        })),
    };
  }

  // ---------------- Reports ----------------

  /**
   * Sales reports. The profit figure is a labelled ESTIMATE:
   * sales − delivery collected − estimated gateway fee (2% of captured
   * payments). Printing/material costs are not in the database, so this
   * is not the true profit.
   */
  async salesReport() {
    const valid = `status NOT IN ('cancelled', 'pending_payment')`;
    const daily: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS orders, COALESCE(SUM(total_paise), 0) AS sales_paise
      FROM orders WHERE ${valid} AND created_at >= now() - interval '30 days'
      GROUP BY 1 ORDER BY 1
    `);
    const monthly: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
             COUNT(*)::int AS orders, COALESCE(SUM(total_paise), 0) AS sales_paise
      FROM orders WHERE ${valid} AND created_at >= now() - interval '12 months'
      GROUP BY 1 ORDER BY 1
    `);
    const productWise: Array<Record<string, unknown>> =
      await this.dataSource.query(`
      SELECT p.id AS product_id, p.name AS product_name,
             SUM(oi.qty)::int AS qty,
             SUM(oi.qty * oi.unit_price_paise) AS sales_paise
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE o.status NOT IN ('cancelled','pending_payment')
      GROUP BY p.id, p.name ORDER BY sales_paise DESC
    `);
    const totals: Array<{ sales: string; delivery: string }> =
      await this.dataSource.query(`
      SELECT COALESCE(SUM(total_paise), 0) AS sales,
             COALESCE(SUM(delivery_paise), 0) AS delivery
      FROM orders WHERE ${valid}
    `);
    const paymentRows: Array<Record<string, unknown>> =
      await this.dataSource.query(`
      SELECT status, COALESCE(method, 'unknown') AS method,
             COUNT(*)::int AS count, COALESCE(SUM(amount_paise), 0) AS amount_paise
      FROM payments GROUP BY status, COALESCE(method, 'unknown') ORDER BY status
    `);
    const captured: Array<{ amount: string }> = await this.dataSource.query(`
      SELECT COALESCE(SUM(amount_paise), 0) AS amount FROM payments WHERE status = 'captured'
    `);

    const sales = Number(totals[0].sales);
    const delivery = Number(totals[0].delivery);
    const capturedAmount = Number(captured[0].amount);
    // Razorpay's standard fee is ~2% + GST; 2% is used as the estimate
    // and labelled as such.
    const gatewayFeeEstimate = Math.round(capturedAmount * 0.02);

    return {
      daily: daily.map((r) => ({
        day: r.day,
        orders: Number(r.orders),
        sales_paise: Number(r.sales_paise),
      })),
      monthly: monthly.map((r) => ({
        month: r.month,
        orders: Number(r.orders),
        sales_paise: Number(r.sales_paise),
      })),
      product_wise: productWise.map((r) => ({
        product_id: r.product_id,
        product_name: r.product_name,
        qty: Number(r.qty),
        sales_paise: Number(r.sales_paise),
      })),
      delivery_collected_paise: delivery,
      payments: paymentRows.map((r) => ({
        status: r.status,
        method: r.method,
        count: Number(r.count),
        amount_paise: Number(r.amount_paise),
      })),
      profit_estimate: {
        is_estimate: true,
        note: 'Estimate only: sales − delivery collected − estimated payment gateway fee (2% of captured payments). Printing and material costs are not tracked in the system, so actual profit will be lower.',
        sales_paise: sales,
        delivery_paise: delivery,
        gateway_fee_estimate_paise: gatewayFeeEstimate,
        estimated_profit_paise: sales - delivery - gatewayFeeEstimate,
      },
    };
  }

  // ---------------- Support ----------------

  async listTickets(status?: string) {
    const rows = await this.tickets.find({
      where: status ? { status } : {},
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((t) => ({
      ...serializeTicket(t),
      customer: t.user
        ? { id: t.user.id, name: t.user.name, mobile: t.user.mobile }
        : null,
    }));
  }

  async replyTicket(
    adminId: string,
    id: string,
    reply: string,
    status: string | undefined,
    ip?: string,
  ) {
    const ticket = await this.tickets.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found.');
    ticket.adminReply = reply;
    ticket.status = status ?? 'replied';
    await this.tickets.save(ticket);
    await this.audit.record({
      adminId,
      action: 'support.reply',
      entity: 'support_ticket',
      entityId: ticket.id,
      ipAddress: ip ?? null,
    });
    await this.notifications.notify({
      userId: ticket.userId,
      title: 'Support reply',
      body: `We replied to your support request: "${ticket.subject}".`,
      type: 'order',
      orderId: ticket.orderId,
    });
    return {
      ...serializeTicket(ticket),
      customer: ticket.user
        ? { id: ticket.user.id, name: ticket.user.name, mobile: ticket.user.mobile }
        : null,
    };
  }
}
