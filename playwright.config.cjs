const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './tests/browser',
    workers: 1,
    timeout: 60000,
    use: { baseURL: process.env.BCB_TEST_URL || 'http://127.0.0.1:8876', headless: true },
});
