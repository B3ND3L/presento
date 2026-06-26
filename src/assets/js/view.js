/* ═══════════════════════════════════════════════════════════
   PRESENTO — Presentation view initialization (Reveal.js)
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
        margin:     0,        // no margin: maps 960×540 exactly like the editor canvas
        center:     false,    // no vertical centering: origin at top-left, like the WYSIWYG
        // Uniform scaling that preserves element ratios. maxScale is raised
        // (default 2.0) so the slide fills large / Hi-DPI screens instead of
        // staying small and anchored top-left.
        minScale:   0.1,
        maxScale:   8,
        transition: cfg.transition || 'slide',
        plugins:    [RevealHighlight, RevealNotes]
    }).then(hideLoader);

    // Safety net: hide the loader even if Reveal is slow
    window.addEventListener('load', () => setTimeout(hideLoader, 1200));
})();

