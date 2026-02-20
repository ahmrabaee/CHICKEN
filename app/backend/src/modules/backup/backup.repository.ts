import { Injectable } from '@nestjs/common';
import { BackupListQueryDto } from './dto/backup-list.query.dto';
import { BackupPrismaService } from './backup-prisma.service';

@Injectable()
export class BackupRepository {
    constructor(private prisma: BackupPrismaService) { }

    async createRun(data: {
        type: 'auto' | 'manual';
        status: 'running' | 'success' | 'failed';
    }) {
        return this.prisma.backupRun.create({ data });
    }

    async updateRun(
        id: number,
        data: Partial<{
            status: string;
            finishedAt: Date;
            filename: string;
            sizeBytes: number;
            checksumSha256: string;
            errorMessage: string;
        }>,
    ) {
        return this.prisma.backupRun.update({ where: { id }, data });
    }

    async findById(id: number) {
        return this.prisma.backupRun.findUnique({ where: { id } });
    }

    async findAll(query: BackupListQueryDto) {
        const { page = 1, limit = 20, type, status } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (type) where.type = type;
        if (status) where.status = status;

        const [items, total] = await Promise.all([
            this.prisma.backupRun.findMany({
                where,
                orderBy: { startedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.backupRun.count({ where }),
        ]);

        return { items, total, page, limit };
    }

    async findSuccessfulRunsBefore(cutoffDate: Date) {
        return this.prisma.backupRun.findMany({
            where: {
                status: 'success',
                finishedAt: { lt: cutoffDate },
            },
            orderBy: { startedAt: 'desc' },
        });
    }

    async deleteRun(id: number) {
        return this.prisma.backupRun.delete({ where: { id } });
    }

    async findRunningBackup() {
        return this.prisma.backupRun.findFirst({
            where: { status: 'running' },
            orderBy: { startedAt: 'desc' },
        });
    }

    async failAllRunningBackups(errorMessage: string) {
        return this.prisma.backupRun.updateMany({
            where: { status: 'running' },
            data: {
                status: 'failed',
                finishedAt: new Date(),
                errorMessage,
            },
        });
    }
}
