import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PageAccessService {
  constructor(private prisma: PrismaService) {}

  /** List users with accountant role (or legacy cashier) for page access selector */
  async getAccountantUsers(): Promise<AccountantUser[]> {
    const accountantOrCashierRoles = await this.prisma.role.findMany({
      where: { name: { in: ['accountant', 'cashier'] } },
      select: { id: true },
    });
    const roleIds = accountantOrCashierRoles.map((r) => r.id);
    if (roleIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: { roleId: { in: roleIds } },
        },
      },
      include: {
        userRoles: { include: { role: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      fullNameEn: u.fullNameEn ?? undefined,
      role: u.userRoles[0]?.role?.name ?? 'accountant',
    }));
  }

  /** Get all pages with allowed status for a specific user */
  async findByUserId(userId: number): Promise<{ pages: PageAccessItem[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException({ message: 'User not found', messageAr: 'المستخدم غير موجود' });
    }

    // Ensure UserPageAccess records exist (for accountants/cashiers created before seed)
    const isAccountantOrCashier = user.userRoles.some(
      (ur) => ur.role?.name === 'accountant' || ur.role?.name === 'cashier',
    );
    if (isAccountantOrCashier) {
      await this.ensureUserPageAccess(userId);
    }

    let pages;
    try {
      pages = await this.prisma.pageDefinition.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          userPageAccess: {
            where: { userId },
          },
        },
      });
    } catch (err) {
      console.error('[PageAccessService] findByUserId error:', err);
      throw err;
    }

    const result: PageAccessItem[] = pages.map((p) => {
      const access = p.userPageAccess[0];
      const allowed = access?.allowed ?? false;
      return {
        id: p.id,
        key: p.key,
        path: p.path,
        titleAr: p.titleAr,
        titleEn: p.titleEn ?? undefined,
        groupKey: p.groupKey ?? undefined,
        sortOrder: p.sortOrder,
        allowed,
      };
    });

    return { pages: result };
  }

  /** Update single page access for a user - ALL pages configurable */
  async update(userId: number, pageKey: string, allowed: boolean): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const page = await this.prisma.pageDefinition.findUnique({ where: { key: pageKey } });

    if (!user) {
      throw new NotFoundException({ message: 'User not found', messageAr: 'المستخدم غير موجود' });
    }
    if (!page) {
      throw new NotFoundException({ message: 'Page not found', messageAr: 'الصفحة غير موجودة' });
    }

    await this.prisma.userPageAccess.upsert({
      where: {
        userId_pageId: { userId, pageId: page.id },
      },
      update: { allowed },
      create: {
        userId,
        pageId: page.id,
        allowed,
      },
    });

    return { success: true };
  }

  async bulkUpdate(items: { userId: number; pageKey: string; allowed: boolean }[]): Promise<{ success: boolean }> {
    for (const item of items) {
      await this.update(item.userId, item.pageKey, item.allowed);
    }
    return { success: true };
  }

  /** Get allowed paths for a user (used by Auth) */
  async getAllowedPathsForUser(userId: number, roleName: string): Promise<string[]> {
    if (roleName === 'admin') {
      return ['*'];
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userPageAccess: {
          where: { allowed: true },
          include: { page: true },
        },
      },
    });

    if (!user) return [];

    if (user.userPageAccess.length === 0) {
      await this.ensureUserPageAccess(userId);
      const refreshed = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          userPageAccess: {
            where: { allowed: true },
            include: { page: true },
          },
        },
      });
      return refreshed?.userPageAccess.map((a) => a.page.path) ?? [];
    }

    return user.userPageAccess.map((a) => a.page.path);
  }

  /** Ensure user has UserPageAccess records (seed from role default when none exist) */
  async ensureUserPageAccess(userId: number): Promise<void> {
    const existing = await this.prisma.userPageAccess.count({ where: { userId } });
    if (existing > 0) return;

    const accountantRole = await this.prisma.role.findUnique({
      where: { name: 'accountant' },
      include: { rolePageAccess: true },
    });
    if (!accountantRole) return;

    const pages = await this.prisma.pageDefinition.findMany();
    for (const page of pages) {
      const roleAccess = accountantRole.rolePageAccess.find((a) => a.pageId === page.id);
      const allowed = roleAccess?.allowed ?? (!page.isAdminOnly && ['dashboard','inventory','sales','sales-pos','customers','payments','reconciliation','credit-notes','accounting','stock-transfer','reports-sales','reports-holdings','reports-purchases','reports-wastage'].includes(page.key));
      await this.prisma.userPageAccess.upsert({
        where: { userId_pageId: { userId, pageId: page.id } },
        update: {},
        create: { userId, pageId: page.id, allowed },
      });
    }
  }
}

export interface PageAccessItem {
  id: number;
  key: string;
  path: string;
  titleAr: string;
  titleEn?: string;
  groupKey?: string;
  sortOrder: number;
  allowed: boolean;
}

export interface AccountantUser {
  id: number;
  username: string;
  fullName: string;
  fullNameEn?: string;
  role: string;
}
