/**
 * AutoSPD - Category settings page
 */

// Must match ai-classifier.js so availability reflects the sessions it creates
const AI_LANGUAGES = {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }]
};

const MIN_SPEED = 0.25;
const MAX_SPEED = 2;

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

/** Returns an error message for the first invalid YouTube category speed, or null */
function validateYouTubeSpeeds(speeds, names = {}) {
    for (const [id, speed] of Object.entries(speeds)) {
        if (!Number.isFinite(speed) || speed < MIN_SPEED || speed > MAX_SPEED) {
            return t('errYtSpeed', names[id] || id, MIN_SPEED, MAX_SPEED);
        }
    }
    return null;
}

/** Returns an error message for the first invalid channel rule, or null */
function validateChannelRules(rules) {
    for (const rule of rules) {
        if (!Number.isFinite(rule.speed) || rule.speed < MIN_SPEED || rule.speed > MAX_SPEED) {
            return t('errChannelSpeed', rule.channel, MIN_SPEED, MAX_SPEED);
        }
    }
    return null;
}

/**
 * Returns an error message for the first invalid category, or null.
 * Keyword mode needs something to match on; the AI can work from names alone.
 */
function validateCategories(categories, { requireMatchers = true } = {}) {
    const names = new Set();
    for (const [index, cat] of categories.entries()) {
        if (!cat.name) return t('errCategoryName', t('nthCategory', index + 1));
        if (names.has(cat.name)) return t('errCategoryDuplicate', cat.name);
        names.add(cat.name);
        if (!Number.isFinite(cat.speed) || cat.speed < MIN_SPEED || cat.speed > MAX_SPEED) {
            return t('errCategorySpeed', cat.name, MIN_SPEED, MAX_SPEED);
        }
        if (requireMatchers && cat.keywords.length === 0 && cat.ytCategoryIds.length === 0) {
            return t('errCategoryMatchers', cat.name);
        }
    }
    return null;
}

