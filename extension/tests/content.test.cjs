const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const contentSource = fs.readFileSync(
    path.join(__dirname, '..', 'content.js'),
    'utf8'
);

function createContentScript() {
    const video = { playbackRate: 1 };
    const documentListeners = new Map();
    const runtimeListeners = [];
    const storageListeners = [];
    const currentLocation = { href: 'https://www.youtube.com/watch?v=test-video' };
    const titleElement = { textContent: '都市傳說：深夜的訪客' };
    const document = {
        title: '都市傳說：深夜的訪客 - YouTube',
        documentElement: { append() {} },
        querySelector(selector) {
            if (selector.includes('video')) return video;
            if (selector === 'h1.ytd-watch-metadata yt-formatted-string') return titleElement;
            return null;
        },
        getElementById() { return null; },
        createElement() {
            return {
                classList: { add() {}, remove() {} },
                setAttribute() {}
            };
        },
        addEventListener(name, listener) {
            documentListeners.set(name, listener);
        }
    };
    const settings = { autoSpeed: true, notifications: false, recordHistory: false };
    const chrome = {
        runtime: {
            onMessage: {
                addListener(listener) { runtimeListeners.push(listener); }
            },
            async sendMessage(message) {
                if (message.type === 'get-settings') return { settings: { ...settings } };
                if (message.type === 'match-video') {
                    return {
                        speed: 1.5,
                        category: { id: 'stories', name: '說故事' }
                    };
                }
                return { success: true };
            }
        },
        storage: {
            onChanged: {
                addListener(listener) { storageListeners.push(listener); }
            }
        }
    };
    const context = {
        chrome,
        document,
        location: currentLocation,
        URL,
        window: { addEventListener() {} },
        console,
        setTimeout,
        clearTimeout
    };

    vm.runInNewContext(contentSource, context);

    return {
        video,
        settings,
        runtimeListeners,
        storageListeners,
        documentListeners,
        currentLocation
    };
}

test('applies the category playback speed to the active YouTube video', async () => {
    const harness = createContentScript();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(harness.video.playbackRate, 1.5);

    let state;
    harness.runtimeListeners[0](
        { type: 'get-video-state' },
        {},
        response => { state = response; }
    );
    assert.equal(state.videoId, 'test-video');
    assert.equal(state.categoryName, '說故事');
    assert.equal(state.mode, 'auto');
});

test('supports a manual speed override for the current video', async () => {
    const harness = createContentScript();
    await new Promise(resolve => setImmediate(resolve));

    let response;
    harness.runtimeListeners[0](
        { type: 'set-manual-speed', speed: 1.75 },
        {},
        result => { response = result; }
    );

    assert.equal(response.success, true);
    assert.equal(harness.video.playbackRate, 1.75);
    assert.equal(response.state.mode, 'manual');
});
