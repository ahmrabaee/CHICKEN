import { IsOptional, IsString, Allow } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetSettingDto {
  @ApiProperty({ description: 'Setting value (any type)' })
  @Allow()
  value: any;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
