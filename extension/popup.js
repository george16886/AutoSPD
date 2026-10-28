(() => {
    'use strict';

    const autoSpeed = document.getElementById('auto-speed');
    const notifications = document.getElementById('notifications');
    const hideCaptions = document.getElementById('hide-captions');
    const videoMeta = document.getElementById('video-meta');
    const channelRule = document.getElementById('channel-rule');
    const channelRuleLabel = document.getElementById('channel-rule-label');
    const channelSpeed = document.getElementById('channel-speed');
    const removeChannelRule = document.getElementById('remove-channel-rule');
    let currentChannel = '';
    const defaultSpeed = document.getElementById('default-speed');
    const manualSpeed = document.getElementById('manual-speed');
    const videoTitle = document.getElementById('video-title');
    const videoStatus = document.getElementById('video-status');
    const message = document.getElementById('message');
    let activeTabId = null;

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle('success', !isError);
    }

    function parseSpeed(input) {
        const speed = Number(input.value);
        if (!Number.isFinite(speed) || speed < 0.25 || speed > 2) {
            throw new Error('請輸入 0.25 到 2 之間的速度。');
        }
        return Math.round(speed * 100) / 100;
    }

    async function getYouTubeTab() {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.id || !/^https:\/\/(www\.)?youtube\.com\//.test(tab.url || '')) {
            videoTitle.textContent = '請先在此分頁開啟 YouTube 影片';
            videoStatus.textContent = '尚未連線';
            return null;
        }
        return tab;
    }

    async function sendToTab(messageData) {
        if (!activeTabId) throw new Error('目前沒有可控制的 YouTube 影片。');
        const response = await chrome.tabs.sendMessage(activeTabId, messageData);
        if (response?.error) throw new Error(response.error);
        return response;
    }

    async function load() {
        try {
            const [{ settings }, tab] = await Promise.all([
                chrome.runtime.sendMessage({ type: 'get-settings' }),
                getYouTubeTab()
            ]);
            autoSpeed.checked = settings.autoSpeed !== false;
            notifications.checked = settings.notifications !== false;
            hideCaptions.checked = settings.hideCaptions !== false;
            defaultSpeed.value = String(settings.defaultSpeed ?? 1);

            if (!tab) return;
            activeTabId = tab.id;
            const state = await sendToTab({ type: 'get-video-state' });
            videoTitle.textContent = state.title || '正在載入影片資訊…';
            videoStatus.textContent = formatStatus(state);
            renderMeta(state);
            renderChannelRule(state.channelName, settings.channelRules);
            if (Number.isFinite(state.speed)) manualSpeed.value = String(state.speed);
        } catch (error) {
            videoTitle.textContent = '無法連線至 YouTube 播放器';
            videoStatus.textContent = '請重新整理 YouTube 分頁後再試';
            showMessage(error.message || '載入失敗', true);
        }
    }

    // Shows what the matcher saw, so it is clear why a video went unclassified
    function renderMeta(state) {
        const parts = [];
        if (state.ytCategory) parts.push(`YouTube 分類：${state.ytCategory}`);
        if (state.channelName) parts.push(`頻道：${state.channelName}`);
        const aiProblems = {
            downloadable: 'AI 模型尚未下載，請到設定頁下載',
            downloading: 'AI 模型下載中',
            unavailable: '這台電腦無法使用 AI 分析',
            unsupported: '這個版本的 Chrome 不支援 AI 分析',
            timeout: 'AI 分析逾時'
        };
        if (state.aiStatus && state.aiStatus !== 'ok') {
            parts.push(aiProblems[state.aiStatus] || `AI 分析失敗（${state.aiStatus}）`);
        }
        videoMeta.textContent = parts.join(' · ');
        videoMeta.hidden = parts.length === 0;
    }

    function sameChannel(a, b) {
        return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    }

    function renderChannelRule(channelName, rules = []) {
        currentChannel = channelName || '';
        channelRule.hidden = !currentChannel;
        if (!currentChannel) return;
        const rule = rules.find(item => sameChannel(item.channel, currentChannel));
        channelRuleLabel.textContent = rule
            ? `「${currentChannel}」的影片一律使用（已設定）`
            : `「${currentChannel}」的影片一律使用`;
        if (rule) channelSpeed.value = String(rule.speed);
        removeChannelRule.hidden = !rule;
    }

    async function saveChannelRules(update) {
        const { settings } = await chrome.runtime.sendMessage({ type: 'get-settings' });
        const rules = update((settings.channelRules || []).filter(rule => !sameChannel(rule.channel, currentChannel)));
        const response = await chrome.runtime.sendMessage({
            type: 'save-settings',
            settings: { ...settings, channelRules: rules }
        });
        if (response?.error) throw new Error(response.error);
        renderChannelRule(currentChannel, rules);
    }

    function formatStatus(state) {
        if (state.mode === 'auto' || state.mode === 'manual') {
            const prefix = state.categoryName ? `${state.categoryName} · ` : '';
            return `${prefix}${state.speed}x`;
        }
        if (state.mode === 'disabled') return '自動調速已關閉';
        if (state.mode === 'not-video') return '目前分頁不是影片頁';
        if (state.mode === 'error') return '套用失敗，請重新整理頁面';
        return '正在判斷影片類型…';
    }

    autoSpeed.addEventListener('change', async () => {
        try {
            const { settings } = await chrome.runtime.sendMessage({ type: 'get-settings' });
            const response = await chrome.runtime.sendMessage({
                type: 'save-settings',
                settings: { ...settings, autoSpeed: autoSpeed.checked }
            });
            if (response?.error) throw new Error(response.error);
            showMessage(autoSpeed.checked ? '自動調速已開啟' : '自動調速已關閉');
            await load();
        } catch (error) {
            autoSpeed.checked = !autoSpeed.checked;
            showMessage(error.message || '設定儲存失敗', true);
        }
    });

    function bindSettingToggle(input, key, onText, offText) {
        input.addEventListener('change', async () => {
            try {
                const { settings } = await chrome.runtime.sendMessage({ type: 'get-settings' });
                const response = await chrome.runtime.sendMessage({
                    type: 'save-settings',
                    settings: { ...settings, [key]: input.checked }
                });
                if (response?.error) throw new Error(response.error);
                showMessage(input.checked ? onText : offText);
            } catch (error) {
                input.checked = !input.checked;
                showMessage(error.message || '設定儲存失敗', true);
            }
        });
    }

    bindSettingToggle(notifications, 'notifications', '速度提示已開啟', '速度提示已關閉');
    bindSettingToggle(hideCaptions, 'hideCaptions', '之後開啟的影片會自動關閉字幕', '已停止自動關閉字幕');

    document.getElementById('save-channel-rule').addEventListener('click', async () => {
        try {
            const speed = parseSpeed(channelSpeed);
            await saveChannelRules(rules => [...rules, { channel: currentChannel, speed }]);
            showMessage(`「${currentChannel}」的影片之後都會使用 ${speed}x`);
        } catch (error) {
            showMessage(error.message || '設定儲存失敗', true);
        }
    });

    removeChannelRule.addEventListener('click', async () => {
        try {
            await saveChannelRules(rules => rules);
            showMessage(`已移除「${currentChannel}」的頻道規則`);
        } catch (error) {
            showMessage(error.message || '設定儲存失敗', true);
        }
    });

    document.getElementById('save-default').addEventListener('click', async () => {
        try {
            const speed = parseSpeed(defaultSpeed);
            const { settings } = await chrome.runtime.sendMessage({ type: 'get-settings' });
            const response = await chrome.runtime.sendMessage({
                type: 'save-settings',
                settings: { ...settings, defaultSpeed: speed }
            });
            if (response?.error) throw new Error(response.error);
            defaultSpeed.value = String(speed);
            showMessage(`未分類影片預設速度已儲存為 ${speed}x`);
        } catch (error) {
            showMessage(error.message || '設定儲存失敗', true);
        }
    });

    document.getElementById('apply-manual').addEventListener('click', async () => {
        try {
            const speed = parseSpeed(manualSpeed);
            const result = await sendToTab({ type: 'set-manual-speed', speed });
            videoStatus.textContent = formatStatus(result.state);
            manualSpeed.value = String(speed);
            showMessage(`目前影片已設定為 ${speed}x`);
        } catch (error) {
            showMessage(error.message || '無法套用播放速度', true);
        }
    });

    document.getElementById('open-options').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    load();
})();
