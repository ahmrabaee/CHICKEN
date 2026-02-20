import * as path from 'path';
import * as fs from 'fs';
import * as tar from 'tar';

export interface ArchiveEntry {
    /** Absolute path on disk */
    sourcePath: string;
    /** Path inside the archive */
    archiveName: string;
}

/**
 * Creates a .tar.gz archive from a list of entries.
 *
 * @param outputPath - absolute path for the output archive
 * @param entries    - list of { sourcePath, archiveName } to include
 */
export async function createArchive(
    outputPath: string,
    entries: ArchiveEntry[],
): Promise<void> {
    // Build a map of file/dir paths to include
    const fileList: string[] = [];
    const cwd = path.dirname(outputPath);

    // We'll create a temp staging structure so tar can use relative paths
    const tempBase = path.join(cwd, '.archive-staging-' + Date.now());
    fs.mkdirSync(tempBase, { recursive: true });

    try {
        for (const entry of entries) {
            if (!fs.existsSync(entry.sourcePath)) continue;

            const dest = path.join(tempBase, entry.archiveName);
            const destDir = path.dirname(dest);
            fs.mkdirSync(destDir, { recursive: true });

            const stat = fs.statSync(entry.sourcePath);
            if (stat.isDirectory()) {
                // Copy directory recursively
                copyDirSync(entry.sourcePath, dest);
            } else {
                fs.copyFileSync(entry.sourcePath, dest);
            }
            fileList.push(entry.archiveName);
        }

        // Create the archive
        await tar.create(
            {
                gzip: true,
                file: outputPath,
                cwd: tempBase,
            },
            fileList,
        );
    } finally {
        // Cleanup temp staging
        try { rmDirSync(tempBase); } catch { /* ignore */ }
    }
}

/**
 * Extracts a .tar.gz backup archive into a destination directory.
 */
export async function extractArchive(
    archivePath: string,
    destinationDir: string,
): Promise<void> {
    fs.mkdirSync(destinationDir, { recursive: true });
    await tar.extract({
        file: archivePath,
        cwd: destinationDir,
        gzip: true,
        strict: true,
    });
}

function copyDirSync(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function rmDirSync(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            rmDirSync(p);
        } else {
            fs.unlinkSync(p);
        }
    }
    fs.rmdirSync(dir);
}
