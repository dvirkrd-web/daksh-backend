import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CUSTOMER_CANCELLABLE,
  OrderStatus,
} from '../../common/order-status';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { OrderStatusHistory } from '../../entities/order-status-history.entity';
import { UploadedFile } from '../../entities/uploaded-file.entity';
import { AddressesService } from '../addresses/addresses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto, QuoteDto } from './dto/order.dto';
import { PricingService, QuoteResult } from './pricing.service';

export const ORDER_RELATIONS = {
  items: { product: true, price: true, files: true },
  statusHistory: true,
  shipment: true,
  address: true,
  user: true,
  payments: true,
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(OrderStatusHistory)
    private readonly history: Repository<OrderStatusHistory>,
    @InjectRepository(UploadedFile)
    private readonly files: Repository<UploadedFile>,
    private readonly dataSource: DataSource,
    private readonly pricing: PricingService,
    private readonly addresses: AddressesService,
    private readonly notifications: NotificationsService,
  ) {}

  quote(dto: QuoteDto): Promise<QuoteResult> {
    return this.pricing.computeQuote(
      dto.items,
      dto.coupon ?? dto.coupon_code ?? null,
    );
  }

  /**
   * Creates the order row in `pending_payment` state together with its
   * items and file links. The order becomes a real order (`received`)
   * only when PaymentsService confirms a verified payment.
   */
  async createDraftOrder(userId: string, dto: CreateOrderDto): Promise<Order> {
    const address = await this.addresses.findOwned(userId, dto.address_id);
    const quote = await this.pricing.computeQuote(
      dto.items,
      dto.coupon_code ?? dto.coupon ?? null,
    );

    const seqRows: Array<{ nextval: string }> = await this.dataSource.query(
      `SELECT nextval('order_no_seq') AS nextval`,
    );
    const orderNo = `DAKSH-${seqRows[0].nextval}`;

    const order = this.orders.create({
      orderNo,
      userId,
      addressId: address.id,
      status: OrderStatus.PendingPayment,
      subtotalPaise: quote.subtotalPaise,
      deliveryPaise: quote.deliveryPaise,
      discountPaise: quote.discountPaise,
      totalPaise: quote.totalPaise,
      couponId: quote.coupon ? quote.coupon.id : null,
      customerNote: dto.customer_note ?? null,
      internalNote: null,
      items: quote.lines.map((line) =>
        Object.assign(new OrderItem(), {
          productId: line.product.id,
          priceId: line.price.id,
          qty: line.qty,
          unitPricePaise: line.price.pricePaise,
          options: line.options,
        }),
      ),
    });
    const saved = await this.orders.save(order);

    // Link the already-confirmed uploads to their order items. Files must
    // belong to this customer and must not already be attached elsewhere.
    for (let i = 0; i < quote.lines.length; i++) {
      const savedItem = saved.items[i];
      for (const ref of quote.lines[i].files) {
        const file = ref.id
          ? await this.files.findOne({ where: { id: ref.id } })
          : ref.storage_key
            ? await this.files.findOne({
                where: { storageKey: ref.storage_key },
              })
            : null;
        if (!file) {
          throw new BadRequestException(
            'One of the uploaded files was not found. Please upload it again.',
          );
        }
        if (file.userId !== userId) {
          throw new BadRequestException(
            'One of the uploaded files does not belong to your account.',
          );
        }
        if (file.orderItemId && file.orderItemId !== savedItem.id) {
          throw new BadRequestException(
            'One of the uploaded files is already used in another order.',
          );
        }
        file.orderItemId = savedItem.id;
        await this.files.save(file);
      }
    }

    return this.loadFullOrder(saved.id);
  }

  async loadFullOrder(id: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id },
      relations: ORDER_RELATIONS,
    });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }

  /** Customer order list — unpaid drafts (pending_payment) are hidden. */
  listForUser(userId: string): Promise<Order[]> {
    return this.orders.find({
      where: { userId },
      relations: ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
    }).then((rows) =>
      rows.filter((o) => o.status !== OrderStatus.PendingPayment),
    );
  }

  async getForUser(userId: string, id: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id, userId },
      relations: ORDER_RELATIONS,
    });
    if (!order || order.status === OrderStatus.PendingPayment) {
      throw new NotFoundException('Order not found.');
    }
    return order;
  }

  /**
   * Called by PaymentsService after a payment is cryptographically
   * verified (checkout signature or webhook). Idempotent: confirming an
   * already-confirmed order is a no-op.
   */
  async confirmOrderPaid(
    orderId: string,
    changedBy: 'system' | 'webhook',
    note: string,
  ): Promise<Order> {
    const order = await this.loadFullOrder(orderId);
    if (order.status !== OrderStatus.PendingPayment) {
      return order;
    }
    order.status = OrderStatus.Received;
    await this.orders.save(order);
    await this.history.save(
      this.history.create({
        orderId: order.id,
        status: OrderStatus.Received,
        changedBy,
        adminId: null,
        note,
      }),
    );
    await this.notifications.notify({
      userId: order.userId,
      title: 'Order confirmed',
      body: `Your order ${order.orderNo} is confirmed and has been received. We will start work on it shortly.`,
      type: 'payment',
      orderId: order.id,
    });
    return this.loadFullOrder(order.id);
  }

  /** Customer cancellation — allowed only before printing starts. */
  async cancelByCustomer(
    userId: string,
    id: string,
    reason?: string,
  ): Promise<Order> {
    const order = await this.getForUser(userId, id);
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw new BadRequestException(
        'This order can no longer be cancelled because printing has already started. Please contact support for help.',
      );
    }
    order.status = OrderStatus.Cancelled;
    await this.orders.save(order);
    await this.history.save(
      this.history.create({
        orderId: order.id,
        status: OrderStatus.Cancelled,
        changedBy: 'user',
        adminId: null,
        note: reason ?? 'Cancelled by customer.',
      }),
    );
    await this.notifications.notify({
      userId: order.userId,
      title: 'Order cancelled',
      body: `Your order ${order.orderNo} has been cancelled. If a payment was taken, the refund will be processed to the original payment method.`,
      type: 'order',
      orderId: order.id,
    });
    return this.loadFullOrder(order.id);
  }
}
