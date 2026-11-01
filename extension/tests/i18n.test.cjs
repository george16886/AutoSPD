const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { EXTENSION, readExtensionFile, joinSources } = require('./i18n-mock.cjs');

const LOCALES = ['en', 'zh_TW', 'zh_CN', 'ja', 'ko'];
const CODE_FILES = ['background.js', 'content.js', 'popup.js', 'options.js', 'i18n.js', 'popup.html', 'options.html'];

function messagesFor(locale) {
    return JSON.parse(readExtensionFile(`_locales/${locale}/messages.json`));
}

function loadBackground(locale, uiLanguage) {
    const noop = { addListener() {} };
    const context = {
        console,
        chrome: {
            runtime: { onInstalled: noop, onMessage: noop },
            storage: {
                sync: { async get() { return { settings: { autoSpeed: true, fixedNormalForMusic: true } }; } },
                local: {}
            }
        }
    };
    const source = joinSources(locale, uiLanguage, 'i18n.js', 'yt-categories.js', 'default-categories.js', 'background.js');
    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}

test('every language has the same messages, with non-empty text', () => {
    const keys = Object.keys(messagesFor('en')).sort();
    for (const locale of LOCALES) {
        const messages = messagesFor(locale);
        assert.deepEqual(Object.keys(messages).sort(), keys, locale);
        for (const key of keys) assert.ok(messages[key].message.trim(), `${locale}: ${key}`);
    }
});

test('every message the code asks for exists', () => {
    const messages = messagesFor('en');
    const used = new Set();
    for (const file of CODE_FILES) {
        const source = readExtensionFile(file);
        for (const match of source.matchAll(/\bt\(\s*'([A-Za-z0-9]+)'/g)) used.add(match[1]);
        for (const match of source.matchAll(/data-i18n(?:-[a-z-]+)?="([A-Za-z0-9]+)"/g)) used.add(match[1]);
    }
    assert.ok(used.size > 50);
    for (const key of used) assert.ok(messages[key], `missing message: ${key}`);
});

test('every message is used somewhere', () => {
    const source = [...CODE_FILES, 'manifest.json'].map(readExtensionFile).join(' ');
    for (const key of Object.keys(messagesFor('en'))) {
        if (key.startsWith('ytCategory') && /\d$/.test(key)) continue; // built from the category ID
        assert.ok(source.includes(key), `unused message: ${key}`);
    }
});

test('every YouTube category has a translated name', () => {
    const { YT_IDS } = (() => {
        const context = {};
        vm.createContext(context);
        vm.runInContext(`${readExtensionFile('yt-categories.js')}; this.YT_IDS = YT_CATEGORIES.map(cat => cat.id);`, context);
        return context;
    })();
    for (const locale of LOCALES) {
        const messages = messagesFor(locale);
        for (const id of YT_IDS) assert.ok(messages[`ytCategory${id}`], `${locale}: ${id}`);
    }
});

test('the manifest uses translated text and falls back to English', () => {
    const manifest = JSON.parse(readExtensionFile('manifest.json'));

    assert.equal(manifest.default_locale, 'en');
    assert.equal(manifest.name, '__MSG_extName__');
    assert.equal(manifest.description, '__MSG_extDescription__');
    assert.ok(fs.existsSync(path.join(EXTENSION, '_locales', manifest.default_locale, 'messages.json')));
});

test('store limits: names up to 75 characters, descriptions up to 132', () => {
    for (const locale of LOCALES) {
        const messages = messagesFor(locale);
        assert.ok(messages.extName.message.length <= 75, locale);
        assert.ok(messages.extDescription.message.length <= 132, locale);
    }
});

test('browser languages map to the right default categories', () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(readExtensionFile('default-categories.js'), context);
    const expected = {
        'zh-TW': 'zh_TW', 'zh-HK': 'zh_TW', 'zh-CN': 'zh_CN', zh: 'zh_CN', ja: 'ja', 'ko-KR': 'ko',
        en: 'en', 'en-GB': 'en', fr: 'en', '': 'en'
    };
    for (const [language, locale] of Object.entries(expected)) {
        assert.equal(context.defaultCategoryLocale(language), locale, language);
    }
});

test('default categories fit one chrome.storage.sync item in every language', () => {
    const QUOTA_BYTES_PER_ITEM = 8192;
    const context = {};
    vm.createContext(context);
    vm.runInContext(readExtensionFile('default-categories.js'), context);
    for (const language of ['en', 'zh-TW', 'zh-CN', 'ja', 'ko']) {
        const categories = context.buildDefaultCategories(language);
        const bytes = Buffer.byteLength('categories' + JSON.stringify(categories));
        assert.ok(bytes < QUOTA_BYTES_PER_ITEM, `${language}: ${bytes} bytes`);
        assert.equal(categories.length, 13, language);
        for (const category of categories) {
            assert.ok(category.name, `${language}: ${category.id}`);
            assert.ok(category.keywords.length > 0, `${language}: ${category.id}`);
        }
    }
});

test('new installs get categories in the browser language, plus English keywords', () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(readExtensionFile('default-categories.js'), context);

    const japanese = context.buildDefaultCategories('ja').find(cat => cat.id === 'cooking');
    assert.equal(japanese.name, '料理');
    assert.ok(japanese.keywords.includes('レシピ'));
    assert.ok(japanese.keywords.includes('recipe'));

    const english = context.buildDefaultCategories('en').find(cat => cat.id === 'cooking');
    assert.equal(english.name, 'Cooking');
    assert.ok(!english.keywords.includes('料理'));
});

test('matcher labels follow the browser language', async () => {
    const english = loadBackground('en', 'en');
    const music = await english.matchVideoToCategory({ title: 'Song (Official MV)' });
    assert.equal(music.category.name, 'Music / MV');
    assert.equal((await english.matchVideoToCategory({ ytCategoryId: '24' })).category.name, 'YouTube: Entertainment');

    const korean = loadBackground('ko', 'ko');
    assert.equal((await korean.matchVideoToCategory({ title: 'Song (Official MV)' })).category.name, '음악 / MV');
});

test('music performance detection works whatever the browser language', async () => {
    const english = loadBackground('en', 'en');

    const stage = await english.matchVideoToCategory({ title: 'NEON', tags: ['인기가요직캠'], ytCategoryId: '24' });

    assert.equal(stage.category.id, 'fixed_music');
});
