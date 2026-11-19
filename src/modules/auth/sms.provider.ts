import { Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * SMS delivery for OTPs. The backend never invents SMS credentials:
 * a real provider is plugged in here once the owner has an account.
 */
export interface SmsProvider {
  readonly name: string;
  sendOtp(mobile: string, otp: string): Promise<void>;
}

/**
 * Development provider — logs the OTP to the server console.
 * ONLY used when OTP_DEV_MODE=true in .env. Never enable in production:
 * anyone with server-log access could read login codes.
 */
export class DevConsoleSmsProvider implements SmsProvider {
  readonly name = 'dev-console';
  private readonly logger = new Logger('DevConsoleSmsProvider');

  async sendOtp(mobile: string, otp: string): Promise<void> {
    this.logger.warn(
      `[OTP_DEV_MODE] OTP for ${mobile} is ${otp} — dev mode only, never enable in production.`,
    );
  }
}

/**
 * Production provider slot (MSG91 / Twilio / Fast2SMS).
 *
 * TODO(owner): create an account with an SMS provider, add its API key
 * to .env (e.g. MSG91_AUTH_KEY / TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN),
 * implement the provider's send-SMS HTTP call here, and register this
 * class in auth.module.ts in place of the "not configured" behaviour.
 * Until then send-otp fails with a clear configuration error instead of
 * pretending an SMS was sent.
 */
export class ProductionSmsProvider implements SmsProvider {
  readonly name = 'production-unconfigured';

  async sendOtp(): Promise<void> {
    throw new ServiceUnavailableException(
      'SMS service is not configured on the server. Please try again later.',
    );
  }
}
