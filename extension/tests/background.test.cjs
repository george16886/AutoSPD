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
