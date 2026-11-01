/**
 * AutoSPD - YouTube's video categories
 * Shared by the background worker (importScripts), the content script
 * (manifest) and the settings page (<script>). `en` is the name the player
 * response reports in playerMicroformatRenderer.category, whatever the UI
 * language; translated names are the ytCategory<id> messages. `speed` is the default speed for videos in that category: used in
 * "YouTube category" mode, and in the other modes when no category matches.
 * These 15 are what uploaders can pick; anything else falls to the default speed.
 * Comedy, pets, sports and music keep 1x: timing and picture are the point.
 */
const YT_CATEGORIES = [
    { id: '1', en: 'Film & Animation', speed: 1.25 },
    { id: '2', en: 'Autos & Vehicles', speed: 1.25 },
    { id: '10', en: 'Music', speed: 1 },
    { id: '15', en: 'Pets & Animals', speed: 1 },
    { id: '17', en: 'Sports', speed: 1 },
    { id: '19', en: 'Travel & Events', speed: 1.25 },
    { id: '20', en: 'Gaming', speed: 1.25 },
    { id: '22', en: 'People & Blogs', speed: 1.25 },
    { id: '23', en: 'Comedy', speed: 1 },
    { id: '24', en: 'Entertainment', speed: 1.25 },
    { id: '25', en: 'News & Politics', speed: 1.5 },
    { id: '26', en: 'Howto & Style', speed: 1.25 },
    { id: '27', en: 'Education', speed: 1.25 },
    { id: '28', en: 'Science & Technology', speed: 1.25 },
    { id: '29', en: 'Nonprofits & Activism', speed: 1.25 }
];
