const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { readExtensionFile } = require('./i18n-mock.cjs');

function loadClassifier({ availability = 'available', answer = '{"category":"investigation"}', prompt } = {}) {
    const prompts = [];
    const created = { systemPrompt: '', count: 0 };
    const session = {
        async clone() { return session; },
        prompt(text, options) {
            prompts.push({ text, ids: [...options.responseConstraint.properties.category.enum], signal: options.signal });
            return prompt ? prompt(prompts.length) : Promise.resolve(answer);
        },
        destroy() {}
    };
    const context = {
        AbortController,
        setTimeout,
        clearTimeout,
        LanguageModel: {
            async availability() { return availability; },
            async create(options) {
                created.count += 1;
                created.systemPrompt = options.initialPrompts[0].content;
                return session;
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(readExtensionFile('ai-classifier.js'), context);
    return { classify: context.classifyWithAi, prompts, created, context };
}

const video = { title: '滅門命案', channelName: 'Sample', tags: ['命案'], description: '' };
const categories = [{ id: 'investigation', name: '案件 / 調查解說', keywords: ['命案', '調查'] }];
const plain = value => JSON.parse(JSON.stringify(value));

test('classifies with the model, offering only the given categories or none', async () => {
    const { classify, prompts, created } = loadClassifier();

    assert.deepEqual(plain(await classify(video, categories)), { categoryId: 'investigation' });
    assert.deepEqual(prompts[0].ids, ['investigation', 'none']);
    assert.match(prompts[0].text, /Title: 滅門命案/);
    assert.match(created.systemPrompt, /investigation: 案件 \/ 調查解說 \(e\.g\. 命案, 調查\)/);
});

test('reports why the model cannot be used instead of starting a download', async () => {
    const { classify, prompts } = loadClassifier({ availability: 'downloadable' });

    assert.deepEqual(plain(await classify(video, categories)), { error: 'downloadable' });
    assert.equal(prompts.length, 0);
});

test('reports browsers without the Prompt API', async () => {
    const { classify, context } = loadClassifier();
    vm.runInContext('delete globalThis.LanguageModel', context);

    assert.deepEqual(plain(await classify(video, categories)), { error: 'unsupported' });
});

test('a prompt that never answers times out, aborts, and does not block the next video', async () => {
    const { classify, prompts, created } = loadClassifier({
        prompt: count => (count === 1 ? new Promise(() => {}) : Promise.resolve('{"category":"none"}'))
    });

    const stuck = classify(video, categories, { timeoutMs: 20 });
    const next = classify(video, categories, { timeoutMs: 1000 });

    assert.deepEqual(plain(await stuck), { error: 'timeout' });
    assert.equal(prompts[0].signal.aborted, true);
    assert.deepEqual(plain(await next), { categoryId: 'none' });
    assert.equal(created.count, 2, 'a stuck model gets a new base session');
});

test('model errors are reported and do not block the next video', async () => {
    const { classify } = loadClassifier({
        prompt: count => (count === 1 ? Promise.reject(new Error('boom')) : Promise.resolve('{"category":"none"}'))
    });

    assert.deepEqual(plain(await classify(video, categories)), { error: 'boom' });
    assert.deepEqual(plain(await classify(video, categories)), { categoryId: 'none' });
});

test('skips queued requests for a video the viewer already left', async () => {
    const { classify, prompts } = loadClassifier();

    const result = await classify(video, categories, { stillWanted: () => false });

    assert.deepEqual(plain(result), { error: 'stale' });
    assert.equal(prompts.length, 0);
});

test('the page bridge no longer touches the model or the categories', () => {
    const bridge = readExtensionFile('page-bridge.js');

    assert.ok(!bridge.includes('LanguageModel'));
    assert.ok(!bridge.includes('categories'));
});
