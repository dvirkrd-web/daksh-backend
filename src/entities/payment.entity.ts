import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 30, default: 'razorpay' })
  gateway: string;

  @Column({ name: 'gateway_order_id', type: 'varchar', length: 80 })
  gatewayOrderId: string;

  @Column({
    name: 'gateway_payment_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  gatewayPaymentId: string | null;

  @Column({ name: 'amount_paise', type: 'int' })
  amountPaise: number;

  /** upi | card | netbanking | wallet — from the gateway, never the app. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  method: string | null;

  /** created | authorized | captured | failed | refunded */
  @Column({ type: 'varchar', length: 20, default: 'created' })
  status: string;

  @Column({ name: 'signature_verified', type: 'boolean', default: false })
  signatureVerified: boolean;

  @Column({ name: 'webhook_payload', type: 'jsonb', nullable: true })
  webhookPayload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
