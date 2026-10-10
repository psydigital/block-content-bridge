(function (global) {
    'use strict';

    const allowedTags = new Set('a abbr address article aside b blockquote br caption cite code dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i img ins li main mark ol p pre q s section small span strong sub summary sup table tbody td tfoot th thead time tr u ul'.split(' '));

    function safeURL(value) {
        try {
            return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(value, 'https://example.invalid/').protocol);
        } catch (error) {
            return false;
        }
    }

    /** Build inert, semantic HTML for analysis; never insert it into the live page. */
    function cleanHTML(html, selectors) {
        const template = global.document.createElement('template');
        template.innerHTML = html;
        const root = template.content;
        const excluded = ['script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed', 'svg', 'form', 'button', 'input', 'select', 'textarea', '[data-psy-analysis-ignore]'];
        for (const selector of [...excluded, ...selectors]) {
            try {
                root.querySelectorAll(selector).forEach(element => element.remove());
            } catch (error) {
                throw new Error('Invalid exclusion selector: ' + selector);
            }
        }
        for (const element of Array.from(root.querySelectorAll('*'))) {
            const tag = element.tagName.toLowerCase();
            if (!allowedTags.has(tag)) {
                element.replaceWith(...element.childNodes);
                continue;
            }
            for (const attribute of Array.from(element.attributes)) {
                const name = attribute.name.toLowerCase();
                const keep = (tag === 'a' && name === 'href' && safeURL(attribute.value)) ||
                    (tag === 'img' && ((name === 'src' && safeURL(attribute.value)) || name === 'alt')) ||
                    name === 'lang';
                if (!keep) element.removeAttribute(attribute.name);
            }
        }
        const walker = global.document.createTreeWalker(root, 128);
        const comments = [];
        while (walker.nextNode()) comments.push(walker.currentNode);
        comments.forEach(comment => comment.remove());
        return template.innerHTML.trim();
    }

    function createController({ render, selectors, onChange, timeoutMs = 20000 }) {
        let source = null;
        let key = null;
        let generation = 0;
        let request = null;
        let current = { status: 'idle', html: null, blocks: 0, excluded: 0, error: '' };
        function publish(patch) {
            current = { ...current, ...patch };
            onChange({ ...current });
        }
        return {
            state: () => ({ ...current }),
            content: fallback => current.status === 'ready' ? current.html : fallback,
            update(next) {
                const nextKey = JSON.stringify(next);
                if (nextKey === key) return false;
                key = nextKey;
                source = { ...next };
                generation++;
                if (request) request.abort();
                publish({ status: 'stale', html: null, blocks: 0, excluded: 0, error: '' });
                return true;
            },
            async refresh() {
                if (!source) return;
                if (request) request.abort();
                const version = ++generation;
                request = new global.AbortController();
                const activeRequest = request;
                const signal = activeRequest.signal;
                let timeout;
                publish({ status: 'loading', html: null, error: '' });
                try {
                    const expiry = new Promise((resolve, reject) => {
                        timeout = global.setTimeout(() => {
                            reject(new Error('Rendering timed out. Try refreshing the analysis.'));
                            activeRequest.abort();
                        }, timeoutMs);
                    });
                    const result = await Promise.race([render({ ...source }, signal), expiry]);
                    if (version !== generation) return;
                    if (!result || typeof result.html !== 'string') throw new Error('The renderer returned an incomplete response.');
                    const html = cleanHTML(result.html, selectors);
                    publish({ status: 'ready', html, blocks: result.blocks, excluded: result.excluded, error: '' });
                } catch (error) {
                    if (version !== generation) return;
                    publish({ status: 'error', html: null, error: error.message || 'Content could not be rendered.' });
                } finally {
                    global.clearTimeout(timeout);
                }
            }
        };
    }

    global.PsyBlockBridge = { cleanHTML, createController };
})(window);
