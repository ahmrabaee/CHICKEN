import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingService } from '../accounting/accounting.service';
import {
  CreateSaleDto, VoidSaleDto, AddPaymentDto, SaleResponseDto, SaleQueryDto,
} from './dto';
import { createPaginatedResult, PaginationQueryDto } from '../common';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private accountingService: AccountingService,
  ) {}

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

  async findById(id: number): Promise<SaleResponseDto> {
    const sale = await this.prisma.sale.findUnique({
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
    const payments = await this.prisma.payment.findMany({
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

  async create(dto: CreateSaleDto, cashierId: number, userRoles: string[]) {
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
      
      const taxAmount = 0; // No tax for now
      const totalAmount = subtotal + taxAmount;

      // Calculate payments
      const totalPayments = dto.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
      const paymentStatus = totalPayments >= totalAmount ? 'paid' : totalPayments > 0 ? 'partial' : 'unpaid';

      // Create sale
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          saleDate: new Date(),
          saleType: dto.saleType,
          customerId: dto.customerId,
          customerName: customer?.name,
          customerPhone: customer?.phone,
          cashierId,
          grossTotalAmount: grossTotal,
          discountAmount: totalDiscount,
          discountPct: dto.discountPct,
          taxAmount,
          totalAmount,
          totalCost,
          totalProfit: totalAmount - totalCost,
          paymentStatus,
          amountPaid: totalPayments,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes,
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
      }

      // Create payments
      if (dto.payments) {
        for (const payment of dto.payments) {
          await tx.payment.create({
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

      // Create automatic journal entry for accounting
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
        },
      );

      return this.findById(sale.id);
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
      }

      // Mark sale as voided
      await tx.sale.update({
        where: { id },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          voidedById: userId,
          voidReason: dto.reason,
        },
      });

      // Void any payments
      await tx.payment.updateMany({
        where: { referenceType: 'sale', referenceId: id },
        data: { isVoided: true },
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

      // Create reversal journal entry
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
      // Create payment
      await tx.payment.create({
        data: {
          paymentNumber: await this.generatePaymentNumber(tx),
          paymentDate: new Date(),
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
