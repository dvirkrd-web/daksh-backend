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
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** order | payment | shipping | promo */
  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  /**
   * 'fcm' only when the push was actually dispatched through Firebase.
   * When Firebase is not configured the row is still recorded (in-app
   * notification centre) and sentVia stays null — the push was NOT sent
   * and nothing in this system claims otherwise.
   */
  @Column({ name: 'sent_via', type: 'varchar', length: 20, nullable: true })
  sentVia: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
