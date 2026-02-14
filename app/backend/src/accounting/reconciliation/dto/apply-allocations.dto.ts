import { IsArray, IsNumber, IsString, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class AllocationItemDto {
  @ApiProperty()
  @IsNumber()
  paymentId: number;

  @ApiProperty({ enum: ['sale', 'purchase'] })
  @IsString()
  @IsIn(['sale', 'purchase'])
  invoiceType: 'sale' | 'purchase';

  @ApiProperty()
  @IsNumber()
  invoiceId: number;

  @ApiProperty({ description: 'Amount in minor units' })
  @IsNumber()
  amount: number;
}

export class ApplyAllocationsDto {
  @ApiProperty({ enum: ['customer', 'supplier'] })
  @IsString()
  @IsIn(['customer', 'supplier'])
  partyType: 'customer' | 'supplier';

  @ApiProperty()
  @IsNumber()
  partyId: number;

  @ApiProperty({ type: [AllocationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationItemDto)
  allocations: AllocationItemDto[];
}
