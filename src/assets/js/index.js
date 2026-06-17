/* ── Traductions (injectées par le template) ── */
const I18N = (() => {
    try { return JSON.parse(document.getElementById('presento-i18n').textContent); }
    catch (_) { return {}; }
})();
const t = (key) => I18N[key] || key;

/* ── Import JSON : dropzone + glisser-déposer ── */
let selectedFile = null;

function setSelectedFile(file) {
    selectedFile = file || null;
    const zone   = document.getElementById('import-dropzone');
    const textEl = document.getElementById('dropzone-text');
    if (!zone || !textEl) return;
    if (selectedFile) {
        zone.classList.add('dropzone--has-file');
        textEl.textContent = selectedFile.name;
    } else {
        zone.classList.remove('dropzone--has-file');
        textEl.textContent = t('dropzone_hint');
    }
}

function initImportDropzone() {
    const zone  = document.getElementById('import-dropzone');
    const input = document.getElementById('import-file');
    if (!zone || !input) return;

    // Clic / clavier : ouvre le sélecteur de fichier
    zone.addEventListener('click', e => {
        if (e.target === input) return;   // évite la récursion du click programmatique
        input.click();
    });
    zone.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });

    input.addEventListener('change', () => setSelectedFile(input.files[0] || null));

    // Empêche le navigateur d'ouvrir le fichier déposé n'importe où sur la page
    // (indispensable pour que l'événement "drop" soit délivré de façon fiable).
    ['dragover', 'drop'].forEach(ev =>
        window.addEventListener(ev, e => e.preventDefault()));

    ['dragenter', 'dragover'].forEach(ev =>
        zone.addEventListener(ev, e => {
            e.preventDefault();
            zone.classList.add('dropzone--over');
        }));
    ['dragleave', 'dragend'].forEach(ev =>
        zone.addEventListener(ev, () => zone.classList.remove('dropzone--over')));

    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dropzone--over');
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) setSelectedFile(file);
    });
}

document.addEventListener('DOMContentLoaded', initImportDropzone);

async function importJson() {
    const file  = selectedFile;
    const errEl = document.getElementById('import-error');
    errEl.classList.add('alert--hidden');

    if (!file) {
        errEl.textContent = t('select_json_file');
        errEl.classList.remove('alert--hidden');
        return;
    }
    let data;
    try {
        data = JSON.parse(await file.text());
    } catch {
        errEl.textContent = t('invalid_json');
        errEl.classList.remove('alert--hidden');
        return;
    }
    if (!data.title || !Array.isArray(data.slides)) {
        errEl.textContent = t('unrecognized_format');
        errEl.classList.remove('alert--hidden');
        return;
    }
    try {
        const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title:      data.title,
                theme:      data.theme      || 'white',
                transition: data.transition || 'slide',
                slides:     data.slides
            })
        });
        if (!res.ok) throw new Error();
        const { id } = await res.json();
        window.location.href = `/p/${id}/edit`;
    } catch {
        errEl.textContent = t('import_error');
        errEl.classList.remove('alert--hidden');
    }
}

function toggleLangMenu() {
    document.getElementById('langTrigger').classList.toggle('open');
    document.getElementById('langMenu').classList.toggle('open');
}

function setLang(code, flag, label) {
    document.getElementById('langFlag').textContent = flag;
    document.getElementById('langLabel').textContent = label;
    toggleLangMenu();
    fetch('/set-lang/' + code, { method: 'POST' }).then(() => location.reload());
}

document.addEventListener('click', e => {
    if (!e.target.closest('#langDropdown')) {
        document.getElementById('langTrigger').classList.remove('open');
        document.getElementById('langMenu').classList.remove('open');
    }
});