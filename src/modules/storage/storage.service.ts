import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfiguration } from '../../config/configuration';

/**
 * Private S3-compatible object storage for customer files.
 *
 * No credentials are baked into code: bucket/keys come from the STORAGE_*
 * env vars. When they are missing, every operation fails with a clear
 * 503 "storage not configured" — a fake URL is never handed out, because
 * the app would upload into the void and the order would lose its files.
 */
@Injectable()
export class StorageService {
  private client: S3Client | null = null;
  private bucketReady: Promise<void> | null = null;

  constructor(private readonly config: ConfigService<AppConfiguration>) {}

  isConfigured(): boolean {
    const s = this.config.get('storage', { infer: true })!;
    return !!(s.bucket && s.accessKey && s.secretKey);
  }

  private requireConfig() {
    const s = this.config.get('storage', { infer: true })!;
    if (!s.bucket || !s.accessKey || !s.secretKey) {
      throw new ServiceUnavailableException(
        'File storage is not configured on the server. Please contact support.',
      );
    }
    return s;
  }

  private getClient(): S3Client {
    const s = this.requireConfig();
    if (!this.client) {
      this.client = new S3Client({
        region: s.region ?? 'ap-south-1',
        endpoint: s.endpoint ?? undefined,
        credentials: {
          accessKeyId: s.accessKey as string,
          secretAccessKey: s.secretKey as string,
        },
        forcePathStyle: !!s.endpoint,
      });
    }
    return this.client;
  }

  /**
   * Creates the bucket on first use if it does not exist yet, so setup
   * never depends on someone creating it by hand in a storage console.
   * The result is cached; a failure clears the cache so the next call
   * retries instead of failing forever.
   */
  private async ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = this.createBucketIfMissing().catch((err) => {
        this.bucketReady = null;
        throw err;
      });
    }
    return this.bucketReady;
  }

  private async createBucketIfMissing(): Promise<void> {
    const s = this.requireConfig();
    const client = this.getClient();
    const bucket = s.bucket as string;
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return; // bucket already exists
    } catch {
      // Missing (or not visible) — try to create it below.
    }
    const input: {
      Bucket: string;
      CreateBucketConfiguration?: { LocationConstraint: string };
    } = { Bucket: bucket };
    if (s.region && s.region !== 'us-east-1') {
      input.CreateBucketConfiguration = { LocationConstraint: s.region };
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.send(new CreateBucketCommand(input as any));
    } catch (err) {
      const name = (err as { name?: string })?.name ?? '';
      if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') {
        throw err;
      }
    }
  }

  /** Signed PUT URL the app uploads one file to (15 min default). */
  async presignPut(storageKey: string, mimeType: string): Promise<string> {
    const s = this.requireConfig();
    await this.ensureBucket();
    const expiry =
      (this.config.get('signedUrlExpiryMinutes', { infer: true }) ?? 15) * 60;
    return getSignedUrl(
      this.getClient(),
      new PutObjectCommand({
        Bucket: s.bucket as string,
        Key: storageKey,
        ContentType: mimeType,
      }),
      { expiresIn: expiry },
    );
  }

  /** Signed GET URL for admin downloads — time-limited by design. */
  async presignGet(storageKey: string): Promise<string> {
    const s = this.requireConfig();
    await this.ensureBucket();
    const expiry =
      (this.config.get('signedUrlExpiryMinutes', { infer: true }) ?? 15) * 60;
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: s.bucket as string, Key: storageKey }),
      { expiresIn: expiry },
    );
  }
}
