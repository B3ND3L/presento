function probeThemeColors(theme, callback) {
    if (_themeCache[theme]) { callback(_themeCache[theme]); return; }
    if (!_probeIframe) {
        _probeIframe = document.createElement('iframe');
        _probeIframe.className = 'probe-iframe';
        document.body.appendChild(_probeIframe);
    }
    const doc = _probeIframe.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
        <link id="t" rel="stylesheet" href="${REVEAL_CDN}/theme/${theme}.min.css">
    </head><body></body></html>`);
    doc.close();
    const link = doc.getElementById('t');
    const done = () => {
        const cs = getComputedStyle(doc.documentElement);
        const result = {
            bg:    cs.getPropertyValue('--r-background-color').trim() || '#ffffff',
            color: cs.getPropertyValue('--r-main-color').trim()       || '#000000',
        };
        _themeCache[theme] = result;
        callback(result);
    };
    link.onload  = done;
    link.onerror = () => { _themeCache[theme] = { bg: '#ffffff', color: '#000000' }; callback(_themeCache[theme]); };
}

let state = {
    title:      "{{ pres.meta.title }}",
    theme:      "{{ pres.meta.theme }}",
    transition: "{{ pres.meta.transition }}",
    slides: []
};

let currentSlideIdx = 0;
let selectedEl = null;
let elCounter  = 0;
let zoom       = 1.0;
let isDirty    = false;
let dragState  = null;
let resizeState = null;

/* ═════════════════════════════════════════════════════
   ELEMENT FACTORIES
═════════════════════════════════════════════════════ */
function emptySlide() { return { bg: '', elements: [] }; }
function makeId()     { return 'el_' + (++elCounter); }

function makeTextEl({ text='', x=100, y=100, w=400, h=null, fontSize=24, fontWeight='normal', color='' }) {
    return {
        id: makeId(), type: 'text',
        x, y, w, h: h || Math.max(40, fontSize * 1.6),
        text, fontSize, fontWeight, fontFamily: 'inherit',
        color, align: 'left', bg: '', zIndex: elCounter
    };
}
function makeImageEl({ src='', x=200, y=100, w=400, h=250 }) {
    return { id: makeId(), type: 'image', x, y, w, h, src, zIndex: elCounter };
}
function makeShapeEl({ shape='rect', x=200, y=150, w=200, h=120, fill='#5b6af8', stroke='none' }) {
    return { id: makeId(), type: 'shape', shape, x, y, w, h, fill, stroke, zIndex: elCounter };
}
function makeIframeEl({ src='', x=80, y=80, w=800, h=450 }) {
    return { id: makeId(), type: 'iframe', x, y, w, h, src, zIndex: elCounter };
}

/* ═════════════════════════════════════════════════════
   RENDER ENGINE
═════════════════════════════════════════════════════ */
function renderCurrentSlide() {
    const canvas = document.getElementById('slide-canvas');
    const slide  = state.slides[currentSlideIdx];
    if (!slide) return;

    canvas.querySelectorAll('.slide-el').forEach(n => n.remove());

    const applyTheme = ({ bg, color }) => {
        const effectiveBg = slide.bg || bg;
        canvas.style.background = effectiveBg;
        canvas.style.color      = color;
        document.getElementById('slide-bg-color').value   = effectiveBg;
        document.getElementById('pp-slide-bg').value      = effectiveBg;
        document.getElementById('slide-bg-preview').style.background = effectiveBg;
    };
    const cached = _themeCache[state.theme];
    if (cached) {
        applyTheme(cached);
    } else {
        applyTheme({ bg: slide.bg || '#ffffff', color: '#000000' });
        probeThemeColors(state.theme, applyTheme);
    }

    document.getElementById('empty-hint').style.display =
        slide.elements.length === 0 ? 'flex' : 'none';

    slide.elements.forEach(el => canvas.appendChild(createDomElement(el)));
    selectedEl = null;
    updateFormToolbar();
}

function createDomElement(elData) {
    const node = document.createElement('div');
    node.className    = 'slide-el';
    node.dataset.id   = elData.id;
    node.style.left   = elData.x + 'px';
    node.style.top    = elData.y + 'px';
    node.style.width  = elData.w + 'px';
    node.style.height = elData.h + 'px';
    node.style.zIndex = elData.zIndex || 1;

    if (elData.type === 'text') {
        node.classList.add('el-text');
        node.contentEditable  = 'false';
        node.dataset.placeholder = 'Cliquez pour éditer…';
        applyTextStyles(node, elData);
        node.innerHTML = elData.html || escapeToHtml(elData.text || '');
        node.addEventListener('dblclick', () => startEditing(node));
        node.addEventListener('blur',     () => stopEditing(node));
        node.addEventListener('input',    () => { syncElDataFromDom(node); markDirty(); });
        node.addEventListener('keydown',  e  => { if (e.key === 'Escape') node.blur(); e.stopPropagation(); });
    }
    if (elData.type === 'image') {
        node.classList.add('el-image');
        const img = document.createElement('img');
        img.src = elData.src; img.draggable = false;
        node.appendChild(img);
    }
    if (elData.type === 'shape') {
        node.classList.add('el-shape');
        node.innerHTML = shapeSvg(elData.shape, elData.fill, elData.stroke);
    }
    if (elData.type === 'iframe') {
        node.classList.add('el-iframe');
        const ph = document.createElement('div');
        ph.className = 'el-iframe-placeholder';
        ph.innerHTML = `<div class="if-icon">🌐</div><div class="if-url">${elData.src || 'URL non définie'}</div>`;
        node.appendChild(ph);
    }

    refreshFragmentBadge(node, elData);

    const rh = document.createElement('div');
    rh.className = 'resize-handle';
    rh.addEventListener('mousedown', e => startResize(e, node));
    node.appendChild(rh);

    node.addEventListener('mousedown', e => onElMouseDown(e, node));
    node.addEventListener('click',     e => { e.stopPropagation(); selectEl(node); });
    return node;
}

function applyTextStyles(node, elData) {
    node.style.fontSize   = (elData.fontSize  || 18) + 'px';
    node.style.fontWeight =  elData.fontWeight || 'normal';
    node.style.fontFamily =  elData.fontFamily || 'inherit';
    node.style.color      =  elData.color      || '';
    node.style.textAlign  =  elData.align      || 'left';
    node.style.background =  elData.bg         || '';
    node.style.lineHeight = '1.4';
}

function shapeSvg(shape, fill, stroke) {
    if (shape === 'rect')
        return `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="2" y="2" width="96" height="96" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/></svg>`;
    if (shape === 'circle')
        return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${fill}" stroke="${stroke}" stroke-width="2"/></svg>`;
    if (shape === 'triangle')
        return `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,4 98,96 2,96" fill="${fill}" stroke="${stroke}" stroke-width="2"/></svg>`;
    return '';
}

