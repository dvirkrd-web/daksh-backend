import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  /** 10-digit Indian mobile, with or without +91 / spaces. */
  @IsString()
  @Matches(/^[+\d][\d\s-]{9,15}$/, { message: 'Enter a valid mobile number.' })
  mobile: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^[+\d][\d\s-]{9,15}$/, { message: 'Enter a valid mobile number.' })
  mobile: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'Enter the 4-digit OTP.' })
  otp: string;
}

export class GoogleLoginDto {
  /** Google ID token from the app's Google Sign-In flow. */
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
