import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Address } from './address.entity';
import { Coupon } from './coupon.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatusHistory } from './order-status-history.entity';
import { Payment } from './payment.entity';
import { Shipment } from './shipment.entity';
import { User } from './user.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** DAKSH-1001, DAKSH-1002, … from the order_no_seq sequence. */
  @Column({ name: 'order_no', type: 'varchar', length: 30, unique: true })
  orderNo: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'address_id', type: 'uuid' })
  addressId: string;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'address_id' })
  address: Address;

  /**
   * received | verification | printing | packed | shipped |
   * out_for_delivery | delivered | cancelled, plus the internal
   * pre-payment state pending_payment (see common/order-status.ts).
   */
  @Column({ type: 'varchar', length: 30, default: 'pending_payment' })
  status: string;

  @Column({ name: 'subtotal_paise', type: 'int' })
  subtotalPaise: number;

  @Column({ name: 'delivery_paise', type: 'int', default: 0 })
  deliveryPaise: number;

  @Column({ name: 'discount_paise', type: 'int', default: 0 })
  discountPaise: number;

  @Column({ name: 'total_paise', type: 'int' })
  totalPaise: number;

  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId: string | null;

  @ManyToOne(() => Coupon, { nullable: true })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon | null;

  @Column({ name: 'customer_note', type: 'text', nullable: true })
  customerNote: string | null;

  @Column({ name: 'internal_note', type: 'text', nullable: true })
  internalNote: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => Payment, (payment) => payment.order)
  payments: Payment[];

  @OneToMany(() => OrderStatusHistory, (entry) => entry.order)
  statusHistory: OrderStatusHistory[];

  @OneToOne(() => Shipment, (shipment) => shipment.order, { nullable: true })
  shipment: Shipment | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