function escapeToHtml(text) {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ═════════════════════════════════════════════════════
   SELECTION & EDITING
═════════════════════════════════════════════════════ */
function selectEl(node) {
    if (selectedEl && selectedEl !== node) {
        selectedEl.classList.remove('selected','editing');
        if (selectedEl.contentEditable === 'true') stopEditing(selectedEl);
    }
    selectedEl = node;
    node.classList.add('selected');
    updateFormToolbar();
}

function deselectAll() {
    if (selectedEl) {
        selectedEl.classList.remove('selected','editing');
        if (selectedEl.contentEditable === 'true') stopEditing(selectedEl);
        selectedEl = null;
    }
    updateFormToolbar();
}

function startEditing(node) {
    if (node.contentEditable === 'true') return;
    node.contentEditable = 'true';
    node.classList.add('editing');
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node); range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
}

function stopEditing(node) {
    node.contentEditable = 'false';
    node.classList.remove('editing');
    syncElDataFromDom(node);
}

function syncElDataFromDom(node) {
    const elData = getElData(node.dataset.id);
    if (!elData) return;
    elData.html = node.innerHTML;
    elData.text = node.innerText;
    markDirty();
}

function getElData(id) {
    const slide = state.slides[currentSlideIdx];
    return slide && slide.elements.find(e => e.id === id);
}

