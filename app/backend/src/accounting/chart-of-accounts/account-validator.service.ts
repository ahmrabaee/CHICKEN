import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountRepository } from './account.repository';
import { AccountTreeBuilderService } from './account-tree-builder.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountValidatorService {
  constructor(
    private accountRepo: AccountRepository,
    private treeBuilder: AccountTreeBuilderService,
  ) {}

  async validateCreate(dto: CreateAccountDto, companyId: number | null): Promise<void> {
    const parentId = dto.parentId ?? null;
    await this.validateParentExists(parentId, companyId);
    await this.validateCodeUnique(dto.code, companyId, null);
    await this.validateParentIsGroup(parentId);
    await this.validateAccountTypeConsistency(dto.accountType, parentId, companyId);
  }

  async validateUpdate(id: number, dto: UpdateAccountDto, companyId: number | null): Promise<void> {
    const account = await this.accountRepo.findById(id);
    if (!account) throw new NotFoundException('Account not found');

    if (dto.parentId !== undefined && dto.parentId !== account.parentId) {
      const newParentId = dto.parentId ?? null;
      if (newParentId === id) throw new BadRequestException('Account cannot be its own parent');
      if (newParentId !== null) {
        const parent = await this.accountRepo.findById(newParentId);
        if (!parent?.isGroup) throw new BadRequestException('Parent must be a group account');
        await this.validateNoCycle(id, newParentId);
      }
    }

    if (dto.isGroup === false && account.isGroup) {
      const hasChildren = await this.accountRepo.hasChildAccounts(id);
      if (hasChildren) throw new BadRequestException('Cannot convert to ledger: has child accounts');
    }

    if (dto.isGroup === true && account.isGroup === false) {
      const hasEntries = await this.accountRepo.hasJournalEntries(id);
      if (hasEntries) throw new BadRequestException('Cannot convert to group: has ledger entries');
    }

    if (dto.isActive === false && account.isSystemAccount) {
      throw new BadRequestException('Cannot disable system account');
    }
  }

  async validateForDeletion(id: number): Promise<void> {
    const hasEntries = await this.accountRepo.hasJournalEntries(id);
    if (hasEntries) throw new BadRequestException('Cannot delete account with ledger entries');

    const hasChildren = await this.accountRepo.hasChildAccounts(id);
    if (hasChildren) throw new BadRequestException('Delete child accounts first');
  }

  private async validateParentExists(parentId: number | null, companyId: number | null): Promise<void> {
    if (!parentId) return;
    const parent = await this.accountRepo.findById(parentId);
    if (!parent) throw new BadRequestException('Parent account not found');
    if (parent.companyId !== companyId) throw new BadRequestException('Parent must belong to same company');
  }

  private async validateCodeUnique(code: string, companyId: number | null, excludeId: number | null): Promise<void> {
    const existing = await this.accountRepo.findByCodeAndCompany(code, companyId);
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`Account with code ${code} already exists`);
    }
  }

  private async validateParentIsGroup(parentId: number | null): Promise<void> {
    if (!parentId) return;
    const parent = await this.accountRepo.findById(parentId);
    if (!parent?.isGroup) throw new BadRequestException('Parent must be a group account');
  }

  private async validateAccountTypeConsistency(
    accountType: string,
    parentId: number | null,
    companyId: number | null,
  ): Promise<void> {
    if (!parentId) return;
    const parent = await this.accountRepo.findById(parentId);
    if (!parent) return;
    const { rootType } = this.treeBuilder.deriveRootAndReportType(accountType, parent);
    const parentRoot = parent.rootType;
    if (rootType !== parentRoot) {
      throw new BadRequestException(`Account type must be consistent with parent (${parentRoot})`);
    }
  }

  private async validateNoCycle(accountId: number, newParentId: number): Promise<void> {
    const ancestors = await this.accountRepo.findAncestors(newParentId);
    if (ancestors.some((a) => a.id === accountId)) {
      throw new BadRequestException('Cycle detected in hierarchy');
    }
  }
}
