import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Mobile number, stored normalised as +91XXXXXXXXXX. Unique.
   * Nullable: Google Sign-In accounts are created with email only —
   * the mobile is collected later, at order time.
   */
  @Column({ type: 'varchar', length: 15, unique: true, nullable: true })
  mobile: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  /**
   * Extension beyond docs/DATABASE_SCHEMA.md: FCM device token, required
   * for Firebase push notifications to reach the customer's phone.
   * Set by the app via PATCH /me after login.
   */
  @Column({ name: 'fcm_token', type: 'varchar', length: 512, nullable: true })
  fcmToken: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
