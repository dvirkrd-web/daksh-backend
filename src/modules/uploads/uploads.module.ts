import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadedFile } from '../../entities/uploaded-file.entity';
import { StorageModule } from '../storage/storage.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [TypeOrmModule.forFeature([UploadedFile]), StorageModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService, StorageModule],
})
export class UploadsModule {}
