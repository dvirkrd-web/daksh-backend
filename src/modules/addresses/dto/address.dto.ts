import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  full_name: string;

  @IsString()
  @Matches(/^[+\d][\d\s-]{9,15}$/, { message: 'Enter a valid mobile number.' })
  mobile: string;

  @IsString()
  @MaxLength(120)
  house_no: string;

  @IsString()
  @MaxLength(200)
  street: string;

  @IsString()
  @MaxLength(120)
  village_city: string;

  @IsString()
  @MaxLength(120)
  district: string;

  @IsString()
  @MaxLength(120)
  state: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter a valid 6-digit PIN code.' })
  pin_code: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  full_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+\d][\d\s-]{9,15}$/, { message: 'Enter a valid mobile number.' })
  mobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  house_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  village_city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter a valid 6-digit PIN code.' })
  pin_code?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
