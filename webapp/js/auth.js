/**
 * AutoSPD - Authentication Module
 * Handles Google Sign-In / Sign-Out with Firebase Auth
 */

const Auth = (() => {
    let currentUser = null;
    let onAuthChangeCallbacks = [];

    /**
     * Initialize auth state observer
     */
    function init() {
        auth.onAuthStateChanged((user) => {
            currentUser = user;
            onAuthChangeCallbacks.forEach(cb => cb(user));
        });
    }

    /**
     * Sign in with Google popup
     */
    async function signInWithGoogle() {
        try {
            const result = await auth.signInWithPopup(googleProvider);
            showToast('登入成功！歡迎回來 👋', 'success');
            return result.user;
        } catch (error) {
            console.error('Sign-in error:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                showToast('登入已取消', 'info');
            } else if (error.code === 'auth/network-request-failed') {
                showToast('網路連線錯誤，請檢查網路後重試', 'error');
            } else {
                showToast('登入失敗：' + error.message, 'error');
            }
            return null;
        }
    }

    /**
     * Sign out
     */
    async function signOut() {
        try {
            await auth.signOut();
            showToast('已成功登出', 'info');
        } catch (error) {
            console.error('Sign-out error:', error);
            showToast('登出失敗', 'error');
        }
    }

    /**
     * Register auth state change callback
     */
    function onAuthChange(callback) {
        onAuthChangeCallbacks.push(callback);
    }

    /**
     * Get current user
     */
    function getUser() {
        return currentUser;
    }

    /**
     * Check if user is signed in
     */
    function isSignedIn() {
        return currentUser !== null;
    }

    return {
        init,
        signInWithGoogle,
        signOut,
        onAuthChange,
        getUser,
        isSignedIn
    };
})();
