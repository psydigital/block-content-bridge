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

test('the official ACF collector retains separate fields while the bridge supplies blocks once', async ({ page }) => {
    await login(page);
    await page.goto('/wp-admin/plugins.php');
    const row = page.locator('tr[data-slug="acf-content-analysis-for-yoast-seo"]');
    test.skip(!(await row.count()), 'Requires the official ACF Content Analysis add-on.');
    const activate = row.getByRole('link', { name: /^Activate ACF Content Analysis/ });
    if (await activate.count()) await activate.click();
    try {
        await page.goto('/wp-admin/post-new.php');
        await page.waitForFunction(() => window.wp?.data?.select('core/editor')?.getCurrentPostId());
        test.skip(!await page.evaluate(() => !!wp.blocks.getBlockType('studio/card')), 'Requires ACF Pro and the fixture plugin.');
        await page.evaluate(() => wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false));
        const panel = page.getByRole('button', { name: 'Block Content Bridge', exact: true });
        await expect(panel).toBeVisible();
        if (await panel.getAttribute('aria-expanded') !== 'true') await panel.click();
        await page.evaluate(() => wp.data.dispatch('core/block-editor').resetBlocks(wp.blocks.parse('<!-- wp:studio/card {"name":"studio/card","data":{"copy":"Unique block copy","_copy":"field_bcb_copy"},"mode":"preview"} /--><!-- wp:paragraph --><p>A native paragraph.</p><!-- /wp:paragraph -->')));
        const metaBoxes = page.getByRole('button', { name: 'Meta Boxes', exact: true });
        if (await metaBoxes.getAttribute('aria-expanded') === 'false') await metaBoxes.press('Enter');
        await expect(page.getByLabel('Additional copy', { exact: true })).toBeVisible();
        await page.getByLabel('Additional copy', { exact: true }).fill('Separate metabox copy');
        await expect(page.getByText('Analysis content is up to date.', { exact: true })).toBeVisible();
        await expect.poll(() => page.evaluate(() => YoastSEO.app.pluggable._applyModifications('content', 'Native fallback'))).toContain('Separate metabox copy');
        const html = await page.evaluate(() => YoastSEO.app.pluggable._applyModifications('content', 'Native fallback'));
        expect(html.match(/Unique block copy/g)).toHaveLength(1);
        expect(html.match(/Separate metabox copy/g)).toHaveLength(1);
        expect(html).toContain('A native paragraph.');
        expect(html).not.toContain('Native fallback');
        await page.evaluate(() => wp.data.dispatch('core/block-editor').selectBlock(wp.data.select('core/block-editor').getBlocks()[0].clientId));
        await page.getByRole('tab', { name: 'Block', exact: true }).click();
        await page.getByLabel('Copy', { exact: true }).fill('Edited block copy');
        await page.getByLabel('Copy', { exact: true }).press('Tab');
        await expect.poll(() => page.evaluate(() => YoastSEO.app.pluggable._applyModifications('content', 'Native fallback')), { timeout: 15000 }).toContain('Edited block copy');
        const edited = await page.evaluate(() => YoastSEO.app.pluggable._applyModifications('content', 'Native fallback'));
        expect(edited.match(/Edited block copy/g)).toHaveLength(1);
        expect(edited.match(/Separate metabox copy/g)).toHaveLength(1);
        expect(edited).not.toContain('Unique block copy');
        const fallback = await page.evaluate(() => {
            const preview = document.createElement('div');
            preview.className = 'acf-block-preview';
            document.body.appendChild(preview);
            const block = wp.data.select('core/block-editor').getBlocks()[0];
            wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, { data: { ...block.attributes.data, copy: 'Edit while sharing is paused' } });
            const content = YoastSEO.app.pluggable._applyModifications('content', 'Native fallback');
            preview.remove();
            const resumed = YoastSEO.app.pluggable._applyModifications('content', 'Native fallback');
            return { content, resumed };
        });
        expect(fallback.content).toContain('Native fallback');
        expect(fallback.content).not.toContain('Edited block copy');
        expect(fallback.resumed).not.toContain('Edited block copy');
    } finally {
        page.on('dialog', dialog => dialog.accept());
        await page.goto('/wp-admin/plugins.php');
        await page.locator('tr[data-slug="acf-content-analysis-for-yoast-seo"]').getByRole('link', { name: /^Deactivate ACF Content Analysis/ }).click();
    }
});
