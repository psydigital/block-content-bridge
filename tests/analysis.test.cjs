const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');

function load() {
    const dom = new JSDOM('', { runScripts: 'outside-only' });
    const file = path.join(__dirname, '../assets/analysis.js');
    if (fs.existsSync(file)) dom.window.eval(fs.readFileSync(file, 'utf8'));
    return dom.window;
}

test('analysis HTML preserves headings, links, image alt text and repeated editorial text', () => {
    const window = load();
    assert.equal(typeof window.PsyBlockBridge?.cleanHTML, 'function', 'HTML collector is available');
    const html = window.PsyBlockBridge.cleanHTML('<h2>Heading</h2><p>Repeated.</p><p>Repeated.</p><a href="https://example.org/work">Work</a><img src="https://example.org/image.jpg" alt="A sample image">', []);
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelector('h2').textContent, 'Heading');
    assert.equal(doc.querySelectorAll('p').length, 2);
    assert.equal(doc.querySelector('a').getAttribute('href'), 'https://example.org/work');
    assert.equal(doc.querySelector('img').getAttribute('alt'), 'A sample image');
});

test('excludes scripts, controls and opt-out content without dropping accordion content', () => {
    const window = load();
    assert.equal(typeof window.PsyBlockBridge?.cleanHTML, 'function');
    const html = window.PsyBlockBridge.cleanHTML('<script>unwanted script text</script><style>unwanted style text</style><button>Editor button</button><div data-psy-analysis-ignore>Ignore me</div><div class="boilerplate">Boilerplate</div><details><summary>Question</summary><p>Answer</p></details><p onclick="alert(1)">Keep me</p>', ['.boilerplate']);
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.body.textContent, 'QuestionAnswerKeep me');
    assert.equal(doc.querySelector('[onclick]'), null);
});

test('invalid selectors produce an actionable error rather than partial analysis', () => {
    const window = load();
    assert.equal(typeof window.PsyBlockBridge?.cleanHTML, 'function');
    assert.throws(() => window.PsyBlockBridge.cleanHTML('<p>Content</p>', ['[']), /selector/i);
});

test('link relationship metadata survives cleaning for accurate outbound-link analysis', () => {
    const window = load();
    const html = window.PsyBlockBridge.cleanHTML('<p><a href="https://example.org" rel="nofollow sponsored ugc noopener" onclick="alert(1)">Reference</a></p>', []);
    const link = new JSDOM(html).window.document.querySelector('a');
    assert.equal(link.getAttribute('rel'), 'nofollow sponsored ugc noopener');
    assert.equal(link.getAttribute('href'), 'https://example.org');
    assert.equal(link.hasAttribute('onclick'), false);
});

test('sharing with the ACF collector requires a separate canvas and no outer block previews', () => {
    const window = load();
    assert.equal(typeof window.PsyBlockBridge.canShareWithACF, 'function');
    assert.equal(window.PsyBlockBridge.canShareWithACF(), false);
    window.document.body.innerHTML = '<div class="metabox-location-normal"><input value="Separate field"></div><iframe name="editor-canvas"></iframe>';
    window.document.querySelector('iframe').contentDocument.body.innerHTML = '<div class="acf-block-component acf-block-body acf-block-preview">Block content</div>';
    assert.equal(window.PsyBlockBridge.canShareWithACF(), true);
    window.document.body.insertAdjacentHTML('beforeend', '<div class="acf-block-component acf-block-body">Editable block fields</div>');
    assert.equal(window.PsyBlockBridge.canShareWithACF(), false);
});

test('unsafe link protocols are omitted and inspector content stays inert', () => {
    const window = load();
    assert.equal(typeof window.PsyBlockBridge?.cleanHTML, 'function');
    const html = window.PsyBlockBridge.cleanHTML('<a href="javascript:alert(1)">Link</a><img src="x" onerror="alert(1)" alt="Photo"><iframe src="https://example.org"></iframe>', []);
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelector('a').hasAttribute('href'), false);
    assert.equal(doc.querySelector('[onerror],iframe'), null);
});
