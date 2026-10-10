const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { version } = require('../package.json');

test('the release ZIP is identical across build timezones and contains only distributable files', () => {
    const root = path.join(__dirname, '..');
    const build = timezone => {
        execFileSync(process.execPath, ['scripts/package.mjs'], { cwd: root, env: { ...process.env, TZ: timezone } });
        return createHash('sha256').update(fs.readFileSync(path.join(root, `dist/block-content-bridge-${version}.zip`))).digest('hex');
    };
    assert.equal(build('UTC'), build('Pacific/Honolulu'));
    const entries = execFileSync('unzip', ['-Z1', `dist/block-content-bridge-${version}.zip`], { cwd: root, encoding: 'utf8' }).trim().split('\n');
    assert.ok(entries.includes('block-content-bridge/block-content-bridge.php'));
    assert.ok(entries.includes('block-content-bridge/assets/editor.js'));
    assert.ok(entries.includes('block-content-bridge/README.md'));
    assert.ok(entries.every(name => name.startsWith('block-content-bridge/') && !name.includes('..')));
    assert.ok(entries.every(name => !/node_modules|tests\/|\.git|wp-config|credentials|\.runtime/.test(name)));
});
