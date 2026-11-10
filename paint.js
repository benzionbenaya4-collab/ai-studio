// עורך ציור: מציירים בעכבר (מחשב) או באצבע/עט (טלפון וטאבלט).
// openPaint({ aspect, base, title, canEnhance }) → Promise<{ img, enhance } | null>
'use strict';
function openPaint({ aspect = '1:1', base = '', title = 'ציור', canEnhance = false } = {}) {
  const [W, H] = aspect === '16:9' ? [1280, 720] : [1024, 1024];
  const COLORS = ['#000000', '#ffffff', '#e63946', '#f4a261', '#ffd166', '#2a9d8f', '#3a86ff', '#8338ec', '#ff70a6', '#8d5524', '#6c757d', '#90be6d'];
  return new Promise(resolve => {
    const st = { tool: 'pen', color: '#000000', size: 12, drawing: false, last: null, undo: [] };
    const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v)); kids.forEach(k => e.append(k)); return e; };

    const cv = el('canvas', { width: W, height: H, class: 'pt-canvas' });
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const snap = () => { st.undo.push(ctx.getImageData(0, 0, W, H)); if (st.undo.length > 25) st.undo.shift(); };
    const undo = () => { const d = st.undo.pop(); if (d) ctx.putImageData(d, 0, 0); };
    const fillAll = c => { snap(); ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); };
    const drawImageCover = (src, done) => {
      const im = new Image();
      im.onload = () => { snap(); const sc = Math.max(W / im.width, H / im.height); ctx.drawImage(im, (W - im.width * sc) / 2, (H - im.height * sc) / 2, im.width * sc, im.height * sc); done && done(); };
      im.src = src;
    };
    if (base) drawImageCover(base, () => { st.undo = []; });

    // ---------- ציור עם עכבר / אצבע ----------
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height, p: e.pressure || 0.5 }; };
    const stroke = (a, b) => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = st.tool === 'eraser' ? '#ffffff' : st.color;
      const pressure = b.p && b.p !== 0.5 ? 0.5 + b.p : 1;
      ctx.lineWidth = st.size * (st.tool === 'eraser' ? 2.5 : 1) * pressure;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.quadraticCurveTo(a.x, a.y, mx, my); ctx.lineTo(b.x, b.y); ctx.stroke();
    };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      const p = pos(e);
      if (st.tool === 'fill') { floodFill(Math.floor(p.x), Math.floor(p.y)); return; }
      snap(); st.drawing = true; st.last = p; stroke(p, p);
    });
    cv.addEventListener('pointermove', e => {
      if (!st.drawing) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) { const p = pos(ev); stroke(st.last, p); st.last = p; }
    });
    const end = () => { st.drawing = false; st.last = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

    // דלי צבע – ממלא אזור סגור
    function floodFill(x, y) {
      snap();
      const img = ctx.getImageData(0, 0, W, H), d = img.data;
      const i0 = (y * W + x) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
      const c = parseInt(st.color.slice(1), 16), fr = c >> 16 & 255, fg = c >> 8 & 255, fb = c & 255;
      if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 10) return;
      const same = i => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) < 90;
      const stack = [[x, y]];
      while (stack.length) {
        let [cx, cy] = stack.pop(), i = (cy * W + cx) * 4;
        while (cx >= 0 && same(i)) { cx--; i -= 4; }
        cx++; i += 4;
        let up = false, dn = false;
        while (cx < W && same(i)) {
          d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
          if (cy > 0) { const u = same(i - W * 4); if (u && !up) stack.push([cx, cy - 1]); up = u; }
          if (cy < H - 1) { const v = same(i + W * 4); if (v && !dn) stack.push([cx, cy + 1]); dn = v; }
          cx++; i += 4;
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    // ---------- סרגל כלים ----------
    const toolBtns = {};
    const toolBtn = (k, label) => (toolBtns[k] = el('button', { class: 'pt-btn', onclick: () => { st.tool = k; refresh(); } }, label));
    const swatches = el('div', { class: 'pt-sw' }, ...COLORS.map(c => el('button', { class: 'pt-color', style: `background:${c}`, title: c, onclick: () => { st.color = c; picker.value = c; if (st.tool === 'eraser') st.tool = 'pen'; refresh(); } })));
    const picker = el('input', { type: 'color', value: st.color, class: 'pt-picker', title: 'צבע אחר', oninput: () => { st.color = picker.value; refresh(); } });
    const size = el('input', { type: 'range', min: 2, max: 80, value: st.size, class: 'pt-size', oninput: () => { st.size = +size.value; } });
    const fileIn = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: () => { const f = fileIn.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => drawImageCover(fr.result); fr.readAsDataURL(f); fileIn.value = ''; } });
    const close = val => { document.removeEventListener('keydown', onKey); ov.remove(); document.body.style.overflow = ''; resolve(val); };
    const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); } };
    document.addEventListener('keydown', onKey);

    const bar = el('div', { class: 'pt-bar' },
      toolBtn('pen', '✏️ עט'), toolBtn('eraser', '🧽 מחק'), toolBtn('fill', '🪣 דלי'),
      swatches, picker,
      el('label', { class: 'pt-lbl' }, 'עובי', size),
      el('button', { class: 'pt-btn', onclick: undo, title: 'Ctrl+Z' }, '↶ ביטול'),
      el('button', { class: 'pt-btn', onclick: () => fillAll(st.color) }, '🎨 צבע רקע'),
      el('button', { class: 'pt-btn', onclick: () => { if (confirm('לנקות את כל הציור?')) fillAll('#ffffff'); } }, '🗑 נקה'),
      el('button', { class: 'pt-btn', onclick: () => fileIn.click() }, '🖼 הוסף תמונה'),
      fileIn);
    const actions = el('div', { class: 'pt-actions' },
      el('b', {}, '🎨 ' + title),
      el('span', { style: 'flex:1' }),
      el('button', { class: 'pt-btn', onclick: () => close(null) }, '✕ בטל'),
      canEnhance ? el('button', { class: 'pt-btn pt-ai', onclick: () => close({ img: cv.toDataURL('image/png'), enhance: true }) }, '✨ שמור והפוך לתמונה מקצועית (ננו בננה)') : '',
      el('button', { class: 'pt-btn pt-save', onclick: () => close({ img: cv.toDataURL('image/png'), enhance: false }) }, '💾 שמור ציור'));
    const ov = el('div', { class: 'pt-ov' }, actions, el('div', { class: 'pt-stage' }, cv), bar);
    function refresh() {
      Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('on', st.tool === k));
      swatches.querySelectorAll('.pt-color').forEach(b => b.classList.toggle('on', b.title === st.color && st.tool !== 'eraser'));
    }
    refresh();
    document.body.style.overflow = 'hidden';
    document.body.append(ov);
    // מתאים את גודל הקנבס למסך (מחשב או טלפון)
    const stage = ov.querySelector('.pt-stage');
    const fit = () => {
      if (!ov.isConnected) return window.removeEventListener('resize', fit);
      const r = stage.getBoundingClientRect(), s = Math.min((r.width - 12) / W, (r.height - 12) / H);
      cv.style.width = Math.max(50, W * s) + 'px'; cv.style.height = Math.max(50, H * s) + 'px';
    };
    window.addEventListener('resize', fit);
    requestAnimationFrame(fit);
  });
}