/* ═════════════════════════════════════════════════════
   DRAG / RESIZE
═════════════════════════════════════════════════════ */
function onElMouseDown(e, node) {
    if (e.target.classList.contains('resize-handle')) return;
    if (node.contentEditable === 'true') return;
    e.preventDefault();
    selectEl(node);
    const elData = getElData(node.dataset.id);
    if (!elData) return;
    dragState = { node, elData, startX: e.clientX, startY: e.clientY, origX: elData.x, origY: elData.y };
}

document.addEventListener('mousemove', e => {
    if (dragState) {
        const dx = (e.clientX - dragState.startX) / zoom;
        const dy = (e.clientY - dragState.startY) / zoom;
        const nx = Math.max(0, Math.round(dragState.origX + dx));
        const ny = Math.max(0, Math.round(dragState.origY + dy));
        dragState.elData.x = nx; dragState.elData.y = ny;
        dragState.node.style.left = nx + 'px';
        dragState.node.style.top  = ny + 'px';
    }
    if (resizeState) {
        const dx = (e.clientX - resizeState.startX) / zoom;
        const dy = (e.clientY - resizeState.startY) / zoom;
        const nw = Math.max(40,  Math.round(resizeState.origW + dx));
        const nh = Math.max(20,  Math.round(resizeState.origH + dy));
        resizeState.elData.w = nw; resizeState.elData.h = nh;
        resizeState.node.style.width  = nw + 'px';
        resizeState.node.style.height = nh + 'px';
    }
});

document.addEventListener('mouseup', () => {
    if (dragState)   { markDirty(); dragState   = null; }
    if (resizeState) { markDirty(); resizeState = null; }
});

function startResize(e, node) {
    e.preventDefault(); e.stopPropagation();
    const elData = getElData(node.dataset.id);
    if (!elData) return;
    resizeState = { node, elData, startX: e.clientX, startY: e.clientY, origW: elData.w, origH: elData.h };
}

function onCanvasClick(e) {
    if (e.target === document.getElementById('slide-canvas') ||
        e.target.closest('#empty-hint')) deselectAll();
}

/* ═════════════════════════════════════════════════════
   FORMAT TOOLBAR
═════════════════════════════════════════════════════ */
function execCmd(cmd, value) {
    if (selectedEl && selectedEl.contentEditable !== 'true') startEditing(selectedEl);
    document.execCommand(cmd, false, value || null);
    syncElDataFromDom(selectedEl);
    updateFormToolbar();
}

function applyStyle(prop, value) {
    if (!selectedEl) return;
    const elData = getElData(selectedEl.dataset.id);
    if (!elData) return;
    selectedEl.style[prop] = value;
    if (prop === 'fontSize')   elData.fontSize  = parseInt(value);
    if (prop === 'fontFamily') elData.fontFamily = value;
    markDirty();
}

function applyTextColor(hex) {
    document.getElementById('color-preview').style.background = hex;
    if (!selectedEl) return;
    const sel = window.getSelection();
    const hasSelection = sel && sel.toString().length > 0 && selectedEl.contains(sel.anchorNode);
    if (hasSelection) {
        document.execCommand('foreColor', false, hex);
    } else {
        selectedEl.style.color = hex;
        const elData = getElData(selectedEl.dataset.id);
        if (elData) elData.color = hex;
    }
    syncElDataFromDom(selectedEl);
    markDirty();
}

function applyBgColor(hex) {
    document.getElementById('bg-color-preview').style.background = hex;
    if (!selectedEl) return;
    selectedEl.style.background = hex;
    const elData = getElData(selectedEl.dataset.id);
    if (elData) elData.bg = hex;
    markDirty();
}

