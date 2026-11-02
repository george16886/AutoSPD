const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { joinSources } = require('./i18n-mock.cjs');

// The worker's importScripts files, inlined in order, with Traditional Chinese messages
const backgroundSource = joinSources('zh_TW', 'zh-TW', 'i18n.js', 'yt-categories.js', 'default-categories.js', 'background.js');

function loadMatcher(storedData = {}) {
    const context = {
        console,
        chrome: {
            runtime: {
                onInstalled: { addListener() {} },
                onMessage: { addListener() {} }
            },
            storage: {
                sync: {
                    async get(keys) {
                        if (typeof keys === 'string') {
                            return { [keys]: storedData[keys] };
                        }
                        return Object.fromEntries(keys.map(key => [key, storedData[key]]));
                    },
                    async set() {}
                },
                local: {
                    async get() { return {}; },
                    async set() {}
                }
            },
            tabs: {
                async query() { return []; },
                async sendMessage() {}
            }
        }
    };

    vm.runInNewContext(backgroundSource, context);
    return context.matchVideoToCategory;
}

function loadBackground() {
    const context = {
        console,
        chrome: {
            runtime: { onInstalled: { addListener() {} }, onMessage: { addListener() {} } },
            storage: { sync: {}, local: {} }
        }
    };
    vm.createContext(context);
    vm.runInContext(backgroundSource, context);
    // Top-level consts are not exposed as context properties
    context.DEFAULT_CATEGORIES = vm.runInContext('DEFAULT_CATEGORIES', context);
    return context;
}

test('matches a category using a title keyword', async () => {
    const matchVideo = loadMatcher({
        categories: [
            { id: 'stories', name: '說故事', speed: 1.5, keywords: ['都市傳說'], enabled: true }
        ],
        settings: { autoSpeed: true, defaultSpeed: 1 }
    });

    const result = await matchVideo({ title: '都市傳說：深夜的訪客' });

    assert.equal(result.category.id, 'stories');
    assert.equal(result.speed, 1.5);
});

test('uses the configured default when automation is disabled', async () => {
    const matchVideo = loadMatcher({
        categories: [],
        settings: { autoSpeed: false, defaultSpeed: 1.25 }
    });

    const result = await matchVideo({ title: '科普知識' });

    assert.equal(result.autoDisabled, true);
    assert.equal(result.speed, null);
});

test('ignores disabled categories and uses the configured fallback', async () => {
    const matchVideo = loadMatcher({
        categories: [
            { id: 'disabled', name: '停用類別', speed: 1.75, keywords: ['開箱'], enabled: false }
        ],
        settings: { autoSpeed: true, defaultSpeed: 1.1 }
    });

    const result = await matchVideo({ title: '新手機開箱' });

    assert.equal(result.category, null);
    assert.equal(result.speed, 1.1);
});

test('falls back to 1x when the saved default speed is invalid', async () => {
    const matchVideo = loadMatcher({
        categories: [],
        settings: { autoSpeed: true, defaultSpeed: 4 }
    });

    const result = await matchVideo({ title: '', tags: 'not-an-array' });

    assert.equal(result.speed, 1);
});

test('does not match categories with out-of-range playback speeds', async () => {
    const matchVideo = loadMatcher({
        categories: [
            { id: 'invalid', name: '無效類別', speed: 3, keywords: ['教學'], enabled: true }
        ],
        settings: { autoSpeed: true, defaultSpeed: 1 }
    });

    const result = await matchVideo({ title: '程式教學' });

    assert.equal(result.category, null);
    assert.equal(result.speed, 1);
});

test('matches Latin keywords only as whole words', async () => {
    const matchVideo = loadMatcher({
        categories: [
            { id: 'science', name: '科普知識', speed: 1.25, keywords: ['TED'], enabled: true },
            { id: 'stories', name: '說故事', speed: 1.5, keywords: ['story'], enabled: true }
        ],
        settings: { autoSpeed: true, defaultSpeed: 1 }
    });

    const missed = await matchVideo({ title: 'I tested the history of every phone' });
    assert.equal(missed.category, null);

    const matched = await matchVideo({ title: 'TED Talk: a short story' });
    assert.ok(matched.category);
});

