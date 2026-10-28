const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const contentSource = fs.readFileSync(
    path.join(__dirname, '..', 'content.js'),
    'utf8'
);

function createContentScript({
    playerInfo = null,
    url = 'https://www.youtube.com/watch?v=test-video',
    staleWatchPlayer = false
} = {}) {
    const video = { playbackRate: 1 };
    // Hidden watch-page player left in the DOM after navigating to Shorts
    const staleWatchVideo = { playbackRate: 1 };
    const documentListeners = new Map();
    const runtimeListeners = [];
    const storageListeners = [];
    const parsedUrl = new URL(url);
    const currentLocation = { href: parsedUrl.href, pathname: parsedUrl.pathname };
    const titleElement = { textContent: '都市傳說：深夜的訪客' };
    const document = {
        title: '都市傳說：深夜的訪客 - YouTube',
        documentElement: { append() {} },
        querySelector(selector) {
            if (staleWatchPlayer && selector.startsWith('#movie_player')) return staleWatchVideo;
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
        },
        removeEventListener(name) {
            documentListeners.delete(name);
        },
        dispatchEvent(event) {
            // Stand-in for page-bridge.js answering from the main world
            if (event.type === 'autospd-request-video-info') {
                documentListeners.get('autospd-video-info')?.({
                    detail: JSON.stringify(playerInfo)
                });
            }
        }
    };
    const matchRequests = [];
    const settings = { autoSpeed: true, notifications: false, recordHistory: false };
    const chrome = {
        runtime: {
            onMessage: {
                addListener(listener) { runtimeListeners.push(listener); }
            },
            async sendMessage(message) {
                if (message.type === 'get-settings') return { settings: { ...settings } };
                if (message.type === 'match-video') {
                    matchRequests.push(message.videoInfo);
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
        CustomEvent: class {
            constructor(type) { this.type = type; }
        },
        window: { addEventListener() {} },
        console,
        setTimeout,
        clearTimeout
    };

    vm.runInNewContext(contentSource, context);

    return {
        video,
        staleWatchVideo,
        settings,
        runtimeListeners,
        storageListeners,
        documentListeners,
        currentLocation,
        matchRequests
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

test('sends the player response metadata and YouTube category ID for matching', async () => {
    const harness = createContentScript({
        playerInfo: {
            videoId: 'test-video',
            title: 'Black hole explained',
            description: 'A short science explainer',
            tags: ['physics'],
            channelName: 'Science Channel',
            ytCategory: 'Science & Technology'
        }
    });
    await new Promise(resolve => setImmediate(resolve));

    const videoInfo = harness.matchRequests[0];
    assert.equal(videoInfo.title, 'Black hole explained');
    assert.deepEqual([...videoInfo.tags], ['physics']);
    assert.equal(videoInfo.ytCategoryId, '28');
});

test('ignores player metadata that belongs to a different video', async () => {
    const harness = createContentScript({
        playerInfo: { videoId: 'previous-video', title: 'Old title', ytCategory: 'Music' }
    });
    await new Promise(resolve => setImmediate(resolve));

    const videoInfo = harness.matchRequests[0];
    assert.equal(videoInfo.title, '都市傳說：深夜的訪客');
    assert.equal(videoInfo.ytCategoryId, undefined);
});

test('applies the speed to the Shorts player, not a leftover watch player', async () => {
    const harness = createContentScript({
        url: 'https://www.youtube.com/shorts/short-video',
        staleWatchPlayer: true
    });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(harness.video.playbackRate, 1.5);
    assert.equal(harness.staleWatchVideo.playbackRate, 1);
});
