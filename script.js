/* ==========================================================
   Kopi Teduh — script.js
   Vanilla JS, tanpa library. Edit bagian PENGATURAN di bawah.

   Isi:
   1. Tautan WhatsApp, peta, tahun
   2. Navigasi ponsel, scroll halus, header
   3. Menu aktif, filter menu, status buka/tutup
   4. Muncul saat scroll (berurutan), parallax, foto
   5. Efek desktop: tilt 3D hero & kartu, tombol magnetik, kursor
   Semua efek gerak mati otomatis bila perangkat memilih
   "kurangi gerak" (prefers-reduced-motion).
   ========================================================== */
(() => {
  'use strict';

  /* ---------- PENGATURAN (edit di sini) ---------- */
  const SHOP = {
    // Nomor WhatsApp: kode negara tanpa tanda "+" dan tanpa 0 di depan.
    // Contoh: 0812-3456-7890 -> '6281234567890'
    // Nomor fiktif untuk portofolio. Ganti dengan nomor asli bila situs dipakai sungguhan.
    whatsappNumber: '000000000000',
    whatsappMessage: 'Halo Kopi Teduh, saya mau tanya atau pesan.',
    // Zona waktu kedai, dipakai untuk status "Buka sekarang".
    // WIB: 'Asia/Jakarta' | WITA: 'Asia/Makassar' | WIT: 'Asia/Jayapura'
    timeZone: 'Asia/Jakarta',
    // Tautan Google Maps kedai (salin dari tombol "Bagikan" di Google Maps).
    mapsUrl: ''
  };

  const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canAnimate = !reduceMotion;
  // Efek berbasis mouse hanya untuk perangkat dengan mouse/trackpad.
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  /* ==========================================================
     1. Tautan WhatsApp & peta, tahun
     ========================================================== */
  const waUrl =
    'https://wa.me/' + SHOP.whatsappNumber +
    '?text=' + encodeURIComponent(SHOP.whatsappMessage);
  $$('[data-wa]').forEach((a) => { a.href = waUrl; });

  if (SHOP.mapsUrl) {
    $$('[data-maps]').forEach((a) => { a.href = SHOP.mapsUrl; });
  }

  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ==========================================================
     2. Navigasi ponsel, scroll halus, header
     ========================================================== */
  const header = $('.site-header');
  const nav = $('#primary-nav');
  const toggle = $('.nav-toggle');
  const desktopQuery = window.matchMedia('(min-width: 56rem)');

  function setNav(open, returnFocus) {
    if (!nav || !toggle) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    const label = $('.sr-only', toggle);
    if (label) label.textContent = open ? 'Tutup menu navigasi' : 'Buka menu navigasi';
    if (open && header) header.classList.remove('is-hidden');
    if (!open && returnFocus) toggle.focus();
  }

  if (nav && toggle) {
    toggle.addEventListener('click', () => {
      setNav(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setNav(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setNav(false, true);
    });
    document.addEventListener('click', (e) => {
      if (toggle.getAttribute('aria-expanded') === 'true' && !header.contains(e.target)) setNav(false);
    });
    desktopQuery.addEventListener('change', (e) => { if (e.matches) setNav(false); });
  }

  /* Scroll halus untuk tautan #anchor (easing sendiri, tanpa library) */
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let scrollAnim = 0;

  function scrollToY(targetY, duration) {
    cancelAnimationFrame(scrollAnim);
    const startY = window.scrollY;
    const dist = targetY - startY;
    if (Math.abs(dist) < 2) return;

    let cancelled = false;
    const cancel = () => { cancelled = true; };
    ['wheel', 'touchstart', 'keydown'].forEach((evt) =>
      window.addEventListener(evt, cancel, { once: true, passive: true }));

    const t0 = performance.now();
    const step = (now) => {
      if (cancelled) return;
      const p = clamp((now - t0) / duration, 0, 1);
      window.scrollTo({ top: startY + dist * easeInOutCubic(p), behavior: 'instant' });
      if (p < 1) scrollAnim = requestAnimationFrame(step);
    };
    scrollAnim = requestAnimationFrame(step);
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const id = link.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target || !canAnimate) return; // biarkan perilaku bawaan browser

    e.preventDefault();
    const offset = parseFloat(getComputedStyle(root).scrollPaddingTop) || 80;
    const y = id === 'top' ? 0 : target.getBoundingClientRect().top + window.scrollY - offset + 1;
    const duration = clamp(Math.abs(y - window.scrollY) * 0.6, 500, 1100);
    scrollToY(y, duration);

    history.pushState(null, '', '#' + id);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* Satu pengendali scroll untuk header, progres, tombol WhatsApp, parallax */
  const waFloat = $('.wa-float');
  const parallaxEls = canAnimate ? $$('[data-parallax]') : [];
  let lastY = window.scrollY;
  let ticking = false;

  function updateParallax() {
    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      if (!el.isConnected) return;
      const host = el.parentElement; // dasar perhitungan: induk yang tidak ikut bergerak
      const r = host.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) return;
      let offset = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
      if (el.tagName === 'IMG') {
        const limit = r.height * 0.11; // gambar hanya punya kelebihan 12% di tiap sisi
        offset = clamp(offset, -limit, limit);
      }
      el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
    });
  }

  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;

    if (header) {
      header.classList.toggle('is-scrolled', y > 8);
      const max = root.scrollHeight - vh;
      header.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : '0');

      const navOpen = nav && nav.classList.contains('is-open');
      if (canAnimate && !navOpen && !header.contains(document.activeElement)) {
        if (y > lastY + 4 && y > 480) header.classList.add('is-hidden');
        else if (y < lastY - 4 || y <= 480) header.classList.remove('is-hidden');
      } else {
        header.classList.remove('is-hidden');
      }
    }
    if (Math.abs(y - lastY) > 4) lastY = y;

    if (waFloat) waFloat.classList.toggle('is-visible', y > vh * 0.6);
    if (parallaxEls.length) updateParallax();
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  });
  onScroll();

  /* ==========================================================
     3. Menu aktif, filter menu, status buka/tutup
     ========================================================== */
  const navLinks = new Map();
  $$('.nav__list a[href^="#"]').forEach((a) => navLinks.set(a.getAttribute('href').slice(1), a));

  if ('IntersectionObserver' in window && navLinks.size) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => link.removeAttribute('aria-current'));
        const active = navLinks.get(entry.target.id);
        if (active) active.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------- Muncul saat scroll, berurutan (stagger) ---------- */
  const reveals = $$('.reveal');
  let revealObserver = null;

  if (!canAnimate || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-visible'));
  } else {
    revealObserver = new IntersectionObserver((entries, obs) => {
      // Elemen yang muncul bersamaan diberi jeda berurutan, atas ke bawah, kiri ke kanan.
      const batch = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) =>
          (a.boundingClientRect.top - b.boundingClientRect.top) ||
          (a.boundingClientRect.left - b.boundingClientRect.left));
      batch.forEach((entry, i) => {
        const el = entry.target;
        el.style.transitionDelay = (Number(el.dataset.delay || 0) + i * 70) + 'ms';
        el.classList.add('is-visible');
        obs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- Filter menu ---------- */
  const chips = $$('.chip[data-filter]');
  const dishes = $$('.dish');
  const menuStatus = $('#menu-status');

  function applyFilter(key, announce) {
    const chip = chips.find((c) => c.dataset.filter === key);
    let count = 0;

    dishes.forEach((dish) => {
      const show = key === 'all' || dish.dataset.category === key;
      dish.hidden = !show;
      if (!show) return;
      count += 1;
      if (!announce) return;
      // Ulangi animasi muncul untuk kartu yang tampil setelah filter diganti
      if (revealObserver) {
        dish.classList.remove('is-visible');
        revealObserver.observe(dish);
      } else {
        dish.classList.add('is-visible');
      }
    });

    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));

    if (announce && menuStatus && chip) {
      menuStatus.textContent = key === 'all'
        ? 'Menampilkan semua ' + count + ' menu'
        : 'Menampilkan ' + count + ' menu ' + chip.textContent.trim();
    }
  }

  if (chips.length) {
    chips.forEach((chip) => {
      chip.addEventListener('click', () => applyFilter(chip.dataset.filter, true));
    });
    applyFilter(chips[0].dataset.filter, false); // kategori awal: yang pertama
  }

  /* ---------- Status buka / tutup ---------- */
  const rows = $$('tr[data-day]');
  const hours = {};

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const toLabel = (hhmm) => hhmm.replace(':', '.');

  rows.forEach((row) => {
    const { day, open, close } = row.dataset;
    hours[day] = open && close
      ? { open: toMinutes(open), close: toMinutes(close), openLabel: toLabel(open), closeLabel: toLabel(close) }
      : null; // baris tanpa data-open/close = libur
  });

  function nowInShop() {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: SHOP.timeZone,
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23'
      }).formatToParts(new Date());
      const get = (type) => parts.find((p) => p.type === type).value;
      const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { day: days[get('weekday')], minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
    } catch (err) {
      const d = new Date(); // cadangan: jam perangkat
      return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function nextOpening(fromDay) {
    for (let i = 1; i <= 7; i += 1) {
      const day = (fromDay + i) % 7;
      if (hours[day]) return { when: i === 1 ? 'besok' : 'hari ' + DAY_NAMES[day], at: hours[day].openLabel };
    }
    return null;
  }

  function updateStatus() {
    if (!rows.length) return;
    const { day, minutes } = nowInShop();
    const today = hours[day];
    let state = 'closed';
    let text;

    if (today && minutes >= today.open && minutes < today.close) {
      state = 'open';
      text = 'Buka sekarang, tutup pukul ' + today.closeLabel;
    } else if (today && minutes < today.open) {
      text = 'Tutup, buka hari ini pukul ' + today.openLabel;
    } else {
      const next = nextOpening(day);
      text = next ? 'Tutup, buka ' + next.when + ' pukul ' + next.at : 'Tutup untuk sementara';
    }

    $$('[data-status]').forEach((el) => {
      el.dataset.state = state;
      const label = $('.status__text', el);
      if (label) label.textContent = text;
    });

    rows.forEach((row) => {
      if (Number(row.dataset.day) === day) row.setAttribute('aria-current', 'date');
      else row.removeAttribute('aria-current');
    });
  }

  updateStatus();
  setInterval(updateStatus, 60 * 1000);

  /* ==========================================================
     4. Foto: muncul halus, cadangan bila gagal dimuat
     ========================================================== */
  // Bila foto tidak bisa dimuat, <img> dibuang dan ilustrasi di bawahnya tetap tampil.
  $$('.photo img, .band__img').forEach((img) => {
    const loaded = () => img.classList.remove('is-pending');
    const failed = () => img.remove();

    if (img.complete) {
      if (img.naturalWidth === 0) failed();
      return;
    }
    img.classList.add('is-pending');
    img.addEventListener('load', loaded, { once: true });
    img.addEventListener('error', failed, { once: true });
  });

  /* ==========================================================
     5. Efek desktop (mouse): hero 3D, tilt kartu, tombol, kursor
     ========================================================== */
  if (canAnimate && finePointer) {

    /* ---------- Hero: kedalaman mengikuti mouse ---------- */
    const hero = $('.hero');
    const stage = $('[data-hero-stage]');
    const tilt = $('[data-hero-tilt]');

    if (hero && stage && tilt) {
      let targetX = 0; let targetY = 0; let curX = 0; let curY = 0; let raf = 0;

      const loop = () => {
        curX += (targetX - curX) * 0.08;
        curY += (targetY - curY) * 0.08;
        tilt.style.setProperty('--px', curX.toFixed(3));
        tilt.style.setProperty('--py', curY.toFixed(3));
        tilt.style.setProperty('--rx', (-curY * 5).toFixed(2));
        tilt.style.setProperty('--ry', (curX * 7).toFixed(2));
        const settled = Math.abs(targetX - curX) < 0.002 && Math.abs(targetY - curY) < 0.002;
        raf = settled ? 0 : requestAnimationFrame(loop);
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

      hero.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = stage.getBoundingClientRect();
        targetX = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1);
        targetY = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2), -1, 1);
        kick();
      });
      hero.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; kick(); });
    }

    /* ---------- Kartu menu: tilt 3D halus + kilau cahaya ---------- */
    const tiltQuery = window.matchMedia('(min-width: 40rem)');

    $$('.dish').forEach((dish) => {
      const photo = $('.photo', dish);
      if (!photo) return;
      let raf = 0; let ev = null;

      const apply = () => {
        raf = 0;
        if (!ev) return;
        const r = dish.getBoundingClientRect();
        const nx = clamp((ev.clientX - r.left) / r.width, 0, 1);
        const ny = clamp((ev.clientY - r.top) / photo.offsetHeight, 0, 1);
        photo.style.transform =
          'perspective(900px) rotateX(' + ((0.5 - ny) * 9).toFixed(2) + 'deg) rotateY(' +
          ((nx - 0.5) * 11).toFixed(2) + 'deg) translateY(-4px)';
        photo.style.setProperty('--gx', (nx * 100).toFixed(1) + '%');
        photo.style.setProperty('--gy', (ny * 100).toFixed(1) + '%');
        const img = $('img', photo);
        if (img) img.style.transform = 'scale(1.09) translate3d(' + ((0.5 - nx) * 10).toFixed(1) + 'px,' + ((0.5 - ny) * 8).toFixed(1) + 'px,0)';
      };

      photo.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || !tiltQuery.matches) return;
        ev = e;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      photo.addEventListener('pointerleave', () => {
        ev = null;
        photo.style.transform = '';
        const img = $('img', photo);
        if (img) img.style.transform = '';
      });
    });

    /* ---------- Tombol: magnetik + cahaya yang mengikuti kursor ---------- */
    $$('.btn').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        btn.style.setProperty('--bx', clamp(dx * 0.22, -7, 7).toFixed(1) + 'px');
        btn.style.setProperty('--by', clamp(dy * 0.3, -5, 5).toFixed(1) + 'px');
        btn.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
        btn.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
      });
      btn.addEventListener('pointerleave', () => {
        btn.style.setProperty('--bx', '0px');
        btn.style.setProperty('--by', '0px');
      });
    });

    /* ---------- Kursor: cincin halus yang membesar di atas elemen interaktif ---------- */
    const ring = document.createElement('div');
    const dot = document.createElement('div');
    ring.className = 'cursor';
    dot.className = 'cursor-dot';
    ring.setAttribute('aria-hidden', 'true');
    dot.setAttribute('aria-hidden', 'true');
    document.body.append(ring, dot);
    root.classList.add('has-cursor');

    let mx = 0; let my = 0; let rx = 0; let ry = 0; let cursorRaf = 0; let seen = false;
    const INTERACTIVE = 'a, button, summary, input, [role="button"], .dish .photo';

    const cursorLoop = () => {
      rx += (mx - rx) * 0.2;
      ry += (my - ry) * 0.2;
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      const settled = Math.abs(mx - rx) < 0.1 && Math.abs(my - ry) < 0.1;
      cursorRaf = settled ? 0 : requestAnimationFrame(cursorLoop);
    };

    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      if (!seen) { seen = true; rx = mx; ry = my; ring.classList.add('is-on'); dot.classList.add('is-on'); }
      const overLink = !!e.target.closest(INTERACTIVE);
      const overDark = !!e.target.closest('.on-dark, [data-dark], .is-night');
      ring.classList.toggle('is-link', overLink);
      ring.classList.toggle('is-dark', overDark);
      dot.classList.toggle('is-dark', overDark);
      if (!cursorRaf) cursorRaf = requestAnimationFrame(cursorLoop);
    }, { passive: true });

    document.addEventListener('pointerdown', () => ring.classList.add('is-down'));
    document.addEventListener('pointerup', () => ring.classList.remove('is-down'));
    document.documentElement.addEventListener('mouseleave', () => {
      ring.classList.remove('is-on'); dot.classList.remove('is-on'); seen = false;
    });
  }
})();
