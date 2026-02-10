
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Recording payment for Purchase ID: 1');

        // This simulates the POST /v1/payments/purchase endpoint logic
        const paymentNumber = `PAY-TEST-${Date.now()}`;
        const amount = 50000; // 500.00 NIS

        const payment = await prisma.payment.create({
            data: {
                paymentNumber,
                paymentDate: new Date(),
                amount: amount,
                paymentMethod: 'cash',
                referenceType: 'purchase',
                referenceId: 1,
                partyType: 'supplier',
                partyId: 1,
                partyName: 'تجريبي',
                receivedById: 1,
            }
        });

        console.log('Payment created:', payment);

        // Update purchase
        await prisma.purchase.update({
            where: { id: 1 },
            data: {
                amountPaid: { increment: amount },
                paymentStatus: 'partial'
            }
        });

        console.log('Purchase updated to partial');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