test('keeps substring matching for CJK keywords next to Latin text', async () => {
    const matchVideo = loadMatcher({
        categories: [
            { id: 'unboxing', name: '開箱影片', speed: 1.5, keywords: ['3C', '開箱'], enabled: true }
        ],
        settings: { autoSpeed: true, defaultSpeed: 1 }
    });

    const result = await matchVideo({ title: '3C產品手機開箱' });

    assert.equal(result.category.id, 'unboxing');
});

test('YouTube category ID outweighs a single keyword match', async () => {
    const matchVideo = loadMatcher({
        categories: [
            { id: 'sports', name: '球賽 / 體育', speed: 1.0, keywords: ['match'], ytCategoryIds: ['17'], enabled: true },
            { id: 'gaming', name: '遊戲實況', speed: 1.25, keywords: ['gaming'], ytCategoryIds: ['20'], enabled: true }
        ],
        settings: { autoSpeed: true, defaultSpeed: 1 }
    });

    const result = await matchVideo({ title: 'Ranked match highlights', ytCategoryId: '20' });

    assert.equal(result.category.id, 'gaming');
});

test('migration removes retired default keywords but keeps user edits', () => {
    const { migrateCategories } = loadBackground();
    const stored = [
        { id: 'sports', keywords: ['足球', 'Game', '我的關鍵字'] },
        { id: 'travel', keywords: ['旅遊', '攻略'], speed: 1.75 },
        { id: 'custom_1', keywords: ['game'] }
    ];

    const migrated = migrateCategories(stored, 1);

    assert.deepEqual([...migrated[0].keywords], ['足球', '我的關鍵字']);
    assert.deepEqual([...migrated[1].keywords], ['旅遊']);
    assert.equal(migrated[1].speed, 1.75);
    assert.deepEqual([...migrated[2].keywords], ['game']);
});

