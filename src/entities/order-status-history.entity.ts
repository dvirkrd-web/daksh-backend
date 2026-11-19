import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';
import { Order } from './order.entity';

@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 30 })
  status: string;

  /** user | admin | system | webhook */
  @Column({ name: 'changed_by', type: 'varchar', length: 20 })
  changedBy: string;

  @Column({ name: 'admin_id', type: 'uuid', nullable: true })
  adminId: string | null;

  @ManyToOne(() => AdminUser, { nullable: true })
  @JoinColumn({ name: 'admin_id' })
  admin: AdminUser | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
