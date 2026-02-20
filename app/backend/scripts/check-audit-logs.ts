import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching Account entity audit logs...');
    const logs = await prisma.auditLog.findMany({
        where: { entityType: 'Account' },
        orderBy: { timestamp: 'desc' },
    });

    console.log(`Found ${logs.length} account logs.`);
    console.log(JSON.stringify(logs, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
