import * as crypto from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TOKEN_TTL_SECONDS = 300; // 5 minutes

interface TokenPayload {
    backupId: number;
    exp: number;
}

@Injectable()
export class BackupTokenService {
    private readonly secret: string;

    constructor(private config: ConfigService) {
        this.secret = this.config.get<string>(
            'BACKUP_DOWNLOAD_SECRET',
            'fallback-secret-change-in-env',
        );
    }

    /**
     * Creates a signed download token for a backup run.
     * Format: base64url(payload).base64url(signature)
     */
    createToken(backupId: number, ttlSeconds = TOKEN_TTL_SECONDS): string {
        const payload: TokenPayload = {
            backupId,
            exp: Math.floor(Date.now() / 1000) + ttlSeconds,
        };

        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signature = this.sign(payloadB64);

        return `${payloadB64}.${signature}`;
    }

    /**
     * Validates a token and returns the payload.
     * Throws if invalid, expired, or backupId doesn't match.
     */
    verifyToken(token: string, expectedBackupId: number): TokenPayload {
        const parts = token.split('.');
        if (parts.length !== 2) {
            throw new UnauthorizedException({ code: 'BACKUP_DOWNLOAD_TOKEN_INVALID' });
        }

        const [payloadB64, signature] = parts;
        const expectedSig = this.sign(payloadB64);

        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
            throw new UnauthorizedException({ code: 'BACKUP_DOWNLOAD_TOKEN_INVALID' });
        }

        let payload: TokenPayload;
        try {
            payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
        } catch {
            throw new UnauthorizedException({ code: 'BACKUP_DOWNLOAD_TOKEN_INVALID' });
        }

        if (Math.floor(Date.now() / 1000) > payload.exp) {
            throw new UnauthorizedException({ code: 'BACKUP_DOWNLOAD_TOKEN_EXPIRED' });
        }

        if (payload.backupId !== expectedBackupId) {
            throw new UnauthorizedException({ code: 'BACKUP_DOWNLOAD_TOKEN_INVALID' });
        }

        return payload;
    }

    private sign(data: string): string {
        return crypto
            .createHmac('sha256', this.secret)
            .update(data)
            .digest('base64url');
    }
}