function applySlideBackground(hex) {
    document.getElementById('slide-bg-preview').style.background = hex;
    document.getElementById('slide-bg-color').value = hex;
    document.getElementById('pp-slide-bg').value    = hex;
    document.getElementById('slide-canvas').style.background = hex;
    const slide = state.slides[currentSlideIdx];
    if (slide) slide.bg = hex;
    markDirty();
    renderThumb(currentSlideIdx);
}

function bringForward() {
    if (!selectedEl) return;
    const elData = getElData(selectedEl.dataset.id);
    if (!elData) return;
    elData.zIndex = (elData.zIndex || 1) + 1;
    selectedEl.style.zIndex = elData.zIndex;
    markDirty();
}

function sendBackward() {
    if (!selectedEl) return;
    const elData = getElData(selectedEl.dataset.id);
    if (!elData) return;
    elData.zIndex = Math.max(1, (elData.zIndex || 1) - 1);
    selectedEl.style.zIndex = elData.zIndex;
    markDirty();
}

function deleteSelected() {
    if (!selectedEl) return;
    const id    = selectedEl.dataset.id;
    const slide = state.slides[currentSlideIdx];
    slide.elements = slide.elements.filter(e => e.id !== id);
    selectedEl.remove();
    selectedEl = null;
    document.getElementById('empty-hint').style.display =
        slide.elements.length === 0 ? 'flex' : 'none';
    markDirty();
    renderThumb(currentSlideIdx);
}

function updateFormToolbar() {
    const hasEl = !!selectedEl;
    document.querySelectorAll('.btn-action-on-el').forEach(b => {
        b.style.opacity = hasEl ? '1' : '.3';
        b.style.cursor  = hasEl ? 'pointer' : 'not-allowed';
    });
    if (hasEl) {
        const elData = getElData(selectedEl.dataset.id);
        document.getElementById('btn-fragment').classList.toggle('active', !!(elData && elData.fragment));
        document.getElementById('btn-edit-iframe').style.display =
            (elData && elData.type === 'iframe') ? 'inline-flex' : 'none';
    } else {
        document.getElementById('btn-fragment').classList.remove('active');
        document.getElementById('btn-edit-iframe').style.display = 'none';
    }
}

/* ═════════════════════════════════════════════════════
   KEYBOARD
═════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
    if (e.target.contentEditable === 'true') return;
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === 's')  { e.preventDefault(); openSaveModal(); return; }
    const delta = e.shiftKey ? 10 : 1;
    if (selectedEl && !dragState && !resizeState) {
        const elData = getElData(selectedEl.dataset.id);
        if (elData) {
            if (e.key === 'ArrowLeft')  { elData.x -= delta; selectedEl.style.left = elData.x + 'px'; markDirty(); e.preventDefault(); }
            if (e.key === 'ArrowRight') { elData.x += delta; selectedEl.style.left = elData.x + 'px'; markDirty(); e.preventDefault(); }
            if (e.key === 'ArrowUp')    { elData.y -= delta; selectedEl.style.top  = elData.y + 'px'; markDirty(); e.preventDefault(); }
            if (e.key === 'ArrowDown')  { elData.y += delta; selectedEl.style.top  = elData.y + 'px'; markDirty(); e.preventDefault(); }
        }
    }
});

/* ═════════════════════════════════════════════════════
   INSERT ACTIONS
═════════════════════════════════════════════════════ */
function insertText(kind) {
    const slide = state.slides[currentSlideIdx];
    document.getElementById('empty-hint').style.display = 'none';
    let el;
    if      (kind === 'heading') el = makeTextEl({ text: '{{ _("slide_title_placeholder") }}', x:80, y:80,  w:800, fontSize:48, fontWeight:'bold' });
    else if (kind === 'body')    el = makeTextEl({ text: '{{ _("slide_text_placeholder") }}',  x:80, y:200, w:800, fontSize:22 });
    else if (kind === 'bullet')  el = makeTextEl({ text: '{{ _("slide_list_placeholder") }}',  x:100,y:160, w:760, fontSize:22 });
    slide.elements.push(el);
    const node = createDomElement(el);
    document.getElementById('slide-canvas').appendChild(node);
    selectEl(node);
    setTimeout(() => startEditing(node), 50);
    markDirty();
    renderThumb(currentSlideIdx);
}

