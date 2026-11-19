import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsUUID()
  order_id?: string;
}
