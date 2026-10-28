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

    // --- AI classification with Chrome's built-in model (Prompt API) ---
    // Runs here because the API is exposed to the page's window. Chinese is
    // not a declared language yet, but the model reads Chinese titles well
    // and only has to answer with a category ID.
    const AI_LANGUAGES = {
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }]
    };
    let aiBase = null; // { key, session } built from the current categories
    let aiQueue = Promise.resolve();

    function aiSystemPrompt(categories) {
        const lines = categories.map(cat => {
            const hints = (cat.keywords || []).slice(0, 8).join(', ');
            return `- ${cat.id}: ${cat.name}${hints ? ` (e.g. ${hints})` : ''}`;
        });
        return 'Classify a YouTube video by its actual subject. Titles are often sensational; '
            + 'judge the topic, not the tone. Pick the best fitting category ID, or "none" if '
            + `nothing fits.\nCategories:\n${lines.join('\n')}`;
    }

    function describeVideo(video) {
        return [
            `Title: ${video.title || ''}`,
            `Channel: ${video.channelName || ''}`,
            `Tags: ${(video.tags || []).slice(0, 15).join(', ')}`,
            `Description: ${String(video.description || '').slice(0, 300)}`
        ].join('\n');
    }

    async function getAiBase(categories) {
        const key = JSON.stringify(categories);
        if (aiBase?.key === key) return aiBase.session;
        aiBase?.session.destroy();
        aiBase = null;
        const session = await LanguageModel.create({
            ...AI_LANGUAGES,
            initialPrompts: [{ role: 'system', content: aiSystemPrompt(categories) }]
        });
        aiBase = { key, session };
        return session;
    }

    async function classifyWithAi({ video, categories }) {
        if (typeof LanguageModel === 'undefined') return { error: 'unsupported' };
        const availability = await LanguageModel.availability(AI_LANGUAGES);
        // Downloading needs a user click, so that happens on the settings page
        if (availability !== 'available') return { error: availability };

        const session = await (await getAiBase(categories)).clone();
        try {
            const ids = [...categories.map(cat => cat.id), 'none'];
            const answer = await session.prompt(describeVideo(video), {
                responseConstraint: {
                    type: 'object',
                    properties: { category: { type: 'string', enum: ids } },
                    required: ['category']
                }
            });
            return { categoryId: JSON.parse(answer).category };
        } finally {
            session.destroy();
        }
    }

    // One prompt at a time; the content script drops answers for stale videos
    document.addEventListener('autospd-ai-classify', event => {
        let request;
        try {
            request = JSON.parse(event.detail);
        } catch {
            return;
        }
        aiQueue = aiQueue
            .then(() => classifyWithAi(request))
            .catch(error => ({ error: error?.message || String(error) }))
            .then(result => {
                document.dispatchEvent(new CustomEvent('autospd-ai-result', {
                    detail: JSON.stringify({ requestId: request.requestId, ...result })
                }));
            });
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
                    ytCategory: response.microformat?.playerMicroformatRenderer?.category || '',
                    // Live right now; finished streams (replays) are false
                    isLive: details.isLive === true
                        || response.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow === true,
                    // Streamed live at some point: true for both live streams and their replays
                    isLiveContent: details.isLiveContent === true
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
