import { IsOptional, IsString, Matches } from 'class-validator';

export class ShippingQuoteDto {
  /** App/API.md name. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter a valid 6-digit PIN code.' })
  pin_code?: string;

  /** Shiprocket's own field name, also accepted. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter a valid 6-digit PIN code.' })
  delivery_postcode?: string;
}
