/* ═══════════════════════════════════════════════════════════
   PRESENTO — Initialisation de la vue présentation (Reveal.js)
═══════════════════════════════════════════════════════════ */
(function () {
    function readConfig() {
        try {
            return JSON.parse(document.getElementById('presento-view-config').textContent);
        } catch (_) {
            return { transition: 'slide' };
        }
    }

    function hideLoader() {
        const loader = document.getElementById('presento-loader');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => loader.remove(), 450);
        }
    }

    const cfg = readConfig();

    Reveal.initialize({
        hash:       true,
        width:      960,
        height:     540,
        margin:     0,        // pas de marge : mappe 960×540 exactement comme le canvas éditeur
        center:     false,    // pas de centrage vertical : origine en haut-à-gauche, comme le WYSIWYG
        transition: cfg.transition || 'slide',
        plugins:    [RevealHighlight, RevealNotes]
    }).then(hideLoader);

    // Filet de sécurité : on masque le loader même si Reveal tarde
    window.addEventListener('load', () => setTimeout(hideLoader, 1200));
})();

