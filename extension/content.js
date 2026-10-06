(() => {
    'use strict';

    const state = {
        videoId: null,
        title: '',
        category: null,
        speed: null,
        mode: 'loading',
        lastLoggedVideoId: null
    };
    let requestVersion = 0;
    let retryTimer = null;
    let retryCount = 0;

    function getVideoId() {
        const url = new URL(location.href);
        if (url.pathname === '/watch') return url.searchParams.get('v');
        const match = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/?]+)/);
        return match ? match[1] : null;
    }

    function getVideoElement() {
        return document.querySelector('#movie_player video.html5-main-video')
            || document.querySelector('video.html5-main-video')
            || document.querySelector('video');
    }

    function getVideoInfo(videoId) {
        const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')
            ?.textContent?.trim()
            || document.querySelector('meta[property="og:title"]')?.content
            || document.title.replace(/\s*-\s*YouTube\s*$/, '').trim();
        const description = document.querySelector('#description-inline-expander')
            ?.textContent?.trim()
            || document.querySelector('meta[property="og:description"]')?.content
            || '';
        const channelName = document.querySelector('#channel-name a')
            ?.textContent?.trim()
            || '';

        return { videoId, title, description, channelName };
    }

    async function sendMessage(message) {
        const response = await chrome.runtime.sendMessage(message);
        if (response?.error) throw new Error(response.error);
        return response;
    }

    function showToast(text) {
        const settingsPromise = sendMessage({ type: 'get-settings' });
        settingsPromise.then(({ settings }) => {
            if (!settings.notifications) return;

            let toast = document.getElementById('autospd-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'autospd-toast';
                toast.setAttribute('role', 'status');
                document.documentElement.append(toast);
            }

            toast.textContent = text;
            toast.classList.add('autospd-toast-visible');
            clearTimeout(toast.hideTimer);
            toast.hideTimer = setTimeout(() => {
                toast.classList.remove('autospd-toast-visible');
            }, 2400);
        }).catch(error => console.error('[AutoSPD] Notification failed:', error));
    }

    async function processVideo(force = false) {
        const videoId = getVideoId();
        if (!videoId) {
            state.videoId = null;
            state.title = '';
            state.category = null;
            state.speed = null;
            state.mode = 'not-video';
            requestVersion += 1;
            return;
        }

        const video = getVideoElement();
        if (!video) {
            scheduleRetry();
            return;
        }

        if (!force && state.videoId === videoId && state.mode !== 'loading') return;

        const version = ++requestVersion;
        const videoInfo = getVideoInfo(videoId);
        state.videoId = videoId;
        state.title = videoInfo.title;
        state.category = null;
        state.speed = null;
        state.mode = 'loading';

        try {
            const { settings } = await sendMessage({ type: 'get-settings' });
            if (version !== requestVersion || getVideoId() !== videoId) return;

            if (!settings.autoSpeed) {
                state.mode = 'disabled';
                return;
            }

            const result = await sendMessage({ type: 'match-video', videoInfo });
            if (version !== requestVersion || getVideoId() !== videoId) return;

            const speed = Number(result.speed);
            if (!Number.isFinite(speed) || speed < 0.25 || speed > 2) {
                throw new Error(`Invalid playback speed: ${result.speed}`);
            }

            const activeVideo = getVideoElement();
            if (!activeVideo) {
                scheduleRetry();
                return;
            }

            activeVideo.playbackRate = speed;
            state.category = result.category || null;
            state.speed = speed;
            state.mode = 'auto';

            if (settings.recordHistory && state.lastLoggedVideoId !== videoId) {
                state.lastLoggedVideoId = videoId;
                const thumbnail = document.querySelector('meta[property="og:image"]')?.content || '';
                sendMessage({
                    type: 'log-history',
                    entry: {
                        title: videoInfo.title,
                        category: state.category?.id || 'default',
                        categoryId: state.category?.id || 'default',
                        speed,
                        thumb: thumbnail,
                        thumbnail,
                        videoId
                    }
                }).catch(error => console.error('[AutoSPD] Could not save local history:', error));
            }

            if (settings.notifications) {
                const categoryName = state.category?.name || '未分類';
                showToast(`AutoSPD：${categoryName} · ${speed}x`);
            }
        } catch (error) {
            if (version !== requestVersion) return;
            state.mode = 'error';
            console.error('[AutoSPD] Could not apply playback speed:', error);
        }
    }

    function scheduleRetry() {
        if (retryTimer || retryCount >= 12) return;
        retryTimer = setTimeout(() => {
            retryTimer = null;
            retryCount += 1;
            processVideo(true);
        }, 500);
    }

    function onNavigation() {
        retryCount = 0;
        clearTimeout(retryTimer);
        retryTimer = null;
        setTimeout(() => processVideo(true), 100);
    }

    function getPublicState() {
        return {
            videoId: state.videoId,
            title: state.title,
            categoryName: state.category?.name || (state.mode === 'disabled' ? '自動調速已關閉' : ''),
            speed: state.speed,
            mode: state.mode
        };
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'get-video-state') {
            sendResponse(getPublicState());
            return false;
        }

        if (message.type === 'set-manual-speed') {
            const speed = Number(message.speed);
            const video = getVideoElement();
            if (!Number.isFinite(speed) || speed < 0.25 || speed > 2 || !video) {
                sendResponse({ error: '目前無法套用這個播放速度' });
                return false;
            }

            video.playbackRate = speed;
            state.videoId = getVideoId();
            state.title = getVideoInfo(state.videoId).title;
            state.category = null;
            state.speed = speed;
            state.mode = 'manual';
            showToast(`AutoSPD：已手動設定為 ${speed}x`);
            sendResponse({ success: true, state: getPublicState() });
            return false;
        }

        if (message.type === 'settings-updated' || message.type === 'categories-updated') {
            processVideo(true);
        }
        return false;
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && (changes.settings || changes.categories)) {
            processVideo(true);
        }
    });

    document.addEventListener('yt-navigate-finish', onNavigation);
    document.addEventListener('yt-page-data-updated', onNavigation);
    window.addEventListener('popstate', onNavigation);
    processVideo(true);
})();
