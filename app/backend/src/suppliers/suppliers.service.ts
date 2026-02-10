import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) { }

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
}
