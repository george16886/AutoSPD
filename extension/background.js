/**
 * AutoSPD Chrome Extension - Background Service Worker
 * Handles storage sync, message routing, and category matching
 */

importScripts('yt-categories.js');

// Default categories (same as webapp)
const DEFAULT_CATEGORIES = [
    { id: 'sports', name: '球賽 / 體育', emoji: '⚽', speed: 1.0, keywords: ['足球', '籃球', 'NBA', 'MLB', '世界盃', '比賽', '賽事', '球賽', 'sports', 'match'], ytCategoryIds: ['17'], enabled: true },
    { id: 'music', name: '音樂 / MV', emoji: '🎵', speed: 1.0, keywords: ['MV', '音樂', 'Music Video', '演唱會', 'concert', '歌曲', 'song', 'lyrics'], ytCategoryIds: ['10'], enabled: true },
    { id: 'science', name: '科普知識', emoji: '🔬', speed: 1.25, keywords: ['科普', '科學', 'science', '知識', '物理', '化學', 'TED', '冷知識'], ytCategoryIds: ['28'], enabled: true },
    { id: 'storytelling', name: '說故事', emoji: '📖', speed: 1.5, keywords: ['說故事', '故事', 'story', 'storytime', '都市傳說', '說書'], ytCategoryIds: [], enabled: true },
    { id: 'unboxing', name: '開箱影片', emoji: '📦', speed: 1.5, keywords: ['開箱', 'unboxing', 'review', '評測', '體驗', '3C'], ytCategoryIds: [], enabled: true },
    { id: 'gaming', name: '遊戲實況', emoji: '🎮', speed: 1.25, keywords: ['遊戲', 'game', 'gaming', '實況', 'gameplay', '攻略'], ytCategoryIds: ['20'], enabled: true },
    { id: 'education', name: '教學課程', emoji: '📚', speed: 1.25, keywords: ['教學', 'tutorial', '課程', 'course', '學習', 'how to'], ytCategoryIds: ['27'], enabled: true },
    { id: 'cooking', name: '料理烹飪', emoji: '🍳', speed: 1.5, keywords: ['料理', '烹飪', 'cooking', 'recipe', '食譜', '美食'], ytCategoryIds: [], enabled: true },
    { id: 'fitness', name: '健身運動', emoji: '💪', speed: 1.0, keywords: ['健身', '運動', 'workout', 'fitness', 'exercise', '瑜珈'], ytCategoryIds: [], enabled: true },
    { id: 'news', name: '新聞時事', emoji: '📰', speed: 1.5, keywords: ['新聞', 'news', '時事', '政治', '經濟', '國際'], ytCategoryIds: ['25'], enabled: true },
    { id: 'movie_review', name: '電影評論', emoji: '🎬', speed: 1.25, keywords: ['電影', 'movie', 'film', '影評', '預告'], ytCategoryIds: ['1'], enabled: true },
    { id: 'travel', name: '旅遊 Vlog', emoji: '✈️', speed: 1.25, keywords: ['旅遊', 'travel', 'vlog', '旅行', '景點'], ytCategoryIds: ['19'], enabled: true },
    { id: 'investigation', name: '案件 / 調查解說', emoji: '🔍', speed: 1.5, keywords: ['調查', '案件', '命案', '懸案', '說案', '真實案件', '真相', '揭秘', '內幕', 'true crime'], ytCategoryIds: [], enabled: true }
];

const DEFAULT_SETTINGS = {
    autoSpeed: true,
    notifications: true,
    hideCaptions: true,
    // Live streams and music always play at 1x, above channel rules and every
    // classification mode; the user can still change the speed by hand
    fixedNormalForLive: true,
    fixedNormalForMusic: true,
    // Finished live streams are long; when no category matches, they use this
    // speed instead of defaultSpeed. Channel rules and categories still win.
    liveReplayEnabled: true,
    liveReplaySpeed: 1.5,
    // [{ channel, speed }]; a channel rule wins over every category
    channelRules: [],
    // 'keywords' matches the categories below; 'youtube' uses the uploader's
    // YouTube category with a speed per category (ytCategorySpeeds, by ID);
    // 'ai' starts from the keyword match, then the content script refines it
    // with Chrome's built-in model, picking one of the same categories
    classifyMode: 'keywords',
    ytCategorySpeeds: {},
    defaultSpeed: 1.0
};

