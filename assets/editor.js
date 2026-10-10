(function (wp, global) {
    'use strict';

    wp.domReady(function () {
        const settings = global.psyBlockBridgeSettings;
        const { __, sprintf } = wp.i18n;
        const { createElement: el, useEffect, useState } = wp.element;
        const { Button, Notice, TextareaControl } = wp.components;
        const { PluginDocumentSettingPanel } = wp.editor;
        const listeners = new Set();
        const pluginName = 'PsyBlockContentBridge';
        let yoast = null;
        let timer = null;
        let status = { status: 'waiting', html: null, error: '', blocks: 0, excluded: 0 };

        function publish(state) {
            status = state;
            listeners.forEach(listener => listener(state));
            if (yoast) yoast.pluginReloaded(pluginName);
        }

        const controller = global.PsyBlockBridge.createController({
            selectors: settings.selectors,
            onChange: publish,
            render: (source, signal) => wp.apiFetch({
                path: '/psy-block-bridge/v1/render',
                method: 'POST',
                data: { post_id: source.id, content: source.content, title: source.title },
                signal,
            }),
        });

        function readEditor() {
            const editor = wp.data.select('core/editor');
            const id = editor.getCurrentPostId();
            if (!id) return;
            const changed = controller.update({
                id,
                content: editor.getEditedPostContent(),
                title: editor.getEditedPostAttribute('title') || '',
            });
            if (!changed) return;
            global.clearTimeout(timer);
            if (settings.refresh === 'auto') timer = global.setTimeout(() => controller.refresh(), 1200);
        }

        function refresh() {
            readEditor();
            global.clearTimeout(timer);
            controller.refresh();
        }

        function Panel() {
            const [state, setState] = useState(status);
            const [inspect, setInspect] = useState(false);
            useEffect(() => {
                listeners.add(setState);
                setState(status);
                return () => listeners.delete(setState);
            }, []);
            const messages = {
                waiting: __('Waiting for Yoast SEO to initialise.', 'block-content-bridge'),
                stale: __('Content has changed. Analysis needs refreshing.', 'block-content-bridge'),
                loading: __('Rendering current editor content…', 'block-content-bridge'),
                ready: __('Analysis content is up to date.', 'block-content-bridge'),
                error: __('Analysis could not be updated. Yoast is using its normal content source.', 'block-content-bridge'),
            };
            return el(PluginDocumentSettingPanel, { name: 'psy-block-content-bridge', title: 'Block Content Bridge', initialOpen: true },
                settings.conflict ? el(Notice, { status: 'warning', isDismissible: false }, settings.conflict) : el('div', null,
                    el('p', { role: 'status', 'aria-live': 'polite' }, messages[state.status] || messages.waiting),
                    state.error ? el(Notice, { status: 'error', isDismissible: false }, state.error) : null,
                    state.status === 'ready' ? el('p', null, sprintf(__('%1$d block instances processed; %2$d excluded.', 'block-content-bridge'), state.blocks, state.excluded)) : null,
                    el(Button, { variant: 'secondary', onClick: refresh, disabled: !yoast || state.status === 'loading' }, __('Refresh analysis', 'block-content-bridge')),
                    el('p', null, __('Uses the current unsaved block content. This does not save or publish the post.', 'block-content-bridge')),
                    el(Button, { variant: 'link', onClick: () => setInspect(!inspect), 'aria-expanded': inspect }, inspect ? __('Hide collected content', 'block-content-bridge') : __('View collected content', 'block-content-bridge')),
                    inspect ? el(TextareaControl, { label: __('Collected HTML', 'block-content-bridge'), value: state.html === null ? '' : state.html, readOnly: true, rows: 10, help: __('This document is supplied to Yoast before any other custom analysis filters. It is not a preview of the public page.', 'block-content-bridge') }) : null
                )
            );
        }

        wp.plugins.registerPlugin('psy-block-content-bridge', { render: Panel, icon: 'editor-code' });
        if (settings.conflict) return;

        let attempts = 0;
        function connect() {
            const app = global.YoastSEO && global.YoastSEO.app;
            if (!app || typeof app.registerModification !== 'function') {
                if (++attempts < 120) global.setTimeout(connect, 250);
                else publish({ ...status, status: 'error', error: __('Yoast did not initialise. Check that its content analysis is enabled, then reload the editor.', 'block-content-bridge') });
                return;
            }
            try {
                app.registerPlugin(pluginName, { status: 'ready' });
                app.registerModification('content', data => controller.content(data), pluginName, 5);
                yoast = app;
                wp.data.subscribe(readEditor);
                readEditor();
            } catch (error) {
                publish({ ...status, status: 'error', error: __('Could not connect to Yoast analysis. Reload the editor and check plugin compatibility.', 'block-content-bridge') });
            }
        }
        connect();
    });
})(window.wp, window);
