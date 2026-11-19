import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { CustomerGuard } from '../../common/guards/auth.guards';
import { serializeUser } from '../../common/serializers';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

/** GET /me, PATCH /me — the logged-in customer's profile. */
@Controller('me')
@UseGuards(CustomerGuard)
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getMe(@CurrentUser() auth: AuthenticatedUser) {
    const user = await this.usersService.findById(auth.id);
    if (!user) throw new NotFoundException('Account not found.');
    return serializeUser(user);
  }

  @Patch()
  async updateMe(
    @CurrentUser() auth: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.findById(auth.id);
    if (!user) throw new NotFoundException('Account not found.');
    const updated = await this.usersService.updateProfile(user, {
      name: dto.name,
      email: dto.email,
      fcmToken: dto.fcm_token,
    });
    return serializeUser(updated);
  }
}
