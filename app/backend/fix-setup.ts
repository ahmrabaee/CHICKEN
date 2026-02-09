import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Updating setup status...');

    await prisma.systemSetting.upsert({
        where: { key: 'setup_completed' },
        update: { value: 'true' },
        create: {
            key: 'setup_completed',
            value: 'true',
            description: 'Whether the initial system setup has been completed',
            dataType: 'boolean',
            settingGroup: 'system',
            isSystem: true
        },
    });

    console.log('✓ setup_completed set to true');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
