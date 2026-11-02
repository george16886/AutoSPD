/**
 * AutoSPD - AI classification with Chrome's built-in model (Prompt API)
 * Runs in the content script's isolated world, so YouTube's own scripts cannot
 * see the user's categories or use the model through the extension. Chinese is
 * not a declared language yet, but the model reads Chinese titles well and only
 * has to answer with a category ID.
 */
const AI_LANGUAGES = {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }]
};
const AI_TIMEOUT_MS = 20000;

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

async function promptAi(video, categories, signal) {
    if (typeof LanguageModel === 'undefined') return { error: 'unsupported' };
    const availability = await LanguageModel.availability(AI_LANGUAGES);
    // Downloading needs a user click, so that happens on the settings page
    if (availability !== 'available') return { error: availability };

    const session = await (await getAiBase(categories)).clone();
    try {
        const ids = [...categories.map(cat => cat.id), 'none'];
        const answer = await session.prompt(describeVideo(video), {
            signal,
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

/**
 * One prompt at a time. A prompt that never answers gives up after the timeout,
 * so it cannot hold up every later video. Requests for videos the viewer has
 * already left (stillWanted returns false) are skipped.
 */
function classifyWithAi(video, categories, { stillWanted = () => true, timeoutMs = AI_TIMEOUT_MS } = {}) {
    const run = async () => {
        if (!stillWanted()) return { error: 'stale' };
        const controller = new AbortController();
        let timer;
        const timedOut = new Promise(resolve => {
            timer = setTimeout(() => {
                controller.abort();
                // The model may be stuck: start from a new base session next time
                aiBase = null;
                resolve({ error: 'timeout' });
            }, timeoutMs);
        });
        try {
            return await Promise.race([promptAi(video, categories, controller.signal), timedOut]);
        } catch (error) {
            return { error: error?.message || String(error) };
        } finally {
            clearTimeout(timer);
        }
    };
    const result = aiQueue.then(run);
    aiQueue = result;
    return result;
}
