
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const purchases = await prisma.purchase.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
        });
        console.log('--- Latest Purchases ---');
        console.log(JSON.stringify(purchases, null, 2));

        const debts = await prisma.debt.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
        });
        console.log('\n--- Latest Debts ---');
        console.log(JSON.stringify(debts, null, 2));

        const suppliers = await prisma.supplier.findMany({
            take: 5
        });
        console.log('\n--- Suppliers ---');
        console.log(JSON.stringify(suppliers, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
