import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { ProductPrice } from './product-price.entity';
import { Product } from './product.entity';
import { UploadedFile } from './uploaded-file.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'price_id', type: 'uuid', nullable: true })
  priceId: string | null;

  @ManyToOne(() => ProductPrice, { nullable: true })
  @JoinColumn({ name: 'price_id' })
  price: ProductPrice | null;

  @Column({ type: 'int' })
  qty: number;

  /** Unit price in paise, copied from product_prices at order time. */
  @Column({ name: 'unit_price_paise', type: 'int' })
  unitPricePaise: number;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  options: Record<string, unknown>;

  @OneToMany(() => UploadedFile, (file) => file.orderItem)
  files: UploadedFile[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
