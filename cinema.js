/* ==========================================================
   Kopi Teduh — cinema.js
   Lapisan sinematik di atas script.js. Vanilla JS, tanpa library.

   Isi:
   1. Hitung persen di tirai pembuka
   2. Teks dipecah: huruf (hero) dan kata (judul)
   3. Debu cahaya di hero (canvas ringan)
   4. Scroll halus untuk roda mouse (touch dan keyboard tetap bawaan)
   5. Mesin scroll: latar bergradasi, hero memudar, opasitas dan
      parallax elemen, bagian "Sehari" yang di-pin

   Semua efek mati bila perangkat memilih "kurangi gerak".
   Variabel CSS yang diisi di sini dipakai oleh styles.css
   (blok "UPGRADE v3"): --hs, --si, --sv, --sc, --tx, --c, dll.
   ========================================================== */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // tampilan statis, semua konten tetap terbaca

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgb = (c) => 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const wide = window.matchMedia('(min-width: 56rem)');

  /* ==========================================================
     1. Tirai pembuka: hitung persen
     ========================================================== */
  const countEl = $('.intro [data-count]');
  if (countEl && !root.classList.contains('no-intro')) {
    const t0 = performance.now();
    const dur = 1250;
    const tick = (now) => {
      const p = clamp((now - t0) / dur, 0, 1);
      const v = Math.round(100 * (1 - Math.pow(1 - p, 3)));
      countEl.textContent = String(v).padStart(3, '0');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ==========================================================
     2. Teks dipecah
     ========================================================== */
  // Hero: huruf demi huruf. Teks asli tetap dibaca pembaca layar lewat aria-label.
  const heroTitle = $('.hero__title');
  if (heroTitle) {
    heroTitle.setAttribute('aria-label', heroTitle.textContent.replace(/\s+/g, ' ').trim());
    $$('.hero__line-inner', heroTitle).forEach((line) => {
      const text = line.textContent.trim();
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      let ci = 0;
      text.split(' ').forEach((word, wi, all) => {
        const w = document.createElement('span');
        w.className = 'cw';
        Array.from(word).forEach((chr) => {
          const c = document.createElement('span');
          c.className = 'ch';
          c.style.setProperty('--ci', String(ci++));
          c.textContent = chr;
          w.appendChild(c);
        });
        line.appendChild(w);
        if (wi < all.length - 1) line.appendChild(document.createTextNode(' '));
      });
    });
    heroTitle.classList.add('is-split');
  }

  // Judul seksi: kata demi kata (kata miring di dalam <em> ikut terpecah)
  function splitWords(el) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    let wi = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.setAttribute('aria-hidden', 'true');
            const inner = document.createElement('span');
            inner.className = 'w__i';
            inner.style.setProperty('--wi', String(wi++));
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
  }

  const titles = $$('[data-split]');
  titles.forEach(splitWords);
  root.classList.add('cine'); // mengaktifkan keadaan awal efek di CSS

  if ('IntersectionObserver' in window) {
    const titleObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        titleObserver.unobserve(entry.target);
      });
    }, { threshold: 0.4, rootMargin: '0px 0px -8% 0px' });
    titles.forEach((t) => titleObserver.observe(t));
  } else {
    titles.forEach((t) => t.classList.add('is-in'));
  }

  // Foto latar di luar .photo: bila gagal dimuat, dibuang agar gradasi cahaya tetap tampil
  $$('img[data-fallback]').forEach((img) => {
    if (img.closest('.photo')) return; // sudah ditangani script.js
    if (img.complete) { if (img.naturalWidth === 0) img.remove(); return; }
    img.style.opacity = '0';
    img.style.transition = 'opacity .9s ease';
    img.addEventListener('load', () => { img.style.opacity = ''; }, { once: true });
    img.addEventListener('error', () => img.remove(), { once: true });
  });

  /* ==========================================================
     3. Debu cahaya di hero
     ========================================================== */
  const dustCanvas = $('[data-dust]');
  const heroEl = $('[data-hero]');

  if (dustCanvas && dustCanvas.getContext && heroEl) {
    const ctx = dustCanvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0; let h = 0; let motes = []; let raf = 0; let visible = true;

    // Satu bola cahaya digambar sekali, lalu dipakai ulang (lebih ringan daripada gradient per frame)
    const sprite = document.createElement('canvas');
    sprite.width = 64; sprite.height = 64;
    const sctx = sprite.getContext('2d');
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,224,170,1)');
    grad.addColorStop(0.35, 'rgba(255,205,135,.45)');
    grad.addColorStop(1, 'rgba(255,205,135,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);

    const size = () => {
      const r = dustCanvas.getBoundingClientRect();
      w = r.width; h = r.height;
      dustCanvas.width = Math.max(1, Math.round(w * dpr));
      dustCanvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 700 ? 16 : 42;
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 4 + Math.random() * 11,
        vy: 0.08 + Math.random() * 0.24,
        vx: (Math.random() - 0.5) * 0.12,
        ph: Math.random() * 6.28,
        sp: 0.4 + Math.random() * 0.9,
        a: 0.25 + Math.random() * 0.55
      }));
    };

    const draw = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      ctx.clearRect(0, 0, w, h);
      const t = now / 1000;
      for (const m of motes) {
        m.y -= m.vy;
        m.x += m.vx + Math.sin(t * m.sp + m.ph) * 0.18;
        if (m.y < -20) { m.y = h + 20; m.x = Math.random() * w; }
        if (m.x < -20) m.x = w + 20;
        if (m.x > w + 20) m.x = -20;
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.4 * m.sp + m.ph);
        ctx.globalAlpha = m.a * (0.25 + 0.75 * twinkle);
        ctx.drawImage(sprite, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      }
      raf = requestAnimationFrame(draw);
    };
    const run = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw); };

    size();
    window.addEventListener('resize', () => { size(); run(); });
    document.addEventListener('visibilitychange', run);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible) run();
      }).observe(heroEl);
    }
    run();
  }

  /* ==========================================================
     4. Scroll halus untuk roda mouse
        Hanya perangkat dengan mouse. Touch, keyboard, dan
        scrollbar tetap memakai scroll bawaan browser.
     ========================================================== */
  if (finePointer) {
    let target = 0; let current = 0; let active = false; let raf = 0; let lastSet = 0; let lastT = 0;
    const maxY = () => Math.max(0, root.scrollHeight - window.innerHeight);

    const stop = () => { active = false; if (raf) cancelAnimationFrame(raf); raf = 0; };

    const step = (now) => {
      const dt = Math.min(48, now - (lastT || now));
      lastT = now;
      // Kecepatan mengejar tidak bergantung pada refresh rate layar
      current += (target - current) * (1 - Math.pow(1 - 0.1, dt / 16.67));
      if (Math.abs(target - current) < 0.4) { current = target; active = false; }
      lastSet = current;
      window.scrollTo(0, current);
      raf = active ? requestAnimationFrame(step) : 0;
      if (!active) lastT = 0;
    };

    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey || e.defaultPrevented) return;        // zoom
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;             // geser horizontal
      for (let n = e.target; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY;                      // elemen dengan scroll sendiri
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return;
      }
      const dy = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1);
      e.preventDefault();
      if (!active) { current = window.scrollY; target = current; }
      target = clamp(target + dy, 0, maxY());
      if (!active) { active = true; lastT = 0; raf = requestAnimationFrame(step); }
    }, { passive: false });

    // Scroll dari sumber lain (keyboard, scrollbar, tautan #anchor) menghentikan scroll halus
    window.addEventListener('scroll', () => {
      if (active && Math.abs(window.scrollY - lastSet) > 3) stop();
    }, { passive: true });
    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('a[href^="#"]')) stop();
    }, true);
  }

  /* ==========================================================
     5. Mesin scroll
     ========================================================== */
  const hero = heroEl;
  const backdrop = $('.backdrop');
  const scrubEls = $$('[data-scrub], .dish, .about__media');

  // Warna latar tiap seksi (atas -> bawah). Latar halaman berpindah warna mengikuti scroll.
  const palette = [
    ['[data-hero]',  [244, 236, 221], [239, 226, 200]],
    ['#menu',        [244, 236, 221], [240, 224, 194]],
    ['.band',        [236, 214, 176], [226, 199, 154]],
    ['#sehari',      [234, 223, 200], [232, 219, 192]],
    ['#cerita',      [233, 222, 196], [224, 212, 182]],
    ['#kunjungi',    [231, 224, 200], [222, 226, 198]],
    ['#kontak',      [222, 226, 198], [222, 226, 198]]
  ].map(([sel, a, b]) => ({ el: $(sel), a, b, top: 0, height: 1 })).filter((s) => s.el);

  /* ---------- Bagian "Sehari": pin + geser horizontal + langit berubah ---------- */
  const day = $('[data-day]');
  const dayPin = $('[data-day-pin]');
  const dayStage = $('[data-day-sticky]');
  const dayTrack = $('[data-day-track]');
  const dayOrb = $('[data-day-orb]');
  const dayClock = $('[data-day-clock]');
  const dayBar = $('[data-day-bar]');
  const slots = day ? $$('.slot', day) : [];

  const SKY = [
    { a: [246, 227, 188], b: [239, 201, 143], orb: [255, 201, 122] }, // pagi
    { a: [238, 240, 210], b: [220, 227, 188], orb: [255, 244, 201] }, // siang
    { a: [232, 162, 95],  b: [182, 85, 47],   orb: [255, 122, 61] },  // sore
    { a: [30, 19, 14],    b: [15, 9, 7],      orb: [244, 236, 221] }  // malam
  ];
  const INK_DAY = [42, 26, 17];
  const INK_NIGHT = [244, 236, 221];

  let pinned = false; let dayDist = 0; let slotCenters = []; let focalX = 0;

  function layoutDay() {
    if (!day || !dayPin || !dayTrack) return;
    const on = wide.matches;
    day.classList.toggle('day--pinned', on);
    pinned = on;
    if (!on) {
      dayPin.style.height = '';
      dayTrack.style.removeProperty('--tx');
      slots.forEach((s) => s.style.removeProperty('--c'));
      day.classList.remove('is-night');
      return;
    }
    const vh = window.innerHeight;
    // Geser sampai panel terakhir berada di posisi panel pertama saat mulai
    dayDist = slots.length > 1 ? Math.max(0, slots[slots.length - 1].offsetLeft - slots[0].offsetLeft) : 0;
    const len = Math.max(dayDist * 1.5, vh * 2.2); // panjang scroll selama di-pin
    dayPin.style.height = Math.round(vh + len) + 'px';
    slotCenters = slots.map((s) => s.offsetLeft + s.offsetWidth / 2);
    focalX = slotCenters[0] || 0;
  }

  function updateDay(vh, vw) {
    if (!pinned) return;
    const rect = dayPin.getBoundingClientRect();
    if (rect.bottom < -vh * 0.2 || rect.top > vh * 1.2) return; // jauh dari layar
    const len = dayPin.offsetHeight - vh;
    const p = clamp(-rect.top / len, 0, 1);

    dayTrack.style.setProperty('--tx', (-p * dayDist).toFixed(1) + 'px');

    // Panel di dekat titik fokus tampak jelas, yang jauh memudar dan sedikit buram
    slots.forEach((s, i) => {
      const cx = slotCenters[i] - p * dayDist;
      const c = 1 - clamp(Math.abs(cx - focalX) / (vw * 0.5), 0, 1);
      s.style.setProperty('--c', smooth(c).toFixed(3));
    });

    // Langit: pagi -> siang -> sore -> malam
    const seg = p * (SKY.length - 1);
    const i = Math.min(Math.floor(seg), SKY.length - 2);
    const t = smooth(seg - i);
    const s0 = SKY[i]; const s1 = SKY[i + 1];
    dayStage.style.setProperty('--sky-a', rgb(mixRGB(s0.a, s1.a, t)));
    dayStage.style.setProperty('--sky-b', rgb(mixRGB(s0.b, s1.b, t)));

    // Warna teks berbalik cepat saat langit sore menggelap (menjaga kontras)
    const tSN = clamp((p - 2 / 3) / (1 / 3), 0, 1);
    const flip = smooth(clamp((tSN - 0.28) / 0.14, 0, 1));
    dayStage.style.setProperty('--day-ink', rgb(mixRGB(INK_DAY, INK_NIGHT, flip)));
    day.classList.toggle('is-night', flip > 0.5);

    // Matahari lalu bulan bergerak melengkung
    if (dayOrb) {
      const size = dayOrb.offsetWidth || 160;
      dayOrb.style.setProperty('--ox', ((0.06 + 0.8 * p) * vw - size / 2).toFixed(1) + 'px');
      dayOrb.style.setProperty('--oy', ((0.66 - 0.5 * Math.sin(Math.PI * p)) * vh - size / 2).toFixed(1) + 'px');
      dayOrb.style.setProperty('--orb', rgb(mixRGB(s0.orb, s1.orb, t)));
    }

    // Jam berjalan 07.00 sampai 22.00
    if (dayClock) {
      const mins = Math.round(7 * 60 + p * 15 * 60);
      const label = String(Math.floor(mins / 60)).padStart(2, '0') + '.' + String(mins % 60).padStart(2, '0');
      if (dayClock.textContent !== label) dayClock.textContent = label;
    }
    if (dayBar) dayBar.style.setProperty('--dp', p.toFixed(4));
  }

  /* ---------- Pengukuran dan kedalaman kartu menu ---------- */
  function measure() {
    palette.forEach((s) => {
      const r = s.el.getBoundingClientRect();
      s.top = r.top + window.scrollY;
      s.height = Math.max(1, r.height);
    });
  }

  function assignDepths() {
    const shown = $$('.dish').filter((d) => !d.hidden);
    const cols = window.matchMedia('(min-width: 64rem)').matches ? 3
      : window.matchMedia('(min-width: 40rem)').matches ? 2 : 1;
    const depths = cols === 3 ? [24, 60, 96] : cols === 2 ? [30, 80] : [0];
    shown.forEach((d, i) => d.style.setProperty('--depth', String(depths[i % cols])));
  }

  // Warna latar pada posisi Y (koordinat halaman), berpindah halus antar seksi
  function washAt(Y) {
    let idx = 0;
    for (let i = 0; i < palette.length; i += 1) if (palette[i].top <= Y) idx = i;
    const s = palette[idx];
    const f = clamp((Y - s.top) / s.height, 0, 1);
    let col = mixRGB(s.a, s.b, f);
    const next = palette[idx + 1];
    if (next) col = mixRGB(col, next.a, smooth(clamp((f - 0.6) / 0.4, 0, 1)));
    return col;
  }

  let lastHs = -1;

  function frame() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const maxScroll = Math.max(1, root.scrollHeight - vh);
    const P = clamp(y / maxScroll, 0, 1);

    // Hero memudar
    if (hero) {
      const hs = clamp(y / (hero.offsetHeight * 0.85), 0, 1);
      if (hs !== lastHs) { hero.style.setProperty('--hs', hs.toFixed(4)); lastHs = hs; }
    }

    // Latar bergradasi + cahaya yang bergeser
    if (backdrop && palette.length) {
      const top = washAt(y);
      const bottom = washAt(y + vh);
      const wave = (k, ph) => 0.5 + 0.5 * Math.sin(P * Math.PI * k + ph);
      backdrop.style.setProperty('--wash-a', rgb(top));
      backdrop.style.setProperty('--wash-b', rgb(bottom));
      backdrop.style.setProperty('--gx', (8 + 84 * P).toFixed(1));
      backdrop.style.setProperty('--gy', (18 + 60 * wave(4, 0)).toFixed(1));
      backdrop.style.setProperty('--go', (0.25 + 0.35 * wave(6, 1.2)).toFixed(3));
      backdrop.style.setProperty('--gx2', (92 - 84 * P).toFixed(1));
      backdrop.style.setProperty('--gy2', (80 - 55 * wave(3, 1)).toFixed(1));
      backdrop.style.setProperty('--go2', (0.2 + 0.25 * wave(5, 2.4)).toFixed(3));
    }

    // Opasitas, posisi, dan skala elemen mengikuti scroll
    scrubEls.forEach((el) => {
      if (el.hidden) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) return;
      const enter = smooth(clamp((vh - r.top) / (vh * 0.4), 0, 1));
      const leave = smooth(clamp(r.bottom / (vh * 0.35), 0, 1));
      el.style.setProperty('--si', enter.toFixed(3));
      el.style.setProperty('--sv', Math.min(enter, leave).toFixed(3));
      el.style.setProperty('--sc', ((r.top + r.height / 2) / vh).toFixed(3));
    });

    updateDay(vh, vw);
  }

  let ticking = false;
  const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };

  function layoutAll() {
    layoutDay();
    measure();
    assignDepths();
    schedule();
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', layoutAll);
  window.addEventListener('load', layoutAll);
  wide.addEventListener('change', layoutAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutAll);

  // Filter menu mengubah tinggi halaman: ukur ulang
  $$('.chip[data-filter]').forEach((chip) => chip.addEventListener('click', () => {
    requestAnimationFrame(layoutAll);
  }));

  layoutAll();
})();
