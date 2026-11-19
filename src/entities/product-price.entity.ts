import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_prices')
export class ProductPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.prices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'option_label', type: 'varchar', length: 160 })
  optionLabel: string;

  /** Integer paise. */
  @Column({ name: 'price_paise', type: 'int' })
  pricePaise: number;

  /** Integer paise, charged once per order line (not per unit). */
  @Column({ name: 'delivery_charge_paise', type: 'int', default: 0 })
  deliveryChargePaise: number;

  @Column({ name: 'min_qty', type: 'int', default: 1 })
  minQty: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
