import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingService } from '../accounting/accounting.service';
import { PaymentLedgerService } from '../accounting/payment-ledger/payment-ledger.service';
import { TaxCalculationService } from '../accounting/tax/tax-calculation.service';
import { StockLedgerService } from '../inventory/stock-ledger/stock-ledger.service';
import { StockAccountMapperService } from '../inventory/stock-ledger/stock-account-mapper.service';
import {
  CreateSaleDto, VoidSaleDto, AddPaymentDto, SaleResponseDto, SaleQueryDto,
} from './dto';
import {
  createPaginatedResult,
  PaginationQueryDto,
  PeriodLockGuard,
} from '../common';
import { PdfService } from '../pdf/pdf.service';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { buildInvoicePdfOptions } from '../pdf/templates/invoice.template';
import { buildReportPdfOptions } from '../pdf/templates/report.template';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private accountingService: AccountingService,
    private paymentLedgerService: PaymentLedgerService,
    private stockLedgerService: StockLedgerService,
    private stockAccountMapperService: StockAccountMapperService,
    private taxCalculationService: TaxCalculationService,
    private pdfService: PdfService,
  ) { }

  async findAll(query: SaleQueryDto, pagination: PaginationQueryDto, userId: number, isAdmin: boolean) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: any = { isVoided: false };

    if (!isAdmin) {
      where.cashierId = userId;
    }

    if (query.customerId) where.customerId = query.customerId;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.startDate) where.saleDate = { gte: new Date(query.startDate) };
    if (query.endDate) where.saleDate = { ...where.saleDate, lte: new Date(query.endDate) };

    const [sales, totalItems] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: pageSize,
        include: { customer: true, saleLines: { include: { item: true } } },
        orderBy: { saleDate: 'desc' },
      }),
      this.prisma.sale.count({ where }),
    ]);

    const items = sales.map((s) => this.toResponseDto(s));
    return createPaginatedResult(items, page, pageSize, totalItems);
  }

  async findById(id: number, tx?: any): Promise<SaleResponseDto> {
    const prisma = tx ?? this.prisma;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        saleLines: {
          include: {
            item: true,
            costAllocations: { include: { lot: true } },
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Sale not found',
        messageAr: 'عملية البيع غير موجودة',
      });
    }

    // Get payments separately
    const payments = await prisma.payment.findMany({
      where: { referenceType: 'sale', referenceId: id },
    });

    return this.toResponseDto({ ...sale, payments }, true);
  }

  async getReceipt(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        saleLines: { include: { item: true } },
        cashier: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
    });

    if (!sale) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Sale not found',
        messageAr: 'عملية البيع غير موجودة',
      });
    }

    // Get payments
    const payments = await this.prisma.payment.findMany({
      where: { referenceType: 'sale', referenceId: id },
    });

    // Get settings for receipt header/footer
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { in: ['store_name', 'receipt_header', 'receipt_footer', 'tax_number'] } },
    });

    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);

    return {
      sale: this.toResponseDto(sale),
      storeName: settingsMap['store_name'] ?? 'Chicken Shop',
      header: settingsMap['receipt_header'],
      footer: settingsMap['receipt_footer'],
      taxNumber: settingsMap['tax_number'],
      cashierName: (sale as any).cashier?.fullName,
      branchName: (sale as any).branch?.name,
      payments: payments.map((p) => ({
        method: p.paymentMethod,
        amount: p.amount,
        date: p.paymentDate,
      })),
      printedAt: new Date().toISOString(),
    };
  }

  async getInvoicePdf(id: number, query: PdfQueryDto) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        saleLines: { include: { item: true } },
        cashier: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
    });

    if (!sale) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Sale not found',
        messageAr: 'عملية البيع غير موجودة',
      });
    }

    const payments = await this.prisma.payment.findMany({
      where: { referenceType: 'sale', referenceId: id },
    });

    const meta = await this.pdfService.getStoreMeta(this.prisma, query.language || 'en');

    const pdfData = {
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate.toISOString(),
      customerName: sale.customer?.name || sale.customerName || (query.language === 'ar' ? 'عميل نقدي' : 'Walk-in Customer'),
      customerPhone: sale.customer?.phone || sale.customerPhone || undefined,
      cashierName: sale.cashier?.fullName || 'System',
      branchName: sale.branch?.name || '',
      items: sale.saleLines.map((line) => ({
        name: line.item?.name || line.itemName,
        quantity: line.weightGrams / 1000,
        unitPrice: line.pricePerKg,
        total: line.lineTotalAmount,
      })),
      subtotal: sale.grossTotalAmount,
      discount: sale.discountAmount,
      taxAmount: sale.taxAmount,
      totalAmount: sale.totalAmount,
      paidAmount: sale.amountPaid,
      balanceDue: sale.totalAmount - sale.amountPaid,
      payments: payments.map((p) => ({
        method: p.paymentMethod,
        amount: p.amount,
        date: p.paymentDate.toISOString(),
      })),
      isVoided: sale.isVoided,
      voidReason: sale.voidReason ?? undefined,
    };

    const options = buildInvoicePdfOptions(meta as any, pdfData);

    return this.pdfService.generate(options);
  }

  async getSalesReportPdf(query: PdfQueryDto) {
    const start = query.startDate ? new Date(query.startDate) : new Date(new Date().setDate(1));
    const end = query.endDate ? new Date(query.endDate) : new Date();

    const sales = await this.prisma.sale.findMany({
      where: {
        saleDate: { gte: start, lte: end },
        docstatus: 1, // Submitted
      },
      include: { customer: true },
      orderBy: { saleDate: 'asc' },
    });

    const meta = await this.pdfService.getStoreMeta(this.prisma, query.language || 'en');

    const rows = sales.map(s => ({
      date: s.saleDate.toISOString().split('T')[0],
      number: s.saleNumber,
      customer: s.customer?.name || s.customerName || 'Cash Customer',
      total: s.grandTotal ?? s.totalAmount, // Fallback
      status: s.paymentStatus,
    }));

    const totalSales = rows.reduce((sum, r) => sum + (r.total || 0), 0);

    const options = buildReportPdfOptions(meta as any, {
      title: 'Sales Report',
      titleAr: 'تقرير المبيعات',
      subtitle: `${start.toISOString().split('T')[0]} - ${end.toISOString().split('T')[0]}`,
      columns: [
        { header: 'Date', headerAr: 'التاريخ', field: 'date', width: 'auto' },
        { header: 'Sale No', headerAr: 'رقم البيع', field: 'number', width: 'auto' },
        { header: 'Customer', headerAr: 'العميل', field: 'customer', width: '*' },
        { header: 'Total', headerAr: 'الإجمالي', field: 'total', width: 'auto', format: 'currency' },
        { header: 'Status', headerAr: 'الحالة', field: 'status', width: 'auto' },
      ],
      rows,
      summaryItems: [
        { label: 'Total Sales', labelAr: 'إجمالي المبيعات', value: totalSales, format: 'currency', bold: true }
      ]
    });

    return this.pdfService.generate(options);
  }

  async create(dto: CreateSaleDto, cashierId: number, userRoles: string[], branchId?: number) {
    const isAdmin = userRoles.includes('admin');
    const maxDiscountPct = isAdmin ? 10000 : 500; // Admin unlimited, cashier 5%

    // Validate discount
    if (dto.discountPct && dto.discountPct > maxDiscountPct) {
      throw new ForbiddenException({
        code: 'DISCOUNT_LIMIT_EXCEEDED',
        message: `Discount cannot exceed ${maxDiscountPct / 100}%`,
        messageAr: `الخصم لا يمكن أن يتجاوز ${maxDiscountPct / 100}%`,
      });
    }

    // Validate customer if provided
    let customer = null;
    if (dto.customerId) {
      customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });

      if (!customer) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Customer not found',
          messageAr: 'العميل غير موجود',
        });
      }
    }

    // Generate sale number
    const saleNumber = await this.generateSaleNumber();

    return this.prisma.$transaction(async (tx) => {
      let grossTotal = 0;
      let totalCost = 0;
      const saleLineData: any[] = [];

      // Process each line with FIFO allocation
      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        const item = await tx.item.findUnique({
          where: { id: line.itemId },
          include: { inventory: true },
        });

        if (!item) {
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: `Item ${line.itemId} not found`,
            messageAr: `المنتج ${line.itemId} غير موجود`,
          });
        }

        // Check stock
        const availableStock = item.inventory?.currentQuantityGrams ?? 0;
        if (availableStock < line.weightGrams && !item.allowNegativeStock) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for ${item.name}. Available: ${availableStock}g`,
            messageAr: `المخزون غير كاف لـ ${item.name}. المتوفر: ${availableStock} جرام`,
          });
        }

        // FIFO allocation
        const allocations = await this.inventoryService.allocateFIFO(line.itemId, line.weightGrams);
        const lineCost = allocations.reduce((sum, a) => sum + a.totalCost, 0);
        const lineGross = Math.round((line.weightGrams / 1000) * line.pricePerKg);
        const lineDiscount = line.discountAmount ?? 0;
        const netPricePerKg = Math.round(line.pricePerKg - (lineDiscount * 1000 / line.weightGrams));
        const lineTotal = lineGross - lineDiscount;
        const costPerKg = line.weightGrams > 0 ? Math.round(lineCost / (line.weightGrams / 1000)) : 0;

        grossTotal += lineTotal;
        totalCost += lineCost;

        saleLineData.push({
          lineNumber: i + 1,
          itemId: line.itemId,
          itemName: item.name,
          itemCode: item.code,
          weightGrams: line.weightGrams,
          pricePerKg: line.pricePerKg,
          discountAmount: lineDiscount,
          netPricePerKg,
          lineTotalAmount: lineTotal,
          costPerKg,
          lineTotalCost: lineCost,
          allocations,
        });
      }

      // Calculate totals
      const saleDiscount = dto.discountAmount ?? 0;
      const discountFromPct = dto.discountPct
        ? Math.round((grossTotal * dto.discountPct) / 10000)
        : 0;
      const totalDiscount = saleDiscount + discountFromPct;
      const subtotal = grossTotal - totalDiscount;

      let netTotal = subtotal;
      let totalTaxAmount = 0;
      let grandTotal = subtotal;
      if (dto.taxTemplateId) {
        const taxResults = await this.taxCalculationService.calculateTaxes(dto.taxTemplateId, subtotal, 2);
        totalTaxAmount = taxResults.reduce((s, r) => s + r.amount, 0);
        grandTotal = subtotal + totalTaxAmount;
      }
      const totalAmount = grandTotal;

      // Calculate payments
      const totalPayments = dto.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
      const paymentStatus = totalPayments >= totalAmount ? 'paid' : totalPayments > 0 ? 'partial' : 'unpaid';

      // Create sale
      const now = new Date();
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          saleDate: now,
          saleType: dto.saleType,
          customerId: dto.customerId ?? undefined,
          customerName: customer?.name ?? dto.customerName ?? null,
          customerPhone: customer?.phone ?? dto.customerPhone ?? null,
          cashierId,
          branchId: branchId ?? undefined,
          grossTotalAmount: grossTotal,
          discountAmount: totalDiscount,
          discountPct: dto.discountPct,
          taxAmount: totalTaxAmount,
          totalAmount,
          totalCost,
          totalProfit: totalAmount - totalCost,
          taxTemplateId: dto.taxTemplateId ?? undefined,
          netTotal: dto.taxTemplateId ? netTotal : null,
          totalTaxAmount,
          grandTotal: dto.taxTemplateId ? grandTotal : null,
          paymentStatus,
          amountPaid: totalPayments,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes,
          docstatus: 1,
          submittedAt: now,
          submittedById: cashierId,
        },
      });

      // Create sale lines and cost allocations
      for (const line of saleLineData) {
        const saleLine = await tx.saleLine.create({
          data: {
            saleId: sale.id,
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            itemName: line.itemName,
            itemCode: line.itemCode,
            weightGrams: line.weightGrams,
            pricePerKg: line.pricePerKg,
            discountAmount: line.discountAmount,
            netPricePerKg: line.netPricePerKg,
            lineTotalAmount: line.lineTotalAmount,
            costPerKg: line.costPerKg,
            lineTotalCost: line.lineTotalCost,
          },
        });

        // Create cost allocations
        for (const alloc of line.allocations) {
          await tx.saleLineCostAllocation.create({
            data: {
              saleLineId: saleLine.id,
              lotId: alloc.lotId,
              quantityAllocatedGrams: alloc.quantityGrams,
              unitCost: alloc.costPerKg,
              totalCost: alloc.totalCost,
            },
          });

          // Deduct from lot
          await tx.inventoryLot.update({
            where: { id: alloc.lotId },
            data: { remainingQuantityGrams: { decrement: alloc.quantityGrams } },
          });
        }

        // Update inventory
        await tx.inventory.update({
          where: { itemId: line.itemId },
          data: {
            currentQuantityGrams: { decrement: line.weightGrams },
            totalValue: { decrement: line.lineTotalCost },
            lastSoldAt: new Date(),
          },
        });
        // Keep averageCost in sync after sale
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
            movementType: 'sale',
            quantityGrams: -line.weightGrams,
            unitCost: line.costPerKg,
            referenceType: 'sale',
            referenceId: sale.id,
            performedById: cashierId,
          },
        });

        // Blueprint 06: Stock Ledger Entry (SLE) for each sale line
        const valuationRate = line.weightGrams > 0 ? Math.round((line.lineTotalCost * 1000) / line.weightGrams) : 0;
        await this.stockLedgerService.createSLE(tx, {
          itemId: line.itemId,
          branchId: sale.branchId,
          voucherType: 'sale',
          voucherId: sale.id,
          voucherDetailNo: `line-${line.lineNumber}`,
          qtyChange: -line.weightGrams,
          valuationRate,
          stockValueDifference: -line.lineTotalCost,
          postingDate: now,
          remarks: `Sale ${sale.saleNumber} line ${line.lineNumber}`,
        });
      }

      // Create payments and PLE for each
      if (dto.payments) {
        for (const payment of dto.payments) {
          const payRec = await tx.payment.create({
            data: {
              paymentNumber: await this.generatePaymentNumber(tx),
              paymentDate: new Date(),
              amount: payment.amount,
              paymentMethod: payment.paymentMethod,
              referenceType: 'sale',
              referenceId: sale.id,
              partyType: 'customer',
              partyId: dto.customerId,
              partyName: customer?.name,
              receivedById: cashierId,
            },
          });
          if (dto.customerId) {
            await this.paymentLedgerService.createPLEForPaymentAgainstSale(
              tx,
              payRec.id,
              sale.id,
              dto.customerId,
              payment.amount,
              now,
            );
          }
        }
      }

      // Create debt record if amount due
      const amountDue = totalAmount - totalPayments;
      if (amountDue > 0 && dto.customerId) {
        await tx.debt.create({
          data: {
            debtNumber: `DEB-${sale.saleNumber}`,
            direction: 'receivable',
            partyType: 'customer',
            partyId: dto.customerId,
            partyName: customer?.name ?? 'Unknown',
            sourceType: 'sale',
            sourceId: sale.id,
            totalAmount: amountDue,
            amountPaid: 0,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            status: 'open',
          },
        });

        // Update customer balance
        await tx.customer.update({
          where: { id: dto.customerId },
          data: { currentBalance: { increment: amountDue } },
        });
      }

      // Create automatic journal entry for accounting (Blueprint 06: branch stock account)
      const stockAccountCode = await this.stockAccountMapperService.getStockAccountCode(sale.branchId);
      await this.accountingService.createSaleJournalEntry(
        tx,
        sale.id,
        sale.saleNumber,
        sale.branchId ?? null,
        cashierId,
        {
          totalAmount,
          totalCost,
          amountPaid: totalPayments,
          customerId: dto.customerId,
          discountAmount: totalDiscount,
          stockAccountCode,
          saleDate: sale.saleDate,
          taxTemplateId: sale.taxTemplateId ?? undefined,
          netTotal: sale.netTotal ?? undefined,
          totalTaxAmount: sale.totalTaxAmount ?? undefined,
          grandTotal: sale.grandTotal ?? undefined,
        },
      );

      // Blueprint 04: Payment Ledger (PLE) for receivables
      if (dto.customerId && totalAmount > 0) {
        await this.paymentLedgerService.createPLEForSale(
          tx,
          sale.id,
          dto.customerId,
          totalAmount,
          now,
          dto.dueDate ? new Date(dto.dueDate) : null,
        );
      }

      return this.findById(sale.id, tx);
    });
  }

  async voidSale(id: number, dto: VoidSaleDto, userId: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        saleLines: { include: { costAllocations: true } },
      },
    });

    if (!sale) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Sale not found',
        messageAr: 'عملية البيع غير موجودة',
      });
    }

    if (sale.isVoided) {
      throw new BadRequestException({
        code: 'ALREADY_VOIDED',
        message: 'Sale is already voided',
        messageAr: 'عملية البيع ملغاة بالفعل',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    return this.prisma.$transaction(async (tx) => {
      // Blueprint 03: Check period lock before cancel
      await PeriodLockGuard.check(sale.saleDate, null, tx);

      // Blueprint 03: Reverse GL for each payment that has its own JE (from recordSalePayment)
      const salePayments = await tx.payment.findMany({
        where: { referenceType: 'sale', referenceId: id, isVoided: false },
      });
      for (const payment of salePayments) {
        const hasJE = await tx.journalEntry.findFirst({
          where: { sourceType: 'payment', sourceId: payment.id },
        });
        if (hasJE) {
          await this.accountingService.reverseByVoucher('payment', payment.id, userId, tx);
        }
        await this.paymentLedgerService.delinkPLEForVoucher('payment', payment.id, tx);
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            docstatus: 2,
            isVoided: true,
            cancelledAt: new Date(),
            cancelledById: userId,
            cancelReason: dto.reason,
          },
        });
      }

      // Restore inventory from each line
      for (const line of sale.saleLines) {
        // Restore to lots from cost allocations
        for (const alloc of line.costAllocations) {
          await tx.inventoryLot.update({
            where: { id: alloc.lotId },
            data: { remainingQuantityGrams: { increment: alloc.quantityAllocatedGrams } },
          });
        }

        // Restore inventory
        await tx.inventory.update({
          where: { itemId: line.itemId },
          data: {
            currentQuantityGrams: { increment: line.weightGrams },
            totalValue: { increment: line.lineTotalCost },
          },
        });

        // Create reversal stock movement
        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            movementType: 'void',
            quantityGrams: line.weightGrams,
            unitCost: line.costPerKg,
            referenceType: 'sale_void',
            referenceId: id,
            reason: dto.reason,
            performedById: userId,
          },
        });

        // Blueprint 06: Reverse SLE for void
        const valuationRate = line.weightGrams > 0 ? Math.round((line.lineTotalCost * 1000) / line.weightGrams) : 0;
        await this.stockLedgerService.createSLE(tx, {
          itemId: line.itemId,
          branchId: sale.branchId,
          voucherType: 'sale_void',
          voucherId: id,
          voucherDetailNo: `line-${line.lineNumber}`,
          qtyChange: line.weightGrams,
          valuationRate,
          stockValueDifference: line.lineTotalCost,
          postingDate: new Date(),
          remarks: `Void sale ${sale.saleNumber}: ${dto.reason}`,
        });
      }

      // Blueprint 04: Delink PLE for voided sale
      await this.paymentLedgerService.delinkPLEForVoucher('sale', id, tx);

      // Mark sale as voided (Blueprint 03: docstatus=2)
      const now = new Date();
      await tx.sale.update({
        where: { id },
        data: {
          isVoided: true,
          voidedAt: now,
          voidedById: userId,
          voidReason: dto.reason,
          docstatus: 2,
          cancelledAt: now,
          cancelledById: userId,
          cancelReason: dto.reason,
        },
      });

      // Update debt if exists
      const amountDue = sale.totalAmount - sale.amountPaid;
      if (sale.customerId && amountDue > 0) {
        await tx.debt.updateMany({
          where: { sourceType: 'sale', sourceId: id },
          data: { status: 'written_off' },
        });

        await tx.customer.update({
          where: { id: sale.customerId },
          data: { currentBalance: { decrement: amountDue } },
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          username: user?.username ?? 'unknown',
          action: 'void',
          entityType: 'Sale',
          entityId: id,
          changes: JSON.stringify({ reason: dto.reason }),
        },
      });

      // Create reversal journal entry (Blueprint 06: branch stock account)
      const stockAccountCode = await this.stockAccountMapperService.getStockAccountCode(sale.branchId);
      await this.accountingService.createSaleVoidJournalEntry(
        tx,
        sale.id,
        sale.saleNumber,
        sale.branchId ?? null,
        userId,
        {
          totalAmount: sale.totalAmount,
          totalCost: sale.totalCost,
          amountPaid: sale.amountPaid,
          discountAmount: sale.discountAmount,
          stockAccountCode,
          customerId: sale.customerId ?? undefined,
          taxTemplateId: sale.taxTemplateId ?? undefined,
          netTotal: sale.netTotal ?? undefined,
          totalTaxAmount: sale.totalTaxAmount ?? undefined,
          grandTotal: sale.grandTotal ?? undefined,
        },
      );

      return this.findById(id);
    });
  }

  async addPayment(id: number, dto: AddPaymentDto, userId: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
    });

    if (!sale) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Sale not found',
        messageAr: 'عملية البيع غير موجودة',
      });
    }

    const amountDue = sale.totalAmount - sale.amountPaid;
    if (amountDue <= 0) {
      throw new BadRequestException({
        code: 'ALREADY_PAID',
        message: 'Sale is already fully paid',
        messageAr: 'عملية البيع مدفوعة بالكامل',
      });
    }

    if (dto.amount > amountDue) {
      throw new BadRequestException({
        code: 'OVERPAYMENT',
        message: `Payment exceeds amount due. Maximum: ${amountDue}`,
        messageAr: `المبلغ يتجاوز المستحق. الحد الأقصى: ${amountDue}`,
      });
    }

    const customer = sale.customerId
      ? await this.prisma.customer.findUnique({ where: { id: sale.customerId } })
      : null;

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const payRec = await tx.payment.create({
        data: {
          paymentNumber: await this.generatePaymentNumber(tx),
          paymentDate: now,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          referenceType: 'sale',
          referenceId: id,
          partyType: 'customer',
          partyId: sale.customerId,
          partyName: customer?.name,
          receiptNumber: dto.referenceNumber,
          receivedById: userId,
          notes: dto.notes,
        },
      });

      if (sale.customerId) {
        await this.paymentLedgerService.createPLEForPaymentAgainstSale(
          tx,
          payRec.id,
          id,
          sale.customerId,
          dto.amount,
          now,
        );
      }

      const newAmountPaid = sale.amountPaid + dto.amount;
      const newAmountDue = sale.totalAmount - newAmountPaid;
      const newPaymentStatus = newAmountDue <= 0 ? 'paid' : 'partial';

      // Update sale
      await tx.sale.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus: newPaymentStatus,
        },
      });

      // Update debt
      if (sale.customerId) {
        await tx.debt.updateMany({
          where: { sourceType: 'sale', sourceId: id },
          data: {
            amountPaid: { increment: dto.amount },
            status: newPaymentStatus === 'paid' ? 'paid' : 'partial',
          },
        });

        // Update customer balance
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { currentBalance: { decrement: dto.amount } },
        });
      }

      return this.findById(id);
    });
  }

  private async generateSaleNumber(): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.sale.count({
      where: {
        saleDate: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    });
    return `SAL-${datePrefix}-${(count + 1).toString().padStart(4, '0')}`;
  }

  private async generatePaymentNumber(tx: any): Promise<string> {
    const count = await tx.payment.count();
    return `PAY-${(count + 1).toString().padStart(6, '0')}`;
  }

  private toResponseDto(sale: any, includeDetails = false): SaleResponseDto {
    const amountDue = sale.totalAmount - sale.amountPaid;

    const response: SaleResponseDto = {
      id: sale.id,
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate.toISOString(),
      saleType: sale.saleType,
      customerId: sale.customerId,
      customerName: sale.customer?.name ?? sale.customerName,
      grossTotalAmount: sale.grossTotalAmount,
      discountAmount: sale.discountAmount,
      taxAmount: sale.taxAmount,
      totalAmount: sale.totalAmount,
      totalCost: sale.totalCost,
      totalProfit: sale.totalProfit,
      paymentStatus: sale.paymentStatus,
      amountPaid: sale.amountPaid,
      amountDue,
      isVoided: sale.isVoided,
      voidReason: sale.voidReason,
      notes: sale.notes,
      createdAt: sale.createdAt.toISOString(),
    };

    if (includeDetails && sale.saleLines) {
      response.lines = sale.saleLines.map((line: any) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        itemName: line.item?.name ?? line.itemName,
        itemCode: line.item?.code ?? line.itemCode,
        weightGrams: line.weightGrams,
        pricePerKg: line.pricePerKg,
        discountAmount: line.discountAmount,
        lineTotalAmount: line.lineTotalAmount,
        costPerKg: line.costPerKg,
        lineTotalCost: line.lineTotalCost,
        costAllocations: line.costAllocations?.map((a: any) => ({
          lotId: a.lotId,
          lotNumber: a.lot?.lotNumber,
          quantityGrams: a.quantityAllocatedGrams,
          unitCost: a.unitCost,
          totalCost: a.totalCost,
        })),
      }));
    }

    if (includeDetails && sale.payments) {
      response.payments = sale.payments.map((p: any) => ({
        id: p.id,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate.toISOString(),
        referenceNumber: p.receiptNumber,
      }));
    }

    return response;
  }
}
