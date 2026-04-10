(() => {
    /* ── State ── */
    let images = [];
    let queue = [];
    let busy = false;
    let dragN = 0;

    /* ── DOM refs ── */
    const $zone      = document.getElementById('dropZone');
    const $viewDef   = document.getElementById('viewDefault');
    const $viewUp    = document.getElementById('viewUploading');
    const $prevImg   = document.getElementById('previewImg');
    const $prevName  = document.getElementById('previewName');
    const $prevSize  = document.getElementById('previewSize');
    const $input     = document.getElementById('fileInput');
    const $progWrap  = document.getElementById('progressWrap');
    const $progFill  = document.getElementById('progressFill');
    const $progPct   = document.getElementById('progressPct');
    const $gallery   = document.getElementById('gallery');
    const $imgCount  = document.getElementById('imgCount');
    const $clearBtn  = document.getElementById('clearBtn');
    const $toasts    = document.getElementById('toastBox');

    /* ── Prevent browser default file-drop on whole page ── */
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => e.preventDefault());

    /* ── Init ── */
    function init() {
        load();
        render();
        bindEvents();
    }

    function load() {
        try {
            const raw = localStorage.getItem('dz_images');
            if (raw) images = JSON.parse(raw);
        } catch { images = []; }
    }

    function save() {
        try { localStorage.setItem('dz_images', JSON.stringify(images)); }
        catch { toast('error', 'Storage full — delete some images to free space.'); }
    }

    /* ── Events ── */
    function bindEvents() {
        $zone.addEventListener('dragenter', onDragEnter);
        $zone.addEventListener('dragover', onDragOver);
        $zone.addEventListener('dragleave', onDragLeave);
        $zone.addEventListener('drop', onDrop);
        $zone.addEventListener('click', onClickZone);
        $zone.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickZone(); }
        });
        $input.addEventListener('change', e => {
            if (e.target.files.length) { handleFiles([...e.target.files]); $input.value = ''; }
        });
        $clearBtn.addEventListener('click', clearAll);
    }

    function onDragEnter(e) { e.preventDefault(); e.stopPropagation(); dragN++; if (!busy) $zone.classList.add('drag-over'); }
    function onDragOver(e)  { e.preventDefault(); e.stopPropagation(); }
    function onDragLeave(e) { e.preventDefault(); e.stopPropagation(); dragN--; if (dragN <= 0) { dragN = 0; $zone.classList.remove('drag-over'); } }

    function onDrop(e) {
        e.preventDefault(); e.stopPropagation();
        dragN = 0; $zone.classList.remove('drag-over');
        if (busy) { toast('error', 'Wait for the current upload to finish.'); return; }
        const files = [...e.dataTransfer.files];
        if (files.length) handleFiles(files);
    }

    function onClickZone() { if (!busy) $input.click(); }

    /* ── File handling ── */
    function handleFiles(files) {
        let ok = 0;
        for (const f of files) { if (validate(f)) { queue.push(f); ok++; } }
        if (ok) pump();
    }

    function validate(f) {
        const okTypes = ['image/jpeg','image/png','image/gif'];
        const okExts  = ['.jpg','.jpeg','.png','.gif'];
        const ext = '.' + f.name.split('.').pop().toLowerCase();
        if (!okTypes.includes(f.type) && !okExts.includes(ext)) {
            toast('error', `"${f.name}" is not a valid image. Only JPG, PNG, GIF allowed.`);
            return false;
        }
        return true;
    }

    function pump() {
        if (busy || !queue.length) return;
        startUpload(queue.shift());
    }

    function startUpload(file) {
        busy = true;
        $zone.classList.add('uploading');
        showPreview(file);
        simulateProgress(file);
    }

    function showPreview(file) {
        const r = new FileReader();
        r.onload = e => {
            $prevImg.src = e.target.result;
            $prevName.textContent = file.name;
            $prevSize.textContent = fmtSize(file.size);
            $viewDef.style.display = 'none';
            $viewUp.style.display = 'flex';
        };
        r.readAsDataURL(file);
    }

    function simulateProgress(file) {
        let p = 0;
        $progWrap.classList.add('visible');
        setProgress(0);

        const iv = setInterval(() => {
            let inc;
            if (p < 25)      inc = Math.random() * 14 + 5;
            else if (p < 65) inc = Math.random() * 9 + 3;
            else if (p < 88) inc = Math.random() * 4 + 1;
            else              inc = Math.random() * 2 + 0.4;
            p = Math.min(100, p + inc);
            setProgress(p);
            if (p >= 100) { clearInterval(iv); setTimeout(() => finishUpload(file), 280); }
        }, 100);
    }

    function setProgress(v) {
        const n = Math.round(v);
        $progFill.style.width = n + '%';
        $progPct.textContent = n + '%';
    }

    function finishUpload(file) {
        const r = new FileReader();
        r.onload = e => resizeAndStore(e.target.result, file);
        r.readAsDataURL(file);
    }

    function resizeAndStore(dataUrl, file) {
        const img = new Image();
        img.onload = () => {
            const MAX = 800;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else       { w = Math.round(w * MAX / h); h = MAX; }
            }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            const url = file.type === 'image/gif'
                ? c.toDataURL('image/png', 0.82)
                : c.toDataURL('image/jpeg', 0.72);

            images.unshift({
                id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                name: file.name,
                size: file.size,
                type: file.type,
                url,
                ts: new Date().toISOString()
            });
            save();
            render();

            $zone.classList.add('success-flash');
            setTimeout(() => $zone.classList.remove('success-flash'), 600);
            toast('success', `"${file.name}" uploaded successfully!`);

            setTimeout(() => { resetZone(); busy = false; pump(); }, 550);
        };
        img.onerror = () => {
            toast('error', `Failed to process "${file.name}".`);
            resetZone(); busy = false; pump();
        };
        img.src = dataUrl;
    }

    function resetZone() {
        $zone.classList.remove('uploading');
        $viewDef.style.display = 'block';
        $viewUp.style.display = 'none';
        $prevImg.src = '';
        $progWrap.classList.remove('visible');
        setProgress(0);
    }

    /* ── Gallery ── */
    function render() {
        $imgCount.textContent = images.length;
        if (!images.length) {
            $clearBtn.style.display = 'none';
            $gallery.innerHTML = `
                <div class="text-center py-16" style="color:var(--text-secondary)">
                    <i class="fa-regular fa-images block text-5xl mb-4" style="opacity:.25"></i>
                    <p class="text-base font-medium mb-1">No images yet</p>
                    <p class="text-sm">Drop some images above to get started.</p>
                </div>`;
            return;
        }
        $clearBtn.style.display = 'inline-flex';
        $gallery.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-3 gap-4">${images.map((im, i) => card(im, i)).join('')}</div>`;
    }

    function card(im, idx) {
        const ext = im.name.split('.').pop().toLowerCase();
        const bc  = ext === 'gif' ? 'gif' : ext === 'png' ? 'png' : 'jpg';
        return `
        <div class="gallery-card" style="animation-delay:${idx * 0.04}s" data-id="${im.id}">
            <button class="del-btn" onclick="window._del('${im.id}')" aria-label="Delete ${im.name}" title="Delete">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <img src="${im.url}" alt="${im.name}" class="card-image" loading="lazy">
            <div class="card-overlay">
                <span class="type-badge ${bc} mb-1.5 w-fit">${ext}</span>
                <p class="text-sm font-medium text-white truncate">${im.name}</p>
                <p class="text-xs mt-0.5" style="color:rgba(255,255,255,.55)">${fmtSize(im.size)} &middot; ${ago(im.ts)}</p>
            </div>
        </div>`;
    }

    /* Expose delete to inline onclick */
    window._del = function(id) {
        const im = images.find(i => i.id === id);
        if (!im) return;
        const el = document.querySelector(`.gallery-card[data-id="${id}"]`);
        if (el) {
            el.style.transition = 'all .28s ease';
            el.style.transform = 'scale(.78)';
            el.style.opacity = '0';
            setTimeout(() => { images = images.filter(i => i.id !== id); save(); render(); toast('success', `"${im.name}" deleted.`); }, 280);
        } else {
            images = images.filter(i => i.id !== id); save(); render(); toast('success', `"${im.name}" deleted.`);
        }
    };

    function clearAll() {
        if (!images.length) return;
        const cards = document.querySelectorAll('.gallery-card');
        cards.forEach((c, i) => {
            c.style.transition = 'all .22s ease';
            c.style.transitionDelay = `${i * 0.025}s`;
            c.style.transform = 'scale(.78)'; c.style.opacity = '0';
        });
        const n = images.length;
        setTimeout(() => { images = []; save(); render(); toast('success', `${n} image${n > 1 ? 's' : ''} cleared.`); }, cards.length * 25 + 220);
    }

    /* ── Toast ── */
    function toast(type, msg) {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-exclamation'}"></i><span>${msg}</span>`;
        $toasts.appendChild(el);
        setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3500);
    }

    /* ── Helpers ── */
    function fmtSize(b) {
        if (!b) return '0 B';
        const u = ['B','KB','MB','GB'];
        const i = Math.floor(Math.log(b) / Math.log(1024));
        return (b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
    }

    function ago(ts) {
        const d = Date.now() - new Date(ts).getTime();
        const s = Math.floor(d / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), dy = Math.floor(h / 24);
        if (s < 10) return 'just now';
        if (s < 60) return s + 's ago';
        if (m < 60) return m + 'm ago';
        if (h < 24) return h + 'h ago';
        if (dy < 30) return dy + 'd ago';
        return new Date(ts).toLocaleDateString();
    }

    /* ── Go ── */
    init();
})();