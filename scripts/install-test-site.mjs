import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

// A fresh disposable installation only. Credentials stay in the ignored runtime directory.
const sitePath = '.runtime/wordpress';
const flag = execFileSync('wp', ['config', 'get', 'PSY_BCB_TEST_SITE', `--path=${sitePath}`], { encoding: 'utf8' }).trim();
if (flag !== '1' && flag !== 'true') throw new Error('PSY_BCB_TEST_SITE must be true.');
const password = crypto.randomBytes(24).toString('hex');
try {
    execFileSync('wp', ['core', 'install', `--path=${sitePath}`, '--url=http://127.0.0.1:8876', '--title=Block Bridge Test', '--admin_user=bridge-admin', `--admin_password=${password}`, '--admin_email=admin@example.org', '--skip-email'], { stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
    throw new Error('Could not install disposable WordPress. Check the test database and configuration.');
}
fs.writeFileSync('.runtime/credentials.json', JSON.stringify({ username: 'bridge-admin', password }), { mode: 0o600 });
console.log('Disposable WordPress installed.');
