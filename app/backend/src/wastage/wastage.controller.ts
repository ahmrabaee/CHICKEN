import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WastageService } from './wastage.service';
import { CreateWastageDto } from './dto/wastage.dto';
import { PaginationQueryDto, Roles, CurrentUser } from '../common';

@ApiTags('wastage')
@ApiBearerAuth()
@Controller('wastage')
export class WastageController {
  constructor(private wastageService: WastageService) {}

  @Get()
  @ApiOperation({ summary: 'List all wastage records' })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.wastageService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get wastage by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.wastageService.findById(id);
  }

  @Post()
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Record wastage' })
  create(@Body() dto: CreateWastageDto, @CurrentUser() user: any) {
    return this.wastageService.create(dto, user.id);
  }
}
