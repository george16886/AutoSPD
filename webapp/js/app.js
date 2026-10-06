/**
 * AutoSPD - Main Application Entry Point
 * Initializes all modules and orchestrates the application
 */

(function () {
    'use strict';

    // ==========================================
    // Application Bootstrap
    // ==========================================

    document.addEventListener('DOMContentLoaded', () => {
        // Initialize UI first (DOM bindings)
        UI.init();

        // Initialize Auth
        Auth.init();

        // Auth state change handler
        Auth.onAuthChange(async (user) => {
            if (user) {
                // User signed in
                await Store.init(user.uid);
                UI.showDashboard(user);
                UI.renderDashboard();

                // Notify Chrome Extension of auth
                notifyExtension('auth', {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email
                });
            } else {
                // User signed out - init with local data for demo
                await Store.init(null);
                UI.showLanding();
            }

            // Hide loading screen
            setTimeout(() => UI.hideLoading(), 300);
        });

        // Listen for data changes
        Store.on('categoriesChanged', (categories) => {
            const analytics = Store.getAnalytics(30);
            UI.renderCategoriesGrid(categories);
            UI.renderStats(categories, analytics);

            // Build and show overview
            const enabledCats = categories.filter(c => c.enabled).slice(0, 8);
            const overviewEl = document.getElementById('category-list-overview');
            if (overviewEl) {
                overviewEl.innerHTML = enabledCats.map(cat => `
                    <div class="category-overview-item">
                        <div class="category-overview-emoji">${cat.emoji}</div>
                        <span class="category-overview-name">${cat.name}</span>
                        <span class="category-overview-speed">${cat.speed}x</span>
                    </div>
                `).join('');
            }

            // Notify extension
            notifyExtension('categories', categories);
        });

        Store.on('historyChanged', (history) => {
            UI.renderHistoryList(history);
            UI.renderHistoryOverview(history);

            const categories = Store.getCategories();
            const analytics = Store.getAnalytics(30);
            UI.renderStats(categories, analytics);
        });

        Store.on('settingsChanged', () => {
            UI.renderSettings();
            notifyExtension('settings', Store.getSettings());
        });

        // Check for extension connection
        checkExtensionConnection();

        // Handle messages from Chrome Extension
        window.addEventListener('message', handleExtensionMessage);

        // Initialize demo mode if not signed in after a delay
        setTimeout(() => {
            if (!Auth.isSignedIn()) {
                Store.init(null);
                UI.hideLoading();
            }
        }, 2000);
    });

    // ==========================================
    // Chrome Extension Communication
    // ==========================================

    /**
     * Notify Chrome Extension of data changes
     */
    function notifyExtension(type, data) {
        try {
            window.postMessage({
                source: 'autospd-webapp',
                type,
                data
            }, '*');
        } catch (e) {
            // Extension not available
        }
    }

    /**
     * Handle messages from Chrome Extension
     */
    function handleExtensionMessage(event) {
        if (event.data?.source !== 'autospd-extension') return;

        const { type, data } = event.data;

        switch (type) {
            case 'extension-connected':
                updateExtensionStatus(true);
                break;

            case 'video-detected':
                // Extension detected a YouTube video
                handleVideoDetected(data);
                break;

            case 'speed-applied':
                // Extension applied a speed
                if (Store.getSettings().recordHistory) {
                    Store.addHistoryEntry({
                        title: data.title,
                        category: data.categoryId,
                        speed: data.speed,
                        thumb: data.thumbnail,
                        videoId: data.videoId
                    });
                }
                break;

            case 'request-categories':
                notifyExtension('categories', Store.getCategories());
                notifyExtension('settings', Store.getSettings());
                break;
        }
    }

    /**
     * Handle video detection from extension
     */
    function handleVideoDetected(videoData) {
        const categories = Store.getCategories();
        const settings = Store.getSettings();

        if (!settings.autoSpeed) return;

        // Match video to category
        let matchedCategory = null;
        let bestScore = 0;

        categories.filter(c => c.enabled).forEach(cat => {
            let score = 0;

            // Check YouTube category ID match
            if (videoData.ytCategoryId && cat.ytCategoryIds?.includes(videoData.ytCategoryId)) {
                score += 10;
            }

            // Check keyword matches in title and tags
            const searchText = (videoData.title + ' ' + (videoData.tags || []).join(' ')).toLowerCase();
            (cat.keywords || []).forEach(keyword => {
                if (searchText.includes(keyword.toLowerCase())) {
                    score += 3;
                }
            });

            if (score > bestScore) {
                bestScore = score;
                matchedCategory = cat;
            }
        });

        const speed = matchedCategory ? matchedCategory.speed : settings.defaultSpeed;

        // Send speed back to extension
        notifyExtension('set-speed', {
            speed,
            categoryId: matchedCategory?.id || 'default',
            categoryName: matchedCategory?.name || '未分類'
        });
    }

    /**
     * Check if extension is connected
     */
    function checkExtensionConnection() {
        notifyExtension('ping', {});

        // If no response within 2 seconds, mark as disconnected
        setTimeout(() => {
            const statusEl = document.getElementById('extension-status');
            if (statusEl && !statusEl.querySelector('.connected')) {
                updateExtensionStatus(false);
            }
        }, 2000);
    }

    /**
     * Update extension status display
     */
    function updateExtensionStatus(connected) {
        const statusEl = document.getElementById('extension-status');
        if (statusEl) {
            statusEl.innerHTML = `
                <span class="status-dot ${connected ? 'connected' : 'disconnected'}"></span>
                <span>${connected ? '已連線' : '未連線'}</span>
            `;
        }
    }

    // ==========================================
    // Smooth Scroll for Anchor Links
    // ==========================================

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (link) {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

})();
