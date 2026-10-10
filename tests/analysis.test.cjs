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

test('unsafe link protocols are omitted and inspector content stays inert', () => {
    const window = load();
    assert.equal(typeof window.PsyBlockBridge?.cleanHTML, 'function');
    const html = window.PsyBlockBridge.cleanHTML('<a href="javascript:alert(1)">Link</a><img src="x" onerror="alert(1)" alt="Photo"><iframe src="https://example.org"></iframe>', []);
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelector('a').hasAttribute('href'), false);
    assert.equal(doc.querySelector('[onerror],iframe'), null);
});
