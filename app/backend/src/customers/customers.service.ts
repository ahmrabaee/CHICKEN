import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerResponseDto, CustomerListQueryDto } from './dto';
import { createPaginatedResult, PaginatedResult } from '../common';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: CustomerListQueryDto): Promise<PaginatedResult<CustomerResponseDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { nameEn: { contains: query.search } },
        { phone: { contains: query.search } },
        { customerNumber: { contains: query.search } },
      ];
    }

    if (query.phone) {
      where.OR = [
        { phone: { contains: query.phone } },
        { phone2: { contains: query.phone } },
      ];
    }

    if (query.priceLevel) {
      where.priceLevel = query.priceLevel;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    } else {
      where.isActive = true;
    }

    if (query.hasBalance) {
      where.currentBalance = { not: 0 };
    }

    const [customers, totalItems] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return createPaginatedResult(
      customers.map(this.toResponseDto),
      page,
      pageSize,
      totalItems,
    );
  }

  async search(searchTerm: string): Promise<CustomerResponseDto[]> {
    const customers = await this.prisma.customer.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: searchTerm } },
          { nameEn: { contains: searchTerm } },
          { phone: { contains: searchTerm } },
          { phone2: { contains: searchTerm } },
          { customerNumber: { contains: searchTerm } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 20,
    });

    return customers.map(this.toResponseDto);
  }

  async findById(id: number): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Customer not found',
        messageAr: 'العميل غير موجود',
      });
    }
    return this.toResponseDto(customer);
  }

  async findByPhone(phone: string): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { phone: phone },
          { phone2: phone },
        ],
      },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Customer not found',
        messageAr: 'العميل غير موجود',
      });
    }
    return this.toResponseDto(customer);
  }

  async findByCustomerNumber(customerNumber: string): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { customerNumber },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Customer not found',
        messageAr: 'العميل غير موجود',
      });
    }
    return this.toResponseDto(customer);
  }

  async create(dto: CreateCustomerDto, userId?: number): Promise<CustomerResponseDto> {
    // Check phone uniqueness if provided
    if (dto.phone) {
      const existingPhone = await this.prisma.customer.findFirst({
        where: {
          OR: [
            { phone: dto.phone },
            { phone2: dto.phone },
          ],
        },
      });
      if (existingPhone) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Phone number already exists',
          messageAr: 'رقم الهاتف موجود بالفعل',
        });
      }
    }

    // Generate customer number
    const customerNumber = await this.generateCustomerNumber();

    const customer = await this.prisma.customer.create({
      data: {
        customerNumber,
        name: dto.name,
        nameEn: dto.nameEn,
        phone: dto.phone,
        phone2: dto.phone2,
        email: dto.email,
        address: dto.address,
        creditLimit: dto.creditLimit ?? 0,
        currentBalance: 0,
        priceLevel: dto.priceLevel ?? 'standard',
        defaultDiscountPct: dto.defaultDiscountPct ?? 0,
        taxNumber: dto.taxNumber,
        notes: dto.notes,
        isActive: dto.isActive ?? true,
        createdById: userId,
      },
    });

    return this.toResponseDto(customer);
  }

  async update(id: number, dto: UpdateCustomerDto, userId?: number): Promise<CustomerResponseDto> {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Customer not found',
        messageAr: 'العميل غير موجود',
      });
    }

    // Check phone uniqueness if changing
    if (dto.phone && dto.phone !== existing.phone) {
      const duplicate = await this.prisma.customer.findFirst({
        where: {
          id: { not: id },
          OR: [
            { phone: dto.phone },
            { phone2: dto.phone },
          ],
        },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Phone number already exists',
          messageAr: 'رقم الهاتف موجود بالفعل',
        });
      }
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        updatedById: userId,
      },
    });

    return this.toResponseDto(customer);
  }

  async delete(id: number): Promise<void> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Customer not found',
        messageAr: 'العميل غير موجود',
      });
    }

    // Check if customer has sales
    const salesCount = await this.prisma.sale.count({
      where: { customerId: id },
    });

    if (salesCount > 0) {
      // Soft delete
      await this.prisma.customer.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Hard delete
      await this.prisma.customer.delete({ where: { id } });
    }
  }

  private async generateCustomerNumber(): Promise<string> {
    const lastCustomer = await this.prisma.customer.findFirst({
      orderBy: { id: 'desc' },
      select: { customerNumber: true },
    });

    let nextNumber = 1;
    if (lastCustomer?.customerNumber) {
      const match = lastCustomer.customerNumber.match(/CUST(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `CUST${nextNumber.toString().padStart(4, '0')}`;
  }

  private toResponseDto(customer: any): CustomerResponseDto {
    return {
      id: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
      nameEn: customer.nameEn,
      phone: customer.phone,
      phone2: customer.phone2,
      email: customer.email,
      address: customer.address,
      creditLimit: customer.creditLimit,
      currentBalance: customer.currentBalance,
      priceLevel: customer.priceLevel,
      defaultDiscountPct: customer.defaultDiscountPct,
      taxNumber: customer.taxNumber,
      notes: customer.notes,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
