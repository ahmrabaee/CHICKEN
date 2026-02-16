import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const codes = [
        '1110', '1111', '1112', '1120', '1130', '1131', '2110', '2120', '1125',
        '3100', '3200', '4100', '4110', '4200', '5100', '5200', '5300', '5400', '5320'
    ];
    const accounts = await prisma.account.findMany({
        where: { code: { in: codes } },
        select: { code: true, name: true, nameEn: true, isGroup: true }
    });

    console.log(JSON.stringify(accounts, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
