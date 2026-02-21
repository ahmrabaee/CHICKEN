import { Module } from '@nestjs/common';
import { PageAccessController } from './page-access.controller';
import { PageAccessService } from './page-access.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PageAccessController],
  providers: [PageAccessService],
  exports: [PageAccessService],
})
export class PageAccessModule {}
