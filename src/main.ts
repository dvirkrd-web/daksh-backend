import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfiguration } from './config/configuration';

async function bootstrap(): Promise<void> {
  // rawBody: true is required so the Razorpay / Shiprocket webhook
  // handlers can verify signatures over the exact bytes received.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // All routes live under /api/v1 (docs/API.md, app config.dart).
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService<AppConfiguration>);
  const port = config.get('port', { infer: true }) ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`DAKSH ONLINE PRINTING backend listening on port ${port}`);
}

void bootstrap();
