const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const backgroundSource = fs.readFileSync(
    path.join(__dirname, '..', 'background.js'),
    'utf8'
);

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

async function runInstall(stored) {
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
                local: {}
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

test('logging the same video twice in a row keeps one history entry', async () => {
    let history = [];
    const context = {
        console,
        chrome: {
            runtime: { onInstalled: { addListener() {} }, onMessage: { addListener() {} } },
            storage: {
                sync: {},
                local: {
                    async get() { return { history }; },
                    async set(values) { history = values.history; }
                }
            }
        }
    };
    vm.runInNewContext(backgroundSource, context);

    await context.logHistory({ videoId: 'a', speed: 1.5 });
    await context.logHistory({ videoId: 'a', speed: 1.5 });
    await context.logHistory({ videoId: 'b', speed: 1 });

    assert.deepEqual(history.map(entry => entry.videoId), ['b', 'a']);
});
