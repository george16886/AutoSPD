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
    hideCaptions = true,
    classifyMode = 'keywords',
    aiAnswer = null,
    aiLabels = {},
    notifications = false
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
            const toast = {
                classList: { add() {}, remove() {} },
                setAttribute() {},
                set textContent(text) { toasts.push(text); }
            };
            return toast;
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
            if (event.type === 'autospd-ai-classify') {
                const request = JSON.parse(event.detail);
                aiRequests.push(request);
                // Answer asynchronously, like the model does
                setImmediate(() => documentListeners.get('autospd-ai-result')?.({
                    detail: JSON.stringify({ requestId: request.requestId, ...aiAnswer })
                }));
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
    const aiRequests = [];
    const savedLabels = [];
    let matchOverride = null;
    const settings = { autoSpeed: true, notifications, hideCaptions, classifyMode };
    const toasts = [];
    const categories = [
        { id: 'stories', name: '說故事', speed: 1.5, keywords: ['故事'], enabled: true },
        { id: 'investigation', name: '案件 / 調查解說', speed: 1.75, keywords: ['命案'], enabled: true },
        { id: 'news', name: '新聞時事', speed: 1.5, keywords: ['新聞'], enabled: true },
        { id: 'off', name: '停用', speed: 2, keywords: [], enabled: false }
    ];
    const chrome = {
        runtime: {
            onMessage: {
                addListener(listener) { runtimeListeners.push(listener); }
            },
            async sendMessage(message) {
                if (message.type === 'get-settings') return { settings: { ...settings } };
                if (message.type === 'match-video') {
                    matchRequests.push(message.videoInfo);
                    if (matchOverride) return matchOverride;
                    const aiPick = categories.find(cat => cat.id === message.videoInfo.aiCategoryId);
                    if (aiPick) return { speed: aiPick.speed, category: { id: aiPick.id, name: `${aiPick.name}（AI）` } };
                    return {
                        speed: 1.5,
                        category: { id: 'stories', name: '說故事' }
                    };
                }
                if (message.type === 'get-categories') return { categories };
                if (message.type === 'get-ai-label') return { categoryId: aiLabels[message.videoId] || null };
                if (message.type === 'save-ai-label') {
                    savedLabels.push([message.videoId, message.categoryId]);
                    return { success: true };
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
        rateRequests,
        aiRequests,
        savedLabels,
        toasts,
        setMatchResult(result) { matchOverride = result; }
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
    harness.storageListeners[0]({ categories: {} }, 'sync');
    await wait(20);

    assert.equal(harness.page.captionsOn, true);
    assert.equal(harness.page.captionClicks, 1);
});

test('AI mode starts with the keyword match, then switches to the model pick', async () => {
    const harness = createContentScript({ classifyMode: 'ai', aiAnswer: { categoryId: 'investigation' } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.video.playbackRate, 1.5);

    await wait(20);

    assert.equal(harness.video.playbackRate, 1.75);
    assert.equal(getState(harness).categoryName, '案件 / 調查解說（AI）');
    assert.deepEqual(harness.savedLabels, [['test-video', 'investigation']]);
    const offered = harness.aiRequests[0].categories.map(cat => cat.id);
    assert.deepEqual(offered, ['stories', 'investigation', 'news']);
});

test('AI mode reuses a cached pick without asking the model again', async () => {
    const harness = createContentScript({ classifyMode: 'ai', aiLabels: { 'test-video': 'investigation' } });
    await wait(20);

    assert.equal(harness.video.playbackRate, 1.75);
    assert.equal(harness.aiRequests.length, 0);
});

test('AI mode keeps the keyword speed when the model is unavailable', async () => {
    const harness = createContentScript({ classifyMode: 'ai', aiAnswer: { error: 'downloadable' } });
    await wait(20);

    assert.equal(harness.video.playbackRate, 1.5);
    assert.equal(getState(harness).aiStatus, 'downloadable');
    assert.deepEqual(harness.savedLabels, []);
});

test('AI mode does not override a speed the user picked while waiting', async () => {
    const harness = createContentScript({ classifyMode: 'ai', aiAnswer: { categoryId: 'investigation' } });
    await new Promise(resolve => setImmediate(resolve));

    harness.video.playbackRate = 2;
    harness.video.fire('ratechange');
    await wait(20);

    assert.equal(harness.video.playbackRate, 2);
    assert.equal(getState(harness).mode, 'manual');
});

test('keyword mode never asks the model', async () => {
    const harness = createContentScript({ aiAnswer: { categoryId: 'investigation' } });
    await wait(20);

    assert.equal(harness.aiRequests.length, 0);
});

test('AI mode does not ask the model when a fixed 1x rule decided', async () => {
    const harness = createContentScript({
        classifyMode: 'ai',
        aiAnswer: { categoryId: 'investigation' },
        playerInfo: { videoId: 'test-video', title: 'Song (Official MV)', isLive: false, ytCategory: 'Music' }
    });
    harness.setMatchResult({ speed: 1, category: { id: 'fixed_music', name: '音樂 / MV（固定 1x）' } });
    await wait(20);

    assert.equal(harness.aiRequests.length, 0);
    assert.equal(harness.matchRequests[0].ytCategoryId, '10');
    assert.equal(harness.matchRequests[0].isLive, false);
});

test('AI mode announces again only when the model changes the speed', async () => {
    // Keyword match: 說故事 1.5x; the model picks 案件 at 1.75x
    const faster = createContentScript({ classifyMode: 'ai', notifications: true, aiAnswer: { categoryId: 'investigation' } });
    await wait(30);
    assert.deepEqual(faster.toasts, ['AutoSPD：說故事 · 1.5x', 'AutoSPD：案件 / 調查解說（AI） · 1.75x']);

    // The model picks a different category at the same speed: category updates quietly
    const same = createContentScript({ classifyMode: 'ai', notifications: true, aiAnswer: { categoryId: 'news' } });
    await wait(30);
    assert.deepEqual(same.toasts, ['AutoSPD：說故事 · 1.5x']);
    assert.equal(getState(same).categoryName, '新聞時事（AI）');
});

const watchPlayerInfo = { videoId: 'test-video', title: '都市傳說：深夜的訪客', ytCategory: 'Entertainment' };

function navigate(harness) {
    harness.documentListeners.get('yt-navigate-finish')();
    harness.documentListeners.get('yt-page-data-updated')();
}

test('the navigation events of one page handle the video only once', async () => {
    const harness = createContentScript({ playerInfo: watchPlayerInfo, notifications: true });
    await wait(20);

    navigate(harness);
    await wait(150);

    assert.equal(harness.matchRequests.length, 1);
    assert.equal(harness.toasts.length, 1);
});

test('navigating within the same video keeps a manual speed', async () => {
    const harness = createContentScript({ playerInfo: watchPlayerInfo });
    await wait(20);
    harness.runtimeListeners[0]({ type: 'set-manual-speed', speed: 1.75 }, {}, () => {});

    navigate(harness);
    await wait(150);

    assert.equal(harness.video.playbackRate, 1.75);
    assert.equal(getState(harness).mode, 'manual');
});

test('a first pass without player data is retried on the next navigation event', async () => {
    const harness = createContentScript();
    await wait(20);

    harness.documentListeners.get('yt-navigate-finish')();
    await wait(150);

    assert.equal(harness.matchRequests.length, 2);
});

test('toggling the toast or captions does not reset a manual speed', async () => {
    const harness = createContentScript({ playerInfo: watchPlayerInfo });
    await wait(20);
    harness.runtimeListeners[0]({ type: 'set-manual-speed', speed: 1.75 }, {}, () => {});

    harness.storageListeners[0]({
        settings: { oldValue: { notifications: true, hideCaptions: true }, newValue: { notifications: false, hideCaptions: false } }
    }, 'sync');
    await wait(20);

    assert.equal(harness.matchRequests.length, 1);
    assert.equal(harness.video.playbackRate, 1.75);
});

test('changing a speed setting re-applies the automatic speed', async () => {
    const harness = createContentScript({ playerInfo: watchPlayerInfo });
    await wait(20);

    harness.storageListeners[0]({ settings: { oldValue: { defaultSpeed: 1 }, newValue: { defaultSpeed: 1.25 } } }, 'sync');
    await wait(20);

    assert.equal(harness.matchRequests.length, 2);
});

test('the popup cannot set a manual speed outside a video page', async () => {
    const harness = createContentScript({ url: 'https://www.youtube.com/' });
    await wait(20);

    let response;
    harness.runtimeListeners[0]({ type: 'set-manual-speed', speed: 1.75 }, {}, result => { response = result; });

    assert.equal(response.error, '目前分頁不是影片頁');
    assert.equal(harness.video.playbackRate, 1);
});
