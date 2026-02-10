
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- PAYMENTS CHECK ---');
    try {
        const count = await prisma.payment.count();
        console.log('Total Payments:', count);

        if (count > 0) {
            const latest = await prisma.payment.findMany({
                take: 5,
                orderBy: { paymentDate: 'desc' }
            });
            console.log('Latest Payments:', JSON.stringify(latest, null, 2));
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