function createCategoryId() {
    return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function initOptionsPage() {
    localizePage();
    const list = document.getElementById('category-list');
    const template = document.getElementById('category-template');
    const message = document.getElementById('message');
    const dirty = document.getElementById('dirty');
    const channelList = document.getElementById('channel-list');
    const channelTemplate = document.getElementById('channel-template');
    const channelEmpty = document.getElementById('channel-empty');
    const keywordSection = document.getElementById('keyword-section');
    const youtubeHint = document.getElementById('youtube-hint');
    const ytSpeedList = document.getElementById('yt-speed-list');
    const modeInputs = [...document.querySelectorAll('input[name="classify-mode"]')];
    const aiStatus = document.getElementById('ai-status');
    const aiStatusText = document.getElementById('ai-status-text');
    const aiDownload = document.getElementById('ai-download');
    const fixedLive = document.getElementById('fixed-live');
    const fixedMusic = document.getElementById('fixed-music');
    const replayEnabled = document.getElementById('replay-enabled');
    const replaySpeed = document.getElementById('replay-speed');
    const defaultSpeed = document.getElementById('default-speed');

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
        select.append(new Option(t('notSpecified'), ''));
        for (const ytCategory of YT_CATEGORIES) {
            select.append(new Option(t(`ytCategory${ytCategory.id}`), ytCategory.id));
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

    function showMode(mode) {
        for (const input of modeInputs) input.checked = input.value === mode;
        keywordSection.hidden = mode === 'youtube';
        youtubeHint.textContent = t(mode === 'youtube' ? 'ytHintYouTubeMode' : 'ytHintFallback');
        aiStatus.hidden = mode !== 'ai';
        if (mode === 'ai') refreshAiStatus();
    }

    function setAiStatus(text, tone = '', canDownload = false) {
        aiStatusText.textContent = text;
        aiStatus.classList.toggle('ready', tone === 'ready');
        aiStatus.classList.toggle('problem', tone === 'problem');
        aiDownload.hidden = !canDownload;
    }

    async function refreshAiStatus() {
        if (typeof LanguageModel === 'undefined') {
            setAiStatus(t('aiNoChrome'), 'problem');
            return;
        }
        try {
            const availability = await LanguageModel.availability(AI_LANGUAGES);
            if (availability === 'available') setAiStatus(t('aiReady'), 'ready');
            else if (availability === 'downloadable') setAiStatus(t('aiNeedsDownload'), '', true);
            else if (availability === 'downloading') setAiStatus(t('aiDownloadingWait'));
            else setAiStatus(t('aiNoHardware'), 'problem');
        } catch (error) {
            setAiStatus(t('aiCheckFailed', error.message), 'problem');
        }
    }

    function readMode() {
        return modeInputs.find(input => input.checked)?.value || 'keywords';
    }

    function renderYouTubeSpeeds(speeds = {}) {
        ytSpeedList.replaceChildren(...YT_CATEGORIES.map(ytCategory => {
            const row = document.createElement('label');
            row.className = 'yt-speed-row';
            const name = document.createElement('span');
            name.textContent = t(`ytCategory${ytCategory.id}`);
            const speed = document.createElement('span');
            speed.className = 'speed';
            const input = document.createElement('input');
            input.type = 'number';
            input.min = String(MIN_SPEED);
            input.max = String(MAX_SPEED);
            input.step = '0.05';
            input.className = 'field-speed';
            input.dataset.ytCategory = ytCategory.id;
            input.value = String(speeds[ytCategory.id] ?? ytCategory.speed);
            input.setAttribute('aria-label', t('speedOfCategory', t(`ytCategory${ytCategory.id}`)));
            const unit = document.createElement('span');
            unit.textContent = 'x';
            speed.append(input, unit);
            row.append(name, speed);
            return row;
        }));
    }

    function readYouTubeSpeeds() {
        return Object.fromEntries([...ytSpeedList.querySelectorAll('input')].map(input => [
            input.dataset.ytCategory,
            Math.round(Number(input.value) * 100) / 100
        ]));
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

    // Chrome only starts the model download from a user click
    aiDownload.addEventListener('click', async () => {
        aiDownload.disabled = true;
        try {
            const session = await LanguageModel.create({
                ...AI_LANGUAGES,
                monitor(monitor) {
                    monitor.addEventListener('downloadprogress', event => {
                        setAiStatus(t('aiDownloadProgress', Math.round(event.loaded * 100)));
                    });
                }
            });
            session.destroy();
            await refreshAiStatus();
        } catch (error) {
            setAiStatus(t('aiDownloadFailed', error.message), 'problem', true);
        } finally {
            aiDownload.disabled = false;
        }
    });

    for (const input of modeInputs) {
        input.addEventListener('change', () => {
            showMode(readMode());
            setDirty(true);
        });
    }

    for (const input of [fixedLive, fixedMusic, replayEnabled, replaySpeed, defaultSpeed]) {
        input.addEventListener('change', () => setDirty(true));
        input.addEventListener('input', () => setDirty(true));
    }

    for (const container of [list, channelList, ytSpeedList]) {
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
        if (!confirm(t('confirmReset'))) return;
        try {
            const { categories } = await send({ type: 'reset-categories' });
            render(categories);
            showMessage(t('resetDone'));
        } catch (error) {
            showMessage(error.message || t('resetFailed'), true);
        }
    });

    document.getElementById('save').addEventListener('click', async () => {
        const categories = readCategories();
        const channelRules = readChannelRules();
        const classifyMode = readMode();
        const uncategorizedSpeed = Math.round(Number(defaultSpeed.value) * 100) / 100;
        const defaultSpeedError = !Number.isFinite(uncategorizedSpeed) || uncategorizedSpeed < MIN_SPEED || uncategorizedSpeed > MAX_SPEED
            ? t('errDefaultSpeed', MIN_SPEED, MAX_SPEED)
            : null;
        const liveReplaySpeed = Math.round(Number(replaySpeed.value) * 100) / 100;
        const replayError = !Number.isFinite(liveReplaySpeed) || liveReplaySpeed < MIN_SPEED || liveReplaySpeed > MAX_SPEED
            ? t('errReplaySpeed', MIN_SPEED, MAX_SPEED)
            : null;
        const ytCategorySpeeds = readYouTubeSpeeds();
        const ytNames = Object.fromEntries(YT_CATEGORIES.map(cat => [cat.id, t(`ytCategory${cat.id}`)]));
        const error = defaultSpeedError
            || replayError
            || validateYouTubeSpeeds(ytCategorySpeeds, ytNames)
            || validateChannelRules(channelRules)
            || validateCategories(categories, { requireMatchers: classifyMode === 'keywords' });
        if (error) {
            showMessage(error, true);
            return;
        }
        try {
            const { settings } = await send({ type: 'get-settings' });
            await send({
                type: 'save-settings',
                settings: {
                    ...settings,
                    channelRules,
                    classifyMode,
                    ytCategorySpeeds,
                    fixedNormalForLive: fixedLive.checked,
                    fixedNormalForMusic: fixedMusic.checked,
                    liveReplayEnabled: replayEnabled.checked,
                    liveReplaySpeed,
                    defaultSpeed: uncategorizedSpeed
                }
            });
            await send({ type: 'save-categories', categories });
            setDirty(false);
            showMessage(t('savedSummary', categories.length, channelRules.length));
        } catch (saveError) {
            const quota = /quota/i.test(saveError.message || '');
            showMessage(quota
                ? t('errQuota')
                : (saveError.message || t('errSave')), true);
        }
    });

    window.addEventListener('beforeunload', event => {
        if (!dirty.hidden) event.preventDefault();
    });

    Promise.all([send({ type: 'get-categories' }), send({ type: 'get-settings' })])
        .then(([{ categories }, { settings }]) => {
            render(categories);
            renderChannelRules(settings.channelRules);
            renderYouTubeSpeeds(settings.ytCategorySpeeds);
            fixedLive.checked = settings.fixedNormalForLive !== false;
            fixedMusic.checked = settings.fixedNormalForMusic !== false;
            replayEnabled.checked = settings.liveReplayEnabled !== false;
            replaySpeed.value = String(settings.liveReplaySpeed ?? 1.5);
            defaultSpeed.value = String(settings.defaultSpeed ?? 1);
            showMode(['youtube', 'ai'].includes(settings.classifyMode) ? settings.classifyMode : 'keywords');
        })
        .catch(error => showMessage(error.message || t('errLoadSettings'), true));
}

if (typeof document !== 'undefined') initOptionsPage();
