import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { CustomerGuard } from '../../common/guards/auth.guards';
import { serializeUploadedFile } from '../../common/serializers';
import { ConfirmUploadDto, PresignDto } from './dto/upload.dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(CustomerGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  presign(@CurrentUser() user: AuthenticatedUser, @Body() dto: PresignDto) {
    return this.uploadsService.presign(user.id, dto);
  }

  @Post('confirm')
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmUploadDto,
  ) {
    const file = await this.uploadsService.confirm(user.id, dto);
    return serializeUploadedFile(file);
  }
}
