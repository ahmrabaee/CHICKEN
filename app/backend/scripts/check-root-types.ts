import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const codes = ['4110', '5100']; // Sales and COGS
    const accounts = await prisma.account.findMany({
        where: { code: { in: codes } },
        select: { code: true, name: true, rootType: true }
    });

    console.log(JSON.stringify(accounts, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
