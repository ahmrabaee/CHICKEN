import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DailyPricingService {
  constructor(private prisma: PrismaService) {}

  /** Normalize date to YYYY-MM-DD start of day (UTC) for storage */
  private toDateOnly(dateStr: string): Date {
    const d = new Date(dateStr);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  /** Get pricing for a specific date - returns all active items with their prices */
  async getByDate(dateStr: string, branchId?: number | null) {
    const date = this.toDateOnly(dateStr);
    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const [items, dailyPrices] = await Promise.all([
      this.prisma.item.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          nameEn: true,
          defaultSalePrice: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.itemDailyPrice.findMany({
        where: {
          pricingDate: { gte: date, lt: nextDay },
          branchId: branchId ?? null,
        },
        select: { itemId: true, pricePerKg: true },
      }),
    ]);

    const priceMap = new Map(dailyPrices.map((p) => [p.itemId, p.pricePerKg]));
    const hasPrices = priceMap.size > 0;

    const result: {
      itemId: number;
      itemName: string;
      itemNameEn?: string;
      pricePerKg: number;
      defaultSalePrice: number;
    }[] = items.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      itemNameEn: item.nameEn ?? undefined,
      pricePerKg: priceMap.get(item.id) ?? item.defaultSalePrice,
      defaultSalePrice: item.defaultSalePrice,
    }));

    return {
      date: dateStr.split('T')[0],
      items: result,
      hasPrices,
    };
  }

  /** Get yesterday's date as YYYY-MM-DD */
  private getYesterdayStr(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  /** Convenience: get yesterday's pricing */
  async getYesterday(branchId?: number | null) {
    return this.getByDate(this.getYesterdayStr(), branchId);
  }

  /** Save/overwrite pricing for a date */
  async setPricing(
    dateStr: string,
    prices: { itemId: number; pricePerKg: number }[],
    branchId: number | null,
    createdById?: number,
  ) {
    const date = this.toDateOnly(dateStr);

    await this.prisma.$transaction(async (tx) => {
      // Delete existing for this date (global: branchId null)
      await tx.itemDailyPrice.deleteMany({
        where: {
          pricingDate: { gte: date, lt: new Date(date.getTime() + 86400000) },
          branchId,
        },
      });

      if (prices.length === 0) return;

      await tx.itemDailyPrice.createMany({
        data: prices.map((p) => ({
          itemId: p.itemId,
          pricingDate: date,
          pricePerKg: p.pricePerKg,
          branchId,
          createdById,
        })),
      });
    });

    return this.getByDate(dateStr.split('T')[0], branchId);
  }

  /** Copy yesterday's prices to today (or specified date) */
  async copyFromYesterday(
    targetDateStr: string,
    branchId: number | null,
    createdById?: number,
  ) {
    const yesterday = await this.getYesterday(branchId);
    if (yesterday.items.length === 0) {
      return this.getByDate(targetDateStr, branchId);
    }

    const prices = yesterday.items.map((i: { itemId: number; pricePerKg: number }) => ({
      itemId: i.itemId,
      pricePerKg: i.pricePerKg,
    }));

    return this.setPricing(targetDateStr, prices, branchId, createdById);
  }

  /** Get price map for a date: itemId -> pricePerKg (for POS). Empty when no daily prices. */
  async getPriceMap(dateStr: string, branchId?: number | null): Promise<Record<number, number>> {
    const result = await this.getByDate(dateStr, branchId);
    const map: Record<number, number> = {};
    if (result.hasPrices) {
      result.items.forEach((i) => {
        map[i.itemId] = i.pricePerKg;
      });
    }
    return map;
  }
}
