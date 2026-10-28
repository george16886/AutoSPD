const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const optionsSource = fs.readFileSync(
    path.join(__dirname, '..', 'options.js'),
    'utf8'
);

function loadOptions() {
    const context = {};
    vm.runInNewContext(optionsSource, context);
    return context;
}

function category(overrides = {}) {
    return { id: 'c1', name: '開箱', speed: 1.5, keywords: ['開箱'], ytCategoryIds: [], enabled: true, ...overrides };
}

test('parses keywords split by commas, 頓號 and newlines, dropping duplicates', () => {
    const { parseKeywords } = loadOptions();

    const keywords = parseKeywords('開箱, unboxing，評測、Unboxing\n 3C ,,');

    assert.deepEqual([...keywords], ['開箱', 'unboxing', '評測', '3C']);
});

test('accepts valid categories', () => {
    const { validateCategories } = loadOptions();

    assert.equal(validateCategories([category(), category({ id: 'c2', name: '音樂', ytCategoryIds: ['10'], keywords: [] })]), null);
});

test('rejects missing names, duplicate names and out-of-range speeds', () => {
    const { validateCategories } = loadOptions();

    assert.match(validateCategories([category({ name: '' })]), /名稱/);
    assert.match(validateCategories([category(), category({ id: 'c2' })]), /重複/);
    assert.match(validateCategories([category({ speed: 3 })]), /速度/);
    assert.match(validateCategories([category({ speed: NaN })]), /速度/);
});

test('rejects categories that can never match a video', () => {
    const { validateCategories } = loadOptions();

    assert.match(validateCategories([category({ keywords: [], ytCategoryIds: [] })]), /關鍵字/);
});

test('rejects channel rules with out-of-range speeds', () => {
    const { validateChannelRules } = loadOptions();

    assert.equal(validateChannelRules([{ channel: 'Wayne調查', speed: 1.5 }]), null);
    assert.match(validateChannelRules([{ channel: 'Wayne調查', speed: 0 }]), /Wayne調查/);
});

test('rejects YouTube category speeds out of range and names the category', () => {
    const { validateYouTubeSpeeds } = loadOptions();

    assert.equal(validateYouTubeSpeeds({ 24: 1.5, 10: 1 }), null);
    assert.match(validateYouTubeSpeeds({ 24: 2.5 }, { 24: '娛樂' }), /娛樂/);
});

test('AI mode accepts categories that only have a name', () => {
    const { validateCategories } = loadOptions();
    const nameOnly = category({ keywords: [], ytCategoryIds: [] });

    assert.equal(validateCategories([nameOnly], { requireMatchers: false }), null);
    assert.match(validateCategories([nameOnly]), /關鍵字/);
});
