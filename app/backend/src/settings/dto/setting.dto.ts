import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetSettingDto {
  @ApiProperty({ description: 'Setting value (any type)' })
  value: any;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
