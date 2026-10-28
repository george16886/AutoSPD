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

    return function requestInfo(videoId) {
        let reply;
        listeners.set('autospd-video-info', event => { reply = JSON.parse(event.detail); });
        listeners.get('autospd-request-video-info')({ detail: videoId });
        return reply;
    };
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
