import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfiguration } from '../../config/configuration';
import { OtpCode } from '../../entities/otp-code.entity';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService, SMS_PROVIDER } from './auth.service';
import {
  DevConsoleSmsProvider,
  ProductionSmsProvider,
  SmsProvider,
} from './sms.provider';

@Module({
  imports: [TypeOrmModule.forFeature([OtpCode]), UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration>): SmsProvider => {
        const devMode = config.get('otpDevMode', { infer: true });
        // Dev console provider is used ONLY in explicit dev mode.
        // Otherwise the production slot is used — which currently throws
        // a clear "not configured" error until the owner plugs in a real
        // SMS provider (see sms.provider.ts TODO).
        return devMode
          ? new DevConsoleSmsProvider()
          : new ProductionSmsProvider();
      },
    },
  ],
})
export class AuthModule {}
