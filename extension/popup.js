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
    const manualSpeed = document.getElementById('manual-speed');
    const manualSlider = document.getElementById('manual-slider');
    const videoTitle = document.getElementById('video-title');
    const videoStatus = document.getElementById('video-status');
    const message = document.getElementById('message');
    let activeTabId = null;

    localizePage();

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle('success', !isError);
    }

    function parseSpeed(input) {
        const speed = Number(input.value);
        if (!Number.isFinite(speed) || speed < 0.25 || speed > 2) {
            throw new Error(t('speedRangeError'));
        }
        return Math.round(speed * 100) / 100;
    }

    async function getYouTubeTab() {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.id || !/^https:\/\/(www\.)?youtube\.com\//.test(tab.url || '')) {
            videoTitle.textContent = t('openYouTube');
            videoStatus.textContent = t('notConnected');
            return null;
        }
        return tab;
    }

    async function sendToTab(messageData) {
        if (!activeTabId) throw new Error(t('noVideoToControl'));
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

            if (!tab) return;
            activeTabId = tab.id;
            const state = await sendToTab({ type: 'get-video-state' });
            videoTitle.textContent = state.title || t('loadingVideoInfo');
            videoStatus.textContent = formatStatus(state);
            renderMeta(state);
            renderChannelRule(state.channelName, settings.channelRules);
            if (Number.isFinite(state.speed)) {
                manualSpeed.value = String(state.speed);
                manualSlider.value = String(state.speed);
            }
        } catch (error) {
            videoTitle.textContent = t('playerUnreachable');
            videoStatus.textContent = t('reloadTab');
            showMessage(error.message || t('loadFailed'), true);
        }
    }

    // Shows what the matcher saw, so it is clear why a video went unclassified
    function renderMeta(state) {
        const parts = [];
        if (state.ytCategory) {
            const ytCategory = YT_CATEGORIES.find(cat => cat.en === state.ytCategory);
            parts.push(t('metaYouTubeCategory', ytCategory ? t(`ytCategory${ytCategory.id}`) : state.ytCategory));
        }
        if (state.channelName) parts.push(t('metaChannel', state.channelName));
        const aiProblems = {
            downloadable: 'aiDownloadable',
            downloading: 'aiDownloading',
            unavailable: 'aiUnavailable',
            unsupported: 'aiUnsupported',
            timeout: 'aiTimeout'
        };
        if (state.aiStatus && state.aiStatus !== 'ok') {
            parts.push(aiProblems[state.aiStatus] ? t(aiProblems[state.aiStatus]) : t('aiFailed', state.aiStatus));
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
        channelRuleLabel.textContent = t(rule ? 'channelRuleLabelSet' : 'channelRuleLabel', currentChannel);
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
        if (state.mode === 'disabled') return t('statusAutoOff');
        if (state.mode === 'not-video') return t('statusNotVideo');
        if (state.mode === 'error') return t('statusError');
        return t('statusDetecting');
    }

    autoSpeed.addEventListener('change', async () => {
        try {
            const { settings } = await chrome.runtime.sendMessage({ type: 'get-settings' });
            const response = await chrome.runtime.sendMessage({
                type: 'save-settings',
                settings: { ...settings, autoSpeed: autoSpeed.checked }
            });
            if (response?.error) throw new Error(response.error);
            showMessage(t(autoSpeed.checked ? 'autoSpeedOn' : 'statusAutoOff'));
            await load();
        } catch (error) {
            autoSpeed.checked = !autoSpeed.checked;
            showMessage(error.message || t('saveFailed'), true);
        }
    });

    function bindSettingToggle(input, key, onMessage, offMessage) {
        input.addEventListener('change', async () => {
            try {
                const { settings } = await chrome.runtime.sendMessage({ type: 'get-settings' });
                const response = await chrome.runtime.sendMessage({
                    type: 'save-settings',
                    settings: { ...settings, [key]: input.checked }
                });
                if (response?.error) throw new Error(response.error);
                showMessage(t(input.checked ? onMessage : offMessage));
            } catch (error) {
                input.checked = !input.checked;
                showMessage(error.message || t('saveFailed'), true);
            }
        });
    }

    bindSettingToggle(notifications, 'notifications', 'noticeOn', 'noticeOff');
    bindSettingToggle(hideCaptions, 'hideCaptions', 'captionsOn', 'captionsOff');

    document.getElementById('save-channel-rule').addEventListener('click', async () => {
        try {
            const speed = parseSpeed(channelSpeed);
            await saveChannelRules(rules => [...rules, { channel: currentChannel, speed }]);
            showMessage(t('channelRuleSaved', currentChannel, speed));
        } catch (error) {
            showMessage(error.message || t('saveFailed'), true);
        }
    });

    removeChannelRule.addEventListener('click', async () => {
        try {
            await saveChannelRules(rules => rules);
            showMessage(t('channelRuleRemoved', currentChannel));
        } catch (error) {
            showMessage(error.message || t('saveFailed'), true);
        }
    });

    async function applyManualSpeed(speed) {
        try {
            const result = await sendToTab({ type: 'set-manual-speed', speed });
            videoStatus.textContent = formatStatus(result.state);
            showMessage(t('manualApplied', speed));
        } catch (error) {
            showMessage(error.message || t('manualFailed'), true);
        }
    }

    document.getElementById('apply-manual').addEventListener('click', () => {
        try {
            const speed = parseSpeed(manualSpeed);
            manualSpeed.value = String(speed);
            manualSlider.value = String(speed);
            applyManualSpeed(speed);
        } catch (error) {
            showMessage(error.message, true);
        }
    });

    manualSpeed.addEventListener('input', () => {
        manualSlider.value = manualSpeed.value;
    });

    // Dragging fires faster than the tab answers: send one at a time, always the latest
    let sliderBusy = false;
    let sliderLatest = null;

    async function flushSlider() {
        if (sliderBusy) return;
        sliderBusy = true;
        while (sliderLatest !== null) {
            const speed = sliderLatest;
            sliderLatest = null;
            await applyManualSpeed(speed);
        }
        sliderBusy = false;
    }

    manualSlider.addEventListener('input', () => {
        const speed = parseSpeed(manualSlider);
        manualSpeed.value = String(speed);
        sliderLatest = speed;
        flushSlider();
    });

    document.getElementById('open-options').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    load();
})();
