/**
 * AutoSPD - Data Store Module
 * Handles Firestore data operations for categories, history, settings
 */

const Store = (() => {
    // Local cache
    let categories = [];
    let history = [];
    let settings = { ...DEFAULT_SETTINGS };
    let listeners = {};

    /**
     * Initialize store - load user data or set defaults
     */
    async function init(userId) {
        if (!userId) {
            // Use localStorage as fallback for demo
            loadFromLocalStorage();
            return;
        }

        try {
            await Promise.all([
                loadCategories(userId),
                loadSettings(userId),
                loadHistory(userId)
            ]);
        } catch (error) {
            console.error('Store init error:', error);
            // Fallback to local storage
            loadFromLocalStorage();
        }
    }

    /**
     * Load from localStorage (demo/offline mode)
     */
    function loadFromLocalStorage() {
        const savedCategories = localStorage.getItem('autospd_categories');
        const savedSettings = localStorage.getItem('autospd_settings');
        const savedHistory = localStorage.getItem('autospd_history');

        categories = savedCategories ? JSON.parse(savedCategories) : [...DEFAULT_CATEGORIES];
        settings = savedSettings ? JSON.parse(savedSettings) : { ...DEFAULT_SETTINGS };
        history = savedHistory ? JSON.parse(savedHistory) : generateDemoHistory();

        emit('categoriesChanged', categories);
        emit('settingsChanged', settings);
        emit('historyChanged', history);
    }

    /**
     * Save to localStorage
     */
    function saveToLocalStorage() {
        localStorage.setItem('autospd_categories', JSON.stringify(categories));
        localStorage.setItem('autospd_settings', JSON.stringify(settings));
        localStorage.setItem('autospd_history', JSON.stringify(history));
    }

    /**
     * Generate demo history data
     */
    function generateDemoHistory() {
        const demoVideos = [
            { title: 'NBA 精華：湖人 vs 勇士 2026 季後賽第三場', category: 'sports', speed: 1.0, thumb: '', date: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
            { title: '周杰倫《最偉大的作品》Official MV', category: 'music', speed: 1.0, thumb: '', date: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
            { title: '為什麼宇宙是平的？量子重力的秘密', category: 'science', speed: 1.25, thumb: '', date: new Date(Date.now() - 1000 * 60 * 240).toISOString() },
            { title: 'iPhone 18 Pro Max 完整開箱評測', category: 'unboxing', speed: 1.5, thumb: '', date: new Date(Date.now() - 1000 * 60 * 360).toISOString() },
            { title: '日本京都5天4夜自由行攻略', category: 'travel', speed: 1.25, thumb: '', date: new Date(Date.now() - 1000 * 60 * 480).toISOString() },
            { title: '30分鐘燃脂HIIT全身運動', category: 'fitness', speed: 1.0, thumb: '', date: new Date(Date.now() - 1000 * 60 * 600).toISOString() },
            { title: 'Python 機器學習入門教學 EP.1', category: 'education', speed: 1.25, thumb: '', date: new Date(Date.now() - 1000 * 60 * 720).toISOString() },
            { title: '一鍋到底！超簡單番茄牛肉燉飯', category: 'cooking', speed: 1.5, thumb: '', date: new Date(Date.now() - 1000 * 60 * 840).toISOString() },
        ];
        return demoVideos;
    }

    // ==========================================
    // Categories CRUD
    // ==========================================

    /**
     * Load categories from Firestore
     */
    async function loadCategories(userId) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists && doc.data().categories) {
                categories = doc.data().categories;
            } else {
                categories = [...DEFAULT_CATEGORIES];
                await saveCategories(userId);
            }
            emit('categoriesChanged', categories);
        } catch (error) {
            console.error('Load categories error:', error);
            categories = [...DEFAULT_CATEGORIES];
            emit('categoriesChanged', categories);
        }
    }

    /**
     * Save categories to Firestore
     */
    async function saveCategories(userId) {
        try {
            if (userId) {
                await db.collection('users').doc(userId).set(
                    { categories, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
                    { merge: true }
                );
            }
            saveToLocalStorage();
        } catch (error) {
            console.error('Save categories error:', error);
            saveToLocalStorage();
        }
    }

    /**
     * Get all categories
     */
    function getCategories() {
        return [...categories];
    }

    /**
     * Get category by ID
     */
    function getCategoryById(id) {
        return categories.find(c => c.id === id);
    }

    /**
     * Add a new category
     */
    async function addCategory(category) {
        const newCategory = {
            id: 'cat_' + Date.now(),
            enabled: true,
            order: categories.length,
            ...category
        };
        categories.push(newCategory);
        const userId = Auth.getUser()?.uid;
        await saveCategories(userId);
        emit('categoriesChanged', categories);
        return newCategory;
    }

    /**
     * Update a category
     */
    async function updateCategory(id, updates) {
        const index = categories.findIndex(c => c.id === id);
        if (index !== -1) {
            categories[index] = { ...categories[index], ...updates };
            const userId = Auth.getUser()?.uid;
            await saveCategories(userId);
            emit('categoriesChanged', categories);
        }
    }

    /**
     * Delete a category
     */
    async function deleteCategory(id) {
        categories = categories.filter(c => c.id !== id);
        const userId = Auth.getUser()?.uid;
        await saveCategories(userId);
        emit('categoriesChanged', categories);
    }

    /**
     * Reset categories to defaults
     */
    async function resetCategories() {
        categories = [...DEFAULT_CATEGORIES];
        const userId = Auth.getUser()?.uid;
        await saveCategories(userId);
        emit('categoriesChanged', categories);
    }

    // ==========================================
    // Settings
    // ==========================================

    /**
     * Load settings from Firestore
     */
    async function loadSettings(userId) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists && doc.data().settings) {
                settings = { ...DEFAULT_SETTINGS, ...doc.data().settings };
            } else {
                settings = { ...DEFAULT_SETTINGS };
            }
            emit('settingsChanged', settings);
        } catch (error) {
            console.error('Load settings error:', error);
            settings = { ...DEFAULT_SETTINGS };
            emit('settingsChanged', settings);
        }
    }

    /**
     * Save settings
     */
    async function saveSettings(newSettings) {
        settings = { ...settings, ...newSettings };
        try {
            const userId = Auth.getUser()?.uid;
            if (userId) {
                await db.collection('users').doc(userId).set(
                    { settings, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
                    { merge: true }
                );
            }
            saveToLocalStorage();
            emit('settingsChanged', settings);
        } catch (error) {
            console.error('Save settings error:', error);
            saveToLocalStorage();
        }
    }

    /**
     * Get settings
     */
    function getSettings() {
        return { ...settings };
    }

    // ==========================================
    // History
    // ==========================================

    /**
     * Load history from Firestore
     */
    async function loadHistory(userId) {
        try {
            const snapshot = await db.collection('users').doc(userId)
                .collection('history')
                .orderBy('date', 'desc')
                .limit(100)
                .get();

            if (!snapshot.empty) {
                history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } else {
                history = generateDemoHistory();
            }
            emit('historyChanged', history);
        } catch (error) {
            console.error('Load history error:', error);
            history = generateDemoHistory();
            emit('historyChanged', history);
        }
    }

    /**
     * Add history entry
     */
    async function addHistoryEntry(entry) {
        const newEntry = {
            ...entry,
            date: new Date().toISOString()
        };
        history.unshift(newEntry);
        if (history.length > 200) history = history.slice(0, 200);

        try {
            const userId = Auth.getUser()?.uid;
            if (userId) {
                await db.collection('users').doc(userId)
                    .collection('history')
                    .add(newEntry);
            }
            saveToLocalStorage();
            emit('historyChanged', history);
        } catch (error) {
            console.error('Add history error:', error);
            saveToLocalStorage();
        }
    }

    /**
     * Get history
     */
    function getHistory() {
        return [...history];
    }

    /**
     * Clear history
     */
    async function clearHistory() {
        history = [];
        try {
            const userId = Auth.getUser()?.uid;
            if (userId) {
                // Delete history collection in Firestore
                const snapshot = await db.collection('users').doc(userId)
                    .collection('history').get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            saveToLocalStorage();
            emit('historyChanged', history);
        } catch (error) {
            console.error('Clear history error:', error);
            saveToLocalStorage();
        }
    }

    /**
     * Search history
     */
    function searchHistory(query) {
        if (!query) return [...history];
        const q = query.toLowerCase();
        return history.filter(h =>
            h.title.toLowerCase().includes(q) ||
            h.category.toLowerCase().includes(q)
        );
    }

    // ==========================================
    // Analytics Helpers
    // ==========================================

    /**
     * Get analytics data
     */
    function getAnalytics(periodDays = 30) {
        const now = Date.now();
        const periodMs = periodDays === 'all' ? Infinity : periodDays * 24 * 60 * 60 * 1000;
        const filtered = history.filter(h => {
            const diff = now - new Date(h.date).getTime();
            return diff <= periodMs;
        });

        // Category distribution
        const categoryDistribution = {};
        filtered.forEach(h => {
            categoryDistribution[h.category] = (categoryDistribution[h.category] || 0) + 1;
        });

        // Speed distribution
        const speedDistribution = {};
        filtered.forEach(h => {
            const speedKey = h.speed + 'x';
            speedDistribution[speedKey] = (speedDistribution[speedKey] || 0) + 1;
        });

        // Daily watch counts
        const dailyCounts = {};
        filtered.forEach(h => {
            const day = new Date(h.date).toISOString().slice(0, 10);
            dailyCounts[day] = (dailyCounts[day] || 0) + 1;
        });

        // Time saved estimate (assuming average video is 10 minutes)
        const avgVideoMinutes = 10;
        let timeSaved = 0;
        filtered.forEach(h => {
            if (h.speed > 1) {
                timeSaved += avgVideoMinutes * (1 - 1 / h.speed);
            }
        });

        return {
            totalWatched: filtered.length,
            categoryDistribution,
            speedDistribution,
            dailyCounts,
            timeSavedMinutes: Math.round(timeSaved),
            avgSpeed: filtered.length > 0
                ? (filtered.reduce((sum, h) => sum + h.speed, 0) / filtered.length).toFixed(2)
                : '1.00'
        };
    }

    /**
     * Export all data
     */
    function exportData() {
        return {
            categories,
            settings,
            history,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Delete all user data
     */
    async function deleteAllData() {
        categories = [...DEFAULT_CATEGORIES];
        settings = { ...DEFAULT_SETTINGS };
        history = [];

        try {
            const userId = Auth.getUser()?.uid;
            if (userId) {
                await db.collection('users').doc(userId).delete();
            }
            localStorage.removeItem('autospd_categories');
            localStorage.removeItem('autospd_settings');
            localStorage.removeItem('autospd_history');
        } catch (error) {
            console.error('Delete data error:', error);
        }

        emit('categoriesChanged', categories);
        emit('settingsChanged', settings);
        emit('historyChanged', history);
    }

    // ==========================================
    // Event System
    // ==========================================

    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
    }

    function off(event, callback) {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(cb => cb !== callback);
    }

    function emit(event, data) {
        if (!listeners[event]) return;
        listeners[event].forEach(cb => cb(data));
    }

    return {
        init,
        getCategories,
        getCategoryById,
        addCategory,
        updateCategory,
        deleteCategory,
        resetCategories,
        getSettings,
        saveSettings,
        getHistory,
        addHistoryEntry,
        clearHistory,
        searchHistory,
        getAnalytics,
        exportData,
        deleteAllData,
        on,
        off
    };
})();
