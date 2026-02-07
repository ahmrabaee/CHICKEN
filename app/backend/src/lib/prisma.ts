/**
 * Prisma Database Client Singleton
 * 
 * Provides a single PrismaClient instance across the application.
 * Handles connection pooling and graceful shutdown.
 * 
 * @module lib/prisma
 */

import { PrismaClient } from '@prisma/client/index.js';

// Prevent multiple instances in development with hot reloading
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * PrismaClient singleton instance
 * 
 * Features:
 * - Query logging in development
 * - Automatic connection management
 * - Graceful shutdown on process exit
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env['NODE_ENV'] === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown handler
 * Ensures database connections are closed when the process exits
 */
async function gracefulShutdown(): Promise<void> {
  await prisma.$disconnect();
  console.log('Prisma disconnected');
}

// Handle various termination signals
process.on('beforeExit', gracefulShutdown);
process.on('SIGINT', async () => {
  await gracefulShutdown();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await gracefulShutdown();
  process.exit(0);
});

export default prisma;
