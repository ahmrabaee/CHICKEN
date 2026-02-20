/**
 * Recover missing Debt + PLE records for purchases with outstanding balance.
 * Run: node app/backend/recover-debt.js
 * Use when purchases exist but /debts page shows no payables.
 * Also creates PLE so Reconciliation/Outstanding stay aligned with Debt.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recover() {
    try {
        const apAccount = await prisma.account.findFirst({ where: { code: '2110', companyId: 1 } });
        if (!apAccount) {
            console.warn('Account 2110 (Accounts Payable) not found. PLE creation will be skipped.');
        }

        const allPurchases = await prisma.purchase.findMany({
            where: { docstatus: { not: 2 } },
            orderBy: { createdAt: 'desc' },
        });

        const toRecover = [];

        for (const purchase of allPurchases) {
            const totalAmount = purchase.grandTotal ?? purchase.totalAmount;
            const amountPaid = purchase.amountPaid ?? 0;
            const amountDue = totalAmount - amountPaid;

            if (amountDue <= 0) continue;

            const existingDebt = await prisma.debt.findFirst({
                where: { sourceType: 'purchase', sourceId: purchase.id },
            });

            if (!existingDebt) {
                toRecover.push({ purchase, amountDue });
            }
        }

        if (toRecover.length > 0) {
            console.log(`Found ${toRecover.length} purchase(s) with missing debt. Recovering...`);
            for (const { purchase, amountDue } of toRecover) {
            const totalAmount = purchase.grandTotal ?? purchase.totalAmount;
            const amountPaid = purchase.amountPaid ?? 0;

            await prisma.$transaction(async (tx) => {
                await tx.debt.create({
                    data: {
                        debtNumber: `DEB-${purchase.purchaseNumber}`,
                        direction: 'payable',
                        partyType: 'supplier',
                        partyId: purchase.supplierId,
                        partyName: purchase.supplierName,
                        sourceType: 'purchase',
                        sourceId: purchase.id,
                        totalAmount,
                        amountPaid,
                        dueDate: purchase.dueDate,
                        status: purchase.paymentStatus === 'paid' ? 'paid' : 'partial',
                        branchId: purchase.branchId,
                    },
                });

                await tx.supplier.update({
                    where: { id: purchase.supplierId },
                    data: { currentBalance: { increment: amountDue } },
                });

                // Create PLE for purchase (invoice) if missing - aligns Outstanding with Debt
                if (apAccount) {
                    const existingPle = await tx.paymentLedgerEntry.findFirst({
                        where: { voucherType: 'purchase', voucherId: purchase.id, againstVoucherId: null, delinked: false },
                    });
                    if (!existingPle) {
                        await tx.paymentLedgerEntry.create({
                            data: {
                                partyType: 'supplier',
                                partyId: purchase.supplierId,
                                accountType: 'payable',
                                accountId: apAccount.id,
                                voucherType: 'purchase',
                                voucherId: purchase.id,
                                againstVoucherType: null,
                                againstVoucherId: null,
                                amount: -totalAmount,
                                postingDate: purchase.purchaseDate ?? purchase.createdAt,
                                dueDate: purchase.dueDate,
                                remarks: `Purchase #${purchase.id}`,
                            },
                        });
                    }

                    // Create Payment + PLE for amountPaid if no Payment records exist
                    const payments = await tx.payment.findMany({
                        where: { referenceType: 'purchase', referenceId: purchase.id },
                    });
                    const paidViaPayments = payments.reduce((s, p) => s + p.amount, 0);
                    if (amountPaid > 0 && paidViaPayments < amountPaid) {
                        const paymentAmount = amountPaid - paidViaPayments;
                        const payment = await tx.payment.create({
                            data: {
                                paymentNumber: `PAY-RECOVERY-${purchase.id}`,
                                paymentDate: purchase.purchaseDate ?? purchase.createdAt,
                                amount: paymentAmount,
                                paymentMethod: 'cash',
                                referenceType: 'purchase',
                                referenceId: purchase.id,
                                partyType: 'supplier',
                                partyId: purchase.supplierId,
                                partyName: purchase.supplierName,
                                branchId: purchase.branchId,
                                docstatus: 1,
                            },
                        });
                        await tx.paymentLedgerEntry.create({
                            data: {
                                partyType: 'supplier',
                                partyId: purchase.supplierId,
                                accountType: 'payable',
                                accountId: apAccount.id,
                                voucherType: 'payment',
                                voucherId: payment.id,
                                againstVoucherType: 'purchase',
                                againstVoucherId: purchase.id,
                                amount: paymentAmount,
                                postingDate: payment.paymentDate,
                                remarks: `Recovery: payment against Purchase #${purchase.id}`,
                            },
                        });
                    }
                }
            });

                console.log(`  ✓ ${purchase.purchaseNumber} - due: ${(amountDue / 100).toFixed(2)}`);
            }
        } else {
            console.log('No purchases with missing debt records.');
        }

        console.log('Debt recovery completed.');

        // Phase 2: Recover PLE for purchases that have Debt but no PLE (e.g. from previous recovery)
        if (apAccount) {
            const purchasesWithDebtNoPle = [];
            for (const purchase of allPurchases) {
                const totalAmount = purchase.grandTotal ?? purchase.totalAmount;
                const amountPaid = purchase.amountPaid ?? 0;
                if (totalAmount - amountPaid <= 0) continue;
                const hasDebt = await prisma.debt.findFirst({ where: { sourceType: 'purchase', sourceId: purchase.id } });
                const hasPle = await prisma.paymentLedgerEntry.findFirst({
                    where: { voucherType: 'purchase', voucherId: purchase.id, againstVoucherId: null, delinked: false },
                });
                if (hasDebt && !hasPle) purchasesWithDebtNoPle.push(purchase);
            }
            if (purchasesWithDebtNoPle.length > 0) {
                console.log(`\nRecovering PLE for ${purchasesWithDebtNoPle.length} purchase(s) with debt but no PLE...`);
                for (const purchase of purchasesWithDebtNoPle) {
                    const totalAmount = purchase.grandTotal ?? purchase.totalAmount;
                    const amountPaid = purchase.amountPaid ?? 0;
                    await prisma.paymentLedgerEntry.create({
                        data: {
                            partyType: 'supplier',
                            partyId: purchase.supplierId,
                            accountType: 'payable',
                            accountId: apAccount.id,
                            voucherType: 'purchase',
                            voucherId: purchase.id,
                            againstVoucherType: null,
                            againstVoucherId: null,
                            amount: -totalAmount,
                            postingDate: purchase.purchaseDate ?? purchase.createdAt,
                            dueDate: purchase.dueDate,
                            remarks: `Recovery PLE: Purchase #${purchase.id}`,
                        },
                    });
                    const payments = await prisma.payment.findMany({
                        where: { referenceType: 'purchase', referenceId: purchase.id },
                    });
                    const paidViaPayments = payments.reduce((s, p) => s + p.amount, 0);
                    if (amountPaid > 0 && paidViaPayments < amountPaid) {
                        const paymentAmount = amountPaid - paidViaPayments;
                        const payment = await prisma.payment.create({
                            data: {
                                paymentNumber: `PAY-RECOVERY-${purchase.id}`,
                                paymentDate: purchase.purchaseDate ?? purchase.createdAt,
                                amount: paymentAmount,
                                paymentMethod: 'cash',
                                referenceType: 'purchase',
                                referenceId: purchase.id,
                                partyType: 'supplier',
                                partyId: purchase.supplierId,
                                partyName: purchase.supplierName,
                                branchId: purchase.branchId,
                                docstatus: 1,
                            },
                        });
                        await prisma.paymentLedgerEntry.create({
                            data: {
                                partyType: 'supplier',
                                partyId: purchase.supplierId,
                                accountType: 'payable',
                                accountId: apAccount.id,
                                voucherType: 'payment',
                                voucherId: payment.id,
                                againstVoucherType: 'purchase',
                                againstVoucherId: purchase.id,
                                amount: paymentAmount,
                                postingDate: payment.paymentDate,
                                remarks: `Recovery: payment against Purchase #${purchase.id}`,
                            },
                        });
                    }
                    console.log(`  ✓ PLE ${purchase.purchaseNumber}`);
                }
            }
        }

        console.log('\nRecovery completed.');
    } catch (err) {
        console.error('Error during recovery:', err);
    } finally {
        await prisma.$disconnect();
    }
}

recover();
