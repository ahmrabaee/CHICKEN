import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) { }

  async getLogs(
    pagination: PaginationQueryDto,
    filters?: {
      entityType?: string;
      entityId?: number;
      userId?: number;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.entityId) where.entityId = filters.entityId;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = filters.action;
    if (filters?.startDate) where.timestamp = { gte: filters.startDate };
    if (filters?.endDate) where.timestamp = { ...where.timestamp, lte: filters.endDate };

    const [logs, totalItems] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        include: { user: { select: { username: true, fullName: true } } },
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const mappedLogs = logs.map((l) => ({
      ...l,
      createdAt: l.timestamp,
      userName: l.user?.fullName || l.user?.username || l.username,
    }));

    return createPaginatedResult(mappedLogs, page, pageSize, totalItems);
  }

  async log(
    entityType: string,
    entityId: number | null,
    action: string,
    userId: number | null,
    username: string,
    changes?: any,
    ipAddress?: string,
    userAgent?: string,
    branchId?: number,
  ) {
    return this.prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        userId,
        username,
        changes: changes ? JSON.stringify(changes) : null,
        ipAddress,
        userAgent,
        branchId,
      },
    });
  }

  async getByEntity(entityType: string, entityId: number) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: { user: { select: { username: true, fullName: true } } },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getByUser(userId: number, pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [logs, totalItems] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);

    return createPaginatedResult(logs, page, pageSize, totalItems);
  }

  async getActionCounts(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate) where.timestamp = { gte: startDate };
    if (endDate) where.timestamp = { ...where.timestamp, lte: endDate };

    const grouped = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
    });

    return grouped.map((g) => ({
      action: g.action,
      count: g._count,
    }));
  }
}
