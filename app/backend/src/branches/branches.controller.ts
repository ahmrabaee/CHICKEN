import {
  Controller, Get, Post, Put, Delete,
  Body, Param, ParseIntPipe, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto, BranchResponseDto } from './dto';
import { Roles, RolesGuard } from '../common';

@ApiTags('branches')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Roles('admin')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'List all branches' })
  @ApiResponse({ status: 200, type: [BranchResponseDto] })
  async findAll(): Promise<BranchResponseDto[]> {
    return this.branchesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch by ID' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, type: BranchResponseDto })
  async findById(@Param('id', ParseIntPipe) id: number): Promise<BranchResponseDto> {
    return this.branchesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create branch' })
  @ApiResponse({ status: 201, type: BranchResponseDto })
  async create(@Body() dto: CreateBranchDto): Promise<BranchResponseDto> {
    return this.branchesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, type: BranchResponseDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchResponseDto> {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.branchesService.delete(id);
  }
}