// Bump when DEFAULT_CATEGORIES changes and add the matching migration below.
// Migrations are targeted edits so categories the user customized survive.
const DEFAULTS_VERSION = 3;
const DEFAULT_MIGRATIONS = {
    2: [
        { id: 'sports', removeKeywords: ['game'] },
        { id: 'movie_review', removeKeywords: ['review'] },
        { id: 'travel', removeKeywords: ['攻略'] }
    ],
    3: [
        { addCategory: 'investigation' }
    ]
};

function migrateCategories(categories, fromVersion) {
    let migrated = categories;
    for (let version = fromVersion + 1; version <= DEFAULTS_VERSION; version++) {
        for (const change of DEFAULT_MIGRATIONS[version] || []) {
            if (change.addCategory) {
                const added = DEFAULT_CATEGORIES.find(cat => cat.id === change.addCategory);
                if (added && !migrated.some(cat => cat.id === added.id)) migrated = [...migrated, added];
                continue;
            }
            migrated = migrated.map(cat => {
                if (cat.id !== change.id || !Array.isArray(cat.keywords)) return cat;
                const removed = change.removeKeywords.map(kw => kw.toLowerCase());
                return {
                    ...cat,
                    keywords: cat.keywords.filter(kw => !removed.includes(String(kw).toLowerCase()))
                };
            });
        }
    }
    return migrated;
}

// Initialize storage on install and migrate default categories on update
chrome.runtime.onInstalled.addListener(async () => {
    const data = await chrome.storage.sync.get(['categories', 'settings', 'defaultsVersion']);

    if (!data.categories) {
        await chrome.storage.sync.set({ categories: DEFAULT_CATEGORIES, defaultsVersion: DEFAULTS_VERSION });
    } else if ((data.defaultsVersion || 1) < DEFAULTS_VERSION) {
        await chrome.storage.sync.set({
            categories: migrateCategories(data.categories, data.defaultsVersion || 1),
            defaultsVersion: DEFAULTS_VERSION
        });
    }

    if (!data.settings) {
        await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    }

    // Versions before 1.2 kept a local watch history that nothing used; drop it
    await chrome.storage.local.remove('history');
    if (data.settings && 'recordHistory' in data.settings) {
        const { recordHistory, ...settings } = data.settings;
        await chrome.storage.sync.set({ settings });
    }

    console.log('[AutoSPD] Extension installed/updated');
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
        .then(sendResponse)
        .catch(error => {
            console.error('[AutoSPD] Request failed:', error);
            sendResponse({ error: error.message || 'Request failed' });
        });
    return true; // Keep the message channel open for async responses
});

async function handleMessage(message, sender) {
    switch (message.type) {
        case 'get-categories':
            const catData = await chrome.storage.sync.get('categories');
            return { categories: catData.categories || DEFAULT_CATEGORIES };

        case 'get-settings':
            const setData = await chrome.storage.sync.get('settings');
            return { settings: { ...DEFAULT_SETTINGS, ...setData.settings } };

        case 'save-categories':
            if (!Array.isArray(message.categories)) {
                throw new Error('Categories must be an array');
            }
            await chrome.storage.sync.set({ categories: message.categories });
            // Cached AI labels were chosen from the old category list
            await chrome.storage.local.set({ aiLabels: {} });
            return { success: true };

        case 'reset-categories':
            await chrome.storage.sync.set({ categories: DEFAULT_CATEGORIES, defaultsVersion: DEFAULTS_VERSION });
            await chrome.storage.local.set({ aiLabels: {} });
            return { categories: DEFAULT_CATEGORIES };

        case 'get-ai-label': {
            const { aiLabels = {} } = await chrome.storage.local.get('aiLabels');
            return { categoryId: aiLabels[message.videoId] || null };
        }

        case 'save-ai-label':
            await saveAiLabel(message.videoId, message.categoryId);
            return { success: true };

        case 'save-settings':
            if (!message.settings || typeof message.settings !== 'object') {
                throw new Error('Settings must be an object');
            }
            await chrome.storage.sync.set({ settings: message.settings });
            return { success: true };

        case 'match-video':
            return await matchVideoToCategory(message.videoInfo);

        default:
            throw new Error(`Unknown message type: ${message.type}`);
    }
}

