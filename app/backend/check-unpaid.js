
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const sales = await prisma.sale.findMany({
            where: { paymentStatus: { in: ['unpaid', 'partial'] }, isVoided: false },
            take: 5
        });
        console.log('Unpaid/Partial Sales:', JSON.stringify(sales, null, 2));

        const purchases = await prisma.purchase.findMany({
            where: { paymentStatus: { in: ['unpaid', 'partial'] } },
            take: 5
        });
        console.log('Unpaid/Partial Purchases:', JSON.stringify(purchases, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
