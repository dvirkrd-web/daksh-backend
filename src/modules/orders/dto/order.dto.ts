import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** A file reference inside an order item — mirrors UploadedFile.toJson(). */
export class FileRefDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  storage_key?: string;

  @IsOptional()
  @IsString()
  original_name?: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsInt()
  size_bytes?: number;

  @IsOptional()
  @IsString()
  side?: string | null;
}

export class OrderItemDto {
  @IsUUID()
  product_id: string;

  @IsUUID()
  price_id: string;

  @IsInt()
  @Min(1)
  qty: number;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileRefDto)
  files?: FileRefDto[];
}

export class QuoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsUUID()
  address_id: string;

  /** The app sends `coupon` on /orders/quote … */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  coupon?: string;

  /** … and `coupon_code` inside the order draft. Both are accepted. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  coupon_code?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsUUID()
  address_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  coupon_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  coupon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customer_note?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
