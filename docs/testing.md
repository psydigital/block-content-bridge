# Testing

Use a disposable local WordPress installation and database. The integration suite creates synthetic users/posts and temporarily changes the bridge's settings.

## JavaScript

Node.js 22 or newer:

```sh
npm ci
npm test
```

The tests cover semantic HTML, exclusions, unsafe attributes, response ordering, deleted content, failed requests and timeout recovery.

## WordPress integration

Install WordPress, Yoast SEO and this plugin in a dedicated test site. Enable the explicit test-site flag:

```sh
wp config set PSY_BCB_TEST_SITE true --raw --path=/path/to/test-wordpress
wp eval-file tests/wp-integration.php --path=/path/to/test-wordpress
```

The suite checks permissions using real WordPress users and REST dispatch, custom-namespace dynamic rendering, nested content, exclusions, size limits, failure handling and unchanged saved content.

## Browser integration

Start the disposable site on a loopback URL. Provide its administrator credentials through local environment variables; never commit them.

```sh
npx playwright install chromium
BCB_TEST_URL=http://127.0.0.1:8876 BCB_TEST_USER=bridge-admin BCB_TEST_PASSWORD="$TEST_SITE_PASSWORD" npm run test:browser
```

For ACF coverage, install your own ACF Pro copy and install `tests/fixtures/` as a separate test plugin. Activate both. The fixture defines `studio/card`, an ACF v3 block with a custom namespace. Without that fixture, the ACF browser test explicitly skips; a passing core test is not ACF compatibility evidence.

Tests edit synthetic unsaved drafts and exercise Yoast's registered analysis modification in the real editor. They never publish posts. Do not run them against a live content site.

## Release checks

Run JavaScript and WordPress tests, PHP syntax checks and browser tests before packaging. Inspect the ZIP, install it on a fresh disposable site, and check activation, settings, analysis and uninstall. Keep the release's tested versions and known limitations explicit.
