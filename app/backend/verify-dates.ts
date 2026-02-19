
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Dates...');

    const sales = await prisma.sale.findMany({ select: { saleDate: true, saleNumber: true } });
    console.log('Sales:', sales.map(s => `${s.saleNumber}: ${s.saleDate.toISOString().split('T')[0]}`));

    const purchases = await prisma.purchase.findMany({ select: { purchaseDate: true, purchaseNumber: true } });
    console.log('Purchases:', purchases.map(p => `${p.purchaseNumber}: ${p.purchaseDate.toISOString().split('T')[0]}`));

    const expenses = await prisma.expense.findMany({ select: { expenseDate: true, expenseNumber: true } });
    console.log('Expenses:', expenses.map(e => `${e.expenseNumber}: ${e.expenseDate.toISOString().split('T')[0]}`));

    const payments = await prisma.payment.findMany({ select: { paymentDate: true, paymentNumber: true } });
    console.log('Payments:', payments.map(p => `${p.paymentNumber}: ${p.paymentDate.toISOString().split('T')[0]}`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
