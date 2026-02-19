
import { Global, Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
    imports: [PrismaModule],
    providers: [PdfService],
    exports: [PdfService],
})
export class PdfModule { }
