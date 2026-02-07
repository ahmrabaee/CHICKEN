import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto, ReceivePurchaseDto } from './dto/purchase.dto';
import { PaginationQueryDto, Roles, CurrentUser } from '../common';

@ApiTags('purchases')
@ApiBearerAuth()
@Controller('purchases')
export class PurchasesController {
  constructor(private purchasesService: PurchasesService) {}

  @Get()
  @ApiOperation({ summary: 'List all purchases' })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.purchasesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.purchasesService.findById(id);
  }

  @Post()
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Create new purchase order' })
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: any) {
    return this.purchasesService.create(dto, user.id);
  }

  @Put(':id/receive')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Receive purchase order goods' })
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceivePurchaseDto,
    @CurrentUser() user: any,
  ) {
    return this.purchasesService.receive(id, dto, user.id);
  }
}
