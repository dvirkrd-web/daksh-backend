import { Body, Controller, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin.dto';

/** POST /admin/auth/login — email + password, returns an admin JWT. */
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: AdminLoginDto, @Ip() ip: string) {
    return this.adminAuth.login(dto.email, dto.password, ip);
  }
}
