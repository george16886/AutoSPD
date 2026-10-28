const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// The manifest loads yt-categories.js before content.js in the same world
const contentSource = [
    fs.readFileSync(path.join(__dirname, '..', 'yt-categories.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8')
].join('\n');

function createVideo() {
    const listeners = new Map();
    return {
        playbackRate: 1,
        addEventListener(name, listener) {
            listeners.set(name, [...(listeners.get(name) || []), listener]);
        },
        fire(name) {
            for (const listener of listeners.get(name) || []) listener();
        }
    };
}

function getState(harness) {
    let state;
    harness.runtimeListeners[0]({ type: 'get-video-state' }, {}, response => { state = response; });
    return state;
}

function createContentScript({
    playerInfo = null,
    url = 'https://www.youtube.com/watch?v=test-video',
    staleWatchPlayer = false,
    captionsOn = false,
    hideCaptions = true
} = {}) {
    const video = createVideo();
    // Hidden watch-page player left in the DOM after navigating to Shorts
    const staleWatchVideo = createVideo();
    const page = { adShowing: false, captionsOn, captionClicks: 0 };
    const captionsButton = {
        click() {
            page.captionClicks += 1;
            page.captionsOn = !page.captionsOn;
        }
    };
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
            if (selector.includes('.ad-showing')) return page.adShowing ? {} : null;
            if (selector.includes('.ytp-subtitles-button')) return page.captionsOn ? captionsButton : null;
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
            if (event.type === 'autospd-set-rate') {
                rateRequests.push(JSON.parse(event.detail));
                return;
            }
            if (event.type === 'autospd-request-video-info') {
                documentListeners.get('autospd-video-info')?.({
                    detail: JSON.stringify(playerInfo)
                });
            }
        }
    };
    const matchRequests = [];
    const rateRequests = [];
    const settings = { autoSpeed: true, notifications: false, recordHistory: false, hideCaptions };
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
            constructor(type, options = {}) {
                this.type = type;
                this.detail = options.detail;
            }
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
        page,
        settings,
        runtimeListeners,
        storageListeners,
        documentListeners,
        currentLocation,
        matchRequests,
        rateRequests
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
    const state = getState(harness);
    assert.equal(state.ytCategory, 'Science & Technology');
    assert.equal(state.channelName, 'Science Channel');
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

test('restores the category speed when YouTube resets it while loading a source', async () => {
    const harness = createContentScript();
    await new Promise(resolve => setImmediate(resolve));

    harness.video.fire('loadeddata');
    harness.video.playbackRate = 1;
    harness.video.fire('ratechange');

    assert.equal(harness.video.playbackRate, 1.5);
    assert.equal(getState(harness).mode, 'auto');
});

test('keeps a speed the user picks in the YouTube player as a manual override', async () => {
    const harness = createContentScript();
    await new Promise(resolve => setImmediate(resolve));

    harness.video.playbackRate = 2;
    harness.video.fire('ratechange');
    harness.video.fire('playing');

    assert.equal(harness.video.playbackRate, 2);
    const state = getState(harness);
    assert.equal(state.mode, 'manual');
    assert.equal(state.speed, 2);
});

test('leaves ads alone and reapplies the speed once the video resumes', async () => {
    const harness = createContentScript();
    await new Promise(resolve => setImmediate(resolve));

    harness.page.adShowing = true;
    harness.video.playbackRate = 1;
    harness.video.fire('loadeddata');
    harness.video.fire('ratechange');
    assert.equal(harness.video.playbackRate, 1);
    assert.equal(getState(harness).mode, 'auto');

    harness.page.adShowing = false;
    harness.video.fire('loadeddata');
    assert.equal(harness.video.playbackRate, 1.5);
});

test('asks the YouTube player to change speed so its menu stays in sync', async () => {
    const harness = createContentScript();
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(harness.rateRequests.at(-1), { videoId: 'test-video', speed: 1.5 });

    harness.runtimeListeners[0]({ type: 'set-manual-speed', speed: 1.75 }, {}, () => {});
    assert.deepEqual(harness.rateRequests.at(-1), { videoId: 'test-video', speed: 1.75 });
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('turns off captions YouTube switched on for a new video', async () => {
    const harness = createContentScript({ captionsOn: true });
    await wait(20);

    assert.equal(harness.page.captionsOn, false);
    assert.equal(harness.page.captionClicks, 1);
});

test('leaves captions on when the setting is off', async () => {
    const harness = createContentScript({ captionsOn: true, hideCaptions: false });
    await wait(20);

    assert.equal(harness.page.captionsOn, true);
    assert.equal(harness.page.captionClicks, 0);
});

test('does not turn captions off again after the user re-enables them', async () => {
    const harness = createContentScript({ captionsOn: true });
    await wait(20);

    harness.page.captionsOn = true;
    harness.storageListeners[0]({ settings: {} }, 'sync');
    await wait(20);

    assert.equal(harness.page.captionsOn, true);
    assert.equal(harness.page.captionClicks, 1);
});
