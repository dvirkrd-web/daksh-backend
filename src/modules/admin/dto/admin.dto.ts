import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ALL_ORDER_STATUSES } from '../../../common/order-status';

export class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn(ALL_ORDER_STATUSES)
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class AddNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note: string;
}

export class AdminPriceDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(160)
  option_label: string;

  @IsInt()
  @Min(0)
  price_paise: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  delivery_charge_paise?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  min_qty?: number;
}

const CATEGORIES = [
  'pvc_card',
  'passport_photo',
  'photo_print',
  'document_print',
  'pdf_print',
  'bulk',
];

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  image_url?: string;

  @IsString()
  @IsIn(CATEGORIES)
  category: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminPriceDto)
  prices?: AdminPriceDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  image_url?: string;

  @IsOptional()
  @IsString()
  @IsIn(CATEGORIES)
  category?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminPriceDto)
  prices?: AdminPriceDto[];
}

export class ReplyTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  admin_reply: string;

  @IsOptional()
  @IsString()
  @IsIn(['replied', 'closed', 'open'])
  status?: string;
}
