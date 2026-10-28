/**
 * AutoSPD - YouTube's video categories
 * Shared by the background worker (importScripts), the content script
 * (manifest) and the settings page (<script>). `en` is the name the player
 * response reports in playerMicroformatRenderer.category, whatever the UI
 * language. `speed` is the default speed in "YouTube category" mode.
 */
const YT_CATEGORIES = [
    { id: '1', en: 'Film & Animation', zh: '電影與動畫', speed: 1.25 },
    { id: '2', en: 'Autos & Vehicles', zh: '汽車', speed: 1.25 },
    { id: '10', en: 'Music', zh: '音樂', speed: 1 },
    { id: '15', en: 'Pets & Animals', zh: '寵物與動物', speed: 1.25 },
    { id: '17', en: 'Sports', zh: '體育', speed: 1 },
    { id: '19', en: 'Travel & Events', zh: '旅遊與活動', speed: 1.25 },
    { id: '20', en: 'Gaming', zh: '遊戲', speed: 1.25 },
    { id: '22', en: 'People & Blogs', zh: '人物與網誌', speed: 1.25 },
    { id: '23', en: 'Comedy', zh: '喜劇', speed: 1.25 },
    { id: '24', en: 'Entertainment', zh: '娛樂', speed: 1.25 },
    { id: '25', en: 'News & Politics', zh: '新聞與政治', speed: 1.5 },
    { id: '26', en: 'Howto & Style', zh: 'DIY 與生活百科', speed: 1.5 },
    { id: '27', en: 'Education', zh: '教育', speed: 1.25 },
    { id: '28', en: 'Science & Technology', zh: '科學與技術', speed: 1.25 },
    { id: '29', en: 'Nonprofits & Activism', zh: '非營利組織與行動主義', speed: 1.25 }
];
