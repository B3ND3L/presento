/* ── Traductions (injectées par le template) ── */
const I18N = (() => {
    try { return JSON.parse(document.getElementById('presento-i18n').textContent); }
    catch (_) { return {}; }
})();
const t = (key) => I18N[key] || key;

/* ═══════════════════════════════════════════════════════════
   STOCKAGE LOCAL : on ne conserve que les IDs des présentations
═══════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'presento_ids';

function getStoredIds() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(raw) ? raw.filter(Boolean) : [];
    } catch { return []; }
}

function setStoredIds(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
}

function addStoredId(id) {
    if (!id) return;
    const ids = getStoredIds();
    if (!ids.includes(id)) { ids.push(id); setStoredIds(ids); }
}

function removeStoredId(id) {
    setStoredIds(getStoredIds().filter(x => x !== id));
}

/* ── Rendu de « Mes présentations » à partir du localStorage ── */
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

async function loadMyPresentations() {
    const container = document.getElementById('my-slides');
    const emptyEl   = document.getElementById('my-slides-empty');
    if (!container) return;

    const ids = getStoredIds();
    container.innerHTML = '';

    let presentations = [];
    if (ids.length) {
        try {
            const res = await fetch('/api/presentations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            if (res.ok) presentations = await res.json();
        } catch { /* hors-ligne : on n'affiche rien */ }
    }

    // Nettoyage des IDs qui n'existent plus sur le serveur
    if (presentations.length !== ids.length) {
        setStoredIds(presentations.map(p => p.id));
    }

    if (!presentations.length) {
        emptyEl && emptyEl.classList.remove('alert--hidden');
        return;
    }
    emptyEl && emptyEl.classList.add('alert--hidden');

    presentations.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        const lock = p.has_password
            ? `<span class="card-lock" title="${escapeHtml(t('password_protected'))}">🔒</span>`
            : '';
        card.innerHTML = `
            <h3>${escapeHtml(p.title)} ${lock}</h3>
            <div class="card-meta">${escapeHtml(p.theme)} • <code>${escapeHtml(p.id)}</code></div>
            <div class="card-actions">
                <a href="/p/${encodeURIComponent(p.id)}" target="_blank" class="btn btn-success">${escapeHtml(t('view_slide'))}</a>
                <a href="/p/${encodeURIComponent(p.id)}/edit" class="btn btn-secondary">${escapeHtml(t('edit'))}</a>
                <a href="/p/${encodeURIComponent(p.id)}?print-pdf" target="_blank" class="btn btn-secondary">${escapeHtml(t('pdf'))}</a>
                <button type="button" class="btn btn-danger" data-del="${escapeHtml(p.id)}">${escapeHtml(t('delete'))}</button>
            </div>`;
        card.querySelector('[data-del]').addEventListener('click', () => deletePresentation(p.id));
        container.appendChild(card);
    });
}

async function deletePresentation(id) {
    if (!confirm(t('confirm_delete'))) return;
    try {
        await fetch('/api/p/' + encodeURIComponent(id), { method: 'DELETE' });
    } catch { /* on retire quand même l'ID local */ }
    removeStoredId(id);
    loadMyPresentations();
}

/* ── Accès par ID/mot de passe : on valide puis on stocke l'ID ── */
async function accessPresentation() {
    const idEl    = document.getElementById('access-id');
    const pwEl    = document.getElementById('access-password');
    const errEl   = document.getElementById('access-error');
    const presId  = (idEl.value || '').trim();
    errEl.classList.add('alert--hidden');

    if (!presId) {
        errEl.textContent = t('access_empty');
        errEl.classList.remove('alert--hidden');
        return;
    }
    try {
        const res = await fetch('/api/pres/access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pres_id: presId, password: pwEl.value || '' })
        });
        if (res.ok) {
            const { id } = await res.json();
            addStoredId(id);
            window.location.href = `/p/${id}/edit`;
            return;
        }
        const key = res.status === 404 ? 'access_not_found'
                  : res.status === 403 ? 'access_bad_password'
                  : 'access_empty';
        errEl.textContent = t(key);
        errEl.classList.remove('alert--hidden');
    } catch {
        errEl.textContent = t('import_error');
        errEl.classList.remove('alert--hidden');
    }
}

document.addEventListener('DOMContentLoaded', loadMyPresentations);

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
        addStoredId(id);
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

/* ── Liaison des gestionnaires d'événements (remplace les onclick inline) ── */
document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', () => {
        if (typeof window.toggleTheme === 'function') window.toggleTheme();
    });

    const langTrigger = document.getElementById('langTrigger');
    if (langTrigger) langTrigger.addEventListener('click', toggleLangMenu);

    document.querySelectorAll('.lang-opt').forEach(btn =>
        btn.addEventListener('click', () =>
            setLang(btn.dataset.lang, btn.dataset.flag, btn.dataset.label)));

    const accessBtn = document.getElementById('access-btn');
    if (accessBtn) accessBtn.addEventListener('click', accessPresentation);

    const importBtn = document.getElementById('import-btn');
    if (importBtn) importBtn.addEventListener('click', importJson);
});
