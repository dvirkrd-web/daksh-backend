import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { CustomerGuard } from '../../common/guards/auth.guards';
import { serializeAddress } from '../../common/serializers';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Controller('addresses')
@UseGuards(CustomerGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const rows = await this.addressesService.list(user.id);
    return rows.map(serializeAddress);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ) {
    const address = await this.addressesService.create(user.id, dto);
    return serializeAddress(address);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const address = await this.addressesService.update(user.id, id, dto);
    return serializeAddress(address);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.addressesService.remove(user.id, id);
    return { deleted: true };
  }
}
