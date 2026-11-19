import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CustomerGuard } from '../../common/guards/auth.guards';
import { ShippingQuoteDto } from './dto/shipping-quote.dto';
import { ShiprocketService } from './shiprocket.service';

/** POST /shipping/quote — PIN serviceability + courier rates (Phase 6). */
@Controller('shipping')
@UseGuards(CustomerGuard)
export class ShippingController {
  constructor(private readonly shiprocket: ShiprocketService) {}

  @Post('quote')
  quote(@Body() dto: ShippingQuoteDto) {
    const pin = dto.pin_code ?? dto.delivery_postcode;
    if (!pin) throw new BadRequestException('PIN code is required.');
    return this.shiprocket.quote(pin);
  }
}
