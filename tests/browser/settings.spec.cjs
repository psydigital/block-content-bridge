const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

async function login(page) {
    const credentials = process.env.BCB_TEST_PASSWORD ? { username: process.env.BCB_TEST_USER, password: process.env.BCB_TEST_PASSWORD } : JSON.parse(fs.readFileSync('.runtime/credentials.json', 'utf8'));
    await page.goto('/wp-login.php');
    await page.locator('#user_login').fill(credentials.username);
    await page.locator('#user_pass').fill(credentials.password);
    await page.locator('#wp-submit').click();
    await page.waitForURL('**/wp-admin/**');
}

test('saved manual mode and selector exclusions change the real analysis', async ({ page }) => {
    await login(page);
    await page.goto('/wp-admin/options-general.php?page=block-content-bridge');
    await page.getByLabel('Analysis updates').selectOption('manual');
    await page.getByText('Advanced exclusions', { exact: true }).click();
    await page.getByLabel('CSS selectors to exclude, one per line').fill('.omit-this');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    try {
        await page.goto('/wp-admin/post-new.php');
        await page.waitForFunction(() => window.wp?.data?.select('core/editor')?.getCurrentPostId());
        await page.evaluate(() => {
            wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false);
            wp.data.dispatch('core/block-editor').resetBlocks(wp.blocks.parse('<!-- wp:html --><p>Keep this</p><p class="omit-this">Omit this</p><!-- /wp:html -->'));
        });
        const panel = page.getByRole('button', { name: 'Block Content Bridge', exact: true });
        await expect(panel).toBeVisible();
        if (await panel.getAttribute('aria-expanded') !== 'true') await panel.click();
        await expect(page.getByText('Content has changed. Analysis needs refreshing.', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Refresh analysis', exact: true }).click();
        await expect(page.getByText('Analysis content is up to date.', { exact: true })).toBeVisible();
        const html = await page.evaluate(() => YoastSEO.app.pluggable._applyModifications('content', 'Native fallback'));
        expect(html).toContain('Keep this');
        expect(html).not.toContain('Omit this');
    } finally {
        page.on('dialog', dialog => dialog.accept());
        await page.goto('/wp-admin/options-general.php?page=block-content-bridge');
        await page.getByLabel('Analysis updates').selectOption('auto');
        await page.getByText('Advanced exclusions', { exact: true }).click();
        await page.getByLabel('CSS selectors to exclude, one per line').fill('');
        await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    }
});

test('the official ACF collector is detected and the bridge does not overwrite its analysis', async ({ page }) => {
    await login(page);
    await page.goto('/wp-admin/plugins.php');
    const row = page.locator('tr[data-slug="acf-content-analysis-for-yoast-seo"]');
    test.skip(!(await row.count()), 'Requires the official ACF Content Analysis add-on.');
    await row.getByRole('link', { name: /^Activate ACF Content Analysis/ }).click();
    try {
        await page.goto('/wp-admin/post-new.php');
        await page.waitForFunction(() => window.wp?.data?.select('core/editor')?.getCurrentPostId());
        await page.evaluate(() => wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false));
        const panel = page.getByRole('button', { name: 'Block Content Bridge', exact: true });
        await expect(panel).toBeVisible();
        if (await panel.getAttribute('aria-expanded') !== 'true') await panel.click();
        await expect(page.locator('.components-notice__content').filter({ hasText: 'Analysis is paused because ACF Content Analysis for Yoast SEO is active' })).toBeVisible();
        const html = await page.evaluate(() => YoastSEO.app.pluggable._applyModifications('content', 'Native fallback'));
        expect(html).toContain('Native fallback');
    } finally {
        page.on('dialog', dialog => dialog.accept());
        await page.goto('/wp-admin/plugins.php');
        await page.locator('tr[data-slug="acf-content-analysis-for-yoast-seo"]').getByRole('link', { name: /^Deactivate ACF Content Analysis/ }).click();
    }
});
