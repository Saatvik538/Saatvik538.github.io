(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };

  const VIEWS = ['home', 'prg', 'log', 'info', 'comm'];
  const TITLES = { home: 'HOME', prg: 'F1 PROGRAMS', log: 'F2 EVENT LOG', info: 'F3 OPERATOR', comm: 'F4 COMM' };
  const body = $('.lcd-body');
  const leds = Object.fromEntries($$('.led').map((l) => [l.dataset.led, l]));
  const hdTab = $('#hdTab'), hdState = $('#hdState');
  const runMsg = $('#runMsg'), runFill = $('#runFill');

  const state = { view: 'home', prg: 0, log: 0, running: false, held: false, line: -1, timer: null, estop: false };

  /* ---------------- views ---------------- */
  function go(view, push = true) {
    if (!VIEWS.includes(view)) view = 'home';
    if (state.estop) return;
    if (view !== 'prg') stopRun(true);
    state.view = view;
    $$('.view').forEach((v) => (v.hidden = v.dataset.view !== view));
    $$('[data-goto]').forEach((k) => k.classList.toggle('on', k.dataset.goto === view && !k.classList.contains('inline-key')));
    hdTab.textContent = TITLES[view];
    body.scrollTop = 0;
    if (push) history.replaceState(null, '', view === 'home' ? location.pathname : '#' + view);
  }
  $$('[data-goto]').forEach((k) => k.addEventListener('click', (e) => { e.preventDefault(); go(k.dataset.goto); }));

  /* ---------------- lists ---------------- */
  const prgBtns = $$('#prgList button'), prgs = $$('.prg');
  const logBtns = $$('#logList button'), evs = $$('.ev');

  function selectPrg(i) {
    state.prg = (i + prgs.length) % prgs.length;
    stopRun(true);
    prgBtns.forEach((b, j) => b.classList.toggle('sel', j === state.prg));
    prgs.forEach((p, j) => (p.hidden = j !== state.prg));
    prgs[state.prg].querySelectorAll('.tp li').forEach((li) => li.classList.remove('cur', 'done'));
    runMsg.textContent = `PRG0${state.prg + 1} LOADED · PRESS RUN`;
    runFill.style.width = '0';
    prgBtns[state.prg].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function selectLog(i) {
    state.log = (i + evs.length) % evs.length;
    logBtns.forEach((b, j) => b.classList.toggle('sel', j === state.log));
    evs.forEach((p, j) => (p.hidden = j !== state.log));
    logBtns[state.log].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  prgBtns.forEach((b) => b.addEventListener('click', () => selectPrg(+b.dataset.i)));
  logBtns.forEach((b) => b.addEventListener('click', () => selectLog(+b.dataset.i)));

  /* ---------------- program execution ---------------- */
  const lines = () => [...prgs[state.prg].querySelectorAll('.tp li')];
  function setRunUI(mode) {
    hdState.textContent = mode;
    leds.run.classList.toggle('on', mode === 'RUN');
  }
  function stepLine() {
    const ls = lines();
    if (state.line >= 0 && ls[state.line]) { ls[state.line].classList.remove('cur'); ls[state.line].classList.add('done'); }
    state.line++;
    if (state.line >= ls.length) { finish(); return false; }
    ls[state.line].classList.add('cur');
    ls[state.line].scrollIntoView({ block: 'nearest' });
    runFill.style.width = `calc(${((state.line + 1) / ls.length) * 100}% - 2px)`;
    runMsg.textContent = `PRG0${state.prg + 1} · LINE ${state.line + 1}/${ls.length}`;
    return true;
  }
  function startRun() {
    if (state.estop) return;
    if (state.view !== 'prg') go('prg');
    if (state.running && state.held) { state.held = false; setRunUI('RUN'); return; }
    if (state.running) return;
    lines().forEach((li) => li.classList.remove('cur', 'done'));
    state.line = -1; state.running = true; state.held = false;
    setRunUI('RUN');
    const tick = () => {
      if (!state.running) return;
      if (!state.held && !state.estop && !stepLine()) return;
      state.timer = setTimeout(tick, 520);
    };
    tick();
  }
  function finish() {
    state.running = false; clearTimeout(state.timer);
    setRunUI('IDLE');
    runMsg.textContent = `PRG0${state.prg + 1} · PROGRAM END ✓`;
    runFill.style.width = 'calc(100% - 2px)';
  }
  function stopRun(silent) {
    clearTimeout(state.timer);
    state.running = false; state.held = false; state.line = -1;
    setRunUI(state.estop ? 'E-STOP' : 'IDLE');
    if (!silent) runMsg.textContent = 'ABORTED';
  }
  function hold() {
    if (!state.running) return;
    state.held = !state.held;
    setRunUI(state.held ? 'HOLD' : 'RUN');
  }
  function step() {
    if (state.estop) return;
    if (state.view !== 'prg') go('prg');
    if (state.running) { state.held = true; setRunUI('HOLD'); }
    else if (state.line < 0 || state.line >= lines().length) { lines().forEach((li) => li.classList.remove('cur', 'done')); state.line = -1; }
    if (!state.running) { setRunUI('STEP'); if (!stepLine()) state.line = -1; }
    else stepLine();
  }

  /* ---------------- e-stop ---------------- */
  const estopBtn = $('#estop'), alarm = $('#alarm');
  function toggleEstop() {
    state.estop = !state.estop;
    if (state.estop) { clearTimeout(state.timer); state.running = false; }
    estopBtn.setAttribute('aria-pressed', state.estop);
    document.body.classList.toggle('estopped', state.estop);
    alarm.hidden = !state.estop;
    leds.fault.classList.toggle('on', state.estop);
    leds.servo.classList.toggle('on', !state.estop);
    setRunUI(state.estop ? 'E-STOP' : 'IDLE');
    if (!state.estop) runMsg.textContent = 'RESET OK · PRESS RUN';
  }
  estopBtn.addEventListener('click', toggleEstop);
  alarm.addEventListener('click', toggleEstop);

  /* ---------------- hardware keys ---------------- */
  function act(a) {
    if (state.estop && a !== 'estop') return;
    const list = state.view === 'log' ? 'log' : 'prg';
    const sel = (d) => (list === 'log' ? selectLog(state.log + d) : selectPrg(state.prg + d));
    switch (a) {
      case 'up': if (state.view === 'prg' || state.view === 'log') sel(-1); else body.scrollBy({ top: -120, behavior: 'smooth' }); break;
      case 'down': if (state.view === 'prg' || state.view === 'log') sel(1); else body.scrollBy({ top: 120, behavior: 'smooth' }); break;
      case 'left': go(VIEWS[(VIEWS.indexOf(state.view) + VIEWS.length - 1) % VIEWS.length]); break;
      case 'right': go(VIEWS[(VIEWS.indexOf(state.view) + 1) % VIEWS.length]); break;
      case 'enter': if (state.view === 'home') go('prg'); else if (state.view === 'prg') startRun(); else if (state.view === 'info') $('#dither').classList.toggle('on'); break;
      case 'run': startRun(); break;
      case 'step': step(); break;
      case 'hold': hold(); break;
    }
  }
  $$('[data-act]').forEach((k) => k.addEventListener('click', () => act(k.dataset.act)));

  const press = (sel) => { const k = $(sel); if (!k) return; k.classList.add('pressed'); setTimeout(() => k.classList.remove('pressed'), 130); };
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.body.classList.contains('booting')) { endBoot(); e.preventDefault(); return; }
    const k = e.key;
    const fn = { F1: 'prg', F2: 'log', F3: 'info', F4: 'comm', F5: 'home', 1: 'prg', 2: 'log', 3: 'info', 4: 'comm', 5: 'home', 0: 'home' }[k];
    if (fn) { e.preventDefault(); if (state.estop) return; go(fn); press(`.fkey[data-goto="${fn}"]`); return; }
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'enter', r: 'run', R: 'run', s: 'step', S: 'step', h: 'hold', H: 'hold', ' ': 'hold' };
    if (k === 'Escape') { e.preventDefault(); toggleEstop(); estopBtn.focus({ preventScroll: true }); return; }
    if (map[k]) {
      const t = e.target;
      if (k === 'Enter' && t.matches && t.matches('a, button')) return; // let focused controls work normally
      if (k === ' ' && t.matches && t.matches('a, button')) return;
      e.preventDefault(); act(map[k]); press(`[data-act="${map[k]}"]`);
    }
  });

  /* ---------------- clock ---------------- */
  const clock = $('#hdClock');
  const tickClock = () => { const d = new Date(); clock.textContent = d.toTimeString().slice(0, 5); };
  tickClock(); setInterval(tickClock, 10000);

  /* ---------------- boot ---------------- */
  const BOOT = [
    'SK-01 CONTROLLER  v26.11',
    'CPU ....... UT AUSTIN/ECE',
    'MEMORY .............. OK',
    'LIDAR CAM MIC IMU ... OK',
    'SERVO AMPS .......... ON',
    'PROGRAMS LOADED ...... 6',
    'OPERATOR: S. KESARWANI',
    '',
    'READY.',
  ];
  let bootT = null;
  function endBoot() { clearTimeout(bootT); document.body.classList.remove('booting'); store.set('booted', '1'); }
  if (!reduce && !store.get('booted') && !location.hash) {
    document.body.classList.add('booting');
    const pre = $('#bootLog'); let i = 0;
    const next = () => { pre.textContent += BOOT[i++] + '\n'; bootT = setTimeout(i < BOOT.length ? next : endBoot, i < BOOT.length ? 120 : 650); };
    next();
    $('#boot').addEventListener('click', endBoot);
    addEventListener('pointerdown', () => document.body.classList.contains('booting') && endBoot(), { once: true });
  }

  /* ---------------- dithered headshot ---------------- */
  (function dither() {
    const cv = $('#ditherCanvas'), img = $('#headshot');
    const draw = () => {
      const W = cv.width, H = cv.height, g = cv.getContext('2d', { willReadFrequently: true });
      const sw = img.naturalWidth, sh = img.naturalHeight;
      const cw = sw * 0.8, ch = cw * (H / W); // 4:5 crop, slightly zoomed
      g.drawImage(img, (sw - cw) / 2, Math.max(0, (sh - ch) * 0.25), cw, ch, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H), p = d.data;
      const lum = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) lum[i] = (p[i * 4] * 0.3 + p[i * 4 + 1] * 0.59 + p[i * 4 + 2] * 0.11) / 255;
      // contrast lift
      for (let i = 0; i < lum.length; i++) lum[i] = Math.min(1, Math.max(0, (lum[i] - 0.5) * 1.35 + 0.56));
      const ink = [23, 33, 26], paper = [170, 185, 155];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, old = lum[i], nw = old < 0.5 ? 0 : 1, err = old - nw;
        lum[i] = nw;
        if (x + 1 < W) lum[i + 1] += err * 7 / 16;
        if (y + 1 < H) { if (x > 0) lum[i + W - 1] += err * 3 / 16; lum[i + W] += err * 5 / 16; if (x + 1 < W) lum[i + W + 1] += err / 16; }
        const c = nw ? paper : ink;
        p[i * 4] = c[0]; p[i * 4 + 1] = c[1]; p[i * 4 + 2] = c[2]; p[i * 4 + 3] = 255;
      }
      g.putImageData(d, 0, 0);
    };
    if (img.complete && img.naturalWidth) draw(); else img.addEventListener('load', draw);
    $('#dither').addEventListener('click', () => $('#dither').classList.toggle('on'));
  })();

  /* ---------------- LCD pixel animations ---------------- */
  const INK = '#17211a', FAINT = 'rgba(23,33,26,0.28)';
  const j1 = $('#j1'), j2 = $('#j2'), tcp = $('#tcp');
  const trail = [];
  const pix = (g, x, y, s = 2) => g.fillRect(Math.round(x), Math.round(y), s, s);
  const line = (g, a, b, c, d, w = 2) => { g.lineWidth = w; g.beginPath(); g.moveTo(Math.round(a), Math.round(b)); g.lineTo(Math.round(c), Math.round(d)); g.stroke(); };

  const ANIM = {
    home(g, t, W, H) {
      const bx = W / 2, by = H - 24, L1 = 62, L2 = 50;
      const tx = bx + Math.sin(t * 0.7) * 70, ty = by - 70 + Math.sin(t * 1.4) * 30;
      let dx = tx - bx, dy = by - ty, d = Math.hypot(dx, dy);
      d = Math.min(d, L1 + L2 - 1);
      const c2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
      const q2 = -Math.acos(Math.max(-1, Math.min(1, c2)));
      const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
      const ex = bx + L1 * Math.cos(q1), ey = by - L1 * Math.sin(q1);
      const px = ex + L2 * Math.cos(q1 + q2), py = ey - L2 * Math.sin(q1 + q2);
      trail.push([px, py]); if (trail.length > 60) trail.shift();
      g.fillStyle = FAINT; trail.forEach(([x, y], i) => i % 2 || pix(g, x, y));
      g.strokeStyle = INK; g.fillStyle = INK;
      line(g, 10, by + 10, W - 10, by + 10, 2);
      for (let x = 14; x < W - 10; x += 8) line(g, x, by + 12, x - 5, by + 18, 1);
      g.fillRect(bx - 16, by - 2, 32, 12);
      line(g, bx, by, ex, ey, 6); line(g, ex, ey, px, py, 4);
      g.fillStyle = '#aab99b'; [[bx, by], [ex, ey]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); g.stroke(); });
      g.fillStyle = INK; g.fillRect(px - 3, py - 3, 6, 6);
      g.strokeStyle = FAINT; g.lineWidth = 1; g.beginPath(); g.arc(Math.round(tx), Math.round(ty), 6, 0, 7); g.stroke();
      if (j1) { j1.textContent = (q1 * 57.3).toFixed(1); j2.textContent = (q2 * 57.3).toFixed(1); tcp.textContent = `${Math.round(px - bx)},${Math.round(by - py)}`; }
    },
    acoustic(g, t, W, H) {
      g.strokeStyle = INK; g.fillStyle = INK;
      g.lineWidth = 2; g.strokeRect(10, 30, 46, 70); g.beginPath(); g.arc(33, 52, 11, 0, 7); g.stroke();
      for (let i = 0; i < 4; i++) pix(g, 26 + i * 4, 52);
      g.fillRect(18, 86, 8, 6); g.fillRect(40, 86, 8, 6);
      // waveform: cough bursts
      const ph = (t * 0.6) % 1;
      g.beginPath(); g.lineWidth = 1.5;
      for (let x = 66; x < W - 8; x++) {
        const u = (x - 66) / (W - 74);
        const env = Math.exp(-((u - ph) ** 2) / 0.006) + 0.5 * Math.exp(-((u - ph + 0.18) ** 2) / 0.004);
        const y = 42 + Math.sin(x * 1.3 + t * 20) * 24 * env + Math.sin(x * 0.4) * 1.5;
        x === 66 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
      for (let i = 0; i < 16; i++) {
        const h = 4 + Math.abs(Math.sin(t * 3 + i * 0.7) * Math.sin(t * 1.1 + i * 0.3)) * 36 * Math.exp(-((i - 6) ** 2) / 40);
        g.fillRect(68 + i * 8, H - 10 - h, 6, h);
      }
    },
    arm(g, t, W, H) {
      g.strokeStyle = INK; g.fillStyle = INK;
      const by = H - 14; line(g, 6, by, W - 6, by, 2);
      const bx = W / 2; g.fillRect(bx - 12, by - 8, 24, 8);
      const cyc = (t * 0.35) % 1, carrying = cyc > 0.1 && cyc < 0.55;
      const src = [36, by - 8], dst = [W - 40, by - 8];
      let u = cyc < 0.55 ? Math.min(1, Math.max(0, (cyc - 0.1) / 0.45)) : 1 - Math.min(1, (cyc - 0.55) / 0.45);
      u = u * u * (3 - 2 * u);
      const tx = src[0] + (dst[0] - src[0]) * u, ty = src[1] - Math.sin(u * Math.PI) * 52;
      const L1 = 54, L2 = 50, dx = tx - bx, dy = by - 8 - ty, d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1);
      const qa = Math.acos(Math.max(-1, Math.min(1, (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2))));
      // pick whichever elbow solution keeps the elbow up
      const sol = [qa, -qa].map((q2) => { const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2)); return [q1, by - 8 - L1 * Math.sin(q1)]; });
      const [q1] = sol[0][1] < sol[1][1] ? sol[0] : sol[1];
      const ex = bx + L1 * Math.cos(q1), ey = by - 8 - L1 * Math.sin(q1);
      line(g, bx, by - 8, ex, ey, 5); line(g, ex, ey, tx, ty, 3);
      line(g, tx - 5, ty, tx - 5, ty + 7, 2); line(g, tx + 5, ty, tx + 5, ty + 7, 2);
      // stack + dealt pile
      const dealt = Math.floor(t * 0.35) % 5;
      for (let i = 0; i < 5 - dealt; i++) g.fillRect(src[0] - 12, by - 3 - i * 3, 24, 2);
      for (let i = 0; i < dealt; i++) g.fillRect(dst[0] - 12 + i * 2, by - 3 - i * 3, 24, 2);
      if (carrying) g.fillRect(tx - 12, ty + 8, 24, 2);
    },
    glasses(g, t, W, H) {
      g.strokeStyle = INK; g.fillStyle = INK;
      const cx = W / 2;
      g.lineWidth = 2; g.strokeRect(cx - 52, 12, 40, 24); g.strokeRect(cx + 12, 12, 40, 24); line(g, cx - 12, 20, cx + 12, 20, 2);
      g.fillRect(cx - 3, 38, 6, 6);
      // rear radar fan
      const a0 = Math.PI / 2 + Math.sin(t * 1.2) * 0.55;
      g.fillStyle = FAINT; g.beginPath(); g.moveTo(cx, 44); g.arc(cx, 44, 78, a0 - 0.32, a0 + 0.32); g.fill();
      g.strokeStyle = FAINT; g.lineWidth = 1;
      for (let r = 20; r <= 78; r += 19) { g.beginPath(); g.arc(cx, 44, r, 0.4, Math.PI - 0.4); g.stroke(); }
      g.fillStyle = INK;
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.5 + k / 3) % 1, ang = Math.PI / 2 + Math.sin(k * 2.1 + Math.floor(t * 0.5 + k / 3)) * 0.7, r = 78 - ph * 50;
        const x = cx + Math.cos(ang) * r, y = 44 + Math.sin(ang) * r;
        g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
        if (ph > 0.75 && (t * 8) % 2 < 1) { g.font = '14px VT323'; g.fillText('! REAR', 6, H - 6); }
      }
    },
    gait(g, t, W, H) {
      g.strokeStyle = INK; g.fillStyle = INK;
      const gy = H - 14; line(g, 4, gy, W - 4, gy, 2);
      const x = 20 + ((t * 28) % (W - 30)), s = Math.sin(t * 6);
      const hip = [x, gy - 34];
      g.beginPath(); g.arc(x, gy - 62, 6, 0, 7); g.stroke();
      line(g, x, gy - 56, hip[0], hip[1], 2);
      line(g, x, gy - 50, x + s * 10, gy - 38, 2); line(g, x, gy - 50, x - s * 10, gy - 38, 2);
      const k1 = [x + s * 8, gy - 17], k2 = [x - s * 8, gy - 17];
      line(g, hip[0], hip[1], k1[0], k1[1], 2); line(g, k1[0], k1[1], x + s * 12, gy, 2);
      line(g, hip[0], hip[1], k2[0], k2[1], 2); line(g, k2[0], k2[1], x - s * 12, gy, 2);
      // footprints behind
      for (let fx = x - 14; fx > 6; fx -= 14) g.fillRect(Math.round(fx), gy + 4 + ((Math.round(fx / 14)) % 2) * 4, 5, 2);
      // lidar dots on the body
      g.fillStyle = FAINT;
      for (let i = 0; i < 26; i++) pix(g, x - 14 + ((i * 37 + Math.floor(t * 12)) % 28), gy - 70 + ((i * 53) % 70), 2);
      g.fillStyle = INK; g.font = '14px VT323'; g.fillText(`KNEE ${Math.round(150 + s * 22)}°`, W - 64, 14);
    },
    ftc(g, t, W, H) {
      g.strokeStyle = INK; g.fillStyle = INK;
      g.lineWidth = 2; g.strokeRect(6, 6, W - 12, H - 12);
      g.strokeStyle = FAINT; g.lineWidth = 1;
      for (let x = 6; x < W; x += (W - 12) / 6) line(g, x, 6, x, H - 6, 1);
      for (let y = 6; y < H; y += (H - 12) / 4) line(g, 6, y, W - 6, y, 1);
      const a = t * 0.9, cx = W / 2 + Math.sin(a) * 62, cy = H / 2 + Math.sin(a * 2) * 30;
      const dx = Math.cos(a) * 62, dy = Math.cos(a * 2) * 60, ang = Math.atan2(dy, dx);
      g.fillStyle = FAINT;
      for (let k = 1; k < 30; k++) { const b = a - k * 0.08; pix(g, W / 2 + Math.sin(b) * 62, H / 2 + Math.sin(b * 2) * 30, 2); }
      g.save(); g.translate(Math.round(cx), Math.round(cy)); g.rotate(ang);
      g.fillStyle = INK; g.fillRect(-9, -8, 18, 16); g.fillStyle = '#aab99b'; g.fillRect(3, -3, 5, 6);
      g.fillStyle = INK; g.fillRect(-11, -10, 6, 3); g.fillRect(5, -10, 6, 3); g.fillRect(-11, 7, 6, 3); g.fillRect(5, 7, 6, 3);
      g.restore();
    },
    web(g, t, W, H) {
      g.strokeStyle = INK; g.fillStyle = INK;
      g.lineWidth = 2; g.strokeRect(8, 8, W - 16, H - 16); line(g, 8, 20, W - 8, 20, 2);
      for (let i = 0; i < 3; i++) g.fillRect(13 + i * 6, 12, 3, 3);
      g.font = '13px VT323'; g.fillText('skadvising.org', 40, 17);
      const n = Math.min(100, Math.floor(((t * 22) % 140)));
      const bars = 12;
      for (let i = 0; i < bars; i++) {
        const v = Math.min(1, n / 100) * (0.25 + (i / bars) * 0.75) * (0.85 + 0.15 * Math.sin(i * 2.3));
        const h = v * 58; g.fillRect(18 + i * 10, H - 16 - h, 7, h);
      }
      g.font = '26px VT323'; g.fillText(`${n}${n >= 100 ? '+' : ''}`, W - 64, 46);
      g.font = '13px VT323'; g.fillText('INQUIRIES', W - 64, 58);
    },
  };

  const canvases = $$('canvas.anim').map((c) => {
    const host = c.closest('[data-anim]') || c;
    return { c, g: c.getContext('2d'), kind: c.dataset.anim || host.dataset.anim };
  });
  let last = performance.now(), simT = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!state.estop) simT += dt * (state.running && !state.held ? 2 : 1);
    for (const a of canvases) {
      if (!a.c.offsetParent) continue;
      if (state.estop && a.drawn) continue;
      const { c, g } = a;
      g.clearRect(0, 0, c.width, c.height);
      ANIM[a.kind] && ANIM[a.kind](g, simT, c.width, c.height);
      a.drawn = true;
    }
    if (!reduce) requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  if (reduce) { // draw static frames once per view change
    const redraw = () => requestAnimationFrame(loop);
    $$('[data-goto], #prgList button').forEach((b) => b.addEventListener('click', redraw));
  }

  /* ---------------- init ---------------- */
  selectPrg(0); selectLog(0);
  const initial = location.hash.slice(1);
  go(VIEWS.includes(initial) ? initial : 'home', false);
  addEventListener('hashchange', () => go(location.hash.slice(1), false));
})();