function insertDivider() {
    const el    = makeShapeEl({ shape:'rect', x:80, y:260, w:800, h:4, fill:'#cccccc', stroke:'none' });
    const slide = state.slides[currentSlideIdx];
    slide.elements.push(el);
    document.getElementById('slide-canvas').appendChild(createDomElement(el));
    document.getElementById('empty-hint').style.display = 'none';
    markDirty(); renderThumb(currentSlideIdx);
}

function insertShape(shape) {
    const fills = { rect:'#5b6af8', circle:'#3ecf8e', triangle:'#ecc94b' };
    const el    = makeShapeEl({ shape, x:280, y:160, w:200, h:160, fill: fills[shape] || '#5b6af8' });
    const slide = state.slides[currentSlideIdx];
    slide.elements.push(el);
    document.getElementById('slide-canvas').appendChild(createDomElement(el));
    document.getElementById('empty-hint').style.display = 'none';
    markDirty(); renderThumb(currentSlideIdx);
}

function insertImageFromUrl() {
    const url = document.getElementById('img-url-input').value.trim();
    if (!url) return;
    const el    = makeImageEl({ src: url, x:180, y:80, w:600, h:380 });
    const slide = state.slides[currentSlideIdx];
    slide.elements.push(el);
    document.getElementById('slide-canvas').appendChild(createDomElement(el));
    document.getElementById('empty-hint').style.display = 'none';
    closeModal('image'); markDirty(); renderThumb(currentSlideIdx);
}

function triggerImageUpload() { document.getElementById('image-upload').click(); }

function handleImageFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
        const el    = makeImageEl({ src: evt.target.result, x:180, y:80, w:600, h:380 });
        const slide = state.slides[currentSlideIdx];
        slide.elements.push(el);
        document.getElementById('slide-canvas').appendChild(createDomElement(el));
        document.getElementById('empty-hint').style.display = 'none';
        markDirty(); renderThumb(currentSlideIdx);
    };
    reader.readAsDataURL(file);
}

function onDragOver(e) { e.preventDefault(); document.getElementById('slide-canvas').classList.add('drag-over'); }
function onDrop(e) {
    e.preventDefault();
    document.getElementById('slide-canvas').classList.remove('drag-over');
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && url.match(/\.(png|jpg|jpeg|gif|webp|svg)/i)) {
        const el = makeImageEl({ src: url, x: e.offsetX - 200, y: e.offsetY - 100, w:400, h:250 });
        state.slides[currentSlideIdx].elements.push(el);
        document.getElementById('slide-canvas').appendChild(createDomElement(el));
        markDirty();
    }
}

/* ═════════════════════════════════════════════════════
   SLIDE MANAGEMENT
═════════════════════════════════════════════════════ */
function switchToSlide(idx) { currentSlideIdx = idx; renderCurrentSlide(); renderSlideList(); }

function addSlide() {
    state.slides.push(emptySlide());
    currentSlideIdx = state.slides.length - 1;
    renderCurrentSlide(); renderSlideList(); markDirty();
}

function deleteSlide(idx) {
    if (state.slides.length === 1) { showToast('Impossible de supprimer la dernière slide.'); return; }
    state.slides.splice(idx, 1);
    if (currentSlideIdx >= state.slides.length) currentSlideIdx = state.slides.length - 1;
    renderCurrentSlide(); renderSlideList(); markDirty();
}

