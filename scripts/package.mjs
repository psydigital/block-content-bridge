import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const main = fs.readFileSync(path.join(root, 'block-content-bridge.php'), 'utf8');
if (!main.includes(`Version: ${version}\n`) || !main.includes(`const VERSION = '${version}';`)) throw new Error('Plugin and package versions differ.');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'bcb-package-'));
const slug = 'block-content-bridge';
const destination = path.join(stage, slug);
const files = ['block-content-bridge.php', 'uninstall.php', 'includes/Settings.php', 'includes/Renderer.php', 'includes/Plugin.php', 'assets/analysis.js', 'assets/editor.js', 'README.md', 'docs/testing.md', 'LICENSE'];
const output = path.join(root, 'dist', `${slug}-${version}.zip`);
try {
    for (const file of files) {
        const target = path.join(destination, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, file), target);
        fs.chmodSync(target, 0o644);
        fs.utimesSync(target, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.rmSync(output, { force: true });
    execFileSync('zip', ['-X', '-q', output, ...files.sort().map(file => `${slug}/${file}`)], { cwd: stage });
    const checksum = crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
    fs.writeFileSync(`${output}.sha256`, `${checksum}  ${path.basename(output)}\n`);
    console.log(`Created dist/${path.basename(output)} (${fs.statSync(output).size} bytes)`);
    console.log(`SHA-256: ${checksum}`);
} finally {
    fs.rmSync(stage, { recursive: true, force: true });
}
