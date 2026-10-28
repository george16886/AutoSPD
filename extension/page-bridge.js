/**
 * AutoSPD - Page bridge
 * Runs in the page's main world so it can read YouTube's player response,
 * which the isolated content script cannot access. Replies synchronously
 * with a JSON string, since object details do not cross worlds reliably.
 */
(() => {
    'use strict';

    function getPlayerResponse() {
        const player = document.getElementById('movie_player');
        if (typeof player?.getPlayerResponse === 'function') {
            const response = player.getPlayerResponse();
            if (response) return response;
        }
        return window.ytInitialPlayerResponse || null;
    }

    document.addEventListener('autospd-request-video-info', () => {
        let info = null;
        try {
            const response = getPlayerResponse();
            const details = response?.videoDetails;
            if (details?.videoId) {
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
