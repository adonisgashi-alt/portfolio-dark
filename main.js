(() => {
  'use strict';

  const PROJECTS = window.PROJECTS || [];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const $ = (id) => document.getElementById(id);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let W = innerWidth;
  let H = innerHeight;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };

  // Supernova intro timeline (ms, relative to script start)
  const T0 = performance.now();
  const NOVA_IGNITE = 250;   // a single point of light appears
  const NOVA_BURST = 1450;   // it collapses and detonates
  const SHOCK_MS = 2600;     // primary shockwave reaches the screen edges
  const easeOut = (k) => 1 - (1 - k) ** 3;

  /* ───────────── Starfield ───────────── */

  const space = $('space');
  const sctx = space.getContext('2d');
  let stars = [];
  let shooter = null;
  let nextShooter = performance.now() + 7000;

  function resizeSpace() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    space.width = Math.round(W * dpr);
    space.height = Math.round(H * dpr);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((W * H) / 2400);
    stars = Array.from({ length: count }, () => {
      const z = Math.random() ** 2.2; // mostly distant
      const tint = Math.random();
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        z,
        r: 0.35 + z * 1.25,
        a: 0.25 + z * 0.65,
        tw: Math.random() * Math.PI * 2,
        ts: 0.4 + Math.random() * 1.6,
        c: tint < 0.12 ? '255,226,200' : tint < 0.35 ? '200,215,255' : '235,240,255',
      };
    });
  }

  function drawSpace(t) {
    sctx.clearRect(0, 0, W, H);
    const drift = reduceMotion ? 0 : t * 0.0035;
    const since = t - T0 - NOVA_BURST;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.hypot(W, H) * 0.62 + 160;
    // stars only exist once the shockwave has swept past them
    const shockR = reduceMotion ? Infinity : since <= 0 ? -1 : since >= SHOCK_MS ? Infinity : easeOut(since / SHOCK_MS) * maxR;

    sctx.save();
    if (!reduceMotion && since > 0 && since < 900) {
      const amp = 7 * Math.exp(-since / 180);
      sctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
    }
    for (const s of stars) {
      const d = 0.15 + s.z;
      let x = (s.x - drift * d + mouse.sx * 26 * d) % W;
      if (x < 0) x += W;
      const y = s.y + mouse.sy * 18 * d;
      let reveal = 1;
      if (shockR !== Infinity) {
        reveal = clamp((shockR - Math.hypot(x - cx, y - cy)) / 180, 0, 1);
        if (!reveal) continue;
      }
      const tw = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(t * 0.001 * s.ts + s.tw);
      const a = s.a * tw * reveal;
      if (s.r < 1) {
        sctx.fillStyle = `rgba(${s.c},${a})`;
        sctx.fillRect(x, y, s.r * 1.4, s.r * 1.4);
      } else {
        sctx.fillStyle = `rgba(${s.c},${a})`;
        sctx.beginPath();
        sctx.arc(x, y, s.r, 0, Math.PI * 2);
        sctx.fill();
        if (s.z > 0.82) {
          // faint diffraction spikes on the nearest stars
          sctx.fillStyle = `rgba(${s.c},${a * 0.28})`;
          sctx.fillRect(x - s.r * 4, y - 0.25, s.r * 8, 0.5);
          sctx.fillRect(x - 0.25, y - s.r * 4, 0.5, s.r * 8);
        }
      }
    }

    if (!reduceMotion) drawNova(t - T0, cx, cy, maxR);
    sctx.restore();

    if (reduceMotion) return;
    if (!shooter && t > nextShooter) {
      const fromLeft = Math.random() < 0.5;
      shooter = {
        x: fromLeft ? Math.random() * W * 0.5 : W * 0.5 + Math.random() * W * 0.5,
        y: Math.random() * H * 0.4,
        vx: (fromLeft ? 1 : -1) * (0.5 + Math.random() * 0.4),
        vy: 0.18 + Math.random() * 0.2,
        born: t,
        life: 1100,
      };
    }
    if (shooter) {
      const k = (t - shooter.born) / shooter.life;
      if (k >= 1) {
        shooter = null;
        nextShooter = t + 9000 + Math.random() * 12000;
      } else {
        const dist = (t - shooter.born);
        const hx = shooter.x + shooter.vx * dist;
        const hy = shooter.y + shooter.vy * dist;
        const tx = hx - shooter.vx * 140;
        const ty = hy - shooter.vy * 140;
        const alpha = Math.sin(k * Math.PI) * 0.55;
        const grad = sctx.createLinearGradient(hx, hy, tx, ty);
        grad.addColorStop(0, `rgba(230,238,255,${alpha})`);
        grad.addColorStop(1, 'rgba(230,238,255,0)');
        sctx.strokeStyle = grad;
        sctx.lineWidth = 1;
        sctx.beginPath();
        sctx.moveTo(hx, hy);
        sctx.lineTo(tx, ty);
        sctx.stroke();
      }
    }
  }

  /* ───────────── Supernova ───────────── */

  let ejecta = null;

  function makeEjecta() {
    const n = Math.round(clamp((W * H) / 2600, 220, 520));
    return Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2;
      const fast = Math.random() ** 2.2;
      const tint = Math.random();
      return {
        cos: Math.cos(a),
        sin: Math.sin(a),
        v: 0.25 + fast * 1.9,             // px per ms at launch
        tau: 700 + Math.random() * 900,   // drag time constant
        life: 1400 + Math.random() * 2600,
        w: 0.6 + Math.random() * 1.4,
        c: tint < 0.6 ? '210,225,255' : tint < 0.8 ? '255,205,160' : tint < 0.93 ? '190,160,255' : '255,255,255',
      };
    });
  }

  function glow(x, y, r, stops) {
    const g = sctx.createRadialGradient(x, y, 0, x, y, r);
    for (const [o, c] of stops) g.addColorStop(o, c);
    sctx.fillStyle = g;
    sctx.beginPath();
    sctx.arc(x, y, r, 0, Math.PI * 2);
    sctx.fill();
  }

  function drawNova(e, cx, cy, maxR) {
    if (e < NOVA_IGNITE || e > NOVA_BURST + 6500) return;
    sctx.globalCompositeOperation = 'lighter';

    if (e < NOVA_BURST) {
      // progenitor: a lone star swelling, then collapsing in on itself
      const k = (e - NOVA_IGNITE) / (NOVA_BURST - NOVA_IGNITE);
      const collapse = k > 0.82 ? 1 - ((k - 0.82) / 0.18) ** 0.6 * 0.85 : 1;
      const flick = 0.85 + Math.random() * 0.15;
      const r = (2 + k ** 2.5 * 26) * collapse;
      glow(cx, cy, r * 6, [[0, `rgba(255,255,255,${0.9 * flick})`], [0.08, `rgba(200,220,255,${0.55 * flick})`], [0.35, `rgba(120,150,255,${0.12 * k})`], [1, 'rgba(0,0,0,0)']]);
      sctx.globalCompositeOperation = 'source-over';
      return;
    }

    const s = e - NOVA_BURST;
    if (!ejecta) ejecta = makeEjecta();

    // flash
    const flash = s < 90 ? s / 90 : Math.exp(-(s - 90) / 420);
    if (flash > 0.01) {
      glow(cx, cy, maxR, [[0, `rgba(255,255,255,${flash})`], [0.25, `rgba(200,215,255,${flash * 0.55})`], [1, `rgba(90,110,200,${flash * 0.12})`]]);
    }

    // white-hot core and lingering remnant
    const coreA = Math.exp(-s / 700);
    glow(cx, cy, 30 + easeOut(Math.min(1, s / 900)) * 140, [[0, `rgba(255,255,255,${coreA})`], [0.3, `rgba(170,200,255,${coreA * 0.5})`], [1, 'rgba(0,0,0,0)']]);
    const remA = 0.22 * Math.exp(-s / 2200) * Math.min(1, s / 300);
    const remR = 120 + easeOut(Math.min(1, s / 5000)) * Math.min(W, H) * 0.55;
    glow(cx - 30, cy + 10, remR, [[0, `rgba(120,90,220,${remA})`], [0.5, `rgba(40,80,200,${remA * 0.45})`], [1, 'rgba(0,0,0,0)']]);
    glow(cx + 40, cy - 12, remR * 0.8, [[0, `rgba(255,140,90,${remA * 0.5})`], [1, 'rgba(0,0,0,0)']]);

    // light rays
    if (s < 1100) {
      const ra = (1 - s / 1100) ** 2 * 0.5;
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39996 + 0.4;
        const len = maxR * (0.35 + ((i * 37) % 10) / 16);
        const g = sctx.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        g.addColorStop(0, `rgba(225,235,255,${ra})`);
        g.addColorStop(1, 'rgba(225,235,255,0)');
        sctx.strokeStyle = g;
        sctx.lineWidth = 1 + (i % 3);
        sctx.beginPath();
        sctx.moveTo(cx, cy);
        sctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        sctx.stroke();
      }
    }

    // shockwaves: a fast bright one and a slower tinted one
    const rings = [
      [SHOCK_MS, maxR, '235,242,255', 0.9, 70],
      [SHOCK_MS * 1.7, maxR * 0.8, '170,150,255', 0.45, 140],
    ];
    for (const [dur, R, c, peak, thick] of rings) {
      const k = s / dur;
      if (k >= 1) continue;
      const r = easeOut(k) * R;
      const a = peak * (1 - k) ** 1.6;
      const g = sctx.createRadialGradient(cx, cy, Math.max(0, r - thick), cx, cy, r);
      g.addColorStop(0, `rgba(${c},0)`);
      g.addColorStop(0.8, `rgba(${c},${a * 0.25})`);
      g.addColorStop(1, `rgba(${c},${a})`);
      sctx.fillStyle = g;
      sctx.beginPath();
      sctx.arc(cx, cy, r, 0, Math.PI * 2);
      sctx.fill();
    }

    // ejecta streaks, slowing under drag
    sctx.lineCap = 'round';
    for (const p of ejecta) {
      if (s > p.life) continue;
      const dist = p.v * p.tau * (1 - Math.exp(-s / p.tau));
      const speed = p.v * Math.exp(-s / p.tau);
      const tail = Math.max(1.5, speed * 60);
      const x = cx + p.cos * dist;
      const y = cy + p.sin * dist;
      const a = (1 - s / p.life) ** 1.4;
      sctx.strokeStyle = `rgba(${p.c},${a})`;
      sctx.lineWidth = p.w;
      sctx.beginPath();
      sctx.moveTo(x, y);
      sctx.lineTo(x - p.cos * tail, y - p.sin * tail);
      sctx.stroke();
    }

    sctx.globalCompositeOperation = 'source-over';
  }

  /* ───────────── Name ───────────── */

  const nameWrap = $('nameWrap');
  const nameEl = $('name');
  let introEnd = 0;

  function buildName() {
    const text = nameEl.textContent.trim();
    nameEl.textContent = '';
    nameEl.setAttribute('aria-label', text);

    let maxDelay = 0;
    const count = text.replace(/ /g, '').length;
    let idx = 0;
    text.split(' ').forEach((word, wi) => {
      if (wi > 0) nameEl.appendChild(document.createTextNode(' '));
      const w = document.createElement('span');
      w.className = 'word';
      w.setAttribute('aria-hidden', 'true');
      for (const char of word) {
        const ch = document.createElement('span');
        ch.className = 'ch';
        const g = document.createElement('span');
        g.className = 'g';
        const t = document.createElement('span');
        t.className = 't';
        t.textContent = char;
        g.appendChild(t);
        // letters condense out of the blast, from the centre outwards
        const off = Math.abs(idx++ - (count - 1) / 2) / (count / 2);
        const d = reduceMotion ? 0 : NOVA_BURST / 1000 + 0.12 + off * 0.75 + Math.random() * 0.35;
        maxDelay = Math.max(maxDelay, d);
        ch.style.setProperty('--d', d.toFixed(2) + 's');
        ch.appendChild(g);
        w.appendChild(ch);
      }
      nameEl.appendChild(w);
    });

    const makeClone = (cls) => {
      const c = document.createElement('div');
      c.className = 'name ' + cls;
      c.setAttribute('aria-hidden', 'true');
      c.innerHTML = nameEl.innerHTML;
      nameWrap.appendChild(c);
    };
    makeClone('name--shine');

    introEnd = reduceMotion ? 0 : (maxDelay + 1.6) * 1000;
  }

  function startSparkles() {
    if (reduceMotion) return;
    const chars = [...nameEl.querySelectorAll('.ch')];
    const tick = () => {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ch.classList.remove('sparkle');
      void ch.offsetWidth;
      ch.classList.add('sparkle');
      setTimeout(tick, 2200 + Math.random() * 3800);
    };
    setTimeout(tick, 1500);
  }

  /* ───────────── Orbs ───────────── */

  const orbitsEl = $('orbits');
  const orbs = [];
  let center = { x: W / 2, y: H / 2 };
  let timeScale = 1;
  let timeTarget = 1;

  function createOrbs() {
    const n = PROJECTS.length;
    PROJECTS.forEach((p, i) => {
      const r = rng(hash(p.name + i));
      const el = document.createElement('button');
      el.className = 'orb';
      el.type = 'button';
      el.setAttribute('aria-label', `Project: ${p.name}`);
      el.style.setProperty('--h', p.hue ?? 210);
      el.style.setProperty('--fd', (r() * -5).toFixed(2) + 's');
      el.innerHTML = '<span class="halo"></span><span class="core"></span><span class="reticle"></span>';
      orbitsEl.appendChild(el);

      const o = {
        p,
        i,
        el,
        // spread evenly around, with a little jitter
        theta: (i / n) * Math.PI * 2 + (r() - 0.5) * 0.6,
        // one lap every ~70–130s — deliberately slow
        speed: ((Math.PI * 2) / (70000 + r() * 60000)) * (r() < 0.25 ? -1 : 1),
        band: n > 1 ? i / (n - 1) : 0.5,
        tilt: (r() - 0.5) * 0.45,
        wob: r() * Math.PI * 2,
        wobAmp: 4 + r() * 8,
        rx: 0,
        ry: 0,
        x: 0,
        y: 0,
        appear: 0,
        appearAt: 0,
        frozen: false,
      };
      orbs.push(o);

      el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hoverIn(o); });
      el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') scheduleClose(380); });
      el.addEventListener('focus', () => open(o));
      el.addEventListener('blur', (e) => { if (!hud.contains(e.relatedTarget)) scheduleClose(200); });
      el.addEventListener('click', () => {
        if (active === o && revealed && o.p.url) {
          window.open(o.p.url, '_blank', 'noopener');
        } else {
          open(o);
        }
      });
    });
    $('count').textContent = String(n).padStart(2, '0');
  }

  function layoutOrbs() {
    const r = nameEl.getBoundingClientRect();
    center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const portrait = H > W;
    for (const o of orbs) {
      const t = o.band;
      const rxMax = W / 2 - 34;
      const ryMax = H / 2 - 70;
      o.rx = Math.min(rxMax, lerp(r.width * 0.46 + 30, W * (portrait ? 0.46 : 0.44), t));
      o.ry = Math.min(ryMax, lerp(r.height * (portrait ? 0.9 : 0.75) + 20, H * (portrait ? 0.38 : 0.36), t));
    }
  }

  function updateOrbs(t, dt) {
    timeScale = lerp(timeScale, timeTarget, Math.min(1, dt * 0.004));
    for (const o of orbs) {
      if (!o.frozen && !reduceMotion) o.theta += o.speed * dt * timeScale;
      const z = Math.sin(o.theta);
      if (o.frozen && o.x) {
        // hold perfectly still while its panel is open so the leader line stays attached
        o.el.style.transform = `translate3d(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px, 0) scale(1.15)`;
        o.el.style.opacity = o.appear.toFixed(3);
        o.el.style.zIndex = 5;
        continue;
      }
      if (o.appearAt && t > o.appearAt) o.appear = Math.min(1, o.appear + dt / 2400);
      // flung out of the blast and settling into orbit
      const launch = reduceMotion ? 1 : easeOut(o.appear);
      const px = Math.cos(o.theta) * o.rx * launch;
      const wob = reduceMotion ? 0 : Math.sin(t * 0.00035 + o.wob) * o.wobAmp * launch;
      const py = Math.sin(o.theta) * o.ry * launch + wob;
      const c = Math.cos(o.tilt);
      const s = Math.sin(o.tilt);
      o.x = center.x + px * c - py * s + mouse.sx * 10;
      o.y = center.y + px * s + py * c + mouse.sy * 8;

      // pseudo-3D: lower half of the ellipse is "in front" of the name
      const depth = (z + 1) / 2;
      const scale = 0.6 + depth * 0.5;

      const focused = o === active;
      const opacity = o.appear * (focused ? 1 : 0.4 + depth * 0.6);

      o.el.style.transform = `translate3d(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px, 0) scale(${focused ? 1.15 : scale.toFixed(3)})`;
      o.el.style.opacity = opacity.toFixed(3);
      o.el.style.zIndex = focused ? 5 : z > 0 ? 3 : 1;
      o.el.style.pointerEvents = o.appear > 0.2 ? 'auto' : 'none';
    }
  }

  /* ───────────── Thumbnails (generated when no image is given) ───────────── */

  const thumbCache = new Map();

  function makeThumb(p) {
    if (p.image) return p.image;
    if (thumbCache.has(p.name)) return thumbCache.get(p.name);

    const w = 640;
    const h = 400;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const r = rng(hash(p.name));
    const hue = p.hue ?? Math.floor(r() * 360);

    g.fillStyle = '#04060e';
    g.fillRect(0, 0, w, h);

    // nebula
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      const x = w * (0.2 + r() * 0.6);
      const y = h * (0.2 + r() * 0.6);
      const rad = 120 + r() * 220;
      const rg = g.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, `hsla(${hue + (r() - 0.5) * 70}, 80%, 55%, ${0.18 + r() * 0.2})`);
      rg.addColorStop(1, 'hsla(0,0%,0%,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, w, h);
    }

    // stars
    for (let k = 0; k < 260; k++) {
      g.fillStyle = `rgba(235,240,255,${r() * 0.8})`;
      const s = r() < 0.94 ? 1 : 2;
      g.fillRect(r() * w, r() * h, s, s);
    }
    g.globalCompositeOperation = 'source-over';

    // perspective floor grid
    const horizon = h * (0.62 + r() * 0.1);
    g.strokeStyle = `hsla(${hue}, 90%, 72%, 0.16)`;
    g.lineWidth = 1;
    for (let k = -14; k <= 14; k++) {
      g.beginPath();
      g.moveTo(w / 2 + k * 8, horizon);
      g.lineTo(w / 2 + k * 90, h);
      g.stroke();
    }
    for (let k = 1; k < 9; k++) {
      const y = horizon + (h - horizon) * (k / 9) ** 1.8;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }

    // central wireframe object
    const cx = w / 2 + (r() - 0.5) * 80;
    const cy = horizon - 70 - r() * 40;
    const R = 70 + r() * 40;
    g.strokeStyle = `hsla(${hue}, 95%, 80%, 0.75)`;
    g.shadowColor = `hsla(${hue}, 95%, 65%, 0.9)`;
    g.shadowBlur = 10;
    const kind = Math.floor(r() * 3);
    if (kind === 0) {
      // gyroscope rings
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.ellipse(cx, cy, R, R * (0.15 + k * 0.2), (r() - 0.5) * 1.2, 0, Math.PI * 2);
        g.stroke();
      }
    } else if (kind === 1) {
      // polyhedron-ish wire mesh
      const pts = Array.from({ length: 9 }, (_, k) => {
        const a = (k / 9) * Math.PI * 2 + r() * 0.3;
        const rr = R * (0.6 + r() * 0.45);
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8];
      });
      pts.push([cx, cy - R * 0.1]);
      for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
          if (r() < 0.32 || b === a + 1) {
            g.beginPath();
            g.moveTo(pts[a][0], pts[a][1]);
            g.lineTo(pts[b][0], pts[b][1]);
            g.stroke();
          }
        }
      }
    } else {
      // planet with orbit line and waveform
      g.beginPath();
      g.arc(cx, cy, R * 0.7, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.ellipse(cx, cy, R * 1.3, R * 0.28, -0.25, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = horizon - 12 + Math.sin(x * 0.03 + r()) * 6 * Math.sin(x * 0.005);
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    g.shadowBlur = 0;

    // HUD-ish annotations
    g.font = '11px "JetBrains Mono", monospace';
    g.fillStyle = `hsla(${hue}, 80%, 80%, 0.55)`;
    const code = hash(p.name).toString(16).toUpperCase().slice(0, 6);
    g.fillText(`0x${code}`, 18, 26);
    g.fillText(`${(r() * 90).toFixed(3)}° / ${(r() * 180).toFixed(3)}°`, 18, h - 18);
    g.strokeStyle = `hsla(${hue}, 80%, 80%, 0.35)`;
    g.strokeRect(cx - R - 14, cy - R - 14, 12, 0.5);
    g.strokeRect(cx + R + 2, cy + R + 14, 12, 0.5);

    const url = c.toDataURL('image/jpeg', 0.88);
    thumbCache.set(p.name, url);
    return url;
  }

  /* ───────────── Text decode ───────────── */

  const GLYPHS = '▯▮░▒<>/\\[]{}—=+*^?#_01ABCDEFXZ';
  let decodeToken = 0;

  function decode(el, text, duration) {
    const token = ++decodeToken;
    const start = performance.now();
    const reveal = [...text].map((ch, i) => ({
      ch,
      at: (i / text.length) * duration * 0.7 + Math.random() * duration * 0.3,
    }));
    const frame = (now) => {
      if (token !== decodeToken) return;
      const elapsed = now - start;
      let html = '';
      let done = true;
      for (const r of reveal) {
        if (r.ch === ' ' || elapsed >= r.at) {
          html += r.ch === '<' ? '&lt;' : r.ch === '&' ? '&amp;' : r.ch;
        } else {
          done = false;
          // unrevealed slots only start flickering once the "signal" reaches them
          html += elapsed > r.at - 400
            ? `<span class="x">${GLYPHS[Math.floor(Math.random() * GLYPHS.length)].replace('<', '&lt;').replace('>', '&gt;')}</span>`
            : '&nbsp;';
        }
      }
      el.innerHTML = html;
      if (!done) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ───────────── HUD ───────────── */

  const hud = $('hud');
  const leader = $('leader');
  const leaderPath = $('leaderPath');
  const hudImg = $('hudImg');
  const hudStatus = $('hudStatus');
  let active = null;
  let revealed = false;
  let openTimer = 0;
  let closeTimer = 0;
  let revealTimer = 0;
  let hoverTimer = 0;
  let hinted = false;

  function hoverIn(o) {
    clearTimeout(closeTimer);
    clearTimeout(hoverTimer);
    if (active === o) return;
    // brief intent delay so passing the cursor over a light doesn't trigger it
    hoverTimer = setTimeout(() => open(o), active ? 60 : 110);
  }

  function open(o) {
    clearTimeout(closeTimer);
    clearTimeout(hoverTimer);
    if (active === o) return;
    if (active) {
      active.el.classList.remove('is-active');
      active.frozen = false;
    }
    active = o;
    revealed = false;
    o.frozen = true;
    o.el.classList.add('is-active');
    timeTarget = 0.06;
    document.body.classList.add('is-focus');

    if (!hinted) {
      hinted = true;
      $('hint').classList.add('is-gone');
    }

    const p = o.p;
    const num = String(o.i + 1).padStart(2, '0');
    hud.style.setProperty('--h', p.hue ?? 210);
    leader.style.setProperty('--h', p.hue ?? 210);
    $('hudId').textContent = `PRJ-${num} // ${String(PROJECTS.length).padStart(2, '0')}`;
    $('hudYear').textContent = p.year || '';
    $('hudTags').textContent = (p.tags || []).join(' · ');
    $('hudDesc').textContent = p.description || '';
    $('hudTitle').innerHTML = '&nbsp;';
    hudStatus.textContent = 'acquiring';
    hudStatus.classList.remove('is-locked');
    hudImg.src = makeThumb(p);
    hudImg.alt = `${p.name} preview`;
    const link = $('hudLink');
    if (p.url) {
      link.href = p.url;
      link.hidden = false;
    } else {
      link.removeAttribute('href');
      link.hidden = true;
    }

    hud.hidden = false;
    hud.classList.remove('is-open');
    positionHud(o);
    void hud.offsetWidth; // restart the reveal sequence
    hud.classList.add('is-open');

    clearTimeout(openTimer);
    clearTimeout(revealTimer);
    const k = reduceMotion ? 0 : 1;
    openTimer = setTimeout(() => decode($('hudTitle'), p.name, reduceMotion ? 1 : 900), 950 * k);
    revealTimer = setTimeout(() => {
      hudStatus.textContent = 'signal locked';
      hudStatus.classList.add('is-locked');
      revealed = true;
    }, 1400 * k);
  }

  function positionHud(o) {
    const docked = W < 700 || !canHover;
    hud.classList.toggle('is-docked', docked);
    const rect = hud.getBoundingClientRect();
    const hw = rect.width;
    const hh = rect.height;

    let left;
    let top;
    let anchorX;
    let anchorY;

    if (docked) {
      top = H - hh - 16;
      left = (W - hw) / 2;
      anchorX = clamp(o.x, left + 14, left + hw - 14);
      anchorY = top;
    } else {
      const gap = 56;
      const right = o.x + gap + hw < W - 20 || o.x < W / 2;
      left = right ? o.x + gap : o.x - gap - hw;
      left = clamp(left, 16, W - hw - 16);
      top = clamp(o.y - hh * 0.3, 16, H - hh - 16);
      hud.style.left = `${left}px`;
      hud.style.top = `${top}px`;
      anchorX = right ? left : left + hw;
      anchorY = clamp(o.y, top + 14, top + hh - 14);
    }

    // elbowed leader line from the light to the panel
    let d;
    if (docked) {
      d = `M${o.x},${o.y} L${o.x},${(o.y + anchorY) / 2} L${anchorX},${(o.y + anchorY) / 2} L${anchorX},${anchorY}`;
      if (o.y > top - 10) d = '';
    } else {
      const dir = anchorX > o.x ? 1 : -1;
      const ex = o.x + dir * Math.min(22, Math.abs(anchorX - o.x) / 2);
      d = `M${o.x + dir * 10},${o.y} L${ex},${anchorY} L${anchorX},${anchorY}`;
    }
    leaderPath.setAttribute('d', d);
    leaderPath.style.opacity = 0;
    if (d) {
      const len = leaderPath.getTotalLength();
      leaderPath.style.transition = 'none';
      leaderPath.style.strokeDasharray = len;
      leaderPath.style.strokeDashoffset = len;
      leaderPath.style.opacity = 1;
      void leaderPath.getBoundingClientRect();
      leaderPath.style.transition = '';
      leaderPath.style.strokeDashoffset = 0;
    }
  }

  function scheduleClose(ms) {
    clearTimeout(hoverTimer);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, ms);
  }

  function close() {
    clearTimeout(openTimer);
    clearTimeout(revealTimer);
    decodeToken++;
    if (!active) return;
    active.el.classList.remove('is-active');
    active.frozen = false;
    active = null;
    revealed = false;
    timeTarget = 1;
    document.body.classList.remove('is-focus');
    hud.classList.remove('is-open');
    leaderPath.style.opacity = 0;
    hud.hidden = true;
  }

  hud.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  hud.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') scheduleClose(260); });
  hud.addEventListener('focusout', (e) => {
    if (!hud.contains(e.relatedTarget) && !(e.relatedTarget && e.relatedTarget.classList.contains('orb'))) scheduleClose(200);
  });

  document.addEventListener('pointerdown', (e) => {
    if (!active) return;
    if (hud.contains(e.target) || e.target.closest('.orb')) return;
    close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) {
      const el = active.el;
      close();
      el.blur();
    }
  });

  /* ───────────── Pointer, clock, loop ───────────── */

  const cxEl = $('cx');
  const cyEl = $('cy');

  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX / W - 0.5;
    mouse.y = e.clientY / H - 0.5;
    cxEl.textContent = (e.clientX / W).toFixed(3);
    cyEl.textContent = (e.clientY / H).toFixed(3);
  }, { passive: true });

  const clockEl = $('clock');
  const t0 = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    clockEl.textContent = `${hh}:${mm}:${ss}`;
  }, 1000);

  let resizeRaf = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      W = innerWidth;
      H = innerHeight;
      resizeSpace();
      layoutOrbs();
      close();
    });
  });

  let last = performance.now();
  function loop(t) {
    const dt = Math.min(64, t - last);
    last = t;
    if (!reduceMotion) {
      mouse.sx = lerp(mouse.sx, mouse.x, 0.04);
      mouse.sy = lerp(mouse.sy, mouse.y, 0.04);
      nameWrap.style.transform = `translate3d(${(mouse.sx * -12).toFixed(2)}px, ${(mouse.sy * -8).toFixed(2)}px, 0)`;
    }
    drawSpace(t);
    updateOrbs(t, dt);
    requestAnimationFrame(loop);
  }

  /* ───────────── Boot ───────────── */

  buildName();
  resizeSpace();
  createOrbs();
  layoutOrbs();

  const boot = performance.now();
  orbs.forEach((o, i) => {
    o.appearAt = reduceMotion ? boot + i * 200 : T0 + NOVA_BURST + 150 + i * 110;
  });

  setTimeout(() => {
    document.body.classList.add('is-lit');
    const hint = $('hint');
    hint.textContent = canHover ? 'hover a light to explore' : 'tap a light to explore';
    if (!hinted) hint.classList.add('is-on');
    startSparkles();
  }, introEnd);

  // re-measure once the display font has loaded (it changes the name's size)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutOrbs);

  requestAnimationFrame(loop);
})();
