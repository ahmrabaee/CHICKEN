import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StockTransferService } from './stock-transfer.service';
import { CreateStockTransferDto } from './dto';
import { Roles, RolesGuard, CurrentUser, CurrentUserData } from '../common';

@ApiTags('stock-transfer')
@ApiBearerAuth('JWT-auth')
@Controller('stock-transfer')
export class StockTransferController {
  constructor(private readonly stockTransferService: StockTransferService) {}

  @Get('source-lots')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Get available raw chicken lots for transfer' })
  getAvailableSourceLots(@Query('branchId') branchId?: string) {
    const bid = branchId ? parseInt(branchId, 10) : undefined;
    return this.stockTransferService.getAvailableSourceLots(bid);
  }

  @Get('products')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Get products that can be created from raw chicken' })
  getTransferrableProducts() {
    return this.stockTransferService.getTransferrableProducts();
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'List stock transfers' })
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;
    return this.stockTransferService.findAll(p, ps);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Get stock transfer by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.stockTransferService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Create and complete stock transfer' })
  create(
    @Body() dto: CreateStockTransferDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.stockTransferService.create(dto, user.id);
  }
}
