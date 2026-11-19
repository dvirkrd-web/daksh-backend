import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { GoogleLoginDto, SendOtpDto, VerifyOtpDto } from './dto/auth.dto';

/**
 * Customer login: POST /auth/send-otp, POST /auth/verify-otp,
 * POST /auth/google.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.mobile);
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.mobile, dto.otp);
  }

  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.idToken);
  }
}
