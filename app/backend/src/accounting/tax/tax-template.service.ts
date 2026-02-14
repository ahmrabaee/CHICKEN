import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaxTemplateService {
  constructor(private prisma: PrismaService) {}

  async findAll(type?: 'sales' | 'purchases', companyId?: number) {
    return this.prisma.taxTemplate.findMany({
      where: {
        isActive: true,
        ...(type && { type }),
        ...(companyId != null && { companyId: companyId === 0 ? null : companyId }),
      },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async findById(id: number) {
    const t = await this.prisma.taxTemplate.findUnique({
      where: { id },
      include: { items: { orderBy: { displayOrder: 'asc' }, include: { account: true } } },
    });
    if (!t) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Tax template not found', messageAr: 'قالب الضريبة غير موجود' });
    return t;
  }

  async getTemplateWithItems(templateId: number) {
    return this.findById(templateId);
  }

  async create(data: {
    name: string;
    type: 'sales' | 'purchases';
    companyId?: number;
    items: Array<{ accountId: number; rate: number; chargeType?: string; rowId?: number; fixedAmount?: number; isDeductible?: boolean; displayOrder?: number }>;
  }) {
    const existing = await this.prisma.taxTemplate.findUnique({ where: { name: data.name } });
    if (existing) throw new BadRequestException({ code: 'DUPLICATE_NAME', message: 'Template name exists', messageAr: 'اسم القالب موجود' });

    return this.prisma.taxTemplate.create({
      data: {
        name: data.name,
        type: data.type,
        companyId: data.companyId ?? null,
        items: {
          create: data.items.map((it, idx) => ({
            accountId: it.accountId,
            rate: it.rate,
            chargeType: it.chargeType ?? 'on_net_total',
            rowId: it.rowId ?? null,
            fixedAmount: it.fixedAmount ?? null,
            isDeductible: it.isDeductible ?? true,
            displayOrder: it.displayOrder ?? idx,
          })),
        },
      },
      include: { items: true },
    });
  }

  async update(id: number, data: { name?: string; isActive?: boolean; items?: Array<{ accountId: number; rate: number; chargeType?: string; rowId?: number; fixedAmount?: number; displayOrder?: number }> }) {
    await this.findById(id);
    const updateData: any = {};
    if (data.name != null) updateData.name = data.name;
    if (data.isActive != null) updateData.isActive = data.isActive;
    if (data.items != null) {
      await this.prisma.taxTemplateItem.deleteMany({ where: { templateId: id } });
      updateData.items = {
        create: data.items.map((it, idx) => ({
          accountId: it.accountId,
          rate: it.rate,
          chargeType: it.chargeType ?? 'on_net_total',
          rowId: it.rowId ?? null,
          fixedAmount: it.fixedAmount ?? null,
          displayOrder: it.displayOrder ?? idx,
        })),
      };
    }
    return this.prisma.taxTemplate.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });
  }

  async delete(id: number) {
    const used = await this.prisma.sale.count({ where: { taxTemplateId: id } }) + await this.prisma.purchase.count({ where: { taxTemplateId: id } });
    if (used > 0) throw new BadRequestException({ code: 'TEMPLATE_IN_USE', message: 'Template is used by invoices', messageAr: 'القالب مستخدم في فواتير' });
    return this.prisma.taxTemplate.delete({ where: { id } });
  }
}