function renderSlideList() {
    const list = document.getElementById('slide-list');
    list.innerHTML = '';
    state.slides.forEach((slide, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'slide-thumb' + (i === currentSlideIdx ? ' active' : '');
        thumb.onclick   = () => switchToSlide(i);

        const iframe = document.createElement('iframe');
        const scale  = 204 / SLIDE_W;
        iframe.style.transform       = `scale(${scale})`;
        iframe.style.width           = SLIDE_W + 'px';
        iframe.style.height          = SLIDE_H + 'px';
        iframe.style.transformOrigin = 'top left';
        iframe.srcdoc = buildThumbHtml(slide);
        thumb.appendChild(iframe);

        const num = document.createElement('div');
        num.className   = 'thumb-num';
        num.textContent = i + 1;
        thumb.appendChild(num);

        const del = document.createElement('button');
        del.className   = 'thumb-del';
        del.innerHTML   = '✕';
        del.onclick     = e => { e.stopPropagation(); deleteSlide(i); };
        thumb.appendChild(del);

        list.appendChild(thumb);
    });
}

function renderThumb(idx) {
    const thumb = document.querySelectorAll('.slide-thumb')[idx];
    if (!thumb) return;
    const iframe = thumb.querySelector('iframe');
    if (iframe) iframe.srcdoc = buildThumbHtml(state.slides[idx]);
}

function buildThumbHtml(slide) {
    const elements = slide.elements.map(el => {
        const base = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;`;
        if (el.type === 'text')
            return `<div style="${base}font-size:${el.fontSize}px;font-weight:${el.fontWeight};font-family:${el.fontFamily};${el.color?`color:${el.color};`:''}text-align:${el.align};${el.bg?`background:${el.bg};`:''}overflow:hidden;line-height:1.4;box-sizing:border-box;padding:4px 6px;">${el.html||escapeToHtml(el.text||'')}</div>`;
        if (el.type === 'image')
            return `<div style="${base}overflow:hidden;"><img src="${el.src}" style="width:100%;height:100%;object-fit:cover;" alt=""/></div>`;
        if (el.type === 'shape')
            return `<div style="${base}">${shapeSvg(el.shape, el.fill, el.stroke)}</div>`;
        if (el.type === 'iframe')
            return `<div style="${base}display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:#1a1a2e;border:2px dashed #3d3f4d;box-sizing:border-box;"><div style="font-size:22px;">🌐</div><div style="font-size:9px;color:#8b8fa8;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${el.src}</div></div>`;
        return '';
    }).join('');
    const explicitBg = slide.bg ? `background:${slide.bg};` : '';
    return `<!DOCTYPE html><html><head>
        <link rel="stylesheet" href="${REVEAL_CDN}/theme/${state.theme}.min.css">
        <style>html{color-scheme:normal;}html,body{margin:0;padding:0;width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;font-family:var(--r-main-font,sans-serif);background:var(--r-background-color,#fff);color:var(--r-main-color,#000);${explicitBg}}body{position:relative;}</style>
    </head><body>${elements}</body></html>`;
}

/* ═════════════════════════════════════════════════════
   ZOOM
═════════════════════════════════════════════════════ */
function setZoom(pct) {
    zoom = pct / 100;
    const canvas = document.getElementById('slide-canvas');
    canvas.style.transform       = `scale(${zoom})`;
    canvas.style.transformOrigin = 'top center';
    document.getElementById('zoom-label').textContent = pct + '%';
    const scaledH = SLIDE_H * zoom;
    document.getElementById('canvas-area').style.paddingBottom =
        Math.max(80, (scaledH - SLIDE_H) / 2 + 80) + 'px';
}

/* ═════════════════════════════════════════════════════
   FRAGMENTS
═════════════════════════════════════════════════════ */
function toggleFragment() {
    if (!selectedEl) return;
    const elData = getElData(selectedEl.dataset.id);
    if (!elData) return;
    if (elData.fragment) {
        elData.fragment = false; delete elData.fragmentIndex;
    } else {
        const slide  = state.slides[currentSlideIdx];
        const maxIdx = slide.elements.reduce((m,e) => e.fragmentIndex!=null ? Math.max(m,e.fragmentIndex) : m, -1);
        elData.fragment = true; elData.fragmentIndex = maxIdx + 1;
    }
    refreshFragmentBadge(selectedEl, elData);
    updateFormToolbar(); markDirty(); renderThumb(currentSlideIdx);
}

