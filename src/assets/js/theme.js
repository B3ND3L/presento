/* ═══════════════════════════════════════════════════════════
   PRESENTO — Gestion du thème clair/sombre
   Ce script doit être chargé dans le <head> (rendu bloquant)
   afin d'appliquer le thème avant le premier paint (pas de flash).
═══════════════════════════════════════════════════════════ */
(function () {
    const STORAGE_KEY = 'presento-theme';

    function resolveInitialTheme() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'light' || stored === 'dark') return stored;
        } catch (_) { /* localStorage indisponible */ }
        const prefersLight = window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: light)').matches;
        return prefersLight ? 'light' : 'dark';
    }

    // Application immédiate (avant le rendu du <body>)
    document.documentElement.setAttribute('data-theme', resolveInitialTheme());

    // Bascule manuelle (appelée par le bouton .theme-toggle)
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

