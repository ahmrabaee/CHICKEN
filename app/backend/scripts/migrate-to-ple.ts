/**
 * Blueprint 04: Migrate existing Sales/Payments to Payment Ledger Entries
 * Run: npx tsx scripts/migrate-to-ple.ts
 */
import { PrismaClient } from '@prisma/client';

const ACCOUNT_CODES = { ACCOUNTS_RECEIVABLE: '1120', ACCOUNTS_PAYABLE: '2110' };

async function main() {
  const prisma = new PrismaClient();

  const arAccount = await prisma.account.findUnique({
    where: { code: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE },
  });
  const apAccount = await prisma.account.findUnique({
    where: { code: ACCOUNT_CODES.ACCOUNTS_PAYABLE },
  });
  if (!arAccount) throw new Error('AR account 1120 not found');
  if (!apAccount) throw new Error('AP account 2110 not found');

  let salesCount = 0;
  let paymentCount = 0;
  let purchaseCount = 0;

  // Migrate Sales
  const sales = await prisma.sale.findMany({
    where: { isVoided: false, docstatus: 1, customerId: { not: null } },
    include: { customer: true },
  });

  for (const sale of sales) {
    if (!sale.customerId || sale.totalAmount <= 0) continue;

    const existing = await prisma.paymentLedgerEntry.findFirst({
      where: { voucherType: 'sale', voucherId: sale.id },
    });
    if (existing) continue;

    await prisma.paymentLedgerEntry.create({
      data: {
        partyType: 'customer',
        partyId: sale.customerId,
        accountType: 'receivable',
        accountId: arAccount.id,
        voucherType: 'sale',
        voucherId: sale.id,
        amount: sale.totalAmount,
        postingDate: sale.saleDate,
        dueDate: sale.dueDate,
        remarks: `Migration: Sale ${sale.saleNumber}`,
      },
    });
    salesCount++;
  }

  // Migrate Payments against Sales
  const salePayments = await prisma.payment.findMany({
    where: {
      referenceType: 'sale',
      docstatus: 1,
      isVoided: false,
      partyType: 'customer',
      partyId: { not: null },
    },
  });

  for (const payment of salePayments) {
    if (!payment.partyId) continue;

    const existing = await prisma.paymentLedgerEntry.findFirst({
      where: { voucherType: 'payment', voucherId: payment.id },
    });
    if (existing) continue;

    await prisma.paymentLedgerEntry.create({
      data: {
        partyType: 'customer',
        partyId: payment.partyId,
        accountType: 'receivable',
        accountId: arAccount.id,
        voucherType: 'payment',
        voucherId: payment.id,
        againstVoucherType: 'sale',
        againstVoucherId: payment.referenceId,
        amount: -payment.amount,
        postingDate: payment.paymentDate,
        remarks: `Migration: Payment against Sale #${payment.referenceId}`,
      },
    });
    paymentCount++;
  }

  // Migrate Purchases (receivables - when received)
  const purchases = await prisma.purchase.findMany({
    where: { docstatus: 1 },
  });

  for (const purchase of purchases) {
    const existing = await prisma.paymentLedgerEntry.findFirst({
      where: { voucherType: 'purchase', voucherId: purchase.id },
    });
    if (existing) continue;

    await prisma.paymentLedgerEntry.create({
      data: {
        partyType: 'supplier',
        partyId: purchase.supplierId,
        accountType: 'payable',
        accountId: apAccount.id,
        voucherType: 'purchase',
        voucherId: purchase.id,
        amount: -purchase.totalAmount,
        postingDate: purchase.purchaseDate,
        dueDate: purchase.dueDate,
        remarks: `Migration: Purchase ${purchase.purchaseNumber}`,
      },
    });
    purchaseCount++;
  }

  // Migrate Payments against Purchases
  const purchasePayments = await prisma.payment.findMany({
    where: { referenceType: 'purchase', docstatus: 1, isVoided: false },
  });

  for (const payment of purchasePayments) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: payment.referenceId },
    });
    if (!purchase) continue;

    const existing = await prisma.paymentLedgerEntry.findFirst({
      where: { voucherType: 'payment', voucherId: payment.id },
    });
    if (existing) continue;

    await prisma.paymentLedgerEntry.create({
      data: {
        partyType: 'supplier',
        partyId: purchase.supplierId,
        accountType: 'payable',
        accountId: apAccount.id,
        voucherType: 'payment',
        voucherId: payment.id,
        againstVoucherType: 'purchase',
        againstVoucherId: payment.referenceId,
        amount: payment.amount,
        postingDate: payment.paymentDate,
        remarks: `Migration: Payment against Purchase #${payment.referenceId}`,
      },
    });
    paymentCount++;
  }

  console.log('Blueprint 04 PLE migration complete:');
  console.log(`  Sales: ${salesCount}`);
  console.log(`  Purchases: ${purchaseCount}`);
  console.log(`  Payments: ${paymentCount}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
