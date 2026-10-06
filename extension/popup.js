(() => {
    'use strict';

    const autoSpeed = document.getElementById('auto-speed');
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
            defaultSpeed.value = String(settings.defaultSpeed ?? 1);

            if (!tab) return;
            activeTabId = tab.id;
            const state = await sendToTab({ type: 'get-video-state' });
            videoTitle.textContent = state.title || '正在載入影片資訊…';
            videoStatus.textContent = formatStatus(state);
            if (Number.isFinite(state.speed)) manualSpeed.value = String(state.speed);
        } catch (error) {
            videoTitle.textContent = '無法連線至 YouTube 播放器';
            videoStatus.textContent = '請重新整理 YouTube 分頁後再試';
            showMessage(error.message || '載入失敗', true);
        }
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

    load();
})();
