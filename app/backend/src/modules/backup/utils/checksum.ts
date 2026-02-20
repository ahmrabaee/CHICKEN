import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Computes the SHA-256 checksum of a file.
 * Returns the hex-encoded digest.
 */
export async function computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}
