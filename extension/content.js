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

    // A rate change this soon after the player loads a source (new video, ad
    // ending) is YouTube restoring its own rate, not the user picking one
    const RESET_WINDOW_MS = 1500;
    const guardedVideos = new WeakSet();
    let resetWindowUntil = 0;

    function getVideoId() {
        const url = new URL(location.href);
        if (url.pathname === '/watch') return url.searchParams.get('v');
        const match = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/?]+)/);
        return match ? match[1] : null;
    }

    // #movie_player stays in the DOM on Shorts after visiting a watch page
    function getVideoElement() {
        const playerId = location.pathname.startsWith('/shorts/') ? 'shorts-player' : 'movie_player';
        return document.querySelector(`#${playerId} video.html5-main-video`)
            || document.querySelector(`#${playerId} video`)
            || document.querySelector('video.html5-main-video')
            || document.querySelector('video');
    }

    // playerMicroformatRenderer.category is the English category name
    const YT_CATEGORY_IDS = {
        'Film & Animation': '1',
        'Autos & Vehicles': '2',
        'Music': '10',
        'Pets & Animals': '15',
        'Sports': '17',
        'Travel & Events': '19',
        'Gaming': '20',
        'People & Blogs': '22',
        'Comedy': '23',
        'Entertainment': '24',
        'News & Politics': '25',
        'Howto & Style': '26',
        'Education': '27',
        'Science & Technology': '28',
        'Nonprofits & Activism': '29'
    };

    // Ask page-bridge.js (main world) for the player response; dispatch is synchronous
    function readPlayerInfo(videoId) {
        let info = null;
        const onInfo = event => {
            try {
                info = JSON.parse(event.detail);
            } catch {
                info = null;
            }
        };
        document.addEventListener('autospd-video-info', onInfo);
        document.dispatchEvent(new CustomEvent('autospd-request-video-info', { detail: videoId }));
        document.removeEventListener('autospd-video-info', onInfo);
        return info?.videoId === videoId ? info : null;
    }

    function getVideoInfo(videoId) {
        const playerInfo = readPlayerInfo(videoId);
        if (playerInfo) {
            return {
                videoId,
                title: playerInfo.title,
                description: playerInfo.description,
                tags: playerInfo.tags,
                channelName: playerInfo.channelName,
                ytCategoryId: YT_CATEGORY_IDS[playerInfo.ytCategory] || null
            };
        }

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

    function isAdShowing() {
        return Boolean(document.querySelector('#movie_player.ad-showing, #shorts-player.ad-showing'));
    }

    function hasAppliedSpeed() {
        return (state.mode === 'auto' || state.mode === 'manual') && Number.isFinite(state.speed);
    }

    function enforceSpeed(video) {
        if (!hasAppliedSpeed() || state.videoId !== getVideoId() || isAdShowing()) return;
        if (video.playbackRate !== state.speed) video.playbackRate = state.speed;
    }

    function onRateChange(video) {
        if (!hasAppliedSpeed() || video.playbackRate === state.speed || isAdShowing()) return;
        if (Date.now() < resetWindowUntil) {
            enforceSpeed(video);
            return;
        }
        // Changed outside a source load: the user chose it in YouTube's menu or via shortcut
        state.speed = video.playbackRate;
        state.category = null;
        state.mode = 'manual';
    }

    function guardVideo(video) {
        if (guardedVideos.has(video)) return;
        guardedVideos.add(video);
        const onSourceLoad = () => {
            resetWindowUntil = Date.now() + RESET_WINDOW_MS;
            enforceSpeed(video);
        };
        video.addEventListener('loadedmetadata', onSourceLoad);
        video.addEventListener('loadeddata', onSourceLoad);
        video.addEventListener('playing', () => enforceSpeed(video));
        video.addEventListener('ratechange', () => onRateChange(video));
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

            guardVideo(activeVideo);
            state.category = result.category || null;
            state.speed = speed;
            state.mode = 'auto';
            if (!isAdShowing()) activeVideo.playbackRate = speed;

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

            guardVideo(video);
            state.videoId = getVideoId();
            state.title = getVideoInfo(state.videoId).title;
            state.category = null;
            state.speed = speed;
            state.mode = 'manual';
            video.playbackRate = speed;
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
