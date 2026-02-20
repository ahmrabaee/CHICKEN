import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { ensureDir, resolveBackupMetaDbPath, resolveDbPath, toSqliteFileUrl } from './utils/paths';

@Injectable()
export class BackupPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BackupPrismaService.name);
    private readonly databasePath: string;

    constructor() {
        const databasePath = resolveBackupMetaDbPath();
        ensureDir(path.dirname(databasePath));

        super({
            datasources: {
                db: {
                    url: toSqliteFileUrl(databasePath),
                },
            },
            log:
                process.env.NODE_ENV === 'development'
                    ? ['warn', 'error']
                    : ['error'],
        });

        this.databasePath = databasePath;
    }

    async onModuleInit() {
        await this.$connect();
        await this.ensureSchema();
        await this.migrateLegacyRuns();
        this.logger.log(`Connected to backup metadata database: ${this.databasePath}`);
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    private async ensureSchema() {
        await this.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "backup_runs" (
                "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                "type" TEXT NOT NULL,
                "status" TEXT NOT NULL,
                "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "finished_at" DATETIME,
                "filename" TEXT,
                "size_bytes" INTEGER,
                "checksum_sha256" TEXT,
                "error_message" TEXT,
                "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "backup_runs_type_status_idx"
            ON "backup_runs"("type", "status")
        `);

        await this.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "backup_runs_started_at_idx"
            ON "backup_runs"("started_at")
        `);
    }

    private async migrateLegacyRuns() {
        const legacyMainDbPath = resolveDbPath();
        if (!fs.existsSync(legacyMainDbPath)) return;
        if (path.resolve(legacyMainDbPath) === path.resolve(this.databasePath)) return;

        const existingCountRows = await this.$queryRawUnsafe<Array<{ count: number }>>(
            `SELECT COUNT(*) AS count FROM "backup_runs"`,
        );
        const existingCount = Number(existingCountRows?.[0]?.count ?? 0);
        if (existingCount > 0) return;

        const attachPath = legacyMainDbPath.replace(/'/g, "''");

        try {
            await this.$executeRawUnsafe(`ATTACH DATABASE '${attachPath}' AS legacy_main`);

            const legacyTableRows = await this.$queryRawUnsafe<Array<{ count: number }>>(
                `SELECT COUNT(*) AS count FROM legacy_main.sqlite_master WHERE type = 'table' AND name = 'backup_runs'`,
            );
            const legacyTableExists = Number(legacyTableRows?.[0]?.count ?? 0) > 0;
            if (!legacyTableExists) return;

            await this.$executeRawUnsafe(`
                INSERT INTO "backup_runs" (
                    "id",
                    "type",
                    "status",
                    "started_at",
                    "finished_at",
                    "filename",
                    "size_bytes",
                    "checksum_sha256",
                    "error_message",
                    "created_at"
                )
                SELECT
                    "id",
                    "type",
                    "status",
                    "started_at",
                    "finished_at",
                    "filename",
                    "size_bytes",
                    "checksum_sha256",
                    "error_message",
                    "created_at"
                FROM legacy_main."backup_runs"
                ORDER BY "id" ASC
            `);

            await this.$executeRawUnsafe(`
                UPDATE "sqlite_sequence"
                SET "seq" = (SELECT IFNULL(MAX("id"), 0) FROM "backup_runs")
                WHERE "name" = 'backup_runs'
            `);

            this.logger.log('Migrated legacy backup run history into backup metadata database');
        } catch (error) {
            this.logger.warn('Could not migrate legacy backup run history');
        } finally {
            try {
                await this.$executeRawUnsafe(`DETACH DATABASE legacy_main`);
            } catch {
                // Ignore detach failures
            }
        }
    }
}
