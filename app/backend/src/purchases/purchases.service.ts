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

    return createPaginatedResult(purchases, page, pageSize, totalItems);
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

    // Get payments separately
    const payments = await this.prisma.payment.findMany({
      where: { referenceType: 'purchase', referenceId: id },
    });

    return { ...purchase, payments };
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

    const payments = await this.prisma.payment.findMany({
      where: { referenceType: 'purchase', referenceId: id },
    });
    const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);

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
      totalAmount: purchase.totalAmount,
      paymentStatus: purchase.paymentStatus,
      amountPaid: amountPaid,
      balanceDue: purchase.totalAmount - amountPaid,
      notes: purchase.notes ?? undefined,
    };

    const options = buildPurchaseOrderPdfOptions(meta as any, pdfData);

    return this.pdfService.generate(options);
  }

  async getPurchasesReportPdf(query: PdfQueryDto) {
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

    const meta = await this.pdfService.getStoreMeta(this.prisma, query.language || 'en');

    const rows = purchases.map(p => ({
      date: p.purchaseDate.toISOString().split('T')[0],
      number: p.purchaseNumber,
      supplier: p.supplier?.name || p.supplierName || 'Unknown',
      total: p.totalAmount,
      status: p.paymentStatus,
    }));

    const totalPurchases = rows.reduce((sum, r) => sum + (r.total || 0), 0);

    const options = buildReportPdfOptions(meta as any, {
      title: 'Purchases Report',
      titleAr: 'تقرير المشتريات',
      subtitle: `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`,
      columns: [
        { header: 'Date', headerAr: 'التاريخ', field: 'date', width: 'auto' },
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
      totalAmount += taxAmount;

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: dto.supplierId,
          supplierName: supplier.name,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          taxAmount,
          totalAmount,
          paymentStatus: 'unpaid',
          amountPaid: 0,
          notes: dto.notes,
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

      return purchase.id;
    });

    return this.findById(purchaseId);
  }

  async receive(id: number, dto: any, userId: number) {
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
          amountPaid: 0, // Payment is recorded separately
          stockAccountCode,
        },
      );

      // Blueprint 04: PLE for payables
      await this.paymentLedgerService.createPLEForPurchase(
        tx,
        purchase.id,
        purchase.supplierId,
        purchase.totalAmount,
        new Date(),
        purchase.dueDate,
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
