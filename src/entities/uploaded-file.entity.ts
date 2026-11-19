import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { User } from './user.entity';

@Entity('uploaded_files')
export class UploadedFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Nullable until the file is attached to an order item: uploads are
   * confirmed (POST /uploads/confirm) before the order exists, and the
   * link is made when the order draft is created.
   */
  @Column({ name: 'order_item_id', type: 'uuid', nullable: true })
  orderItemId: string | null;

  @ManyToOne(() => OrderItem, (item) => item.files, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Private object-storage key. Never a public URL. */
  @Column({ name: 'storage_key', type: 'varchar', length: 512, unique: true })
  storageKey: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  /**
   * Full MIME type as sent by the app (image/jpeg | image/png |
   * application/pdf). NOTE: docs/DATABASE_SCHEMA.md abbreviates these as
   * jpg/png/pdf; the app contract (UploadedFile.mimeForExtension) uses
   * full MIME types, and the app wins.
   */
  @Column({ name: 'mime_type', type: 'varchar', length: 80 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: number;

  /** front | back | null (PVC cards). */
  @Column({ type: 'varchar', length: 10, nullable: true })
  side: string | null;

  /** When the stored object should be auto-deleted (retention policy). */
  @Column({ name: 'retention_delete_at', type: 'timestamptz', nullable: true })
  retentionDeleteAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
