import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockLedgerService } from '../inventory/stock-ledger/stock-ledger.service';
import { StockAccountMapperService } from '../inventory/stock-ledger/stock-account-mapper.service';
import { AccountingService } from '../accounting/accounting.service';
import { PaymentLedgerService } from '../accounting/payment-ledger/payment-ledger.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';
import { PdfService } from '../pdf/pdf.service';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { buildPurchaseOrderPdfOptions } from '../pdf/templates/purchase-order.template';
import { buildReportPdfOptions } from '../pdf/templates/report.template';
import { formatDateForHeader } from '../pdf/pdf.helpers';
import { localizePaymentStatus } from '../pdf/pdf.localization';
import { ReceivePurchaseDto } from './dto/purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
    private paymentLedgerService: PaymentLedgerService,
    private stockLedgerService: StockLedgerService,
    private stockAccountMapperService: StockAccountMapperService,
    private pdfService: PdfService,
  ) { }

  /** Derive a logical status string from the DB fields */
  private computeStatus(p: { docstatus: number; isApproved: boolean; receivedAt: Date | null }): string {
    if (p.docstatus === 2) return 'cancelled';
    if (p.receivedAt || p.isApproved) return 'received';
    if (p.docstatus === 1) return 'ordered';
    return 'draft';
  }

  async findAll(pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [purchases, totalItems] = await Promise.all([
      this.prisma.purchase.findMany({
        skip,
        take: pageSize,
        include: { supplier: true, purchaseLines: { include: { item: true } } },
        orderBy: { purchaseDate: 'desc' },
      }),
      this.prisma.purchase.count(),
    ]);

    const mapped = purchases.map((p) => ({
      ...p,
      status: this.computeStatus(p),
    }));

    return createPaginatedResult(mapped, page, pageSize, totalItems);
  }

  async findById(id: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseLines: { include: { item: true } },
        inventoryLots: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Purchase not found',
        messageAr: 'أمر الشراء غير موجود',
      });
    }

    // Return only active payments to keep details aligned with financial state.
    const payments = await this.prisma.payment.findMany({
      where: {
        referenceType: 'purchase',
        referenceId: id,
        isVoided: false,
        docstatus: { not: 2 },
      },
    });

    return { ...purchase, payments, status: this.computeStatus(purchase) };
  }

  async getPurchaseOrderPdf(id: number, query: PdfQueryDto) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseLines: { include: { item: true } },
      },
    });

    if (!purchase) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Purchase not found',
        messageAr: 'أمر الشراء غير موجود',
      });
    }

    const payableTotal = purchase.grandTotal ?? purchase.totalAmount;
    const amountPaid = purchase.amountPaid ?? 0;
    const balanceDue = Math.max(0, payableTotal - amountPaid);

    const meta = await this.pdfService.getStoreMeta(this.prisma, query.language || 'en');

    const pdfData = {
      purchaseNumber: purchase.purchaseNumber,
      purchaseDate: purchase.purchaseDate.toISOString(),
      dueDate: purchase.dueDate?.toISOString(),
      supplierName: purchase.supplier?.name || purchase.supplierName,
      supplierPhone: purchase.supplier?.phone ?? undefined,
      items: purchase.purchaseLines.map((line) => ({
        itemName: line.itemName,
        itemCode: line.itemCode,
        quantity: line.weightGrams / 1000,
        unitPrice: line.pricePerKg,
        total: line.lineTotalAmount,
      })),
      taxAmount: purchase.taxAmount || 0,
      totalAmount: payableTotal,
      paymentStatus: purchase.paymentStatus,
      amountPaid,
      balanceDue,
      notes: purchase.notes ?? undefined,
    };

    const options = buildPurchaseOrderPdfOptions(meta as any, pdfData);

    return this.pdfService.generate(options);
  }

  async getPurchasesReportPdf(query: PdfQueryDto) {
    const language = query.language || 'en';
    const start = query.startDate ? new Date(query.startDate) : new Date(new Date().setDate(1));
    const end = query.endDate ? new Date(query.endDate) : new Date();

    const purchases = await this.prisma.purchase.findMany({
      where: {
        purchaseDate: { gte: start, lte: end },
        // docstatus? 1 usually means submitted/approved
      },
      include: { supplier: true },
      orderBy: { purchaseDate: 'asc' },
    });

    const meta = await this.pdfService.getStoreMeta(this.prisma, language);

    const rows = purchases.map(p => ({
      date: p.purchaseDate.toISOString().split('T')[0],
      number: p.purchaseNumber,
      supplier: p.supplier?.name || p.supplierName || 'Unknown',
      total: p.totalAmount,
      status: localizePaymentStatus(p.paymentStatus, language),
    }));

    const totalPurchases = rows.reduce((sum, r) => sum + (r.total || 0), 0);

    const options = buildReportPdfOptions(meta as any, {
      title: 'Purchases Report',
      titleAr: 'تقرير المشتريات',
      subtitle: `${formatDateForHeader(start)} — ${formatDateForHeader(end)}`,
      subtitleAr: `${formatDateForHeader(start)} — ${formatDateForHeader(end)}`,
      columns: [
        { header: 'Date', headerAr: 'التاريخ', field: 'date', width: 'auto', format: 'date' },
        { header: 'PO No', headerAr: 'رقم الشراء', field: 'number', width: 'auto' },
        { header: 'Supplier', headerAr: 'المورد', field: 'supplier', width: '*' },
        { header: 'Total', headerAr: 'الإجمالي', field: 'total', width: 'auto', format: 'currency' },
        { header: 'Status', headerAr: 'الحالة', field: 'status', width: 'auto' },
      ],
      rows,
      summaryItems: [
        { label: 'Total Purchases', labelAr: 'إجمالي المشتريات', value: totalPurchases, format: 'currency', bold: true }
      ]
    });

    return this.pdfService.generate(options);
  }

  private async assertPurchaseCanBeModifiedOrDeleted(tx: any, purchase: { id: number; docstatus: number; inventoryLots: Array<{ id: number }> }) {
    if (purchase.docstatus === 2) {
      throw new BadRequestException({
        code: 'PURCHASE_CANCELLED',
        message: 'Cancelled purchase cannot be modified',
        messageAr: 'لا يمكن تعديل أمر شراء ملغي',
      });
    }

    const [activePayments, activeCreditNotes] = await Promise.all([
      tx.payment.count({
        where: {
          referenceType: 'purchase',
          referenceId: purchase.id,
          docstatus: { not: 2 },
        },
      }),
      tx.creditNote.count({
        where: {
          originalInvoiceType: 'purchase',
          originalInvoiceId: purchase.id,
          docstatus: { not: 2 },
        },
      }),
    ]);

    if (activePayments > 0) {
      throw new BadRequestException({
        code: 'PURCHASE_HAS_PAYMENTS',
        message: 'Cannot modify purchase with linked payments',
        messageAr: 'لا يمكن تعديل أو حذف أمر شراء مرتبط بدفعات',
      });
    }

    if (activeCreditNotes > 0) {
      throw new BadRequestException({
        code: 'PURCHASE_HAS_CREDIT_NOTES',
        message: 'Cannot modify purchase with linked credit notes',
        messageAr: 'لا يمكن تعديل أو حذف أمر شراء مرتبط بإشعارات دائنة',
      });
    }

    const lotIds = purchase.inventoryLots.map((lot) => lot.id);
    if (lotIds.length === 0) return;

    const [saleAllocations, wastageRefs, transferRefs, nonPurchaseMovements] = await Promise.all([
      tx.saleLineCostAllocation.count({ where: { lotId: { in: lotIds } } }),
      tx.wastageRecord.count({
        where: {
          lotId: { in: lotIds },
          docstatus: { not: 2 },
        },
      }),
      tx.stockTransfer.count({
        where: {
          sourceLotId: { in: lotIds },
          status: { not: 'cancelled' },
        },
      }),
      tx.stockMovement.count({
        where: {
          lotId: { in: lotIds },
          NOT: {
            AND: [
              { movementType: 'purchase' },
              { referenceType: 'purchase' },
              { referenceId: purchase.id },
            ],
          },
        },
      }),
    ]);

    if (saleAllocations > 0 || wastageRefs > 0 || transferRefs > 0 || nonPurchaseMovements > 0) {
      throw new BadRequestException({
        code: 'PURCHASE_STOCK_ALREADY_USED',
        message: 'Cannot modify purchase because stock was already used',
        messageAr: 'لا يمكن تعديل أو حذف أمر الشراء لأن المخزون الناتج منه تم استخدامه',
      });
    }
  }

  private async rollbackPurchaseDerivedData(
    tx: any,
    purchase: {
      id: number;
      supplierId: number;
      grandTotal: number | null;
      totalAmount: number;
      amountPaid: number;
      purchaseLines: Array<{ itemId: number; weightGrams: number; lineTotalAmount: number }>;
    },
  ): Promise<void> {
    for (const line of purchase.purchaseLines) {
      const inventory = await tx.inventory.findUnique({ where: { itemId: line.itemId } });
      if (!inventory) continue;

      const newQty = Math.max(0, inventory.currentQuantityGrams - line.weightGrams);
      const newTotalValue = Math.max(0, inventory.totalValue - line.lineTotalAmount);

      await tx.inventory.update({
        where: { itemId: line.itemId },
        data: {
          currentQuantityGrams: newQty,
          totalValue: newTotalValue,
          averageCost: newQty > 0 ? Math.round((newTotalValue * 1000) / newQty) : 0,
        },
      });
    }

    await Promise.all([
      tx.stockMovement.deleteMany({ where: { referenceType: 'purchase', referenceId: purchase.id } }),
      tx.stockLedgerEntry.deleteMany({ where: { voucherType: 'purchase', voucherId: purchase.id } }),
      tx.inventoryLot.deleteMany({ where: { purchaseId: purchase.id } }),
      tx.purchaseLine.deleteMany({ where: { purchaseId: purchase.id } }),
      tx.journalEntry.deleteMany({ where: { sourceType: 'purchase', sourceId: purchase.id } }),
      tx.paymentLedgerEntry.deleteMany({
        where: {
          OR: [
            { voucherType: 'purchase', voucherId: purchase.id },
            { againstVoucherType: 'purchase', againstVoucherId: purchase.id },
          ],
        },
      }),
      tx.debt.deleteMany({ where: { sourceType: 'purchase', sourceId: purchase.id } }),
    ]);

    const previousGrandTotal = purchase.grandTotal ?? purchase.totalAmount;
    const previousOutstanding = Math.max(0, previousGrandTotal - (purchase.amountPaid ?? 0));
    if (previousOutstanding > 0) {
      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: { currentBalance: { decrement: previousOutstanding } },
      });
    }
  }

  async create(dto: any, userId: number) {
    const purchaseNumber = await this.generatePurchaseNumber();

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });

    if (!supplier) {
      throw new BadRequestException({
        code: 'SUPPLIER_NOT_FOUND',
        message: 'Supplier not found',
        messageAr: 'المورد غير موجود',
      });
    }

    const purchaseId = await this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;

      for (const line of dto.lines) {
        const lineAmount = Math.round((line.weightGrams / 1000) * line.pricePerKg);
        totalAmount += lineAmount;
      }

      const taxAmount = dto.taxAmount ?? 0;
      const netTotal = totalAmount; // Sum of lines
      const grandTotal = netTotal + taxAmount;
      const amountPaid = dto.amountPaid ?? 0;

      let paymentStatus = 'unpaid';
      if (amountPaid >= grandTotal && grandTotal > 0) paymentStatus = 'paid';
      else if (amountPaid > 0) paymentStatus = 'partial';

      const branchId = dto.branchId ?? null;
      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: dto.supplierId,
          supplierName: supplier.name,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          taxAmount,
          totalAmount: grandTotal, // Backward compatibility or specific use
          netTotal,
          grandTotal,
          paymentStatus,
          amountPaid,
          notes: dto.notes,
          branchId,
          receivedAt: new Date(), // Treat create as immediate receipt for accounting
          receivedById: userId,
          createdById: userId,
        },
      });

      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        const item = await tx.item.findUnique({ where: { id: line.itemId } });

        if (!item) continue;

        const lineTotal = Math.round((line.weightGrams / 1000) * line.pricePerKg);

        await tx.purchaseLine.create({
          data: {
            purchaseId: purchase.id,
            lineNumber: i + 1,
            itemId: line.itemId,
            itemName: item.name,
            itemCode: item.code,
            weightGrams: line.weightGrams,
            pricePerKg: line.pricePerKg,
            lineTotalAmount: lineTotal,
            isLiveBird: line.isLiveBird ?? false,
          },
        });
      }

      // Inventory receipt + accounting (treat create as immediate receipt)
      let totalInventoryValue = 0;
      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        const item = await tx.item.findUnique({ where: { id: line.itemId } });
        if (!item) continue;

        const lineTotal = Math.round((line.weightGrams / 1000) * line.pricePerKg);
        totalInventoryValue += lineTotal;

        const lotNumber = await this.generateLotNumber(tx);
        const lot = await tx.inventoryLot.create({
          data: {
            itemId: line.itemId,
            purchaseId: purchase.id,
            purchaseLineId: (await tx.purchaseLine.findFirst({
              where: { purchaseId: purchase.id, lineNumber: i + 1 },
            }))!.id,
            branchId,
            lotNumber,
            totalQuantityGrams: line.weightGrams,
            remainingQuantityGrams: line.weightGrams,
            unitPurchasePrice: line.pricePerKg,
            receivedAt: new Date(),
            expiryDate: item.shelfLifeDays
              ? new Date(Date.now() + item.shelfLifeDays * 24 * 60 * 60 * 1000)
              : null,
            createdById: userId,
          },
        });

        await tx.inventory.upsert({
          where: { itemId: line.itemId },
          update: {
            currentQuantityGrams: { increment: line.weightGrams },
            totalValue: { increment: lineTotal },
            lastRestockedAt: new Date(),
          },
          create: {
            itemId: line.itemId,
            branchId,
            currentQuantityGrams: line.weightGrams,
            reservedQuantityGrams: 0,
            totalValue: lineTotal,
            lastRestockedAt: new Date(),
          },
        });

        const inv = await tx.inventory.findUnique({ where: { itemId: line.itemId } });
        if (inv && inv.currentQuantityGrams > 0) {
          await tx.inventory.update({
            where: { itemId: line.itemId },
            data: { averageCost: Math.round((inv.totalValue * 1000) / inv.currentQuantityGrams) },
          });
        }

        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            lotId: lot.id,
            branchId,
            movementType: 'purchase',
            quantityGrams: line.weightGrams,
            unitCost: line.pricePerKg,
            referenceType: 'purchase',
            referenceId: purchase.id,
            performedById: userId,
          },
        });

        await this.stockLedgerService.createSLE(tx, {
          itemId: line.itemId,
          branchId,
          voucherType: 'purchase',
          voucherId: purchase.id,
          voucherDetailNo: `lot-${lot.lotNumber}`,
          qtyChange: line.weightGrams,
          valuationRate: line.pricePerKg,
          stockValueDifference: lineTotal,
          postingDate: new Date(),
          remarks: `Purchase ${purchase.purchaseNumber}`,
        });
      }

      if (totalInventoryValue > 0) {
        if (amountPaid > 0) {
          await this.accountingService.assertSufficientBalance(
            amountPaid,
            (dto.paymentMethod as string) ?? 'cash',
            dto.bankAccountId ?? null,
            purchase.purchaseDate ?? new Date(),
            tx,
          );
        }
        const stockAccountCode = await this.stockAccountMapperService.getStockAccountCode(branchId);
        await this.accountingService.createPurchaseJournalEntry(
          tx,
          purchase.id,
          purchase.purchaseNumber,
          branchId,
          userId,
          {
            totalAmount: totalInventoryValue,
            amountPaid: amountPaid,
            supplierId: dto.supplierId,
            stockAccountCode,
            paymentMethod: (dto.paymentMethod as string) ?? 'cash',
            bankAccountId: dto.bankAccountId ?? null,
          },
        );
      }

      // Create debt record if amount due
      const amountDue = grandTotal - amountPaid;
      if (amountDue > 0) {
        await tx.debt.create({
          data: {
            debtNumber: `DEB-${purchase.purchaseNumber}`,
            direction: 'payable',
            partyType: 'supplier',
            partyId: dto.supplierId,
            partyName: supplier.name,
            sourceType: 'purchase',
            sourceId: purchase.id,
            totalAmount: grandTotal,
            amountPaid: amountPaid,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            status: paymentStatus === 'paid' ? 'paid' : 'open',
            branchId: dto.branchId,
          },
        });

        // Update supplier balance
        await tx.supplier.update({
          where: { id: dto.supplierId },
          data: { currentBalance: { increment: amountDue } },
        });

        // Blueprint 04: PLE for payables
        await this.paymentLedgerService.createPLEForPurchase(
          tx,
          purchase.id,
          dto.supplierId,
          grandTotal,
          new Date(),
          dto.dueDate ? new Date(dto.dueDate) : null,
        );

        // Create Payment + PLE when partial payment at creation (aligns Debt with PLE)
        if (amountPaid > 0) {
          const paymentCount = await tx.payment.count();
          const paymentNumber = `PAY-${(paymentCount + 1).toString().padStart(6, '0')}`;
          const now = new Date();
          const payment = await tx.payment.create({
            data: {
              paymentNumber,
              paymentDate: now,
              amount: amountPaid,
              paymentMethod: (dto.paymentMethod as string) ?? 'cash',
              bankAccountId: dto.bankAccountId ?? null,
              referenceType: 'purchase',
              referenceId: purchase.id,
              partyType: 'supplier',
              partyId: dto.supplierId,
              partyName: supplier.name,
              receivedById: userId,
              branchId: dto.branchId ?? purchase.branchId,
              docstatus: 1,
            },
          });
          await this.paymentLedgerService.createPLEForPaymentAgainstPurchase(
            tx,
            payment.id,
            purchase.id,
            dto.supplierId,
            amountPaid,
            now,
          );
        }
      } else if (amountPaid > 0 && grandTotal > 0) {
        // Full payment at creation: create Payment for audit trail (no Debt/PLE needed)
        const paymentCount = await tx.payment.count();
        const paymentNumber = `PAY-${(paymentCount + 1).toString().padStart(6, '0')}`;
        await tx.payment.create({
          data: {
            paymentNumber,
            paymentDate: new Date(),
            amount: amountPaid,
            paymentMethod: (dto.paymentMethod as string) ?? 'cash',
            referenceType: 'purchase',
            referenceId: purchase.id,
            partyType: 'supplier',
            partyId: dto.supplierId,
            partyName: supplier.name,
            receivedById: userId,
            branchId: dto.branchId ?? purchase.branchId,
            docstatus: 1,
          },
        });
      }

      return purchase.id;
    });

    return this.findById(purchaseId);
  }

  async update(id: number, dto: any, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchase.findUnique({
        where: { id },
        include: {
          purchaseLines: true,
          inventoryLots: { select: { id: true } },
        },
      });

      if (!existing) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Purchase not found',
          messageAr: 'أمر الشراء غير موجود',
        });
      }

      await this.assertPurchaseCanBeModifiedOrDeleted(tx, existing);

      const supplierId = dto.supplierId ?? existing.supplierId;
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        throw new BadRequestException({
          code: 'SUPPLIER_NOT_FOUND',
          message: 'Supplier not found',
          messageAr: 'المورد غير موجود',
        });
      }

      const amountPaid = Number(dto.amountPaid ?? 0);
      if (amountPaid > 0) {
        throw new BadRequestException({
          code: 'PURCHASE_UPDATE_WITH_PAYMENT_NOT_ALLOWED',
          message: 'Update supports only unpaid purchases',
          messageAr: 'تعديل أمر الشراء مسموح فقط للأوامر غير المدفوعة',
        });
      }

      const incomingLines = Array.isArray(dto.lines) && dto.lines.length > 0
        ? dto.lines
        : existing.purchaseLines.map((line) => ({
          itemId: line.itemId,
          weightGrams: line.weightGrams,
          pricePerKg: line.pricePerKg,
          isLiveBird: line.isLiveBird,
        }));

      if (incomingLines.length === 0) {
        throw new BadRequestException({
          code: 'INVALID_LINES',
          message: 'At least one line is required',
          messageAr: 'يجب إدخال سطر واحد على الأقل',
        });
      }

      await this.rollbackPurchaseDerivedData(tx, existing);

      const normalizedLines: Array<{
        lineNumber: number;
        itemId: number;
        itemName: string;
        itemCode: string;
        weightGrams: number;
        pricePerKg: number;
        lineTotal: number;
        isLiveBird: boolean;
      }> = [];

      let netTotal = 0;
      for (let i = 0; i < incomingLines.length; i++) {
        const line = incomingLines[i];
        const item = await tx.item.findUnique({ where: { id: line.itemId } });

        if (!item) {
          throw new BadRequestException({
            code: 'ITEM_NOT_FOUND',
            message: `Item not found for line ${i + 1}`,
            messageAr: `الصنف غير موجود في السطر ${i + 1}`,
          });
        }

        const weightGrams = Number(line.weightGrams || 0);
        const pricePerKg = Number(line.pricePerKg || 0);

        if (weightGrams <= 0) {
          throw new BadRequestException({
            code: 'INVALID_WEIGHT',
            message: `Invalid weight in line ${i + 1}`,
            messageAr: `وزن غير صالح في السطر ${i + 1}`,
          });
        }

        if (pricePerKg < 0) {
          throw new BadRequestException({
            code: 'INVALID_PRICE',
            message: `Invalid price in line ${i + 1}`,
            messageAr: `سعر غير صالح في السطر ${i + 1}`,
          });
        }

        const lineTotal = Math.round((weightGrams / 1000) * pricePerKg);
        netTotal += lineTotal;

        normalizedLines.push({
          lineNumber: i + 1,
          itemId: item.id,
          itemName: item.name,
          itemCode: item.code,
          weightGrams,
          pricePerKg,
          lineTotal,
          isLiveBird: !!line.isLiveBird,
        });
      }

      const taxAmount = Math.max(0, Number(dto.taxAmount ?? existing.taxAmount ?? 0));
      const grandTotal = netTotal + taxAmount;
      const purchaseDate = dto.purchaseDate ? new Date(dto.purchaseDate) : existing.purchaseDate;
      const dueDate = dto.dueDate === '' ? null : (dto.dueDate ? new Date(dto.dueDate) : existing.dueDate);
      const paymentStatus = grandTotal > 0 ? 'unpaid' : 'paid';
      const branchId = dto.branchId ?? existing.branchId ?? null;

      await tx.purchase.update({
        where: { id },
        data: {
          supplierId,
          supplierName: supplier.name,
          purchaseDate,
          dueDate,
          taxAmount,
          totalAmount: grandTotal,
          netTotal,
          grandTotal,
          amountPaid: 0,
          paymentStatus,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          branchId,
          receivedAt: new Date(),
          receivedById: userId,
        },
      });

      let totalInventoryValue = 0;

      for (const line of normalizedLines) {
        const purchaseLine = await tx.purchaseLine.create({
          data: {
            purchaseId: id,
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            itemName: line.itemName,
            itemCode: line.itemCode,
            weightGrams: line.weightGrams,
            pricePerKg: line.pricePerKg,
            lineTotalAmount: line.lineTotal,
            isLiveBird: line.isLiveBird,
          },
        });

        totalInventoryValue += line.lineTotal;

        const lotNumber = await this.generateLotNumber(tx);
        const item = await tx.item.findUnique({ where: { id: line.itemId } });
        const lot = await tx.inventoryLot.create({
          data: {
            itemId: line.itemId,
            purchaseId: id,
            purchaseLineId: purchaseLine.id,
            branchId,
            lotNumber,
            totalQuantityGrams: line.weightGrams,
            remainingQuantityGrams: line.weightGrams,
            unitPurchasePrice: line.pricePerKg,
            receivedAt: new Date(),
            expiryDate: item?.shelfLifeDays
              ? new Date(Date.now() + item.shelfLifeDays * 24 * 60 * 60 * 1000)
              : null,
            createdById: userId,
          },
        });

        await tx.inventory.upsert({
          where: { itemId: line.itemId },
          update: {
            currentQuantityGrams: { increment: line.weightGrams },
            totalValue: { increment: line.lineTotal },
            lastRestockedAt: new Date(),
          },
          create: {
            itemId: line.itemId,
            branchId,
            currentQuantityGrams: line.weightGrams,
            reservedQuantityGrams: 0,
            totalValue: line.lineTotal,
            lastRestockedAt: new Date(),
          },
        });

        const inv = await tx.inventory.findUnique({ where: { itemId: line.itemId } });
        if (inv && inv.currentQuantityGrams > 0) {
          await tx.inventory.update({
            where: { itemId: line.itemId },
            data: { averageCost: Math.round((inv.totalValue * 1000) / inv.currentQuantityGrams) },
          });
        }

        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            lotId: lot.id,
            branchId,
            movementType: 'purchase',
            quantityGrams: line.weightGrams,
            unitCost: line.pricePerKg,
            referenceType: 'purchase',
            referenceId: id,
            performedById: userId,
          },
        });

        await this.stockLedgerService.createSLE(tx, {
          itemId: line.itemId,
          branchId,
          voucherType: 'purchase',
          voucherId: id,
          voucherDetailNo: `lot-${lot.lotNumber}`,
          qtyChange: line.weightGrams,
          valuationRate: line.pricePerKg,
          stockValueDifference: line.lineTotal,
          postingDate: purchaseDate,
          remarks: `Purchase ${existing.purchaseNumber} (updated)`,
        });
      }

      if (totalInventoryValue > 0) {
        const stockAccountCode = await this.stockAccountMapperService.getStockAccountCode(branchId);
        await this.accountingService.createPurchaseJournalEntry(
          tx,
          id,
          existing.purchaseNumber,
          branchId,
          userId,
          {
            totalAmount: totalInventoryValue,
            amountPaid: 0,
            supplierId,
            stockAccountCode,
          },
        );
      }

      if (grandTotal > 0) {
        await tx.debt.create({
          data: {
            debtNumber: `DEB-${existing.purchaseNumber}`,
            direction: 'payable',
            partyType: 'supplier',
            partyId: supplierId,
            partyName: supplier.name,
            sourceType: 'purchase',
            sourceId: id,
            totalAmount: grandTotal,
            amountPaid: 0,
            dueDate,
            status: 'open',
            branchId,
          },
        });

        await tx.supplier.update({
          where: { id: supplierId },
          data: { currentBalance: { increment: grandTotal } },
        });

        await this.paymentLedgerService.createPLEForPurchase(
          tx,
          id,
          supplierId,
          grandTotal,
          purchaseDate,
          dueDate,
        );
      }

      return this.findById(id);
    });
  }

  async remove(id: number, _userId: number) {
    await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id },
        include: {
          purchaseLines: true,
          inventoryLots: { select: { id: true } },
        },
      });

      if (!purchase) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Purchase not found',
          messageAr: 'أمر الشراء غير موجود',
        });
      }

      await this.assertPurchaseCanBeModifiedOrDeleted(tx, purchase);
      await this.rollbackPurchaseDerivedData(tx, purchase);

      await tx.purchase.delete({ where: { id } });
    });

    return {
      success: true,
      message: 'Purchase deleted successfully',
      messageAr: 'تم حذف أمر الشراء بنجاح',
    };
  }

  async receive(id: number, dto: ReceivePurchaseDto, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { purchaseLines: true },
    });

    if (!purchase) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Purchase not found',
        messageAr: 'أمر الشراء غير موجود',
      });
    }

    if (purchase.receivedAt) {
      throw new BadRequestException({
        code: 'ALREADY_RECEIVED',
        message: 'This purchase has already been received',
        messageAr: 'تم استلام هذا الشراء مسبقاً',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      for (const lineDto of dto.lines) {
        const line = purchase.purchaseLines.find((l) => l.id === lineDto.purchaseLineId);
        if (!line) continue;

        const lotNumber = lineDto.lotNumber ?? await this.generateLotNumber(tx);
        const item = await tx.item.findUnique({ where: { id: line.itemId } });

        // Create inventory lot
        const lot = await tx.inventoryLot.create({
          data: {
            itemId: line.itemId,
            purchaseId: id,
            purchaseLineId: line.id,
            lotNumber,
            totalQuantityGrams: lineDto.receivedWeightGrams,
            remainingQuantityGrams: lineDto.receivedWeightGrams,
            unitPurchasePrice: line.pricePerKg,
            receivedAt: new Date(),
            expiryDate: item?.shelfLifeDays
              ? new Date(Date.now() + item.shelfLifeDays * 24 * 60 * 60 * 1000)
              : null,
            createdById: userId,
          },
        });

        // Update inventory
        const lotValue = Math.round((lineDto.receivedWeightGrams / 1000) * line.pricePerKg);
        await tx.inventory.upsert({
          where: { itemId: line.itemId },
          update: {
            currentQuantityGrams: { increment: lineDto.receivedWeightGrams },
            totalValue: { increment: lotValue },
            lastRestockedAt: new Date(),
          },
          create: {
            itemId: line.itemId,
            currentQuantityGrams: lineDto.receivedWeightGrams,
            reservedQuantityGrams: 0,
            totalValue: lotValue,
            lastRestockedAt: new Date(),
          },
        });
        // Keep averageCost in sync (minor units per kg)
        const inv = await tx.inventory.findUnique({ where: { itemId: line.itemId } });
        if (inv && inv.currentQuantityGrams > 0) {
          await tx.inventory.update({
            where: { itemId: line.itemId },
            data: { averageCost: Math.round((inv.totalValue * 1000) / inv.currentQuantityGrams) },
          });
        }

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            lotId: lot.id,
            movementType: 'purchase',
            quantityGrams: lineDto.receivedWeightGrams,
            unitCost: line.pricePerKg,
            referenceType: 'purchase',
            referenceId: id,
            performedById: userId,
          },
        });

        // Blueprint 06: Stock Ledger Entry for purchase receipt
        await this.stockLedgerService.createSLE(tx, {
          itemId: line.itemId,
          branchId: purchase.branchId,
          voucherType: 'purchase',
          voucherId: id,
          voucherDetailNo: `lot-${lot.lotNumber}`,
          qtyChange: lineDto.receivedWeightGrams,
          valuationRate: line.pricePerKg,
          stockValueDifference: lotValue, // same as inventory increment
          postingDate: new Date(),
          remarks: `Purchase ${purchase.purchaseNumber} received`,
        });
      }

      await tx.purchase.update({
        where: { id },
        data: { receivedAt: new Date(), receivedById: userId },
      });

      // Create journal entry for inventory receipt
      // Calculate total received value
      let totalReceivedValue = 0;
      for (const lineDto of dto.lines) {
        const line = purchase.purchaseLines.find((l: any) => l.id === lineDto.purchaseLineId);
        if (line) {
          totalReceivedValue += Math.round((lineDto.receivedWeightGrams / 1000) * line.pricePerKg);
        }
      }

      const stockAccountCode = await this.stockAccountMapperService.getStockAccountCode(purchase.branchId);
      await this.accountingService.createPurchaseJournalEntry(
        tx,
        purchase.id,
        purchase.purchaseNumber,
        purchase.branchId ?? null,
        userId,
        {
          totalAmount: totalReceivedValue,
          amountPaid: Math.min(purchase.amountPaid, totalReceivedValue),
          supplierId: purchase.supplierId,
          stockAccountCode,
        },
      );

      return this.findById(id);
    });
  }

  private async generatePurchaseNumber(): Promise<string> {
    const count = await this.prisma.purchase.count();
    return `PUR-${(count + 1).toString().padStart(6, '0')}`;
  }

  private async generateLotNumber(tx: any): Promise<string> {
    const count = await tx.inventoryLot.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LOT-${date}-${(count + 1).toString().padStart(3, '0')}`;
  }
}
