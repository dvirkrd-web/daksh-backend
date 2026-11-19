import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Extension table beyond the 15 in docs/DATABASE_SCHEMA.md: OTP codes
 * cannot live in any of those tables. Codes are stored HASHED
 * (SHA-256 of mobile + code + JWT secret), expire in 5 minutes, allow a
 * limited number of attempts, and are single-use.
 */
@Entity('otp_codes')
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Normalised +91XXXXXXXXXX mobile. */
  @Column({ type: 'varchar', length: 15 })
  mobile: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 128 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'boolean', default: false })
  consumed: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
