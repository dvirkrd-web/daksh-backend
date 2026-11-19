import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  /** FCM device token for push notifications (app registers it after login). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  fcm_token?: string;
}
