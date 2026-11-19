import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName: string;

  @Column({ type: 'varchar', length: 15 })
  mobile: string;

  @Column({ name: 'house_no', type: 'varchar', length: 120 })
  houseNo: string;

  @Column({ type: 'varchar', length: 200 })
  street: string;

  @Column({ name: 'village_city', type: 'varchar', length: 120 })
  villageCity: string;

  @Column({ type: 'varchar', length: 120 })
  district: string;

  @Column({ type: 'varchar', length: 120 })
  state: string;

  @Column({ name: 'pin_code', type: 'varchar', length: 6 })
  pinCode: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
