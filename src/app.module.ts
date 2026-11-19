import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration, { AppConfiguration } from './config/configuration';
import { ALL_ENTITIES } from './entities';
import { InitialSchema1763299200000 } from './database/migrations/1763299200000-InitialSchema';
import { MakeUserMobileNullable1795087523965 } from './database/migrations/1795087523965-MakeUserMobileNullable';
import { AddPaymentScreenshotKey1795087523966 } from './database/migrations/1795087523966-AddPaymentScreenshotKey';
import { AdminModule } from './modules/admin/admin.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { SupportModule } from './modules/support/support.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration>) => ({
        secret: config.get('jwtSecret', { infer: true }),
        signOptions: {
          expiresIn: config.get('jwtExpiresIn', { infer: true }),
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration>) => ({
        type: 'postgres' as const,
        url: config.get('databaseUrl', { infer: true }),
        entities: ALL_ENTITIES,
        migrations: [
          InitialSchema1763299200000,
          MakeUserMobileNullable1795087523965,
          AddPaymentScreenshotKey1795087523966,
        ],
        migrationsRun: false,
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
    UsersModule,
    AuthModule,
    AddressesModule,
    ProductsModule,
    UploadsModule,
    OrdersModule,
    PaymentsModule,
    ShippingModule,
    SupportModule,
    NotificationsModule,
    AuditModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
