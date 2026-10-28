/**
 * AutoSPD - Firebase Configuration
 * 
 * IMPORTANT: Replace with your own Firebase config before deploying.
 * Get your config from: https://console.firebase.google.com
 * 
 * Steps:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Google Sign-In under Authentication > Sign-in method
 * 3. Enable Cloud Firestore
 * 4. Copy the config values below
 */

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Default categories with their speed settings
const DEFAULT_CATEGORIES = [
    {
        id: 'sports',
        name: '球賽 / 體育',
        emoji: '⚽',
        speed: 1.0,
        keywords: ['足球', '籃球', 'NBA', 'MLB', '世界盃', '比賽', '賽事', '球賽', 'World Cup', 'Premier League', '中華職棒', 'sports', 'match'],
        ytCategoryIds: ['17'],
        enabled: true,
        order: 0
    },
    {
        id: 'music',
        name: '音樂 / MV',
        emoji: '🎵',
        speed: 1.0,
        keywords: ['MV', '音樂', 'Music Video', '演唱會', 'concert', 'live performance', '歌曲', 'song', 'lyrics', '歌詞'],
        ytCategoryIds: ['10'],
        enabled: true,
        order: 1
    },
    {
        id: 'science',
        name: '科普知識',
        emoji: '🔬',
        speed: 1.25,
        keywords: ['科普', '科學', 'science', '知識', '物理', '化學', '生物', '天文', '數學', 'TED', 'TED-Ed', '冷知識', 'facts'],
        ytCategoryIds: ['28'],
        enabled: true,
        order: 2
    },
    {
        id: 'storytelling',
        name: '說故事',
        emoji: '📖',
        speed: 1.5,
        keywords: ['說故事', '故事', 'story', 'storytime', '都市傳說', '鬼故事', '童話', '寓言', '說書'],
        ytCategoryIds: [],
        enabled: true,
        order: 3
    },
    {
        id: 'unboxing',
        name: '開箱影片',
        emoji: '📦',
        speed: 1.5,
        keywords: ['開箱', 'unboxing', 'review', '評測', '體驗', '試用', '手機開箱', '筆電開箱', '3C'],
        ytCategoryIds: [],
        enabled: true,
        order: 4
    },
    {
        id: 'gaming',
        name: '遊戲實況',
        emoji: '🎮',
        speed: 1.25,
        keywords: ['遊戲', 'game', 'gaming', '實況', 'gameplay', 'let\'s play', 'walkthrough', '攻略'],
        ytCategoryIds: ['20'],
        enabled: true,
        order: 5
    },
    {
        id: 'education',
        name: '教學課程',
        emoji: '📚',
        speed: 1.25,
        keywords: ['教學', 'tutorial', '課程', 'course', '教程', '學習', 'how to', '入門', '進階', 'programming'],
        ytCategoryIds: ['27'],
        enabled: true,
        order: 6
    },
    {
        id: 'cooking',
        name: '料理烹飪',
        emoji: '🍳',
        speed: 1.5,
        keywords: ['料理', '烹飪', 'cooking', 'recipe', '食譜', '美食', '下廚', '做菜', 'baking'],
        ytCategoryIds: [],
        enabled: true,
        order: 7
    },
    {
        id: 'fitness',
        name: '健身運動',
        emoji: '💪',
        speed: 1.0,
        keywords: ['健身', '運動', 'workout', 'fitness', 'exercise', '瑜珈', 'yoga', '有氧', 'HIIT'],
        ytCategoryIds: [],
        enabled: true,
        order: 8
    },
    {
        id: 'news',
        name: '新聞時事',
        emoji: '📰',
        speed: 1.5,
        keywords: ['新聞', 'news', '時事', '政治', '經濟', '國際', '報導', '分析', 'analysis'],
        ytCategoryIds: ['25'],
        enabled: true,
        order: 9
    },
    {
        id: 'movie_review',
        name: '電影評論',
        emoji: '🎬',
        speed: 1.25,
        keywords: ['電影', 'movie', 'film', '影評', '推薦', '預告', 'trailer', '觀後感'],
        ytCategoryIds: ['1'],
        enabled: true,
        order: 10
    },
    {
        id: 'travel',
        name: '旅遊 Vlog',
        emoji: '✈️',
        speed: 1.25,
        keywords: ['旅遊', 'travel', 'vlog', '旅行', '景點', '自由行', '出國', 'trip'],
        ytCategoryIds: ['19'],
        enabled: true,
        order: 11
    }
];

// App Settings Defaults
const DEFAULT_SETTINGS = {
    autoSpeed: true,
    notifications: true,
    recordHistory: true,
    defaultSpeed: 1.0,
    extensionConnected: false
};