/**
 * Latin keywords must match whole words so "ted" does not hit "tested";
 * CJK text has no word boundaries, so those keywords keep substring matching.
 */
function keywordMatches(text, keyword) {
    if (!/^[\x00-\x7f]+$/.test(keyword)) return text.includes(keyword);
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(text);
}

const MIN_MATCH_SCORE = 3;

function isValidSpeed(speed) {
    return Number.isFinite(speed) && speed >= 0.25 && speed <= 2;
}

function isLiveReplay(videoInfo) {
    return videoInfo?.isLiveContent === true && videoInfo.isLive !== true;
}

// Used whenever no category applies
function defaultMatch(settings, videoInfo) {
    const replaySpeed = Number(settings.liveReplaySpeed);
    if (settings.liveReplayEnabled && isLiveReplay(videoInfo) && isValidSpeed(replaySpeed)) {
        return { speed: replaySpeed, category: { id: 'live_replay', name: '直播重播' }, score: 0 };
    }
    const speed = Number(settings.defaultSpeed);
    return { speed: isValidSpeed(speed) ? speed : 1, category: null, score: 0 };
}

function matchByYouTubeCategory(videoInfo, settings) {
    const ytCategoryId = videoInfo.ytCategoryId;
    const ytCategory = YT_CATEGORIES.find(cat => cat.id === String(ytCategoryId));
    if (!ytCategory) return defaultMatch(settings, videoInfo);
    const speed = Number(settings.ytCategorySpeeds?.[ytCategory.id] ?? ytCategory.speed);
    if (!isValidSpeed(speed)) return defaultMatch(settings, videoInfo);
    return {
        speed,
        category: { id: `yt_${ytCategory.id}`, name: `YouTube：${ytCategory.zh}` },
        score: 0
    };
}

const MUSIC_YT_CATEGORY_ID = '10';
// MV, M/V, official music/lyric video or audio, lyric(s) video, 歌詞, 演唱會…
const MUSIC_TITLE_PATTERN = /(?<![a-z0-9])m\/?v(?![a-z0-9])|official\s+(music\s+|lyric\s+)?video|official\s+audio|lyrics?\s+video|歌詞|演唱會|音樂錄影帶/i;

function isMusicVideo(videoInfo) {
    return String(videoInfo.ytCategoryId) === MUSIC_YT_CATEGORY_ID
        || /\s-\s*topic$/i.test(String(videoInfo.channelName || '').trim())
        || MUSIC_TITLE_PATTERN.test(String(videoInfo.title || ''));
}

function findFixedNormalSpeed(videoInfo, settings) {
    if (settings.fixedNormalForLive && videoInfo.isLive === true) {
        return { id: 'fixed_live', name: '直播' };
    }
    if (settings.fixedNormalForMusic && isMusicVideo(videoInfo)) {
        return { id: 'fixed_music', name: '音樂 / MV' };
    }
    return null;
}

function findChannelRule(rules, channelName) {
    const channel = String(channelName || '').trim().toLowerCase();
    if (!channel || !Array.isArray(rules)) return null;
    return rules.find(rule => {
        const speed = Number(rule?.speed);
        return String(rule?.channel || '').trim().toLowerCase() === channel && isValidSpeed(speed);
    }) || null;
}

/**
 * Match a video to a category based on title, tags, and YouTube category ID
 */
