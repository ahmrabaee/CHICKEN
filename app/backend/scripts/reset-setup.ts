/**
 * Reset setup status so the setup wizard can be run again.
 * Use when you need to re-run the initial setup (e.g. after db:seed).
 * Also removes the default admin user if it exists so the wizard can create a new one.
 *
 * Run: npx tsx scripts/reset-setup.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting setup status...');

  await prisma.systemSetting.upsert({
    where: { key: 'setup_completed' },
    update: { value: 'false', updatedAt: new Date() },
    create: {
      key: 'setup_completed',
      value: 'false',
      description: 'Whether the initial system setup has been completed',
      dataType: 'boolean',
      settingGroup: 'system',
      isSystem: true,
    },
  });

  // Remove default admin user so setup wizard can create a fresh one
  const deleted = await prisma.userRole.deleteMany({
    where: { user: { username: 'admin' } },
  });
  if (deleted.count > 0) {
    await prisma.user.deleteMany({ where: { username: 'admin' } });
    console.log('✓ Removed existing admin user');
  }

  console.log('✓ setup_completed set to false - you can run the setup wizard again');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
