import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ShiprocketService } from '../shipping/shiprocket.service';

/**
 * Gateway / courier webhooks. These are NOT behind the JWT guards —
 * authenticity comes from each provider's own signature/token check.
 * The app never calls these endpoints.
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly shiprocketService: ShiprocketService,
  ) {}

  @Post('razorpay')
  razorpay(
    @Req() req: { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body for signature check.');
    }
    return this.paymentsService.handleWebhook(req.rawBody, signature ?? '');
  }

  @Post('shiprocket')
  shiprocket(
    @Headers() headers: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ) {
    return this.shiprocketService.handleWebhook(headers, body ?? {});
  }
}
