import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { CustomerGuard } from '../../common/guards/auth.guards';
import { serializeOrder } from '../../common/serializers';
import { AddressesService } from '../addresses/addresses.service';
import { CancelOrderDto, QuoteDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(CustomerGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly addressesService: AddressesService,
  ) {}

  /** POST /orders/quote — authoritative price breakup for the cart. */
  @Post('quote')
  async quote(@CurrentUser() user: AuthenticatedUser, @Body() dto: QuoteDto) {
    // The address must belong to the caller (also guards PIN-based
    // delivery pricing when Shiprocket rating arrives in Phase 6).
    await this.addressesService.findOwned(user.id, dto.address_id);
    const q = await this.ordersService.quote(dto);
    return {
      subtotal_paise: q.subtotalPaise,
      delivery_paise: q.deliveryPaise,
      discount_paise: q.discountPaise,
      total_paise: q.totalPaise,
      coupon_applied: q.couponApplied,
      coupon_code: q.coupon ? q.coupon.code : null,
      message: q.message,
    };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const orders = await this.ordersService.listForUser(user.id);
    return orders.map((o) => serializeOrder(o));
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const order = await this.ordersService.getForUser(user.id, id);
    return serializeOrder(order);
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
  ) {
    const order = await this.ordersService.cancelByCustomer(
      user.id,
      id,
      dto.reason,
    );
    return serializeOrder(order);
  }
}
