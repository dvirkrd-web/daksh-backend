import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';

export interface PushSender {
  isConfigured(): boolean;
  sendToToken(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean>;
}

/**
 * Firebase Cloud Messaging sender. Initialises firebase-admin lazily,
 * only when FIREBASE_PROJECT_ID + FIREBASE_SERVICE_ACCOUNT_JSON are set
 * (the env value is either the service-account JSON itself or a path to
 * the JSON file on the server). When Firebase is not configured,
 * isConfigured() is false and NotificationsService records notifications
 * in the database only — no push is sent and none is claimed.
 */
@Injectable()
export class FirebasePushSender implements PushSender {
  private readonly logger = new Logger(FirebasePushSender.name);
  private app: unknown = null;
  private initFailed = false;

  constructor(private readonly config: ConfigService<AppConfiguration>) {}

  isConfigured(): boolean {
    const f = this.config.get('firebase', { infer: true })!;
    return !!(f.projectId && f.serviceAccountJson);
  }

  private getApp(): unknown {
    if (this.app || this.initFailed) return this.app;
    try {
      // Lazy require so the package is only touched when configured.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const admin = require('firebase-admin');
      const f = this.config.get('firebase', { infer: true })!;
      const raw = f.serviceAccountJson as string;
      let credentialJson: Record<string, unknown>;
      if (raw.trim().startsWith('{')) {
        credentialJson = JSON.parse(raw) as Record<string, unknown>;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        credentialJson = JSON.parse(fs.readFileSync(raw, 'utf8')) as Record<
          string,
          unknown
        >;
      }
      this.app = admin.initializeApp({
        credential: admin.credential.cert(credentialJson),
        projectId: f.projectId as string,
      });
    } catch (err) {
      this.initFailed = true;
      this.logger.error(
        `Firebase init failed; push notifications disabled. ${(err as Error).message}`,
      );
      this.app = null;
    }
    return this.app;
  }

  async sendToToken(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const app = this.getApp() as {
      messaging: () => {
        send: (msg: Record<string, unknown>) => Promise<string>;
      };
    } | null;
    if (!app) return false;
    try {
      await app.messaging().send({
        token,
        notification: { title, body },
        data: data ?? {},
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `FCM send failed: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
