/**
 * AutoSPD - Page bridge
 * Runs in the page's main world so it can read YouTube's player response,
 * which the isolated content script cannot access. Replies synchronously
 * with a JSON string, since object details do not cross worlds reliably.
 */
(() => {
    'use strict';

    // Watch pages use #movie_player and Shorts use #shorts-player; both can
    // exist at once after SPA navigation, so pick the one playing videoId
    const PLAYER_IDS = ['movie_player', 'shorts-player'];

    function findPlayer(videoId) {
        for (const id of PLAYER_IDS) {
            const player = document.getElementById(id);
            if (typeof player?.getPlayerResponse !== 'function') continue;
            const response = player.getPlayerResponse();
            if (response?.videoDetails?.videoId === videoId) return { player, response };
        }
        return null;
    }

    function getPlayerResponse(videoId) {
        const found = findPlayer(videoId);
        if (found) return found.response;
        const initial = window.ytInitialPlayerResponse;
        return initial?.videoDetails?.videoId === videoId ? initial : null;
    }

    // Setting video.playbackRate alone leaves YouTube's speed menu showing the
    // old rate, so go through the player API when it is available
    document.addEventListener('autospd-set-rate', event => {
        try {
            const { videoId, speed } = JSON.parse(event.detail);
            const player = findPlayer(videoId)?.player;
            if (typeof player?.setPlaybackRate === 'function') player.setPlaybackRate(speed);
        } catch (error) {
            console.error('[AutoSPD] Could not set player rate:', error);
        }
    });

    document.addEventListener('autospd-request-video-info', event => {
        let info = null;
        try {
            const videoId = typeof event.detail === 'string' ? event.detail : null;
            const response = videoId ? getPlayerResponse(videoId) : null;
            const details = response?.videoDetails;
            if (details) {
                info = {
                    videoId: details.videoId,
                    title: details.title || '',
                    description: details.shortDescription || '',
                    tags: Array.isArray(details.keywords) ? details.keywords : [],
                    channelName: details.author || '',
                    ytCategory: response.microformat?.playerMicroformatRenderer?.category || ''
                };
            }
        } catch (error) {
            console.error('[AutoSPD] Could not read player response:', error);
        }
        document.dispatchEvent(new CustomEvent('autospd-video-info', {
            detail: JSON.stringify(info)
        }));
    });
})();