function refreshFragmentBadge(node, elData) {
    let badge = node.querySelector('.fragment-badge');
    if (elData.fragment) {
        if (!badge) { badge = document.createElement('div'); badge.className = 'fragment-badge'; node.appendChild(badge); }
        badge.textContent = (elData.fragmentIndex ?? 0) + 1;
    } else { badge && badge.remove(); }
}

/* ═════════════════════════════════════════════════════
   IFRAMES
═════════════════════════════════════════════════════ */
let _iframeEditMode = false;

function openIframeModal(editMode) {
    _iframeEditMode = editMode;
    document.getElementById('iframe-modal-title').textContent =
        editMode ? "Modifier l'URL de l'iframe" : "Insérer un iframe";
    const input = document.getElementById('iframe-url-input');
    input.value = (editMode && selectedEl) ? (getElData(selectedEl.dataset.id)?.src || '') : '';
    document.getElementById('modal-iframe').classList.add('open');
    setTimeout(() => input.focus(), 50);
}

function confirmIframeModal() {
    const src = document.getElementById('iframe-url-input').value.trim();
    if (!src) return;
    closeModal('iframe');
    if (_iframeEditMode && selectedEl) {
        const elData = getElData(selectedEl.dataset.id);
        if (elData) {
            elData.src = src;
            const ph = selectedEl.querySelector('.el-iframe-placeholder .if-url');
            if (ph) ph.textContent = src;
            markDirty(); renderThumb(currentSlideIdx);
        }
    } else {
        const el    = makeIframeEl({ src, x:80, y:80, w:800, h:450 });
        const slide = state.slides[currentSlideIdx];
        slide.elements.push(el);
        const node = createDomElement(el);
        document.getElementById('slide-canvas').appendChild(node);
        document.getElementById('empty-hint').style.display = 'none';
        selectEl(node); markDirty(); renderThumb(currentSlideIdx);
    }
}

/* ═════════════════════════════════════════════════════
   SETTINGS
═════════════════════════════════════════════════════ */
function onThemeChange(val) {
    state.theme = val;
    document.getElementById('theme-select').value = val;
    document.querySelectorAll('#pp-themes .theme-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.val === val)
    );
    probeThemeColors(val, ({ bg, color }) => {
        const canvas = document.getElementById('slide-canvas');
        const slide  = state.slides[currentSlideIdx];
        if (!slide.bg) canvas.style.background = bg;
        canvas.style.color = color;
        renderSlideList();
    });
    markDirty();
}

function onTransitionChange(val) { state.transition = val; markDirty(); }

function buildPropPanel() {
    const themes = ['white','black','beige','moon','sky','solarized','league','serif'];
    document.getElementById('pp-themes').innerHTML = themes.map(t =>
        `<button class="theme-btn${state.theme===t?' active':''}" data-val="${t}" onclick="onThemeChange('${t}')">${t}</button>`
    ).join('');
    const swatches = ['#ffffff','#1a1a2e','#16213e','#0f3460','#f5f0e8','#2d2d2d','#f8f9fa','#fff3e0'];
    document.getElementById('bg-swatches').innerHTML = swatches.map(c =>
        `<div class="pp-swatch" style="background:${c}" onclick="applySlideBackground('${c}')"></div>`
    ).join('');
    document.getElementById('pp-transition').value = state.transition;
}

function togglePropPanel() {
    const panel = document.getElementById('prop-panel');
    panel.classList.toggle('open');
    document.getElementById('canvas-area').classList.toggle('panel-open', panel.classList.contains('open'));
    document.getElementById('format-toolbar').classList.toggle('panel-open', panel.classList.contains('open'));
}

