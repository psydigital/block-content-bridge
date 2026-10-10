const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

test('real editor supplies fresh semantic block HTML to Yoast and clears removed content', async ({ page }) => {
    const credentials = process.env.BCB_TEST_PASSWORD ? { username: process.env.BCB_TEST_USER, password: process.env.BCB_TEST_PASSWORD } : JSON.parse(fs.readFileSync('.runtime/credentials.json', 'utf8'));
    await page.goto('/wp-login.php');
    await page.locator('#user_login').fill(credentials.username);
    await page.locator('#user_pass').fill(credentials.password);
    await page.locator('#wp-submit').click();
    await page.waitForURL('**/wp-admin/**');
    await page.goto('/wp-admin/post-new.php');
    await page.waitForFunction(() => window.wp?.data?.select('core/editor')?.getCurrentPostId());
    await page.evaluate(() => wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false));
    await page.evaluate(() => {
        wp.data.dispatch('core/editor').editPost({ title: 'Bridge browser fixture' });
        wp.data.dispatch('core/block-editor').resetBlocks(wp.blocks.parse('<!-- wp:heading --><h2 class="wp-block-heading">A sample heading</h2><!-- /wp:heading --><!-- wp:paragraph --><p>First paragraph with <a href="https://example.org">a link</a>.</p><!-- /wp:paragraph -->'));
    });
    await expect(page.getByRole('button', { name: 'Block Content Bridge', exact: true })).toBeVisible();
    const panel = page.getByRole('button', { name: 'Block Content Bridge', exact: true });
    if (await panel.getAttribute('aria-expanded') !== 'true') await panel.click();
    await expect(page.getByText('Analysis content is up to date.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'View collected content', exact: true }).click();
    await expect(page.getByLabel('Collected HTML')).toHaveValue(/<h2>A sample heading<\/h2>/);
    await expect(page.getByLabel('Collected HTML')).toHaveValue(/href="https:\/\/example.org"/);
    await page.evaluate(() => wp.data.dispatch('core/block-editor').resetBlocks([]));
    await expect(page.getByText('Analysis content is up to date.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Collected HTML')).toHaveValue('');
    // Exercise the registered Yoast modification, rather than only the panel's copy.
    const analysis = await page.evaluate(async () => {
        return YoastSEO.app.pluggable._applyModifications('content', 'Native fallback');
    });
    expect(analysis).toBe('');
});

test('a custom-namespace ACF v3 block renders unsaved text inside an iframe editor', async ({ page }) => {
    const credentials = process.env.BCB_TEST_PASSWORD ? { username: process.env.BCB_TEST_USER, password: process.env.BCB_TEST_PASSWORD } : JSON.parse(fs.readFileSync('.runtime/credentials.json', 'utf8'));
    await page.goto('/wp-login.php');
    await page.locator('#user_login').fill(credentials.username);
    await page.locator('#user_pass').fill(credentials.password);
    await page.locator('#wp-submit').click();
    await page.waitForURL('**/wp-admin/**');
    await page.goto('/wp-admin/post-new.php');
    await page.waitForFunction(() => window.wp?.data?.select('core/editor')?.getCurrentPostId());
    const hasACF = await page.evaluate(() => !!wp.blocks.getBlockType('studio/card'));
    test.skip(!hasACF, 'Requires a local ACF Pro installation and the test fixture plugin.');
    await page.evaluate(() => {
        wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false);
        wp.data.dispatch('core/editor').editPost({ title: 'ACF integration fixture' });
        wp.data.dispatch('core/block-editor').resetBlocks(wp.blocks.parse('<!-- wp:group --><div class="wp-block-group"><!-- wp:studio/card {"name":"studio/card","data":{"copy":"Unsaved ACF heading","_copy":"field_bcb_copy"},"mode":"preview"} /--></div><!-- /wp:group -->'));
    });
    const panel = page.getByRole('button', { name: 'Block Content Bridge', exact: true });
    await expect(panel).toBeVisible();
    if (await panel.getAttribute('aria-expanded') !== 'true') await panel.click();
    await expect(page.getByText('Analysis content is up to date.', { exact: true })).toBeVisible();
    await expect(page.locator('iframe[name="editor-canvas"]')).toBeVisible();
    await page.getByRole('button', { name: 'View collected content', exact: true }).click();
    await expect(page.getByLabel('Collected HTML')).toHaveValue(/<h2>Unsaved ACF heading<\/h2>/);
    const analysis = await page.evaluate(() => YoastSEO.app.pluggable._applyModifications('content', 'Native fallback'));
    expect(analysis.match(/Unsaved ACF heading/g)).toHaveLength(1);
    expect(analysis).toContain('alt="Example project photo"');
});
