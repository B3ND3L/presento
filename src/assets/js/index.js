async function importJson() {
    const file  = document.getElementById('import-file').files[0];
    const errEl = document.getElementById('import-error');
    errEl.classList.add('alert--hidden');

    if (!file) {
        errEl.textContent = 'Veuillez sélectionner un fichier JSON.';
        errEl.classList.remove('alert--hidden');
        return;
    }
    let data;
    try {
        data = JSON.parse(await file.text());
    } catch {
        errEl.textContent = 'Fichier JSON invalide.';
        errEl.classList.remove('alert--hidden');
        return;
    }
    if (!data.title || !Array.isArray(data.slides)) {
        errEl.textContent = 'Format de fichier non reconnu (title et slides requis).';
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
        errEl.textContent = "Erreur lors de l'import. Veuillez réessayer.";
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