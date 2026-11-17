/* Juicebox: scroll-scrubbed hero + page behavior. Vanilla JS, no build step. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  const hero = $('#top'), stage = $('#stage'), video = $('#hero'), poster = $('#poster'), ring = $('#ring');
  const VIDEO_URL = 'assets/hero-scrub.mp4';
  const VIDEO_BYTES = 2233026;                       // fallback when Content-Length is missing
  const POSTER_URL = 'assets/hero-poster.jpg';

  /* ---------- split headline text (seeded, identical on every load) ---------- */
  $$('[data-split]').forEach((el, idx) => {
    const text = el.textContent.trim();
    const fx = el.dataset.fx || 'rise';
    const em = (el.dataset.em || '').split(',').map(s => s.trim().toLowerCase());
    const rnd = rng(4242 + idx * 77);
    const words = text.split(' ');
    el.textContent = '';
    const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text;
    const vis = document.createElement('span'); vis.className = 'vis'; vis.setAttribute('aria-hidden', 'true');
    words.forEach((word, wi) => {
      const w = document.createElement('span');
      w.className = 'w' + (em.indexOf(word.toLowerCase()) > -1 ? ' em' : '');
      w.style.setProperty('--th', ((wi / Math.max(1, words.length - 1)) * 0.5).toFixed(3));
      if (fx === 'scatter') {
        Array.from(word).forEach(ch => {
          const c = document.createElement('span'); c.className = 'c'; c.textContent = ch;
          c.style.setProperty('--th', (rnd() * 0.55).toFixed(3));
          c.style.setProperty('--jx', Math.round((rnd() - .5) * 120) + 'px');
          c.style.setProperty('--jy', Math.round((rnd() - .5) * 90) + 'px');
          c.style.setProperty('--jr', Math.round((rnd() - .5) * 60) + 'deg');
          w.appendChild(c);
        });
      } else { w.textContent = word; }
      vis.appendChild(w);
      if (wi < words.length - 1) vis.appendChild(document.createTextNode(' '));
    });
    el.classList.add('split', 'fx-' + fx);
    el.append(sr, vis);
  });

  /* ---------- hero engine ---------- */
  const bands = $$('.band').map(el => ({
    el, a: +el.dataset.a, b: +el.dataset.b, first: !!el.dataset.first, last: !!el.dataset.last,
    op: -1, k: -1, on: false
  }));
  let target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true;
  let loadK = 0, loadRaf = null, scrubOn = false, heroInited = false;
  let seekBusy = false, pendingTime = null;

  function heroProgress() {
    const r = hero.getBoundingClientRect();
    const range = hero.offsetHeight - innerHeight;
    return range > 0 ? clamp(-r.top / range, 0, 1) : 0;
  }

  function requestSeek(t) {
    if (!video.duration) return;
    if (seekBusy) { pendingTime = t; return; }
    seekBusy = true;
    video.currentTime = clamp(t, 0, video.duration - 0.001);
  }
  video.addEventListener('seeked', () => {
    seekBusy = false;
    if (pendingTime !== null) { const t = pendingTime; pendingTime = null; requestSeek(t); }
  });
  video.addEventListener('error', () => { seekBusy = false; pendingTime = null; failVideo(); });

  let lastBlend = -1;
  function updateCaptions(p) {
    const bo = Math.round(smoothstep(p, 0.9, 1) * 1000) / 1000;   // blend the hero's bottom edge into the pink section
    if (Math.abs(bo - lastBlend) > 0.004 || ((bo === 0 || bo === 1) && bo !== lastBlend)) { lastBlend = bo; stage.style.setProperty('--bo', bo); }
    for (const bd of bands) {
      const { a, b } = bd;
      const f = Math.min(0.02, (b - a) / 3);
      let o = 1;
      if (!bd.first) o *= smoothstep(p, a, a + f);
      if (!bd.last) o *= 1 - smoothstep(p, b - f, b);
      if (p < a && !bd.first) o = 0;
      if (p > b && !bd.last) o = 0;
      o = Math.round(o * 1000) / 1000;
      if (Math.abs(o - bd.op) > 0.004 || ((o === 0 || o === 1) && o !== bd.op)) {
        bd.op = o; bd.el.style.opacity = o;
      }
      const on = o > 0.01;
      if (on !== bd.on) { bd.on = on; bd.el.classList.toggle('on', on); }
      if (on || bd.k < 0) {
        const ramp = Math.min(0.04, (b - a) * 0.35);
        let k = clamp((p - a) / ramp, 0, 1);
        if (bd.first) k = Math.max(k, loadK);
        k = Math.round(k * 1000) / 1000;
        if (Math.abs(k - bd.k) > 0.008 || ((k === 0 || k === 1) && k !== bd.k)) {
          bd.k = k; bd.el.style.setProperty('--k', k);
        }
      }
    }
  }

  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
    if (Math.abs(target - shown) < 0.0005) { shown = target; rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
    requestSeek(shown * (video.duration || 0));
    updateCaptions(shown);
  }
  function wake() { if (rafId === null && heroOnScreen && scrubOn) rafId = requestAnimationFrame(tick); }
  function onScroll() { target = heroProgress(); wake(); }

  new IntersectionObserver(es => {
    heroOnScreen = es[0].isIntersecting;
    if (heroOnScreen) { target = heroProgress(); wake(); }
    else if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; lastTick = 0; }
  }, { threshold: 0 }).observe(hero);

  /* band one assembles on load, then hands over to scroll */
  function startLoadRamp() {
    const t0 = performance.now() + 250;
    const step = now => {
      loadK = clamp((now - t0) / 1300, 0, 1);
      updateCaptions(scrubOn ? shown : 0);
      if (loadK < 1) loadRaf = requestAnimationFrame(step); else loadRaf = null;
    };
    loadRaf = requestAnimationFrame(step);
  }

  /* ---------- video: poster first, then blob with an honest ring ---------- */
  function initHeroOnce() {
    if (heroInited) return; heroInited = true;
    poster.style.backgroundImage = "url('" + POSTER_URL + "')";
    let started = false;
    const go = () => { if (started) return; started = true; loadHeroBlob().catch(failVideo); };
    const img = new Image(); img.onload = go; img.onerror = go; img.src = POSTER_URL;
    setTimeout(go, 4000);
  }
  async function loadHeroBlob() {
    const ctrl = new AbortController();
    let watchdog = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(VIDEO_URL, { priority: 'low', signal: ctrl.signal });
    if (!res.ok) throw new Error('video ' + res.status);
    const total = Number(res.headers.get('Content-Length')) || VIDEO_BYTES;
    const reader = res.body.getReader();
    const chunks = []; let got = 0, lastRing = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      clearTimeout(watchdog); watchdog = setTimeout(() => ctrl.abort(), 20000);
      chunks.push(value); got += value.length;
      const frac = Math.min(1, got / total), now = performance.now();
      if (now - lastRing > 100 || frac === 1) { lastRing = now; ring.style.setProperty('--ld', Math.round(126 * (1 - frac))); }
    }
    clearTimeout(watchdog);
    ring.style.setProperty('--ld', 0);
    video.src = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
    video.load();
    video.addEventListener('canplay', () => {
      target = shown = heroProgress();
      requestSeek(shown * video.duration);
      stage.classList.add('video-ready');
    }, { once: true });
  }
  function failVideo() {
    hero.classList.add('video-failed'); stage.classList.add('video-failed');
    poster.style.backgroundImage = '';   // let the CSS still frame (the composed ending) take over
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ---------- the five static-hero gates, live (must match styles.css exactly) ---------- */
  const GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  function enableScrub() {
    if (scrubOn) return; scrubOn = true;
    initHeroOnce();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    bands.forEach(b => { b.op = -1; b.k = -1; b.on = false; });
    target = shown = heroProgress();
    if (video.duration) requestSeek(shown * video.duration);
    updateCaptions(shown);
    if (loadK < 1 && loadRaf === null) startLoadRamp();
    onScroll();
  }
  function disableScrub() {
    if (!scrubOn) return; scrubOn = false;
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; lastTick = 0; }
  }
  function applyHeroMode() { if (GATES.some(q => matchMedia(q).matches)) disableScrub(); else enableScrub(); }
  const MQLS = GATES.map(q => matchMedia(q));
  MQLS.forEach(m => m.addEventListener('change', applyHeroMode));

  /* ---------- nav, reveals, living elements ---------- */
  const nav = $('#nav'); let navSolid = false, navInHero = null;
  function navCheck() {
    // only the logo shows over the hero; the menu and a solid bar arrive with the next section
    const inHero = hero.getBoundingClientRect().bottom > nav.offsetHeight + 8;
    if (inHero !== navInHero) { navInHero = inHero; nav.classList.toggle('in-hero', inHero); }
    const s = !inHero;
    if (s !== navSolid) { navSolid = s; nav.classList.toggle('solid', s); }
  }
  addEventListener('scroll', navCheck, { passive: true }); addEventListener('resize', navCheck, { passive: true }); navCheck();

  const secs = $$('.sec');
  secs.forEach(sec => $$('.rv', sec).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 8))));
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      const t = e.target;
      t.classList.toggle('live', e.isIntersecting);
      if (e.isIntersecting && t.classList.contains('sec') && !t.classList.contains('in')) {
        t.classList.add('in');
        setTimeout(() => t.classList.add('done'), 2400);   // retire stagger delays so hovers never lag
      }
    });
  }, { threshold: 0.12 });
  secs.forEach(s => io.observe(s));

  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  /* ---------- the squeeze: press and hold ---------- */
  const sq = $('#squeeze'), steps = $('#steps'), btn = $('#holdBtn'), lab = $('.hold-label', btn);
  const lis = $$('li', steps);
  let hp = 0, holding = false, hraf = null, hlast = 0, hdone = false, lastW = -1, pinned = false;
  function setP(v) {
    hp = v;
    const r = Math.round(v * 500) / 500;
    if (r === lastW) return; lastW = r;
    sq.style.setProperty('--p', r); steps.style.setProperty('--p', r);
    lis.forEach(li => {
      const lit = r >= parseFloat(li.style.getPropertyValue('--s'));
      if (li.classList.contains('lit') !== lit) li.classList.toggle('lit', lit);
    });
  }
  function hloop(t) {
    const dt = Math.min(64, t - (hlast || t)); hlast = t;
    if (holding) hp = Math.min(1, hp + dt / 2200);
    else if (!hdone) hp = Math.max(0, hp - dt / 1500 * (0.5 + hp));
    setP(hp);
    if (hp >= 1 && !hdone) { hdone = true; holding = false; lab.textContent = 'Squeezed. Nice.'; sq.classList.add('full'); }
    if ((holding && hp < 1) || (!holding && hp > 0 && !hdone)) hraf = requestAnimationFrame(hloop);
    else { hraf = null; hlast = 0; }
  }
  function holdStart(e) { if (hdone || pinned) return; holding = true; btn.setAttribute('aria-pressed', 'true'); if (hraf === null) hraf = requestAnimationFrame(hloop); }
  function holdEnd() { if (!holding) return; holding = false; btn.setAttribute('aria-pressed', 'false'); if (hraf === null && hp > 0 && !hdone) hraf = requestAnimationFrame(hloop); }
  btn.addEventListener('pointerdown', e => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) {} holdStart(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => btn.addEventListener(n, holdEnd));
  btn.addEventListener('contextmenu', e => e.preventDefault());
  btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); holdStart(); } });
  btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') holdEnd(); });
  btn.addEventListener('blur', holdEnd);

  function pinToFinalStates() {
    pinned = true; hdone = true; holding = false;
    if (hraf !== null) { cancelAnimationFrame(hraf); hraf = null; }
    setP(1); lab.textContent = 'All Five Steps Shown'; sq.classList.add('full');
    secs.forEach(s => s.classList.add('in', 'done'));
  }
  function unpinFinalStates() {
    if (!pinned) return;
    pinned = false; hdone = false; hp = 0; lastW = -1; setP(0);
    lab.textContent = 'Hold to Squeeze'; sq.classList.remove('full');
  }
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => {
    if (e.matches) pinToFinalStates(); else { unpinFinalStates(); applyHeroMode(); }
  });

  /* ---------- FAQ: smooth open and close, one open at a time ---------- */
  const faqs = $$('.qa details');
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // read where the answer is right now (so a half-finished animation can reverse without a jump)
  function faqNow(ans) {
    const cs = getComputedStyle(ans);
    return { h: ans.getBoundingClientRect().height, pad: parseFloat(cs.paddingBottom) || 0, op: parseFloat(cs.opacity) };
  }
  function faqAnimate(d, from, to, duration, done) {
    const ans = $('p', d);
    if (d._anim) d._anim.cancel();
    ans.style.overflow = 'hidden';
    const frame = s => ({ height: s.h + 'px', paddingBottom: s.pad + 'px', opacity: s.op, transform: 'translateY(' + (1 - s.op) * -6 + 'px)' });
    // fill:'forwards' holds the last frame until the details element has really finished opening or closing
    const anim = ans.animate([frame(from), frame(to)], { duration, easing: EASE, fill: 'forwards' });
    d._anim = anim;
    anim.onfinish = () => { if (done) done(); anim.cancel(); ans.style.overflow = ''; if (d._anim === anim) d._anim = null; };
  }
  function faqOpen(d) {
    const ans = $('p', d);
    const wasMoving = !!d._anim || d.classList.contains('closing');
    const from = wasMoving ? faqNow(ans) : { h: 0, pad: 0, op: 0 };
    d.classList.remove('closing');
    d.open = true;
    if (reducedMotion()) return;
    if (d._anim) d._anim.cancel();
    const full = { h: ans.scrollHeight, pad: parseFloat(getComputedStyle(ans).paddingBottom) || 0, op: 1 };
    faqAnimate(d, from, full, 520);
  }
  function faqClose(d) {
    if (!d.open || d.classList.contains('closing')) return;
    if (reducedMotion()) { d.open = false; return; }
    const ans = $('p', d);
    const from = faqNow(ans);
    d.classList.add('closing');
    faqAnimate(d, from, { h: 0, pad: 0, op: 0 }, 400, () => { d.open = false; d.classList.remove('closing'); });
  }
  faqs.forEach(d => {
    $('summary', d).addEventListener('click', e => {
      e.preventDefault();
      if (d.open && !d.classList.contains('closing')) { faqClose(d); return; }
      faqs.forEach(o => { if (o !== d) faqClose(o); });
      faqOpen(d);
    });
  });

  /* ---------- go ---------- */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) pinToFinalStates();
  applyHeroMode();
})();
