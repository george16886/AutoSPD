/**
 * AutoSPD - Category settings page
 */

const MIN_SPEED = 0.25;
const MAX_SPEED = 2;

const YT_CATEGORY_OPTIONS = [
    ['', '不指定'],
    ['1', '電影與動畫 (Film & Animation)'],
    ['2', '汽車 (Autos & Vehicles)'],
    ['10', '音樂 (Music)'],
    ['15', '寵物與動物 (Pets & Animals)'],
    ['17', '體育 (Sports)'],
    ['19', '旅遊與活動 (Travel & Events)'],
    ['20', '遊戲 (Gaming)'],
    ['22', '人物與網誌 (People & Blogs)'],
    ['23', '喜劇 (Comedy)'],
    ['24', '娛樂 (Entertainment)'],
    ['25', '新聞與政治 (News & Politics)'],
    ['26', 'DIY 與生活百科 (Howto & Style)'],
    ['27', '教育 (Education)'],
    ['28', '科學與技術 (Science & Technology)'],
    ['29', '非營利組織與行動主義 (Nonprofits & Activism)']
];

function parseKeywords(text) {
    const seen = new Set();
    const keywords = [];
    for (const raw of String(text || '').split(/[,，、\n]/)) {
        const keyword = raw.trim();
        const key = keyword.toLowerCase();
        if (keyword && !seen.has(key)) {
            seen.add(key);
            keywords.push(keyword);
        }
    }
    return keywords;
}

/** Returns an error message for the first invalid channel rule, or null */
function validateChannelRules(rules) {
    for (const rule of rules) {
        if (!Number.isFinite(rule.speed) || rule.speed < MIN_SPEED || rule.speed > MAX_SPEED) {
            return `頻道「${rule.channel}」的速度必須介於 ${MIN_SPEED} 到 ${MAX_SPEED} 之間。`;
        }
    }
    return null;
}

/** Returns an error message for the first invalid category, or null */
function validateCategories(categories) {
    const names = new Set();
    for (const [index, cat] of categories.entries()) {
        const label = cat.name || `第 ${index + 1} 個分類`;
        if (!cat.name) return `${label}：請輸入分類名稱。`;
        if (names.has(cat.name)) return `「${cat.name}」重複了，請使用不同的分類名稱。`;
        names.add(cat.name);
        if (!Number.isFinite(cat.speed) || cat.speed < MIN_SPEED || cat.speed > MAX_SPEED) {
            return `「${label}」的速度必須介於 ${MIN_SPEED} 到 ${MAX_SPEED} 之間。`;
        }
        if (cat.keywords.length === 0 && cat.ytCategoryIds.length === 0) {
            return `「${label}」至少要有一個關鍵字或指定 YouTube 分類，否則不會比對到任何影片。`;
        }
    }
    return null;
}

