import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';
import { PaymentLedgerService } from '../accounting/payment-ledger/payment-ledger.service';
import { PdfService } from '../pdf/pdf.service';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { buildStatementPdfOptions } from '../pdf/templates/statement.template';

@Injectable()
export class SuppliersService {
  constructor(
    private prisma: PrismaService,
    private paymentLedgerService: PaymentLedgerService,
    private pdfService: PdfService,
  ) { }

  async findAll(pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [suppliers, totalItems] = await Promise.all([
      this.prisma.supplier.findMany({
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count(),
    ]);

    return createPaginatedResult(suppliers, page, pageSize, totalItems);
  }

  async findById(id: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Supplier not found',
        messageAr: 'المورد غير موجود',
      });
    }

    return supplier;
  }

  async create(dto: any, userId?: number) {
    const existing = await this.prisma.supplier.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE',
        message: 'Supplier with this name already exists',
        messageAr: 'المورد بهذا الاسم موجود بالفعل',
      });
    }

    const supplierNumber = await this.generateSupplierNumber();

    return this.prisma.supplier.create({
      data: {
        ...dto,
        supplierNumber,
        isActive: true,
        createdById: userId,
      },
    });
  }

  private async generateSupplierNumber(): Promise<string> {
    const count = await this.prisma.supplier.count();
    return `SUP-${(count + 1).toString().padStart(4, '0')}`;
  }

  async update(id: number, dto: any) {
    await this.findById(id);

    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: number) {
    await this.findById(id);

    const hasPurchases = await this.prisma.purchase.findFirst({
      where: { supplierId: id },
    });

    if (hasPurchases) {
      return this.prisma.supplier.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.supplier.delete({ where: { id } });
  }

  async getStatementPdf(id: number, query: PdfQueryDto) {
    const supplier = await this.findById(id);

    const start = query.startDate ? new Date(query.startDate) : new Date(new Date().setDate(1));
    const end = query.endDate ? new Date(query.endDate) : new Date();

    const statementData = await this.paymentLedgerService.getStatement(
      'supplier',
      id,
      start,
      end,
    );

    const meta = await this.pdfService.getStoreMeta(this.prisma, query.language || 'en');

    const pdfData = {
      partyName: query.language === 'ar' ? (supplier.name || supplier.nameEn || '') : (supplier.nameEn || supplier.name || ''),
      partyAddress: supplier.address || undefined,
      partyPhone: supplier.phone || undefined,
      partyTaxNumber: supplier.taxNumber || undefined,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      openingBalance: statementData.openingBalance,
      totalDebits: statementData.totalDebits,
      totalCredits: statementData.totalCredits,
      closingBalance: statementData.closingBalance,
      transactions: statementData.transactions.map((t: any) => ({
        ...t,
        date: t.date.toISOString().split('T')[0],
      })),
    };

    const options = buildStatementPdfOptions(meta as any, pdfData);
    return this.pdfService.generate(options);
  }
}
