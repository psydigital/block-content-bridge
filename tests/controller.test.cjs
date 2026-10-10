const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');

function controller(render, timeoutMs) {
    const dom = new JSDOM('', { runScripts: 'outside-only' });
    dom.window.eval(fs.readFileSync(path.join(__dirname, '../assets/analysis.js'), 'utf8'));
    assert.equal(typeof dom.window.PsyBlockBridge.createController, 'function');
    return dom.window.PsyBlockBridge.createController({ render, selectors: [], onChange() {}, timeoutMs });
}

test('only the latest editor revision can supply analysis, even if an old response arrives last', async () => {
    const responses = [];
    const bridge = controller(() => new Promise(resolve => responses.push(resolve)));
    bridge.update({ id: 1, content: 'First' });
    const first = bridge.refresh();
    bridge.update({ id: 1, content: 'Second' });
    const second = bridge.refresh();
    responses[1]({ html: '<p>Second</p>', blocks: 1, excluded: 0 });
    await second;
    responses[0]({ html: '<p>First</p>', blocks: 1, excluded: 0 });
    await first;
    assert.equal(bridge.content('Native'), '<p>Second</p>');
    assert.equal(bridge.state().status, 'ready');
});

test('a stalled request times out and permits a retry', async () => {
    let stalled = true;
    const bridge = controller(() => stalled ? new Promise(() => {}) : Promise.resolve({ html: '<p>Recovered</p>', blocks: 1, excluded: 0 }), 10);
    bridge.update({ id: 1, content: 'Content' });
    await Promise.race([bridge.refresh(), new Promise(resolve => setTimeout(resolve, 100))]);
    assert.equal(bridge.state().status, 'error');
    assert.match(bridge.state().error, /timed out/i);
    stalled = false;
    await bridge.refresh();
    assert.equal(bridge.content('Native'), '<p>Recovered</p>');
});

test('editing invalidates collected content immediately and an empty document clears previous analysis', async () => {
    const bridge = controller(async source => ({ html: source.content, blocks: 0, excluded: 0 }));
    bridge.update({ id: 1, content: '<p>Old content</p>' });
    await bridge.refresh();
    bridge.update({ id: 1, content: '' });
    assert.equal(bridge.content('Native'), 'Native');
    assert.equal(bridge.state().status, 'stale');
    await bridge.refresh();
    assert.equal(bridge.content('Native'), '');
});

test('failed rendering restores native analysis and reports the failure', async () => {
    const bridge = controller(async () => { throw new Error('Rendering unavailable'); });
    bridge.update({ id: 1, content: 'Content' });
    await bridge.refresh();
    assert.equal(bridge.content('Native'), 'Native');
    assert.equal(bridge.state().status, 'error');
    assert.equal(bridge.state().error, 'Rendering unavailable');
});

test('unchanged editor state does not invalidate a successful analysis', async () => {
    const bridge = controller(async () => ({ html: '<p>Content</p>', blocks: 1, excluded: 0 }));
    bridge.update({ id: 1, content: 'Content' });
    await bridge.refresh();
    assert.equal(bridge.update({ id: 1, content: 'Content' }), false);
    assert.equal(bridge.content('Native'), '<p>Content</p>');
});

test('a response without complete HTML is an error, not a successful zero-word analysis', async () => {
    const bridge = controller(async () => ({ blocks: 1 }));
    bridge.update({ id: 1, content: 'Content' });
    await bridge.refresh();
    assert.equal(bridge.state().status, 'error');
    assert.equal(bridge.content('Native'), 'Native');
});