test('migration is a no-op for categories already on the latest defaults', () => {
    const { migrateCategories, DEFAULT_CATEGORIES } = loadBackground();
    const latest = migrateCategories(DEFAULT_CATEGORIES, 1);

    assert.deepEqual(JSON.parse(JSON.stringify(latest)), JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
});

async function runInstall(stored, removed = []) {
    let onInstalled;
    const writes = {};
    const context = {
        console,
        chrome: {
            runtime: {
                onInstalled: { addListener(listener) { onInstalled = listener; } },
                onMessage: { addListener() {} }
            },
            storage: {
                sync: {
                    async get(keys) { return Object.fromEntries(keys.map(key => [key, stored[key]])); },
                    async set(values) { Object.assign(writes, values); }
                },
                local: {
                    async remove(key) { removed.push(key); }
                }
            }
        }
    };
    vm.runInNewContext(backgroundSource, context);
    await onInstalled();
    return JSON.parse(JSON.stringify(writes));
}

test('new installs get default settings with captions hidden', async () => {
    const writes = await runInstall({});

    assert.equal(writes.settings.notifications, true);
    assert.equal(writes.settings.hideCaptions, true);
    assert.equal(writes.defaultsVersion, 3);
});

test('updates leave existing settings untouched', async () => {
    const writes = await runInstall({
        categories: [],
        defaultsVersion: 2,
        settings: { notifications: false }
    });

    assert.equal(writes.settings, undefined);
});

test('a single keyword in the description is not enough to classify', async () => {
    const matchVideo = loadMatcher({
        categories: [{ id: 'fitness', name: '健身運動', speed: 1, keywords: ['運動'], enabled: true }],
        settings: { autoSpeed: true, defaultSpeed: 1.25 }
    });

    const result = await matchVideo({ title: '職場守則', description: '……本集提到不合作運動……' });

    assert.equal(result.category, null);
    assert.equal(result.speed, 1.25);
});

test('a tag scores once even when it contains several keywords', async () => {
    const matchVideo = loadMatcher({
        categories: [
            { id: 'science', name: '科普知識', speed: 1.25, keywords: ['科普', '知識'], enabled: true },
            { id: 'fitness', name: '健身運動', speed: 1, keywords: ['健身'], enabled: true }
        ],
        settings: { autoSpeed: true, defaultSpeed: 1 }
    });

    const result = await matchVideo({ title: '居家健身動作', tags: ['健身知識科普'] });

    assert.equal(result.category.id, 'fitness');
});

test('a channel rule wins over category matches', async () => {
    const matchVideo = loadMatcher({
        categories: [{ id: 'sports', name: '體育', speed: 1, keywords: ['nba'], ytCategoryIds: ['17'], enabled: true }],
        settings: { autoSpeed: true, defaultSpeed: 1, channelRules: [{ channel: '澤北SG', speed: 1.75 }] }
    });

    const result = await matchVideo({ title: 'NBA 傷病潮', channelName: ' 澤北sg ', ytCategoryId: '17' });

    assert.equal(result.speed, 1.75);
    assert.equal(result.category.id, 'channel');
});

test('migration to v3 adds the investigation category once', () => {
    const { migrateCategories } = loadBackground();

    const migrated = migrateCategories([{ id: 'sports', keywords: [] }], 2);
    assert.deepEqual([...migrated.map(cat => cat.id)], ['sports', 'investigation']);

    const again = migrateCategories(migrated, 2);
    assert.equal(again.filter(cat => cat.id === 'investigation').length, 1);
});

test('updating removes the old watch history and its setting', async () => {
    const removed = [];
    const writes = await runInstall({
        categories: [],
        defaultsVersion: 3,
        settings: { recordHistory: true, autoSpeed: false }
    }, removed);

    assert.deepEqual(removed, ['history']);
    assert.deepEqual(writes.settings, { autoSpeed: false });
});

test('YouTube category mode uses the speed set for the video category', async () => {
    const matchVideo = loadMatcher({
        categories: [{ id: 'investigation', name: '案件', speed: 1.5, keywords: ['命案'], enabled: true }],
        settings: { autoSpeed: true, defaultSpeed: 1, classifyMode: 'youtube', ytCategorySpeeds: { 24: 1.75 } }
    });

    const result = await matchVideo({ title: '滅門命案', ytCategoryId: '24' });

    assert.equal(result.speed, 1.75);
    assert.equal(result.category.name, 'YouTube：娛樂');
});

test('YouTube category mode falls back to the built-in speed, then the default', async () => {
    const matchVideo = loadMatcher({
        categories: [],
        settings: { autoSpeed: true, defaultSpeed: 1.1, classifyMode: 'youtube', ytCategorySpeeds: {} }
    });

    assert.equal((await matchVideo({ ytCategoryId: '25' })).speed, 1.5);
    const unknown = await matchVideo({ title: 'no category' });
    assert.equal(unknown.category, null);
    assert.equal(unknown.speed, 1.1);
});

test('channel rules still win in YouTube category mode', async () => {
    const matchVideo = loadMatcher({
        categories: [],
        settings: { autoSpeed: true, classifyMode: 'youtube', channelRules: [{ channel: 'Wayne調查', speed: 2 }] }
    });

    assert.equal((await matchVideo({ channelName: 'Wayne調查', ytCategoryId: '24' })).speed, 2);
});

test('AI mode uses the model pick, with a marked name', async () => {
    const matchVideo = loadMatcher({
        categories: [
            { id: 'stories', name: '說故事', speed: 1.5, keywords: ['故事'], enabled: true },
            { id: 'investigation', name: '案件', speed: 1.75, keywords: [], enabled: true }
        ],
        settings: { autoSpeed: true, defaultSpeed: 1, classifyMode: 'ai' }
    });

    const result = await matchVideo({ title: '都市傳說故事', aiCategoryId: 'investigation' });

    assert.equal(result.speed, 1.75);
    assert.equal(result.category.name, '案件（AI）');
});

test('AI mode: "none" means the default speed; unknown picks fall back to keywords', async () => {
    const matchVideo = loadMatcher({
        categories: [{ id: 'stories', name: '說故事', speed: 1.5, keywords: ['故事'], enabled: true }],
        settings: { autoSpeed: true, defaultSpeed: 1.1, classifyMode: 'ai' }
    });

    assert.equal((await matchVideo({ title: '都市傳說故事', aiCategoryId: 'none' })).speed, 1.1);
    assert.equal((await matchVideo({ title: '都市傳說故事', aiCategoryId: 'deleted' })).category.id, 'stories');
    assert.equal((await matchVideo({ title: '都市傳說故事' })).category.id, 'stories');
});

function loadMessageHandler() {
    const local = {};
    const sync = {};
    const context = {
        console,
        chrome: {
            runtime: {
                onInstalled: { addListener() {} },
                onMessage: { addListener() {} },
                getURL: path => `chrome-extension://autospd/${path}`
            },
            storage: {
                sync: {
                    async get(key) { return { [key]: sync[key] }; },
                    async set(values) { Object.assign(sync, values); }
                },
                local: {
                    async get(key) { return { [key]: local[key] }; },
                    async set(values) { Object.assign(local, values); }
                }
            }
        }
    };
    vm.runInNewContext(backgroundSource, context);
    return { handle: context.handleMessage, local, sync };
}

const SETTINGS_PAGE = { url: 'chrome-extension://autospd/options.html', tab: { id: 1 } };
const YOUTUBE_TAB = { url: 'https://www.youtube.com/watch?v=abc', tab: { id: 2 } };

test('AI labels are cached per video and cleared only when categories change', async () => {
    const { handle } = loadMessageHandler();
    const categories = [{ id: 'a', name: 'A' }];
    await handle({ type: 'save-categories', categories }, SETTINGS_PAGE);

    await handle({ type: 'save-ai-label', videoId: 'v1', categoryId: 'investigation' }, YOUTUBE_TAB);
    assert.equal((await handle({ type: 'get-ai-label', videoId: 'v1' }, YOUTUBE_TAB)).categoryId, 'investigation');

    await handle({ type: 'save-categories', categories: [{ id: 'a', name: 'A' }] }, SETTINGS_PAGE);
    assert.equal((await handle({ type: 'get-ai-label', videoId: 'v1' }, YOUTUBE_TAB)).categoryId, 'investigation');

    await handle({ type: 'save-categories', categories: [] }, SETTINGS_PAGE);
    assert.equal((await handle({ type: 'get-ai-label', videoId: 'v1' }, YOUTUBE_TAB)).categoryId, null);
});

test('only extension pages can change settings', async () => {
    const { handle, sync } = loadMessageHandler();

    for (const message of [
        { type: 'save-settings', settings: { autoSpeed: false } },
        { type: 'save-categories', categories: [] },
        { type: 'reset-categories' }
    ]) {
        await assert.rejects(handle(message, YOUTUBE_TAB), /Not allowed/);
        await assert.rejects(handle(message, undefined), /Not allowed/);
    }
    assert.deepEqual(Object.keys(sync), []);

    await handle({ type: 'save-settings', settings: { autoSpeed: false } }, SETTINGS_PAGE);
    assert.equal(sync.settings.autoSpeed, false);
});

test('video IDs that name Object.prototype members are not treated as cached', async () => {
    const { handle, local } = loadMessageHandler();

    for (const videoId of ['__proto__', 'constructor', 'toString']) {
        assert.equal((await handle({ type: 'get-ai-label', videoId }, YOUTUBE_TAB)).categoryId, null);
        await handle({ type: 'save-ai-label', videoId, categoryId: 'x' }, YOUTUBE_TAB);
        assert.equal((await handle({ type: 'get-ai-label', videoId }, YOUTUBE_TAB)).categoryId, null);
    }
    assert.equal(Object.keys(local.aiLabels || {}).length, 0);
});

function loadFixedMatcher(settings = {}) {
    return loadMatcher({
        categories: [{ id: 'stories', name: '說故事', speed: 1.5, keywords: ['故事', 'mv'], enabled: true }],
        settings: { autoSpeed: true, defaultSpeed: 1.25, fixedNormalForLive: true, fixedNormalForMusic: true, ...settings }
    });
}

test('live streams are fixed at 1x, above channel rules', async () => {
    const matchVideo = loadFixedMatcher({ channelRules: [{ channel: '實況主', speed: 2 }] });

    const live = await matchVideo({ title: '深夜故事直播', channelName: '實況主', isLive: true });
    assert.equal(live.speed, 1);
    assert.equal(live.category.id, 'fixed_live');

    const replay = await matchVideo({ title: '深夜故事直播', channelName: '實況主', isLive: false });
    assert.equal(replay.speed, 2);
});

test('music is fixed at 1x by YouTube category, Topic channel, or MV-style title', async () => {
    const matchVideo = loadFixedMatcher();

    for (const info of [
        { title: '某首歌', ytCategoryId: '10' },
        { title: 'Song Name', channelName: 'Some Artist - Topic' },
        { title: '周杰倫【最偉大的作品 Official MV】' },
        { title: 'Artist - Song (M/V)' },
        { title: 'Song (Official Lyric Video)' },
        { title: 'Song Official Audio' },
        { title: '告白氣球 動態歌詞' },
        { title: '2026 跨年演唱會完整版' }
    ]) {
        const result = await matchVideo(info);
        assert.equal(result.category?.id, 'fixed_music', info.title);
        assert.equal(result.speed, 1, info.title);
    }
});

test('music detection does not fire on words that merely contain "mv"', async () => {
    const matchVideo = loadFixedMatcher();

    const result = await matchVideo({ title: 'Mvp 故事 and the mvno market' });

    assert.equal(result.category.id, 'stories');
});

test('the fixed 1x rules can be turned off', async () => {
    const matchVideo = loadFixedMatcher({ fixedNormalForLive: false, fixedNormalForMusic: false });

    assert.equal((await matchVideo({ title: '故事 Official MV', isLive: true, ytCategoryId: '10' })).category.id, 'stories');
});

test('unclassified live replays use the replay speed instead of the default', async () => {
    const matchVideo = loadFixedMatcher({ liveReplayEnabled: true, liveReplaySpeed: 1.5 });

    const replay = await matchVideo({ title: '週五雜談', isLiveContent: true, isLive: false });
    assert.equal(replay.speed, 1.5);
    assert.equal(replay.category.id, 'live_replay');

    const upload = await matchVideo({ title: '週五雜談', isLiveContent: false });
    assert.equal(upload.speed, 1.25);
    assert.equal(upload.category, null);
});

test('categories, channel rules and the music rule win over the replay speed', async () => {
    const matchVideo = loadFixedMatcher({
        liveReplayEnabled: true,
        liveReplaySpeed: 1.75,
        channelRules: [{ channel: '實況主', speed: 1.1 }]
    });
    const replay = { isLiveContent: true, isLive: false };

    assert.equal((await matchVideo({ ...replay, title: '深夜故事' })).category.id, 'stories');
    assert.equal((await matchVideo({ ...replay, title: '雜談', channelName: '實況主' })).speed, 1.1);
    assert.equal((await matchVideo({ ...replay, title: '跨年演唱會' })).category.id, 'fixed_music');
    assert.equal((await matchVideo({ ...replay, title: '雜談', isLive: true })).category.id, 'fixed_live');
});

test('the replay speed applies in YouTube-category and AI modes when nothing matches', async () => {
    const replay = { title: '雜談', isLiveContent: true, isLive: false };

    const youtube = loadFixedMatcher({ classifyMode: 'youtube', liveReplayEnabled: true, liveReplaySpeed: 1.5 });
    assert.equal((await youtube(replay)).category.id, 'live_replay');

    const ai = loadFixedMatcher({ classifyMode: 'ai', liveReplayEnabled: true, liveReplaySpeed: 1.5 });
    assert.equal((await ai({ ...replay, aiCategoryId: 'none' })).category.id, 'live_replay');
});

test('the replay speed can be turned off', async () => {
    const matchVideo = loadFixedMatcher({ liveReplayEnabled: false, liveReplaySpeed: 1.5 });

    assert.equal((await matchVideo({ title: '雜談', isLiveContent: true, isLive: false })).speed, 1.25);
});

test('fixed 1x matches are labelled plainly, without repeating the speed', async () => {
    const matchVideo = loadFixedMatcher();

    assert.equal((await matchVideo({ title: 'Song (Official MV)' })).category.name, '音樂 / MV');
    assert.equal((await matchVideo({ title: '雜談', isLive: true })).category.name, '直播');
});

test('music show and stage footage is fixed at 1x from its title, tags or channel', async () => {
    const matchVideo = loadFixedMatcher();

    // The reported video: Entertainment category, Korean title, music only visible in the tags
    const stage = await matchVideo({
        title: "[단독샷캠4K] 에이투오 라이트 'NEON' 단독샷 별도녹화│A2O LITE ONE TAKE STAGE│@SBS Inkigayo 261025",
        channelName: 'SBSKPOP X INKIGAYO',
        tags: ['인기가요직캠', '음악방송', '에이투오 라이트 무대'],
        ytCategoryId: '24'
    });
    assert.equal(stage.category?.id, 'fixed_music');
    assert.equal(stage.speed, 1);

    for (const info of [
        { title: '某團體', tags: ['직캠'] },
        { title: '回歸舞台 4K 直拍' },
        { title: 'Stage', channelName: 'Mnet M COUNTDOWN' },
        { title: 'Live', tags: ['Music Bank'] }
    ]) {
        assert.equal((await matchVideo(info)).category?.id, 'fixed_music', info.title);
    }
});

test('music performance terms need a real match and ignore the description', async () => {
    const matchVideo = loadFixedMatcher();

    for (const info of [
        { title: '聊聊音樂產業的故事', tags: ['音樂', '歌手', 'song'] },
        { title: '故事', tags: ['showcase', 'musical'] },
        { title: '故事', description: '本集也提到 fancam 和 인기가요' }
    ]) {
        assert.equal((await matchVideo(info)).category?.id, 'stories', info.title);
    }
});

function loadFallbackMatcher(settings = {}) {
    return loadMatcher({
        categories: [{ id: 'stories', name: '說故事', speed: 1.5, keywords: ['故事'], enabled: true }],
        settings: { autoSpeed: true, defaultSpeed: 1.1, classifyMode: 'keywords', ...settings }
    });
}

test('keyword mode falls back to the YouTube category speed when nothing matches', async () => {
    const matchVideo = loadFallbackMatcher();

    const result = await matchVideo({ title: '週五雜談', ytCategoryId: '24' });

    assert.equal(result.speed, 1.25);
    assert.equal(result.category.name, 'YouTube：娛樂');
});

test('the fallback uses speeds the user set for YouTube categories', async () => {
    const matchVideo = loadFallbackMatcher({ ytCategorySpeeds: { 24: 1.75 } });

    assert.equal((await matchVideo({ title: '週五雜談', ytCategoryId: '24' })).speed, 1.75);
});

test('keyword matches and live replays win over the YouTube category fallback', async () => {
    const matchVideo = loadFallbackMatcher({ liveReplayEnabled: true, liveReplaySpeed: 1.5 });

    assert.equal((await matchVideo({ title: '深夜故事', ytCategoryId: '23' })).category.id, 'stories');
    const replay = await matchVideo({ title: '週五雜談', ytCategoryId: '23', isLiveContent: true, isLive: false });
    assert.equal(replay.category.id, 'live_replay');
});

test('AI "none" uses the YouTube category; no category info uses the default speed', async () => {
    const ai = loadFallbackMatcher({ classifyMode: 'ai' });
    assert.equal((await ai({ title: '週五雜談', ytCategoryId: '25', aiCategoryId: 'none' })).speed, 1.5);

    const keywords = loadFallbackMatcher();
    const unknown = await keywords({ title: '週五雜談' });
    assert.equal(unknown.category, null);
    assert.equal(unknown.speed, 1.1);
});

test('every YouTube category has a usable default speed', () => {
    const context = loadBackground();
    const categories = vm.runInContext('YT_CATEGORIES', context);

    assert.equal(categories.length, 15);
    for (const category of categories) {
        assert.ok(category.speed >= 0.25 && category.speed <= 2, category.en);
    }
});
