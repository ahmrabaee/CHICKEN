import { ApiProperty } from '@nestjs/swagger';

export class DownloadLinkDto {
    @ApiProperty({ description: 'Signed download URL' })
    url: string;

    @ApiProperty({ description: 'ISO timestamp when the link expires' })
    expiresAt: string;
}