function createCategoryId() {
    return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function initOptionsPage() {
    const list = document.getElementById('category-list');
    const template = document.getElementById('category-template');
    const message = document.getElementById('message');
    const dirty = document.getElementById('dirty');
    const channelList = document.getElementById('channel-list');
    const channelTemplate = document.getElementById('channel-template');
    const channelEmpty = document.getElementById('channel-empty');

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle('success', !isError);
    }

    function setDirty(value) {
        dirty.hidden = !value;
    }

    async function send(messageData) {
        const response = await chrome.runtime.sendMessage(messageData);
        if (response?.error) throw new Error(response.error);
        return response;
    }

    function renderCategory(cat) {
        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.id = cat.id;
        card.querySelector('.field-enabled').checked = cat.enabled !== false;
        card.querySelector('.field-emoji').value = cat.emoji || '';
        card.querySelector('.field-name').value = cat.name || '';
        card.querySelector('.field-speed').value = String(cat.speed ?? 1);
        card.querySelector('.field-keywords').value = (cat.keywords || []).join(', ');

        const select = card.querySelector('.field-yt-category');
        for (const [value, label] of YT_CATEGORY_OPTIONS) {
            select.append(new Option(label, value));
        }
        select.value = cat.ytCategoryIds?.[0] || '';

        card.querySelector('.delete').addEventListener('click', () => {
            card.remove();
            setDirty(true);
        });
        card.classList.toggle('disabled', cat.enabled === false);
        card.querySelector('.field-enabled').addEventListener('change', event => {
            card.classList.toggle('disabled', !event.target.checked);
        });
        return card;
    }

    function render(categories) {
        list.replaceChildren(...categories.map(renderCategory));
        setDirty(false);
    }

    function updateChannelEmpty() {
        channelEmpty.hidden = channelList.children.length > 0;
    }

    function renderChannelRules(rules = []) {
        channelList.replaceChildren(...rules.map(rule => {
            const row = channelTemplate.content.firstElementChild.cloneNode(true);
            row.dataset.channel = rule.channel;
            row.querySelector('.channel-name').textContent = rule.channel;
            row.querySelector('.field-channel-speed').value = String(rule.speed);
            row.querySelector('.delete').addEventListener('click', () => {
                row.remove();
                updateChannelEmpty();
                setDirty(true);
            });
            return row;
        }));
        updateChannelEmpty();
    }

    function readChannelRules() {
        return [...channelList.querySelectorAll('.channel-row')].map(row => ({
            channel: row.dataset.channel,
            speed: Math.round(Number(row.querySelector('.field-channel-speed').value) * 100) / 100
        }));
    }

    function readCategories() {
        return [...list.querySelectorAll('.category')].map(card => {
            const ytCategoryId = card.querySelector('.field-yt-category').value;
            return {
                id: card.dataset.id,
                name: card.querySelector('.field-name').value.trim(),
                emoji: card.querySelector('.field-emoji').value.trim(),
                speed: Math.round(Number(card.querySelector('.field-speed').value) * 100) / 100,
                keywords: parseKeywords(card.querySelector('.field-keywords').value),
                ytCategoryIds: ytCategoryId ? [ytCategoryId] : [],
                enabled: card.querySelector('.field-enabled').checked
            };
        });
    }

    for (const container of [list, channelList]) {
        container.addEventListener('input', () => setDirty(true));
        container.addEventListener('change', () => setDirty(true));
    }

    document.getElementById('add-category').addEventListener('click', () => {
        const card = renderCategory({ id: createCategoryId(), emoji: '🏷️', speed: 1, keywords: [], enabled: true });
        list.append(card);
        card.querySelector('.field-name').focus();
        setDirty(true);
    });

    document.getElementById('reset-categories').addEventListener('click', async () => {
        if (!confirm('確定要還原成預設分類嗎？你新增和修改過的分類都會被清除。')) return;
        try {
            const { categories } = await send({ type: 'reset-categories' });
            render(categories);
            showMessage('已還原預設分類');
        } catch (error) {
            showMessage(error.message || '還原失敗', true);
        }
    });

    document.getElementById('save').addEventListener('click', async () => {
        const categories = readCategories();
        const channelRules = readChannelRules();
        const error = validateCategories(categories) || validateChannelRules(channelRules);
        if (error) {
            showMessage(error, true);
            return;
        }
        try {
            const { settings } = await send({ type: 'get-settings' });
            await send({ type: 'save-settings', settings: { ...settings, channelRules } });
            await send({ type: 'save-categories', categories });
            setDirty(false);
            showMessage(`已儲存 ${categories.length} 個分類和 ${channelRules.length} 個頻道規則，開啟中的 YouTube 分頁會立即套用。`);
        } catch (saveError) {
            const quota = /quota/i.test(saveError.message || '');
            showMessage(quota
                ? '分類資料超過 Chrome 同步容量上限，請減少關鍵字或分類數量。'
                : (saveError.message || '儲存失敗'), true);
        }
    });

    window.addEventListener('beforeunload', event => {
        if (!dirty.hidden) event.preventDefault();
    });

    Promise.all([send({ type: 'get-categories' }), send({ type: 'get-settings' })])
        .then(([{ categories }, { settings }]) => {
            render(categories);
            renderChannelRules(settings.channelRules);
        })
        .catch(error => showMessage(error.message || '無法載入設定', true));
}

if (typeof document !== 'undefined') initOptionsPage();
