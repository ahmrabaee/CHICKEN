import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { SetSettingDto } from './dto/setting.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Roles } from '../common';

@ApiTags('settings')
@ApiBearerAuth('JWT-auth')
@Roles('admin')
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) { }

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  getAll() {
    return this.settingsService.getAll();
  }

  @Get('group/:group')
  @ApiOperation({ summary: 'Get settings by group' })
  getByGroup(@Param('group') group: string) {
    return this.settingsService.getByGroup(group);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk update settings' })
  bulkUpdate(@Body() settings: { key: string; value: any }[]) {
    return this.settingsService.bulkUpdate(settings);
  }

  @Put('company')
  @ApiOperation({ summary: 'Update company settings' })
  updateCompany(@Body() dto: UpdateCompanyDto) {
    return this.settingsService.updateCompany(dto);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get setting by key' })
  getByKey(@Param('key') key: string) {
    return this.settingsService.getByKey(key);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Set/update a setting' })
  set(@Param('key') key: string, @Body() dto: SetSettingDto) {
    return this.settingsService.set(key, dto.value, dto.description);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a setting' })
  delete(@Param('key') key: string) {
    return this.settingsService.delete(key);
  }
}
