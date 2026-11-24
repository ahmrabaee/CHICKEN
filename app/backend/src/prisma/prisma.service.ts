import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // ─── SQLite concurrency hardening (fix C-1: "database is locked") ────────────
    // WAL mode (persisted in the DB file, so it applies to every connection) lets
    // readers run concurrently with the single writer; busy_timeout makes a
    // competing writer wait-and-retry (up to 5s) instead of failing immediately
    // with SQLITE_BUSY. We deliberately do NOT force connection_limit=1: several
    // services issue queries on the base client inside an interactive
    // $transaction, which with a single pooled connection would dead-lock (P2028).
    try {
      // journal_mode and busy_timeout return a row set → use $queryRawUnsafe
      const [{ journal_mode } = { journal_mode: 'unknown' }] =
        (await this.$queryRawUnsafe<Array<{ journal_mode: string }>>(
          'PRAGMA journal_mode=WAL;',
        )) ?? [];
      await this.$queryRawUnsafe('PRAGMA busy_timeout=5000;');
      // synchronous=NORMAL is the safe/recommended durability level under WAL
      await this.$executeRawUnsafe('PRAGMA synchronous=NORMAL;');
      this.logger.log(
        `SQLite pragmas applied: journal_mode=${journal_mode}, busy_timeout=5000ms, synchronous=NORMAL`,
      );
    } catch (e) {
      this.logger.warn(
        `Failed to apply SQLite concurrency pragmas: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    this.logger.log('Connected to SQLite database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  /**
   * Execute operations within a transaction
   */
  async executeInTransaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (prisma) => {
      return fn(prisma as PrismaClient);
    });
  }

  /**
   * Clean database for testing purposes
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    
    // Delete in order respecting foreign keys
    const tablenames = await this.$queryRaw<
      Array<{ name: string }>
    >`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'`;

    for (const { name } of tablenames) {
      if (name !== 'SchemaVersion') {
        await this.$executeRawUnsafe(`DELETE FROM "${name}"`);
      }
    }
  }
}
