import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  code: string;

  /** type: percent | flat */
  @Column({ type: 'varchar', length: 10 })
  type: string;

  /** percent → percentage points (10 = 10%); flat → paise. */
  @Column({ type: 'int' })
  value: number;

  @Column({ name: 'min_order_paise', type: 'int', default: 0 })
  minOrderPaise: number;

  @Column({ name: 'max_discount_paise', type: 'int', nullable: true })
  maxDiscountPaise: number | null;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true })
  validTo: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
