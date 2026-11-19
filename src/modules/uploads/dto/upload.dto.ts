import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export class PresignDto {
  @IsString()
  @IsIn(ALLOWED_MIME_TYPES, {
    message: 'Only JPG, PNG or PDF files are allowed.',
  })
  mime_type: string;

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES, { message: 'File is larger than 25 MB.' })
  size: number;

  @IsOptional()
  @IsString()
  @IsIn(['front', 'back'])
  side?: string;
}

export class ConfirmUploadDto {
  @IsString()
  @MaxLength(512)
  storage_key: string;

  @IsString()
  @MaxLength(255)
  original_name: string;

  @IsString()
  @IsIn(ALLOWED_MIME_TYPES, {
    message: 'Only JPG, PNG or PDF files are allowed.',
  })
  mime_type: string;

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES, { message: 'File is larger than 25 MB.' })
  size_bytes: number;

  @IsOptional()
  @IsString()
  @IsIn(['front', 'back'])
  side?: string;
}
