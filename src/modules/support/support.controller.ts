import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { CustomerGuard } from '../../common/guards/auth.guards';
import { serializeTicket } from '../../common/serializers';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(CustomerGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ) {
    const ticket = await this.supportService.create(user.id, dto);
    return serializeTicket(ticket);
  }

  @Get('tickets')
  async list(@CurrentUser() user: AuthenticatedUser) {
    const tickets = await this.supportService.listForUser(user.id);
    return tickets.map(serializeTicket);
  }
}