/* ═════════════════════════════════════════════════════
   SAVE
═════════════════════════════════════════════════════ */
function markDirty() {
    isDirty = true;
    const s = document.getElementById('save-status');
    s.className   = 'unsaved';
    s.textContent = '● Non sauvegardé';
}

function openSaveModal() {
    state.title = document.getElementById('pres-title').value || state.title;
    document.getElementById('save-password').value         = '';
    document.getElementById('save-password-confirm').value = '';
    document.getElementById('save-online-error').style.display = 'none';
    document.getElementById('modal-save').classList.add('open');
}

function switchSaveTab(tab) {
    document.querySelectorAll('.save-tab').forEach((btn,i) =>
        btn.classList.toggle('active', (i===0 && tab==='online') || (i===1 && tab==='offline'))
    );
    document.getElementById('save-pane-online').classList.toggle('active',  tab === 'online');
    document.getElementById('save-pane-offline').classList.toggle('active', tab === 'offline');
}

function copyPresId() {
    navigator.clipboard.writeText(state.id).then(() => showToast('🔑 ID copié !'));
}

async function saveOnline() {
    const pw  = document.getElementById('save-password').value;
    const pw2 = document.getElementById('save-password-confirm').value;
    const errEl = document.getElementById('save-online-error');
    errEl.style.display = 'none';
    if (pw && pw !== pw2) {
        errEl.textContent   = 'Les mots de passe ne correspondent pas.';
        errEl.style.display = 'block';
        return;
    }
    closeModal('save');
    await savePresentation(pw || null);
}

function saveOffline() {
    const data = { title: state.title, theme: state.theme, transition: state.transition, slides: state.slides };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: (state.title || 'presentation').replace(/[^a-z0-9]/gi,'_').toLowerCase() + '.json' });
    a.click();
    URL.revokeObjectURL(url);
    closeModal('save');
    showToast('{{ _("json_downloaded") }}');
}

async function savePresentation(newPassword = undefined) {
    state.title = document.getElementById('pres-title').value || state.title;
    const s = document.getElementById('save-status');
    s.className = 'saving'; s.textContent = '{{ _("saving") }}';
    const body = { title: state.title, theme: state.theme, transition: state.transition, slides: state.slides };
    if (newPassword !== undefined) body.password = newPassword;
    try {
        const res = await fetch(`/api/p/${state.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error();
        isDirty = false;
        s.className = 'saved'; s.textContent = '{{ _("saved") }}';
        setTimeout(() => { s.className = ''; s.textContent = '{{ _("saved") }}'; }, 2500);
        showToast('{{ _("deck_saved") }}');
    } catch {
        s.className = 'unsaved'; s.textContent = '{{ _("network_error") }}';
    }
}

setInterval(() => { if (isDirty) savePresentation(); }, 45000);

/* ═════════════════════════════════════════════════════
   INSERT MENU / MODALS / SHARE / TOAST
═════════════════════════════════════════════════════ */
function toggleInsertMenu() {
    document.getElementById('insert-fab').classList.toggle('open');
    document.getElementById('insert-menu').classList.toggle('open');
}
function closeInsertMenu() {
    document.getElementById('insert-fab').classList.remove('open');
    document.getElementById('insert-menu').classList.remove('open');
}
document.addEventListener('click', e => {
    if (!e.target.closest('#insert-menu') && !e.target.closest('#insert-fab')) closeInsertMenu();
});

function openImageModal() { document.getElementById('modal-image').classList.add('open'); }
function closeModal(name) { document.getElementById('modal-' + name).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(el =>
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); })
);

function copyShareLink() {
    navigator.clipboard.writeText(window.location.origin + '/p/' + state.id)
        .then(() => showToast('🔗 Lien copié !'));
}

let toastTimer;
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

document.getElementById('pres-title').addEventListener('input', e => {
    state.title = e.target.value; markDirty();
});
