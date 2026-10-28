const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const bridgeSource = fs.readFileSync(
    path.join(__dirname, '..', 'page-bridge.js'),
    'utf8'
);

function playerFor(videoId, category) {
    return {
        rates: [],
        setPlaybackRate(rate) { this.rates.push(rate); },
        getPlayerResponse() {
            if (!videoId) return null;
            return {
                videoDetails: { videoId, title: `Title ${videoId}`, keywords: ['tag'], author: 'Channel' },
                microformat: { playerMicroformatRenderer: { category } }
            };
        }
    };
}

function createBridge({ players = {}, initialResponse = null } = {}) {
    const listeners = new Map();
    const document = {
        getElementById(id) { return players[id] || null; },
        addEventListener(name, listener) { listeners.set(name, listener); },
        dispatchEvent(event) { listeners.get(event.type)?.(event); }
    };
    const context = {
        document,
        window: { ytInitialPlayerResponse: initialResponse },
        console,
        CustomEvent: class {
            constructor(type, options = {}) {
                this.type = type;
                this.detail = options.detail;
            }
        }
    };
    vm.runInNewContext(bridgeSource, context);

    requestInfo.setRate = (videoId, speed) => {
        listeners.get('autospd-set-rate')({ detail: JSON.stringify({ videoId, speed }) });
    };
    return requestInfo;

    function requestInfo(videoId) {
        let reply;
        listeners.set('autospd-video-info', event => { reply = JSON.parse(event.detail); });
        listeners.get('autospd-request-video-info')({ detail: videoId });
        return reply;
    }
}

test('reads the Shorts player when the watch player is stale', () => {
    const requestInfo = createBridge({
        players: {
            movie_player: playerFor(undefined),
            'shorts-player': playerFor('short-1', 'People & Blogs')
        }
    });

    const info = requestInfo('short-1');

    assert.equal(info.videoId, 'short-1');
    assert.equal(info.ytCategory, 'People & Blogs');
});

test('picks the player whose response matches the requested video', () => {
    const requestInfo = createBridge({
        players: {
            movie_player: playerFor('watch-1', 'Music'),
            'shorts-player': playerFor('short-old', 'Comedy')
        }
    });

    assert.equal(requestInfo('watch-1').ytCategory, 'Music');
});

test('returns null when no player has the requested video', () => {
    const requestInfo = createBridge({
        players: { movie_player: playerFor('previous-video', 'Music') }
    });

    assert.equal(requestInfo('new-video'), null);
});

test('sets the speed through the player that is playing the video', () => {
    const watchPlayer = playerFor('watch-1', 'Music');
    const shortsPlayer = playerFor('short-old', 'Comedy');
    const requestInfo = createBridge({ players: { movie_player: watchPlayer, 'shorts-player': shortsPlayer } });

    requestInfo.setRate('watch-1', 1.5);

    assert.deepEqual(watchPlayer.rates, [1.5]);
    assert.deepEqual(shortsPlayer.rates, []);
});

function createAiBridge({ availability = 'available', answer = '{"category":"investigation"}' } = {}) {
    const listeners = new Map();
    const prompts = [];
    let systemPrompt = '';
    const session = {
        async clone() { return session; },
        async prompt(text, options) {
            prompts.push({ text, enum: options.responseConstraint.properties.category.enum });
            return answer;
        },
        destroy() {}
    };
    const context = {
        document: {
            getElementById() { return null; },
            addEventListener(name, listener) { listeners.set(name, listener); },
            dispatchEvent(event) { listeners.get(event.type)?.(event); }
        },
        window: {},
        console,
        LanguageModel: {
            async availability() { return availability; },
            async create(options) {
                systemPrompt = options.initialPrompts[0].content;
                return session;
            }
        },
        CustomEvent: class {
            constructor(type, options = {}) {
                this.type = type;
                this.detail = options.detail;
            }
        }
    };
    vm.runInNewContext(bridgeSource, context);

    return {
        prompts,
        get systemPrompt() { return systemPrompt; },
        classify(request) {
            return new Promise(resolve => {
                listeners.set('autospd-ai-result', event => resolve(JSON.parse(event.detail)));
                listeners.get('autospd-ai-classify')({ detail: JSON.stringify(request) });
            });
        }
    };
}

const aiRequest = {
    requestId: 7,
    video: { title: '滅門命案', channelName: 'Wayne調查', tags: ['命案'], description: '' },
    categories: [{ id: 'investigation', name: '案件 / 調查解說', keywords: ['命案', '調查'] }]
};

test('classifies with the model, offering only the given categories or none', async () => {
    const bridge = createAiBridge();

    const result = await bridge.classify(aiRequest);

    assert.deepEqual(result, { requestId: 7, categoryId: 'investigation' });
    assert.deepEqual([...bridge.prompts[0].enum], ['investigation', 'none']);
    assert.match(bridge.prompts[0].text, /Title: 滅門命案/);
    assert.match(bridge.systemPrompt, /investigation: 案件 \/ 調查解說 \(e\.g\. 命案, 調查\)/);
});

test('reports why the model cannot be used instead of starting a download', async () => {
    const bridge = createAiBridge({ availability: 'downloadable' });

    assert.deepEqual(await bridge.classify(aiRequest), { requestId: 7, error: 'downloadable' });
    assert.equal(bridge.prompts.length, 0);
});
