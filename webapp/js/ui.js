/**
 * AutoSPD - UI Module
 * Handles all DOM manipulation, rendering, and user interactions
 */

const UI = (() => {
    // DOM element references
    let elements = {};
    let editingCategoryId = null;

    /**
     * Initialize UI - cache DOM elements
     */
    function init() {
        cacheElements();
        bindEvents();
        initScrollAnimations();
        initNavScroll();
        initCountUp();
    }

    /**
     * Cache frequently accessed DOM elements
     */
    function cacheElements() {
        elements = {
            // Screens
            loadingScreen: document.getElementById('loading-screen'),
            landingPage: document.getElementById('landing-page'),
            dashboardPage: document.getElementById('dashboard-page'),

            // Nav
            mainNav: document.getElementById('main-nav'),
            navLinks: document.getElementById('nav-links'),
            loginBtn: document.getElementById('login-btn'),
            heroLoginBtn: document.getElementById('hero-login-btn'),
            ctaLoginBtn: document.getElementById('cta-login-btn'),
            userMenu: document.getElementById('user-menu'),
            userMenuBtn: document.getElementById('user-menu-btn'),
            userDropdown: document.getElementById('user-dropdown'),
            userAvatar: document.getElementById('user-avatar'),
            userName: document.getElementById('user-name'),
            signOutBtn: document.getElementById('sign-out-btn'),
            goDashboard: document.getElementById('go-dashboard'),
            goSettings: document.getElementById('go-settings'),
            mobileMenuBtn: document.getElementById('mobile-menu-btn'),

            // Sidebar
            sidebar: document.getElementById('sidebar'),
            sidebarUserAvatar: document.getElementById('sidebar-user-avatar'),
            sidebarUserName: document.getElementById('sidebar-user-name'),
            sidebarUserEmail: document.getElementById('sidebar-user-email'),

            // Dashboard panels
            dashboardContent: document.getElementById('dashboard-content'),
            welcomeName: document.getElementById('welcome-name'),

            // Stats
            statCategories: document.getElementById('stat-categories'),
            statWatched: document.getElementById('stat-watched'),
            statTimeSaved: document.getElementById('stat-time-saved'),
            statAvgSpeed: document.getElementById('stat-avg-speed'),

            // Overview
            categoryListOverview: document.getElementById('category-list-overview'),
            historyListOverview: document.getElementById('history-list-overview'),
            quickAddBtn: document.getElementById('quick-add-btn'),

            // Categories panel
            categoriesGrid: document.getElementById('categories-grid'),
            addCategoryBtn: document.getElementById('add-category-btn'),
            resetDefaultsBtn: document.getElementById('reset-defaults-btn'),
            autoSpeedToggle: document.getElementById('auto-speed-toggle'),

            // History panel
            historyList: document.getElementById('history-list'),
            historySearch: document.getElementById('history-search'),
            clearHistoryBtn: document.getElementById('clear-history-btn'),

            // Analytics
            analyticsPeriod: document.getElementById('analytics-period'),

            // Settings
            settingAutoSpeed: document.getElementById('setting-auto-speed'),
            settingNotifications: document.getElementById('setting-notifications'),
            settingHistory: document.getElementById('setting-history'),
            exportDataBtn: document.getElementById('export-data-btn'),
            deleteDataBtn: document.getElementById('delete-data-btn'),
            downloadExtensionBtn: document.getElementById('download-extension-btn'),

            // Modal
            categoryModal: document.getElementById('category-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalClose: document.getElementById('modal-close'),
            modalCancel: document.getElementById('modal-cancel'),
            modalSave: document.getElementById('modal-save'),
            categoryNameInput: document.getElementById('category-name-input'),
            emojiPicker: document.getElementById('emoji-picker'),
            speedSlider: document.getElementById('speed-slider'),
            speedDisplay: document.getElementById('speed-display'),
            categoryKeywords: document.getElementById('category-keywords'),
            categoryYtIds: document.getElementById('category-yt-ids'),

            // Toast
            toastContainer: document.getElementById('toast-container')
        };
    }

    /**
     * Bind event listeners
     */
    function bindEvents() {
        // Login buttons
        elements.loginBtn?.addEventListener('click', () => Auth.signInWithGoogle());
        elements.heroLoginBtn?.addEventListener('click', () => Auth.signInWithGoogle());
        elements.ctaLoginBtn?.addEventListener('click', () => Auth.signInWithGoogle());

        // User menu
        elements.userMenuBtn?.addEventListener('click', toggleUserMenu);
        elements.signOutBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.signOut();
        });

        // Dashboard navigation
        elements.goDashboard?.addEventListener('click', (e) => {
            e.preventDefault();
            switchPanel('overview');
            closeUserMenu();
        });

        elements.goSettings?.addEventListener('click', (e) => {
            e.preventDefault();
            switchPanel('settings-panel');
            closeUserMenu();
        });

        // Sidebar navigation
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const panel = link.dataset.panel;
                switchPanel(panel);
            });
        });

        // View all links
        document.querySelectorAll('.view-all-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const panel = link.dataset.panel;
                switchPanel(panel);
            });
        });

        // Mobile menu
        elements.mobileMenuBtn?.addEventListener('click', toggleMobileMenu);

        // Category actions
        elements.addCategoryBtn?.addEventListener('click', () => openCategoryModal());
        elements.quickAddBtn?.addEventListener('click', () => openCategoryModal());
        elements.resetDefaultsBtn?.addEventListener('click', handleResetDefaults);

        // Auto speed toggle
        elements.autoSpeedToggle?.addEventListener('change', (e) => {
            Store.saveSettings({ autoSpeed: e.target.checked });
            showToast(e.target.checked ? '自動速度調整已啟用' : '自動速度調整已停用', 'info');
        });

        // Modal
        elements.modalClose?.addEventListener('click', closeCategoryModal);
        elements.modalCancel?.addEventListener('click', closeCategoryModal);
        elements.modalSave?.addEventListener('click', handleSaveCategory);
        elements.categoryModal?.addEventListener('click', (e) => {
            if (e.target === elements.categoryModal) closeCategoryModal();
        });

        // Speed slider
        elements.speedSlider?.addEventListener('input', (e) => {
            elements.speedDisplay.textContent = parseFloat(e.target.value).toFixed(2) + 'x';
        });

        // Emoji picker
        elements.emojiPicker?.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                elements.emojiPicker.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        // History search
        elements.historySearch?.addEventListener('input', (e) => {
            const results = Store.searchHistory(e.target.value);
            renderHistoryList(results);
        });

        // Clear history
        elements.clearHistoryBtn?.addEventListener('click', async () => {
            if (confirm('確定要清除所有觀看紀錄嗎？此操作無法復原。')) {
                await Store.clearHistory();
                showToast('觀看紀錄已清除', 'success');
            }
        });

        // Analytics period filter
        elements.analyticsPeriod?.addEventListener('change', () => {
            updateAnalytics();
        });

        // Settings toggles
        elements.settingAutoSpeed?.addEventListener('change', (e) => {
            Store.saveSettings({ autoSpeed: e.target.checked });
            elements.autoSpeedToggle.checked = e.target.checked;
        });

        elements.settingNotifications?.addEventListener('change', (e) => {
            Store.saveSettings({ notifications: e.target.checked });
        });

        elements.settingHistory?.addEventListener('change', (e) => {
            Store.saveSettings({ recordHistory: e.target.checked });
        });

        // Default speed buttons
        document.querySelectorAll('.speed-selector .speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.speed-selector .speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Store.saveSettings({ defaultSpeed: parseFloat(btn.dataset.speed) });
                showToast(`預設速度已更新為 ${btn.dataset.speed}x`, 'success');
            });
        });

        // Export data
        elements.exportDataBtn?.addEventListener('click', handleExportData);

        // Delete data
        elements.deleteDataBtn?.addEventListener('click', handleDeleteData);

        // Download extension
        elements.downloadExtensionBtn?.addEventListener('click', () => {
            showToast('即將開放下載，敬請期待！', 'info');
        });

        // Close user menu on outside click
        document.addEventListener('click', (e) => {
            if (elements.userMenu && !elements.userMenu.contains(e.target)) {
                closeUserMenu();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeCategoryModal();
                closeUserMenu();
            }
        });
    }

    // ==========================================
    // Navigation & Menu
    // ==========================================

    function toggleUserMenu() {
        elements.userMenu.classList.toggle('open');
    }

    function closeUserMenu() {
        elements.userMenu?.classList.remove('open');
    }

    function toggleMobileMenu() {
        elements.sidebar?.classList.toggle('open');
    }

    function initNavScroll() {
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            if (scrollY > 50) {
                elements.mainNav.classList.add('scrolled');
            } else {
                elements.mainNav.classList.remove('scrolled');
            }
            lastScroll = scrollY;
        });
    }

    // ==========================================
    // Page Switching
    // ==========================================

    /**
     * Show landing page
     */
    function showLanding() {
        elements.landingPage.classList.remove('hidden');
        elements.dashboardPage.classList.add('hidden');
        elements.loginBtn.classList.remove('hidden');
        elements.userMenu.classList.add('hidden');
        elements.navLinks.classList.remove('hidden');
    }

    /**
     * Show dashboard
     */
    function showDashboard(user) {
        elements.landingPage.classList.add('hidden');
        elements.dashboardPage.classList.remove('hidden');
        elements.loginBtn.classList.add('hidden');
        elements.userMenu.classList.remove('hidden');
        elements.navLinks.classList.add('hidden');

        // Update user info
        if (user) {
            const photoURL = user.photoURL || '';
            const displayName = user.displayName || '使用者';
            const email = user.email || '';

            elements.userAvatar.src = photoURL;
            elements.userName.textContent = displayName;
            elements.sidebarUserAvatar.src = photoURL;
            elements.sidebarUserName.textContent = displayName;
            elements.sidebarUserEmail.textContent = email;
            elements.welcomeName.textContent = `${displayName}，管理您的播放速度設定`;
        }
    }

    /**
     * Switch dashboard panel
     */
    function switchPanel(panelId) {
        // Update sidebar links
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.toggle('active', link.dataset.panel === panelId);
        });

        // Show panel
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === panelId);
        });

        // Trigger analytics chart render if analytics panel
        if (panelId === 'analytics-panel') {
            setTimeout(() => updateAnalytics(), 100);
        }
    }

    /**
     * Hide loading screen
     */
    function hideLoading() {
        elements.loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            elements.loadingScreen.style.display = 'none';
        }, 500);
    }

    // ==========================================
    // Rendering Functions
    // ==========================================

    /**
     * Render all dashboard data
     */
    function renderDashboard() {
        const categories = Store.getCategories();
        const history = Store.getHistory();
        const analytics = Store.getAnalytics(30);

        renderStats(categories, analytics);
        renderCategoryOverview(categories);
        renderCategoriesGrid(categories);
        renderHistoryOverview(history);
        renderHistoryList(history);
        renderSettings();
    }

    /**
     * Render stats cards
     */
    function renderStats(categories, analytics) {
        const enabledCategories = categories.filter(c => c.enabled);
        elements.statCategories.textContent = enabledCategories.length;
        elements.statWatched.textContent = analytics.totalWatched;
        elements.statTimeSaved.textContent = analytics.timeSavedMinutes + ' 分鐘';
        elements.statAvgSpeed.textContent = analytics.avgSpeed + 'x';
    }

    /**
     * Render category overview (overview panel)
     */
    function renderCategoryOverview(categories) {
        const enabledCategories = categories.filter(c => c.enabled).slice(0, 8);
        elements.categoryListOverview.innerHTML = enabledCategories.map(cat => `
            <div class="category-overview-item">
                <div class="category-overview-emoji">${cat.emoji}</div>
                <span class="category-overview-name">${cat.name}</span>
                <span class="category-overview-speed">${cat.speed}x</span>
            </div>
        `).join('');
    }

    /**
     * Render categories grid (categories panel)
     */
    function renderCategoriesGrid(categories) {
        elements.categoriesGrid.innerHTML = categories.map(cat => {
            const speedPercent = (cat.speed / 3) * 100;
            const keywordTags = (cat.keywords || []).slice(0, 5).map(k =>
                `<span class="keyword-tag">${k}</span>`
            ).join('');

            return `
                <div class="dash-category-card ${!cat.enabled ? 'disabled' : ''}" data-id="${cat.id}">
                    <div class="dash-category-card-header">
                        <div class="dash-category-card-title">
                            <div class="emoji">${cat.emoji}</div>
                            <h4>${cat.name}</h4>
                        </div>
                        <div class="dash-category-card-actions">
                            <button class="card-action-btn edit-cat-btn" data-id="${cat.id}" title="編輯">
                                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                            </button>
                            <button class="card-action-btn toggle-cat-btn" data-id="${cat.id}" title="${cat.enabled ? '停用' : '啟用'}">
                                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="${cat.enabled ? 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' : 'M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 008.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z'}"/></svg>
                            </button>
                            <button class="card-action-btn delete delete-cat-btn" data-id="${cat.id}" title="刪除">
                                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="dash-category-speed">
                        <span class="dash-category-speed-value">${cat.speed}x</span>
                        <div class="dash-category-speed-bar">
                            <div class="dash-category-speed-fill" style="width:${speedPercent}%"></div>
                        </div>
                    </div>
                    <div class="dash-category-keywords">${keywordTags}</div>
                </div>
            `;
        }).join('');

        // Bind card action events
        elements.categoriesGrid.querySelectorAll('.edit-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => openCategoryModal(btn.dataset.id));
        });

        elements.categoriesGrid.querySelectorAll('.toggle-cat-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const cat = Store.getCategoryById(btn.dataset.id);
                if (cat) {
                    await Store.updateCategory(btn.dataset.id, { enabled: !cat.enabled });
                    showToast(`${cat.name} 已${cat.enabled ? '停用' : '啟用'}`, 'info');
                }
            });
        });

        elements.categoriesGrid.querySelectorAll('.delete-cat-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const cat = Store.getCategoryById(btn.dataset.id);
                if (cat && confirm(`確定要刪除「${cat.name}」分類嗎？`)) {
                    await Store.deleteCategory(btn.dataset.id);
                    showToast(`已刪除「${cat.name}」`, 'success');
                }
            });
        });
    }

    /**
     * Render history overview (overview panel - limited items)
     */
    function renderHistoryOverview(history) {
        if (history.length === 0) {
            elements.historyListOverview.innerHTML = `
                <div class="empty-state-small">
                    <p>開始觀看 YouTube 影片後，紀錄會顯示在這裡</p>
                </div>
            `;
            return;
        }

        const recent = history.slice(0, 5);
        elements.historyListOverview.innerHTML = recent.map(h => renderHistoryItem(h)).join('');
    }

    /**
     * Render full history list
     */
    function renderHistoryList(history) {
        if (history.length === 0) {
            elements.historyList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <h3>尚無觀看紀錄</h3>
                    <p>安裝 Chrome 擴充功能後，觀看的 YouTube 影片將會記錄在這裡</p>
                </div>
            `;
            return;
        }

        elements.historyList.innerHTML = history.map(h => renderHistoryItem(h)).join('');
    }

    /**
     * Render a single history item
     */
    function renderHistoryItem(item) {
        const category = Store.getCategoryById(item.category);
        const categoryName = category ? category.name : '未分類';
        const categoryEmoji = category ? category.emoji : '📺';
        const dateStr = formatDate(item.date);

        return `
            <div class="history-item">
                <div class="history-thumb">
                    ${item.thumb
                        ? `<img src="${item.thumb}" alt="${item.title}">`
                        : `<div class="history-thumb-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>`
                    }
                </div>
                <div class="history-info">
                    <div class="history-title">${item.title}</div>
                    <div class="history-meta">
                        <span class="history-category">${categoryEmoji} ${categoryName}</span>
                        <div class="history-speed">
                            <span class="history-speed-badge">${item.speed}x</span>
                        </div>
                    </div>
                </div>
                <span class="history-date">${dateStr}</span>
            </div>
        `;
    }

    /**
     * Render settings state
     */
    function renderSettings() {
        const settings = Store.getSettings();
        elements.settingAutoSpeed.checked = settings.autoSpeed;
        elements.settingNotifications.checked = settings.notifications;
        elements.settingHistory.checked = settings.recordHistory;
        elements.autoSpeedToggle.checked = settings.autoSpeed;

        // Default speed buttons
        document.querySelectorAll('.speed-selector .speed-btn').forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.speed) === settings.defaultSpeed);
        });
    }

    /**
     * Update analytics panel
     */
    function updateAnalytics() {
        const period = elements.analyticsPeriod.value;
        const analytics = Store.getAnalytics(period === 'all' ? 'all' : parseInt(period));

        // Update time saved stats
        document.getElementById('time-today').textContent = Math.round(analytics.timeSavedMinutes * 0.1) + ' 分';
        document.getElementById('time-week').textContent = Math.round(analytics.timeSavedMinutes * 0.4) + ' 分';
        document.getElementById('time-month').textContent = analytics.timeSavedMinutes + ' 分';
        document.getElementById('time-total').textContent = Math.round(analytics.timeSavedMinutes * 1.5) + ' 分';

        // Render charts
        if (typeof Charts !== 'undefined') {
            Charts.renderDailyChart(analytics.dailyCounts);
            Charts.renderCategoryChart(analytics.categoryDistribution);
            Charts.renderSpeedChart(analytics.speedDistribution);
        }
    }

    // ==========================================
    // Category Modal
    // ==========================================

    function openCategoryModal(editId = null) {
        editingCategoryId = editId;

        if (editId) {
            const cat = Store.getCategoryById(editId);
            if (!cat) return;
            elements.modalTitle.textContent = '編輯分類';
            elements.categoryNameInput.value = cat.name;
            elements.speedSlider.value = cat.speed;
            elements.speedDisplay.textContent = cat.speed.toFixed(2) + 'x';
            elements.categoryKeywords.value = (cat.keywords || []).join(', ');
            elements.categoryYtIds.value = (cat.ytCategoryIds || []).join(', ');

            // Select emoji
            elements.emojiPicker.querySelectorAll('.emoji-btn').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.emoji === cat.emoji);
            });
        } else {
            elements.modalTitle.textContent = '新增分類';
            elements.categoryNameInput.value = '';
            elements.speedSlider.value = 1;
            elements.speedDisplay.textContent = '1.00x';
            elements.categoryKeywords.value = '';
            elements.categoryYtIds.value = '';
            elements.emojiPicker.querySelectorAll('.emoji-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
        }

        elements.categoryModal.classList.add('active');
        elements.categoryNameInput.focus();
    }

    function closeCategoryModal() {
        elements.categoryModal.classList.remove('active');
        editingCategoryId = null;
    }

    async function handleSaveCategory() {
        const name = elements.categoryNameInput.value.trim();
        const speed = parseFloat(elements.speedSlider.value);
        const selectedEmoji = elements.emojiPicker.querySelector('.emoji-btn.selected');
        const emoji = selectedEmoji ? selectedEmoji.dataset.emoji : '📺';
        const keywords = elements.categoryKeywords.value
            .split(',')
            .map(k => k.trim())
            .filter(k => k);
        const ytCategoryIds = elements.categoryYtIds.value
            .split(',')
            .map(id => id.trim())
            .filter(id => id);

        if (!name) {
            showToast('請輸入分類名稱', 'warning');
            elements.categoryNameInput.focus();
            return;
        }

        if (editingCategoryId) {
            await Store.updateCategory(editingCategoryId, {
                name, emoji, speed, keywords, ytCategoryIds
            });
            showToast(`已更新「${name}」分類`, 'success');
        } else {
            await Store.addCategory({
                name, emoji, speed, keywords, ytCategoryIds
            });
            showToast(`已新增「${name}」分類`, 'success');
        }

        closeCategoryModal();
    }

    async function handleResetDefaults() {
        if (confirm('確定要恢復所有分類為預設值嗎？您的自訂分類將會被刪除。')) {
            await Store.resetCategories();
            showToast('已恢復預設分類', 'success');
        }
    }

    // ==========================================
    // Data Actions
    // ==========================================

    function handleExportData() {
        const data = Store.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `autospd-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('資料已匯出', 'success');
    }

    async function handleDeleteData() {
        if (confirm('確定要刪除所有資料嗎？此操作無法復原，您的所有設定和觀看紀錄將被永久刪除。')) {
            await Store.deleteAllData();
            showToast('所有資料已刪除', 'success');
        }
    }

    // ==========================================
    // Scroll Animations
    // ==========================================

    function initScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = parseInt(entry.target.dataset.delay) || 0;
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, delay);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            observer.observe(el);
        });
    }

    // ==========================================
    // Count Up Animation
    // ==========================================

    function initCountUp() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCountUp(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        document.querySelectorAll('.stat-number').forEach(el => {
            observer.observe(el);
        });
    }

    function animateCountUp(element) {
        const target = parseInt(element.dataset.count);
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        function update() {
            current += step;
            if (current >= target) {
                element.textContent = target;
                return;
            }
            element.textContent = Math.floor(current);
            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    // ==========================================
    // Utility Functions
    // ==========================================

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '剛剛';
        if (minutes < 60) return `${minutes} 分鐘前`;
        if (hours < 24) return `${hours} 小時前`;
        if (days < 7) return `${days} 天前`;
        return date.toLocaleDateString('zh-TW');
    }

    return {
        init,
        showLanding,
        showDashboard,
        hideLoading,
        renderDashboard,
        switchPanel,
        updateAnalytics,
        renderCategoriesGrid,
        renderHistoryList,
        renderHistoryOverview,
        renderSettings,
        renderStats
    };
})();

// ==========================================
// Global Toast Function
// ==========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconPaths = {
        success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
        info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    };

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <svg class="toast-icon ${type}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="${iconPaths[type] || iconPaths.info}"/>
        </svg>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.classList.add('fade-out'); setTimeout(() => this.parentElement.remove(), 300);">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
        </button>
    `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}
