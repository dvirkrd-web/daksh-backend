import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid', unique: true })
  orderId: string;

  @OneToOne(() => Order, (order) => order.shipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 30, default: 'shiprocket' })
  provider: string;

  @Column({
    name: 'shiprocket_order_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  shiprocketOrderId: string | null;

  @Column({ name: 'shipment_id', type: 'varchar', length: 80, nullable: true })
  shipmentId: string | null;

  @Column({ name: 'awb_code', type: 'varchar', length: 80, nullable: true })
  awbCode: string | null;

  @Column({ name: 'courier_name', type: 'varchar', length: 120, nullable: true })
  courierName: string | null;

  @Column({ name: 'pickup_status', type: 'varchar', length: 60, nullable: true })
  pickupStatus: string | null;

  @Column({ name: 'tracking_url', type: 'varchar', length: 512, nullable: true })
  trackingUrl: string | null;

  @Column({
    name: 'current_status',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  currentStatus: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  etd: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
