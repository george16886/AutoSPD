/**
 * AutoSPD Chrome Extension - Background Service Worker
 * Handles storage sync, message routing, and category matching
 */

// Default categories (same as webapp)
const DEFAULT_CATEGORIES = [
    { id: 'sports', name: '球賽 / 體育', emoji: '⚽', speed: 1.0, keywords: ['足球', '籃球', 'NBA', 'MLB', '世界盃', '比賽', '賽事', '球賽', 'sports', 'game', 'match'], ytCategoryIds: ['17'], enabled: true },
    { id: 'music', name: '音樂 / MV', emoji: '🎵', speed: 1.0, keywords: ['MV', '音樂', 'Music Video', '演唱會', 'concert', '歌曲', 'song', 'lyrics'], ytCategoryIds: ['10'], enabled: true },
    { id: 'science', name: '科普知識', emoji: '🔬', speed: 1.25, keywords: ['科普', '科學', 'science', '知識', '物理', '化學', 'TED', '冷知識'], ytCategoryIds: ['28'], enabled: true },
    { id: 'storytelling', name: '說故事', emoji: '📖', speed: 1.5, keywords: ['說故事', '故事', 'story', 'storytime', '都市傳說', '說書'], ytCategoryIds: [], enabled: true },
    { id: 'unboxing', name: '開箱影片', emoji: '📦', speed: 1.5, keywords: ['開箱', 'unboxing', 'review', '評測', '體驗', '3C'], ytCategoryIds: [], enabled: true },
    { id: 'gaming', name: '遊戲實況', emoji: '🎮', speed: 1.25, keywords: ['遊戲', 'game', 'gaming', '實況', 'gameplay', '攻略'], ytCategoryIds: ['20'], enabled: true },
    { id: 'education', name: '教學課程', emoji: '📚', speed: 1.25, keywords: ['教學', 'tutorial', '課程', 'course', '學習', 'how to'], ytCategoryIds: ['27'], enabled: true },
    { id: 'cooking', name: '料理烹飪', emoji: '🍳', speed: 1.5, keywords: ['料理', '烹飪', 'cooking', 'recipe', '食譜', '美食'], ytCategoryIds: [], enabled: true },
    { id: 'fitness', name: '健身運動', emoji: '💪', speed: 1.0, keywords: ['健身', '運動', 'workout', 'fitness', 'exercise', '瑜珈'], ytCategoryIds: [], enabled: true },
    { id: 'news', name: '新聞時事', emoji: '📰', speed: 1.5, keywords: ['新聞', 'news', '時事', '政治', '經濟', '國際'], ytCategoryIds: ['25'], enabled: true },
    { id: 'movie_review', name: '電影評論', emoji: '🎬', speed: 1.25, keywords: ['電影', 'movie', 'film', '影評', 'review', '預告'], ytCategoryIds: ['1'], enabled: true },
    { id: 'travel', name: '旅遊 Vlog', emoji: '✈️', speed: 1.25, keywords: ['旅遊', 'travel', 'vlog', '旅行', '景點', '攻略'], ytCategoryIds: ['19'], enabled: true }
];

const DEFAULT_SETTINGS = {
    autoSpeed: true,
    notifications: true,
    recordHistory: true,
    defaultSpeed: 1.0
};

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
    const data = await chrome.storage.sync.get(['categories', 'settings']);
    
    if (!data.categories) {
        await chrome.storage.sync.set({ categories: DEFAULT_CATEGORIES });
    }
    
    if (!data.settings) {
        await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
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
            return { success: true };

        case 'save-settings':
            if (!message.settings || typeof message.settings !== 'object') {
                throw new Error('Settings must be an object');
            }
            await chrome.storage.sync.set({ settings: message.settings });
            return { success: true };

        case 'match-video':
            return await matchVideoToCategory(message.videoInfo);

        case 'log-history':
            await logHistory(message.entry);
            return { success: true };

        case 'get-history':
            const histData = await chrome.storage.local.get('history');
            return { history: histData.history || [] };

        case 'clear-history':
            await chrome.storage.local.set({ history: [] });
            return { success: true };

        default:
            throw new Error(`Unknown message type: ${message.type}`);
    }
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

    let bestMatch = null;
    let bestScore = 0;

    const title = String(videoInfo.title || '').toLowerCase();
    const searchText = [
        videoInfo.title,
        videoInfo.description,
        Array.isArray(videoInfo.tags) ? videoInfo.tags.join(' ') : '',
        videoInfo.channelName
    ].filter(Boolean).join(' ').toLowerCase();

    for (const cat of categories) {
        const categorySpeed = Number(cat.speed);
        if (!cat.enabled || !Number.isFinite(categorySpeed) || categorySpeed < 0.25 || categorySpeed > 2) continue;
        let score = 0;

        // YouTube category ID match (highest priority)
        if (videoInfo.ytCategoryId && cat.ytCategoryIds?.includes(String(videoInfo.ytCategoryId))) {
            score += 10;
        }

        // Keyword matching
        for (const keyword of (Array.isArray(cat.keywords) ? cat.keywords : [])) {
            const kw = String(keyword).toLowerCase().trim();
            if (!kw) continue;
            if (searchText.includes(kw)) {
                if (title.includes(kw)) {
                    score += 5;
                } else {
                    score += 2;
                }
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = cat;
        }
    }

    if (bestMatch && bestScore >= 2) {
        return {
            speed: bestMatch.speed,
            category: bestMatch,
            score: bestScore
        };
    }

    const defaultSpeed = Number(settings.defaultSpeed);
    return {
        speed: Number.isFinite(defaultSpeed) && defaultSpeed >= 0.25 && defaultSpeed <= 2 ? defaultSpeed : 1,
        category: null,
        score: 0
    };
}

/**
 * Log a history entry
 */
async function logHistory(entry) {
    const data = await chrome.storage.local.get('history');
    const history = data.history || [];
    
    history.unshift({
        ...entry,
        date: new Date().toISOString()
    });

    // Keep only the last 500 entries
    if (history.length > 500) {
        history.length = 500;
    }

    await chrome.storage.local.set({ history });
}