async function matchVideoToCategory(videoInfo) {
    videoInfo = videoInfo || {};
    const data = await chrome.storage.sync.get(['categories', 'settings']);
    const categories = data.categories || DEFAULT_CATEGORIES;
    const settings = { ...DEFAULT_SETTINGS, ...data.settings };

    if (!settings.autoSpeed) {
        return { speed: null, category: null, autoDisabled: true };
    }

    const fixed = findFixedNormalSpeed(videoInfo, settings);
    if (fixed) return { speed: 1, category: fixed, score: 0 };

    const channelRule = findChannelRule(settings.channelRules, videoInfo.channelName);
    if (channelRule) {
        return {
            speed: channelRule.speed,
            category: { id: 'channel', name: `頻道：${channelRule.channel}` },
            score: 0
        };
    }

    if (settings.classifyMode === 'youtube') {
        return matchByYouTubeCategory(videoInfo, settings);
    }

    // The model's pick wins when it names a usable category; otherwise fall
    // through to keyword matching ('none' means the model found no fit)
    if (settings.classifyMode === 'ai' && videoInfo.aiCategoryId) {
        if (videoInfo.aiCategoryId === 'none') return defaultMatch(settings, videoInfo);
        const cat = categories.find(item => item.id === videoInfo.aiCategoryId);
        const speed = Number(cat?.speed);
        if (cat && cat.enabled !== false && isValidSpeed(speed)) {
            return { speed, category: { ...cat, name: `${cat.name}（AI）` }, score: 0 };
        }
    }

    // A keyword scores the weight of the strongest field it appears in.
    // Descriptions are long and full of sponsor and social links, so a lone
    // description hit stays below MIN_MATCH_SCORE. Each tag scores at most
    // once, so a tag like "健身知識科普" cannot outweigh a title hit.
    const title = String(videoInfo.title || '').toLowerCase();
    const channel = String(videoInfo.channelName || '').toLowerCase();
    const description = String(videoInfo.description || '').toLowerCase();
    const tags = (Array.isArray(videoInfo.tags) ? videoInfo.tags : []).map(tag => String(tag).toLowerCase());

    let bestMatch = null;
    let bestScore = 0;

    for (const cat of categories) {
        const categorySpeed = Number(cat.speed);
        if (!cat.enabled || !Number.isFinite(categorySpeed) || categorySpeed < 0.25 || categorySpeed > 2) continue;
        let score = 0;

        // YouTube category ID match (highest priority)
        if (videoInfo.ytCategoryId && cat.ytCategoryIds?.includes(String(videoInfo.ytCategoryId))) {
            score += 10;
        }

        const matchedTags = new Set();
        for (const keyword of (Array.isArray(cat.keywords) ? cat.keywords : [])) {
            const kw = String(keyword).toLowerCase().trim();
            if (!kw) continue;
            if (keywordMatches(title, kw)) {
                score += 5;
                continue;
            }
            const tagIndex = tags.findIndex(tag => keywordMatches(tag, kw));
            if (tagIndex !== -1) matchedTags.add(tagIndex);
            else if (keywordMatches(channel, kw)) score += 3;
            else if (keywordMatches(description, kw)) score += 1;
        }
        score += matchedTags.size * 3;

        if (score > bestScore) {
            bestScore = score;
            bestMatch = cat;
        }
    }

    if (bestMatch && bestScore >= MIN_MATCH_SCORE) {
        return {
            speed: bestMatch.speed,
            category: bestMatch,
            score: bestScore
        };
    }

    return defaultMatch(settings, videoInfo);
}

const MAX_AI_LABELS = 2000;

async function saveAiLabel(videoId, categoryId) {
    if (!videoId || !categoryId) return;
    const { aiLabels = {} } = await chrome.storage.local.get('aiLabels');
    delete aiLabels[videoId];
    aiLabels[videoId] = categoryId;
    // Objects keep insertion order, so the first keys are the oldest labels
    const ids = Object.keys(aiLabels);
    for (const id of ids.slice(0, Math.max(0, ids.length - MAX_AI_LABELS))) delete aiLabels[id];
    await chrome.storage.local.set({ aiLabels });
}
