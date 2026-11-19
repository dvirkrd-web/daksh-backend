import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { AppConfiguration } from '../../config/configuration';
import { serializeUser } from '../../common/serializers';
import { OtpCode } from '../../entities/otp-code.entity';
import { User } from '../../entities/user.entity';
import { normalizeMobile, UsersService } from '../users/users.service';
import { SmsProvider } from './sms.provider';

export const SMS_PROVIDER = 'SMS_PROVIDER';

/** Shape of Google's tokeninfo response (only the claims we check). */
interface GoogleTokenInfo {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  exp?: string;
  name?: string;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(OtpCode)
    private readonly otpCodes: Repository<OtpCode>,
    @Inject(SMS_PROVIDER)
    private readonly sms: SmsProvider,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfiguration>,
  ) {}

  private hashCode(mobile: string, code: string): string {
    const secret = this.config.get('jwtSecret', { infer: true });
    return createHash('sha256').update(`${mobile}:${code}:${secret}`).digest('hex');
  }

  async sendOtp(rawMobile: string): Promise<{ sent: boolean; expires_in_seconds: number }> {
    const mobile = normalizeMobile(rawMobile);
    if (!/^\+91\d{10}$/.test(mobile)) {
      throw new BadRequestException('Enter a valid 10-digit mobile number.');
    }

    const devMode = this.config.get('otpDevMode', { infer: true });
    if (!devMode && this.sms.name === 'production-unconfigured') {
      // No real SMS provider is wired up and dev mode is off: fail loudly
      // instead of pretending an OTP was sent.
      throw new ServiceUnavailableException(
        'OTP service is not configured on the server. Please contact support.',
      );
    }

    const latest = await this.otpCodes.findOne({
      where: { mobile },
      order: { createdAt: 'DESC' },
    });
    if (
      latest &&
      !latest.consumed &&
      Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException(
        'An OTP was just sent. Please wait 30 seconds before requesting another.',
      );
    }

    const code = randomInt(1000, 10000).toString();
    await this.otpCodes.save(
      this.otpCodes.create({
        mobile,
        codeHash: this.hashCode(mobile, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
        consumed: false,
      }),
    );

    await this.sms.sendOtp(mobile, code);
    return { sent: true, expires_in_seconds: OTP_TTL_MS / 1000 };
  }

  async verifyOtp(rawMobile: string, code: string) {
    const mobile = normalizeMobile(rawMobile);
    const record = await this.otpCodes.findOne({
      where: { mobile, consumed: false },
      order: { createdAt: 'DESC' },
    });
    if (!record) {
      throw new UnauthorizedException('OTP not found. Please request a new OTP.');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      record.consumed = true;
      await this.otpCodes.save(record);
      throw new UnauthorizedException('OTP expired. Please request a new OTP.');
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      record.consumed = true;
      await this.otpCodes.save(record);
      throw new UnauthorizedException(
        'Too many wrong attempts. Please request a new OTP.',
      );
    }

    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(this.hashCode(mobile, code), 'hex');
    const matches =
      expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!matches) {
      record.attempts += 1;
      await this.otpCodes.save(record);
      throw new UnauthorizedException('Incorrect OTP. Please try again.');
    }

    record.consumed = true;
    await this.otpCodes.save(record);

    // First login creates the account (customer registration).
    const user = await this.usersService.findOrCreateByMobile(mobile);
    return this.issueSession(user);
  }

  /**
   * Google Sign-In: verifies the ID token with Google's tokeninfo
   * endpoint, then finds-or-creates the customer by email and issues
   * the same session response as OTP login. The account is keyed by
   * email; the mobile is collected later, at order time.
   */
  async loginWithGoogle(idToken: string) {
    const clientId = this.config.get('googleClientId', { infer: true });
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Google login is not configured on the server.',
      );
    }

    let claims: GoogleTokenInfo;
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
      if (!res.ok) {
        throw new UnauthorizedException(
          'Google sign-in failed. Please try again.',
        );
      }
      claims = (await res.json()) as GoogleTokenInfo;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'Google sign-in failed. Please try again.',
      );
    }

    if (claims.aud !== clientId) {
      throw new UnauthorizedException(
        'Google sign-in failed. Please try again.',
      );
    }
    const emailVerified =
      claims.email_verified === true || claims.email_verified === 'true';
    if (!emailVerified) {
      throw new UnauthorizedException(
        'Your Google email is not verified. Please verify it and try again.',
      );
    }
    const expiresAtMs = Number(claims.exp) * 1000;
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      throw new UnauthorizedException(
        'Google sign-in expired. Please try again.',
      );
    }
    const email = (claims.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException(
        'Google sign-in failed. Please try again.',
      );
    }

    // First Google login creates the account (customer registration).
    const name = (claims.name ?? '').trim();
    const user = await this.usersService.findOrCreateByEmail(
      email,
      name.length > 0 ? name : null,
    );
    return this.issueSession(user);
  }

  /**
   * Shared login tail for OTP and Google sign-in: rejects disabled
   * accounts, stamps the login time and issues the customer JWT.
   * The app accepts `token` (or access_token); send both, same value.
   */
  private async issueSession(user: User) {
    if (!user.isActive) {
      throw new UnauthorizedException(
        'This account has been disabled. Please contact support.',
      );
    }
    const active = await this.usersService.touchLastLogin(user);
    const token = await this.jwtService.signAsync({
      sub: active.id,
      type: 'customer',
      mobile: active.mobile,
    });
    return { token, access_token: token, user: serializeUser(active) };
  }
}
