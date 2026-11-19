import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AppConfiguration } from '../../config/configuration';
import { UploadedFile } from '../../entities/uploaded-file.entity';
import { StorageService } from '../storage/storage.service';
import { ConfirmUploadDto, PresignDto } from './dto/upload.dto';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

/**
 * Upload flow: presign (signed PUT URL for private storage) → the app
 * uploads bytes directly → confirm (creates the uploaded_files row).
 * Storage keys are namespaced per user (uploads/<userId>/…) and confirm
 * rejects keys outside the caller's namespace, so one customer can never
 * attach another customer's file to an order.
 */
@Injectable()
export class UploadsService {
  constructor(
    @InjectRepository(UploadedFile)
    private readonly files: Repository<UploadedFile>,
    private readonly storage: StorageService,
    private readonly config: ConfigService<AppConfiguration>,
  ) {}

  async presign(userId: string, dto: PresignDto) {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'File storage is not configured on the server. Please contact support.',
      );
    }
    const ext = EXTENSION_BY_MIME[dto.mime_type];
    const storageKey = `uploads/${userId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.storage.presignPut(storageKey, dto.mime_type);
    const expiresIn =
      (this.config.get('signedUrlExpiryMinutes', { infer: true }) ?? 15) * 60;
    return {
      upload_url: uploadUrl,
      storage_key: storageKey,
      expires_in_seconds: expiresIn,
    };
  }

  async confirm(userId: string, dto: ConfirmUploadDto): Promise<UploadedFile> {
    if (!dto.storage_key.startsWith(`uploads/${userId}/`)) {
      throw new BadRequestException('Invalid storage key for this account.');
    }
    const existing = await this.files.findOne({
      where: { storageKey: dto.storage_key },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new BadRequestException('Invalid storage key for this account.');
      }
      return existing; // idempotent re-confirm
    }
    const retentionDays =
      this.config.get('fileRetentionDays', { infer: true }) ?? 30;
    const retentionDeleteAt = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1000,
    );
    return this.files.save(
      this.files.create({
        userId,
        storageKey: dto.storage_key,
        originalName: dto.original_name,
        mimeType: dto.mime_type,
        sizeBytes: dto.size_bytes,
        side: dto.side ?? null,
        orderItemId: null,
        retentionDeleteAt,
      }),
    );
  }

  findById(id: string): Promise<UploadedFile | null> {
    return this.files.findOne({ where: { id } });
  }

  findByStorageKey(storageKey: string): Promise<UploadedFile | null> {
    return this.files.findOne({ where: { storageKey } });
  }
}
