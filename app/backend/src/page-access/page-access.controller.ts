import { Controller, Get, Put, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PageAccessService } from './page-access.service';
import { UpdatePageAccessDto, BulkUpdatePageAccessDto } from './dto/page-access.dto';
import { Roles, RolesGuard } from '../common';

@ApiTags('page-access')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Roles('admin')
@Controller('page-access')
export class PageAccessController {
  constructor(private readonly pageAccessService: PageAccessService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get accountant users for page access selector' })
  getAccountantUsers() {
    return this.pageAccessService.getAccountantUsers();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get page access for a specific user' })
  @ApiParam({ name: 'userId', type: Number })
  findByUserId(@Param('userId', ParseIntPipe) userId: number) {
    return this.pageAccessService.findByUserId(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Update single page access for a user' })
  update(@Body() dto: UpdatePageAccessDto) {
    return this.pageAccessService.update(dto.userId, dto.pageKey, dto.allowed);
  }

  @Put('bulk')
  @ApiOperation({ summary: 'Bulk update page access' })
  bulkUpdate(@Body() dto: BulkUpdatePageAccessDto) {
    return this.pageAccessService.bulkUpdate(dto.items);
  }
}
