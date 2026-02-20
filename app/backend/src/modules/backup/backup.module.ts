import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupScheduler } from './backup.scheduler';
import { BackupRepository } from './backup.repository';
import { BackupTokenService } from './security/backup-token.service';
import { BackupPrismaService } from './backup-prisma.service';
import { SettingsModule } from '../../settings/settings.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        SettingsModule,
    ],
    controllers: [BackupController],
    providers: [
        BackupService,
        BackupScheduler,
        BackupPrismaService,
        BackupRepository,
        BackupTokenService,
    ],
    exports: [BackupService],
})
export class BackupModule { }
