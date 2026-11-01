/**
 * AutoSPD - Default categories, by language
 * New installs get the names in the browser's language, and that language's
 * keywords plus the English ones. Only one language's keywords are stored:
 * chrome.storage.sync allows 8 KB per item, and all of them would not fit.
 */
const DEFAULT_CATEGORY_DATA = [
    {
        id: 'sports', emoji: '⚽', speed: 1.0, ytCategoryIds: ['17'],
        names: { en: 'Sports', zh_TW: '球賽 / 體育', zh_CN: '球赛 / 体育', ja: 'スポーツ', ko: '스포츠' },
        keywords: {
            en: ['NBA', 'MLB', 'NFL', 'sports', 'match', 'soccer', 'basketball', 'baseball'],
            zh_TW: ['足球', '籃球', '世界盃', '比賽', '賽事', '球賽'],
            zh_CN: ['足球', '篮球', '世界杯', '比赛', '赛事', '球赛'],
            ja: ['サッカー', 'バスケ', '野球', '試合', 'ワールドカップ'],
            ko: ['축구', '농구', '야구', '경기', '월드컵']
        }
    },
    {
        id: 'music', emoji: '🎵', speed: 1.0, ytCategoryIds: ['10'],
        names: { en: 'Music / MV', zh_TW: '音樂 / MV', zh_CN: '音乐 / MV', ja: '音楽 / MV', ko: '음악 / MV' },
        keywords: {
            en: ['MV', 'Music Video', 'concert', 'song', 'lyrics'],
            zh_TW: ['音樂', '演唱會', '歌曲'],
            zh_CN: ['音乐', '演唱会', '歌曲'],
            ja: ['音楽', 'ライブ映像', '歌詞', '歌ってみた'],
            ko: ['음악', '콘서트', '노래', '뮤직비디오']
        }
    },
    {
        id: 'science', emoji: '🔬', speed: 1.25, ytCategoryIds: ['28'],
        names: { en: 'Science', zh_TW: '科普知識', zh_CN: '科普知识', ja: '科学・教養', ko: '과학·상식' },
        keywords: {
            en: ['science', 'TED', 'physics', 'chemistry', 'astronomy'],
            zh_TW: ['科普', '科學', '知識', '物理', '化學', '冷知識'],
            zh_CN: ['科普', '科学', '知识', '物理', '化学', '冷知识'],
            ja: ['科学', '解説', '雑学', '物理', '化学'],
            ko: ['과학', '상식', '물리', '화학', '지식']
        }
    },
    {
        id: 'storytelling', emoji: '📖', speed: 1.5, ytCategoryIds: [],
        names: { en: 'Storytelling', zh_TW: '說故事', zh_CN: '讲故事', ja: 'ストーリー', ko: '이야기' },
        keywords: {
            en: ['story', 'storytime', 'audiobook'],
            zh_TW: ['說故事', '故事', '都市傳說', '說書'],
            zh_CN: ['讲故事', '故事', '都市传说', '说书'],
            ja: ['物語', '朗読', '都市伝説', '怖い話'],
            ko: ['이야기', '썰', '도시전설', '오디오북']
        }
    },
    {
        id: 'unboxing', emoji: '📦', speed: 1.5, ytCategoryIds: [],
        names: { en: 'Unboxing / Reviews', zh_TW: '開箱影片', zh_CN: '开箱视频', ja: '開封・レビュー', ko: '언박싱·리뷰' },
        keywords: {
            en: ['unboxing', 'review', 'hands-on'],
            zh_TW: ['開箱', '評測', '體驗', '3C'],
            zh_CN: ['开箱', '评测', '体验', '数码'],
            ja: ['開封', 'レビュー', '実機'],
            ko: ['언박싱', '리뷰', '개봉기']
        }
    },
    {
        id: 'gaming', emoji: '🎮', speed: 1.25, ytCategoryIds: ['20'],
        names: { en: 'Gaming', zh_TW: '遊戲實況', zh_CN: '游戏实况', ja: 'ゲーム実況', ko: '게임 방송' },
        keywords: {
            en: ['game', 'gaming', 'gameplay', 'walkthrough'],
            zh_TW: ['遊戲', '實況', '攻略'],
            zh_CN: ['游戏', '实况', '攻略'],
            ja: ['ゲーム', '実況', '攻略'],
            ko: ['게임', '공략', '플레이']
        }
    },
    {
        id: 'education', emoji: '📚', speed: 1.25, ytCategoryIds: ['27'],
        names: { en: 'Tutorials / Courses', zh_TW: '教學課程', zh_CN: '教学课程', ja: 'チュートリアル・講座', ko: '강의·튜토리얼' },
        keywords: {
            en: ['tutorial', 'course', 'how to', 'lesson'],
            zh_TW: ['教學', '課程', '學習'],
            zh_CN: ['教学', '课程', '学习', '教程'],
            ja: ['講座', '入門', '使い方', '勉強'],
            ko: ['강의', '강좌', '배우기', '튜토리얼']
        }
    },
    {
        id: 'cooking', emoji: '🍳', speed: 1.5, ytCategoryIds: [],
        names: { en: 'Cooking', zh_TW: '料理烹飪', zh_CN: '料理烹饪', ja: '料理', ko: '요리' },
        keywords: {
            en: ['cooking', 'recipe', 'baking'],
            zh_TW: ['料理', '烹飪', '食譜', '美食'],
            zh_CN: ['料理', '烹饪', '食谱', '美食'],
            ja: ['料理', 'レシピ', '作り方'],
            ko: ['요리', '레시피', '맛집']
        }
    },
    {
        id: 'fitness', emoji: '💪', speed: 1.0, ytCategoryIds: [],
        names: { en: 'Fitness', zh_TW: '健身運動', zh_CN: '健身运动', ja: 'フィットネス', ko: '운동·피트니스' },
        keywords: {
            en: ['workout', 'fitness', 'exercise', 'yoga'],
            zh_TW: ['健身', '運動', '瑜珈'],
            zh_CN: ['健身', '运动', '瑜伽'],
            ja: ['筋トレ', 'ヨガ', 'ダイエット'],
            ko: ['운동', '헬스', '요가', '홈트']
        }
    },
    {
        id: 'news', emoji: '📰', speed: 1.5, ytCategoryIds: ['25'],
        names: { en: 'News', zh_TW: '新聞時事', zh_CN: '新闻时事', ja: 'ニュース', ko: '뉴스' },
        keywords: {
            en: ['news', 'politics', 'economy'],
            zh_TW: ['新聞', '時事', '政治', '經濟', '國際'],
            zh_CN: ['新闻', '时事', '政治', '经济', '国际'],
            ja: ['ニュース', '政治', '経済', '国際'],
            ko: ['뉴스', '시사', '정치', '경제']
        }
    },
    {
        id: 'movie_review', emoji: '🎬', speed: 1.25, ytCategoryIds: ['1'],
        names: { en: 'Film commentary', zh_TW: '電影評論', zh_CN: '电影评论', ja: '映画解説', ko: '영화 리뷰' },
        keywords: {
            en: ['movie', 'film', 'trailer'],
            zh_TW: ['電影', '影評', '預告'],
            zh_CN: ['电影', '影评', '预告', '解说'],
            ja: ['映画', '予告', '考察'],
            ko: ['영화', '예고편', '결말']
        }
    },
    {
        id: 'travel', emoji: '✈️', speed: 1.25, ytCategoryIds: ['19'],
        names: { en: 'Travel / Vlogs', zh_TW: '旅遊 Vlog', zh_CN: '旅游 Vlog', ja: '旅行・Vlog', ko: '여행·브이로그' },
        keywords: {
            en: ['travel', 'vlog', 'trip'],
            zh_TW: ['旅遊', '旅行', '景點'],
            zh_CN: ['旅游', '旅行', '景点'],
            ja: ['旅行', '観光'],
            ko: ['여행', '브이로그', '관광']
        }
    },
    {
        id: 'investigation', emoji: '🔍', speed: 1.5, ytCategoryIds: [],
        names: { en: 'True crime / Investigations', zh_TW: '案件 / 調查解說', zh_CN: '案件 / 调查解说', ja: '事件・調査解説', ko: '사건·탐사' },
        keywords: {
            en: ['true crime', 'investigation', 'cold case'],
            zh_TW: ['調查', '案件', '命案', '懸案', '說案', '真實案件', '真相', '揭秘', '內幕'],
            zh_CN: ['调查', '案件', '命案', '悬案', '说案', '真实案件', '真相', '揭秘', '内幕'],
            ja: ['事件', '未解決', '真相', '調査'],
            ko: ['사건', '미제', '진실', '탐사']
        }
    }
];

/** Map a browser UI language (zh-TW, ja, en-GB, ...) to one of our languages */
function defaultCategoryLocale(uiLanguage) {
    const language = String(uiLanguage || '').toLowerCase().replace('_', '-');
    if (/^zh-(tw|hk|mo|hant)/.test(language)) return 'zh_TW';
    if (language.startsWith('zh')) return 'zh_CN';
    if (language.startsWith('ja')) return 'ja';
    if (language.startsWith('ko')) return 'ko';
    return 'en';
}

function buildDefaultCategories(uiLanguage) {
    const locale = defaultCategoryLocale(uiLanguage);
    return DEFAULT_CATEGORY_DATA.map(({ id, emoji, speed, ytCategoryIds, names, keywords }) => ({
        id,
        name: names[locale],
        emoji,
        speed,
        keywords: locale === 'en' ? [...keywords.en] : [...keywords[locale], ...keywords.en],
        ytCategoryIds: [...ytCategoryIds],
        enabled: true
    }));
}
