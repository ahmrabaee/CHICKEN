import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    const settings = await this.prisma.systemSetting.findMany();
    return settings.reduce((acc, s) => {
      acc[s.key] = this.parseValue(s.value, s.dataType);
      return acc;
    }, {} as Record<string, any>);
  }

  async getByKey(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Setting '${key}' not found`,
        messageAr: `الإعداد '${key}' غير موجود`,
      });
    }

    return {
      key: setting.key,
      value: this.parseValue(setting.value, setting.dataType),
      dataType: setting.dataType,
      description: setting.description,
    };
  }

  async set(key: string, value: any, description?: string, dataType?: string) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const detectedType = dataType ?? this.detectType(value);

    return this.prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: stringValue,
        dataType: detectedType,
        description,
      },
      update: {
        value: stringValue,
        dataType: detectedType,
        description,
      },
    });
  }

  async delete(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });

    if (!setting) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Setting '${key}' not found`,
        messageAr: `الإعداد '${key}' غير موجود`,
      });
    }

    if (setting.isSystem) {
      throw new Error('Cannot delete system settings');
    }

    return this.prisma.systemSetting.delete({ where: { key } });
  }

  async getByGroup(group: string) {
    const settings = await this.prisma.systemSetting.findMany({
      where: { settingGroup: group },
    });

    return settings.reduce((acc, s) => {
      acc[s.key] = this.parseValue(s.value, s.dataType);
      return acc;
    }, {} as Record<string, any>);
  }

  async bulkUpdate(settings: { key: string; value: any }[]) {
    for (const s of settings) {
      await this.set(s.key, s.value);
    }
    return { updated: settings.length };
  }

  private parseValue(value: string, dataType: string): any {
    switch (dataType) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  private detectType(value: any): string {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'object') return 'json';
    return 'string';
  }
}
