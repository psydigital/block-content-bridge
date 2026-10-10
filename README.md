# Block Content Bridge

Give Yoast SEO the rendered content of your WordPress blocks, including dynamic ACF blocks with custom namespaces.

By **Psy Digital** · [hello@psydigital.co.uk](mailto:hello@psydigital.co.uk)

## Install

1. Download **`block-content-bridge-0.1.0.zip`** from [GitHub Releases](https://github.com/psydigital/block-content-bridge/releases). Use the plugin ZIP asset, rather than GitHub's source-code archive.
2. In WordPress, go to **Plugins → Add New Plugin → Upload Plugin** and select the ZIP.
3. Activate it, then open a post or page in the block editor.
4. Open **Block Content Bridge** in the document sidebar. Automatic analysis starts after you pause editing.

Requires WordPress 6.6+, PHP 8.1+ and Yoast SEO 24.6+. ACF Pro is needed only for ACF blocks. The plugin has no frontend scripts or external service dependency.

For updates, upload the newer release ZIP and choose **Replace current with uploaded**. GitHub updates are not installed automatically. Uninstalling removes this plugin's settings on the current site; posts and blocks are retained.

## What it does

The editor sends its current block content to an authenticated endpoint on your own WordPress site. WordPress renders the blocks and shortcodes, and the plugin supplies cleaned semantic HTML to Yoast's content analysis. Headings, links, lists and image alt text are preserved. Nested blocks stay in document order.

This replaces Yoast's normal post-content input while the current render is ready. It does not append a second copy of the page. Unsaved edits are analysed without saving or publishing them. If rendering fails or content changes, the bridge falls back to Yoast's normal input and shows its status.

The plugin changes editor analysis only. It does not change public pages, metadata, sitemaps, indexing or search rankings.

## Settings

Find **Settings → Block Content Bridge**:

| Setting | Default | Purpose |
| --- | --- | --- |
| Enabled post types | Public types with the block editor | Choose where the bridge runs. Clear all to disable it. |
| Excluded block types | None | Omit selected blocks and their contents from analysis. |
| Analysis updates | Automatic | Use Manual to render only when you press Refresh analysis. |
| Advanced exclusions | Empty | Exclude elements using CSS selectors, one per line. |

Developers can add `data-psy-analysis-ignore` to any element in a block template to omit it and its contents. Scripts, styles, forms, form controls, embedded frames and SVGs are excluded automatically. Collapsed accordion content is retained.

The editor panel provides **Refresh analysis**, collection status and **View collected content**. The inspector shows the HTML supplied by this plugin before other custom Yoast filters; it is not the final Yoast word count. Inspection stays in your browser and is not logged or sent to Psy Digital.

## Compatibility and limits

- **ACF Content Analysis for Yoast SEO:** the bridge pauses while that add-on is active. Choose one collector. This plugin handles rendered post blocks, not separate custom-field metaboxes or taxonomy fields. Do not deactivate another collector if you depend on those features without comparing results first.
- **Other custom Yoast integrations:** this plugin replaces the `content` input at priority 5. Later content filters still run. Check the final analysis if another integration replaces or appends content.
- **Content source:** unsaved values must be present in the editor's serialized block content. Unsaved values held only in custom-field metaboxes or post-meta-backed blocks are outside this release's coverage.
- **Rendering context:** templates run in a REST request with the current post. Blocks that depend on frontend-only query state, JavaScript output or third-party content filters can differ from the public page. Full theme headers and footers are outside the analysed document.
- **Limits:** 1 MB of source content, 1,000 rendered block instances, 5 MB of rendered HTML and a 20-second browser wait. A timed-out server render may finish on the server, but its result is ignored.
- **Scope:** the post/page block editor and single-site WordPress. Classic Editor, Site Editor templates, Rank Math and network-wide uninstall are not supported in this release.

If the panel reports an error, check that the block previews work, inspect the collected HTML, and try **Refresh analysis**. Invalid exclusion selectors produce an error instead of silently omitting content.

## Development

Runtime PHP and JavaScript are committed directly; installation needs no build tools.

```sh
npm ci
npm test
npm run package
```

Packaging requires the `zip` command. It produces a deterministic plugin ZIP and SHA-256 file in `dist/`, using an explicit runtime-file allowlist. Tests, dependencies and development tooling are excluded.

See [testing instructions](docs/testing.md) for the disposable WordPress integration and browser suites. ACF Pro must be provided locally and is never bundled or uploaded to CI.

## Support and licence

Report reproducible bugs through [GitHub Issues](https://github.com/psydigital/block-content-bridge/issues). Include WordPress, PHP, Yoast and ACF versions and a minimal synthetic example. Remove private content and credentials before sharing diagnostics.

Security reports: [hello@psydigital.co.uk](mailto:hello@psydigital.co.uk).

GPL-3.0-or-later. This independent plugin is not affiliated with Yoast or Advanced Custom Fields.
