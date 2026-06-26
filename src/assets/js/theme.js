/* ═══════════════════════════════════════════════════════════
   PRESENTO — Light/dark theme management
   This script must be loaded in the <head> (render-blocking)
   so the theme is applied before the first paint (no flash).
═══════════════════════════════════════════════════════════ */
(function () {
    const STORAGE_KEY = 'presento-theme';

    function resolveInitialTheme() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'light' || stored === 'dark') return stored;
        } catch (_) { /* localStorage unavailable */ }
        const prefersLight = window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: light)').matches;
        return prefersLight ? 'light' : 'dark';
    }

    // Immediate application (before the <body> is rendered)
    document.documentElement.setAttribute('data-theme', resolveInitialTheme());

    // Manual toggle (called by the .theme-toggle button)
    window.toggleTheme = function () {
        const root = document.documentElement;
        const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        root.classList.add('theme-anim');
        root.setAttribute('data-theme', next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch (_) { /* ignore */ }
        window.clearTimeout(window.__themeAnimTimer);
        window.__themeAnimTimer = window.setTimeout(
            () => root.classList.remove('theme-anim'), 300);
    };
})();

