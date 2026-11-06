// Animated illustrations for each project boarding pass.
// Every scene is drawn in a virtual 640×250 space and scaled to the canvas.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(2, devicePixelRatio || 1);
  const VW = 640, VH = 250;
  const ICE = '#89e6ff', ICE_D = 'rgba(137,230,255,0.35)', ICE_F = 'rgba(137,230,255,0.12)';
  const AMB = '#ffb35c', ROSE = '#ff7a90', GRN = '#4dff9e', INK = '#eef3ff', DIM = 'rgba(160,200,255,0.22)', MUTE = 'rgba(169,180,204,0.7)';
  const TAU = Math.PI * 2;

  // ---------- drawing helpers ----------
  const H = (g) => ({
    line(pts, col = ICE, w = 2, glow = 8, dash) {
      g.save(); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
      if (glow) { g.shadowColor = col; g.shadowBlur = glow; }
      if (dash) g.setLineDash(dash);
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.restore();
    },
    rect(x, y, w, h, r, col = ICE, lw = 1.6, fill, glow = 6, dash) {
      g.save(); g.beginPath(); g.roundRect(x, y, w, h, r);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (col) { g.strokeStyle = col; g.lineWidth = lw; if (glow) { g.shadowColor = col; g.shadowBlur = glow; } if (dash) g.setLineDash(dash); g.stroke(); }
      g.restore();
    },
    circ(x, y, r, col = ICE, lw = 1.6, fill, glow = 8) {
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU);
      if (fill) { g.fillStyle = fill; if (glow) { g.shadowColor = fill; g.shadowBlur = glow; } g.fill(); }
      if (col) { g.strokeStyle = col; g.lineWidth = lw; if (glow) { g.shadowColor = col; g.shadowBlur = glow; } g.stroke(); }
      g.restore();
    },
    text(s, x, y, size = 11, col = MUTE, align = 'left', weight = 400, font = 'JetBrains Mono, monospace') {
      g.save(); g.fillStyle = col; g.font = `${weight} ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); g.restore();
    },
    arrow(x1, y, x2, col = ICE_D) {
      g.save(); g.strokeStyle = col; g.lineWidth = 1.4; g.setLineDash([3, 4]);
      g.beginPath(); g.moveTo(x1, y); g.lineTo(x2 - 6, y); g.stroke(); g.setLineDash([]);
      g.fillStyle = col; g.beginPath(); g.moveTo(x2, y); g.lineTo(x2 - 7, y - 4); g.lineTo(x2 - 7, y + 4); g.fill(); g.restore();
    },
  });
  const ease = (u) => u * u * (3 - 2 * u);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  function ik2(bx, by, tx, ty, L1, L2, up = true) {
    const dx = tx - bx, dy = by - ty; let d = Math.hypot(dx, dy); d = Math.min(d, L1 + L2 - 0.5);
    const c2 = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
    const q2 = (up ? 1 : -1) * Math.acos(c2);
    const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    const ex = bx + L1 * Math.cos(q1), ey = by - L1 * Math.sin(q1);
    return { ex, ey, px: ex + L2 * Math.cos(q1 + q2), py: ey - L2 * Math.sin(q1 + q2), q1, q2 };
  }

  // =================================================================
  // FTC: CAD wireframe → autonomous path on the field → Worlds
  // =================================================================
  function ftc(g, t, h) {
    // left: rotating wireframe robot (CAD)
    const cx = 100, cy = 120, a = t * 0.6;
    const P = (x, y, z) => { const ca = Math.cos(a), sa = Math.sin(a); const X = x * ca - z * sa, Z = x * sa + z * ca; return [cx + X, cy + y * 0.9 + Z * 0.35]; };
    const box = (x0, y0, z0, x1, y1, z1, col, lw = 1.4) => {
      const v = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]].map((p) => P(...p));
      [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([i, j]) => h.line([v[i], v[j]], col, lw, 4));
    };
    box(-40, 10, -40, 40, 26, 40, ICE);
    const lift = 10 + (Math.sin(t * 1.4) * 0.5 + 0.5) * 50;
    box(-6, 10 - lift - 30, 18, 6, 10, 30, ICE_D);
    box(-26, 10 - lift - 34, 10, 26, 10 - lift - 26, 40, AMB);
    [[-44, -30], [44, -30], [-44, 30], [44, 30]].forEach(([x, z]) => { const [px, py] = P(x, 30, z); h.circ(px, py, 7, ICE_D, 1.2, null, 0); });
    h.text('CAD · ONSHAPE', cx, 222, 10, MUTE, 'center');

    // middle: field with autonomous spline path
    const fx = 220, fy = 22, fs = 200;
    h.rect(fx, fy, fs, fs, 8, DIM, 1.2, 'rgba(10,18,36,0.6)', 0);
    g.save(); g.strokeStyle = 'rgba(160,200,255,0.08)'; g.lineWidth = 1;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(fx + (fs / 6) * i, fy); g.lineTo(fx + (fs / 6) * i, fy + fs); g.moveTo(fx, fy + (fs / 6) * i); g.lineTo(fx + fs, fy + (fs / 6) * i); g.stroke(); }
    g.restore();
    const path = (u) => { const th = u * TAU; return [fx + fs / 2 + Math.sin(th) * 70, fy + fs / 2 + Math.sin(th * 2) * 52]; };
    const pts = []; for (let i = 0; i <= 80; i++) pts.push(path(i / 80));
    h.line(pts, ICE_D, 1.4, 0, [4, 5]);
    const u = (t * 0.09) % 1, [rx, ry] = path(u), [qx, qy] = path((u + 0.005) % 1);
    const trail = []; for (let i = 0; i < 18; i++) trail.push(path((u - i * 0.006 + 1) % 1));
    h.line(trail, AMB, 2.4, 10);
    // game pieces: collected when the robot passes
    const pieces = [0.12, 0.37, 0.62, 0.87];
    pieces.forEach((pu) => { const [px, py] = path(pu); const d = (u - pu + 1) % 1; if (d > 0.25) h.circ(px, py, 5, AMB, 1.6, 'rgba(255,179,92,0.25)', 6); });
    g.save(); g.translate(rx, ry); g.rotate(Math.atan2(qy - ry, qx - rx));
    h.rect(-11, -10, 22, 20, 3, ICE, 1.8, 'rgba(137,230,255,0.25)', 10);
    h.line([[4, 0], [11, 0]], INK, 2, 0);
    g.restore();
    const score = Math.floor(t * 0.09 * 4) % 40 * 5;
    h.text('AUTO', fx + 10, fy + 12, 9.5, ICE);
    h.text(String(score).padStart(3, '0') + ' PTS', fx + fs - 10, fy + 12, 9.5, AMB, 'right');
    h.text('AUTONOMOUS PATHING', fx + fs / 2, 238, 10, MUTE, 'center');

    // right: trophy
    const tx = 540, ty = 92, pul = 0.6 + Math.sin(t * 2) * 0.4;
    g.save(); g.shadowColor = AMB; g.shadowBlur = 18 * pul;
    h.line([[tx - 30, ty - 30], [tx + 30, ty - 30], [tx + 26, ty + 6], [tx + 12, ty + 22], [tx - 12, ty + 22], [tx - 26, ty + 6], [tx - 30, ty - 30]], AMB, 2.2, 14);
    h.line([[tx - 30, ty - 22], [tx - 46, ty - 22], [tx - 44, ty - 4], [tx - 27, ty + 4]], AMB, 2, 8);
    h.line([[tx + 30, ty - 22], [tx + 46, ty - 22], [tx + 44, ty - 4], [tx + 27, ty + 4]], AMB, 2, 8);
    h.line([[tx, ty + 22], [tx, ty + 38]], AMB, 2, 8);
    h.rect(tx - 22, ty + 38, 44, 12, 3, AMB, 2, 'rgba(255,179,92,0.15)', 8);
    g.restore();
    h.text('★', tx, ty - 8, 18, INK, 'center');
    h.text('WORLDS 2025', tx, 172, 15, INK, 'center', 700, 'Syne, sans-serif');
    h.text('STATE CHAMPIONS', tx, 194, 10, AMB, 'center');
  }

  // =================================================================
  // AcousticTB: cough → spectrogram → CNN + XGBoost → screen result
  // =================================================================
  function atb(g, t, h) {
    const per = 4.2, p = (t % per) / per;
    // device
    h.rect(26, 62, 92, 140, 18, ICE, 1.8, 'rgba(137,230,255,0.06)', 8);
    h.circ(72, 104, 20, ICE, 1.6, null, 6);
    for (let i = -2; i <= 2; i++) h.line([[64, 104 + i * 5], [80, 104 + i * 5]], ICE_D, 1.2, 0);
    h.circ(55, 176, 9, ICE_D, 1.4, null, 0); h.circ(89, 176, 9, ICE_D, 1.4, null, 0);
    h.rect(54, 136, 36, 18, 3, ICE_D, 1.2, null, 0);
    h.circ(100, 76, 3.5, null, 0, p < 0.35 ? GRN : 'rgba(77,255,158,0.25)', 8);
    h.text('MIC · SONAR · CAM', 72, 222, 9.5, MUTE, 'center');
    // waveform travelling out of the mic
    const wpts = [];
    for (let x = 128; x <= 262; x += 2) {
      const u = (x - 128) / 134, env = Math.exp(-((u - p * 1.4 + 0.15) ** 2) / 0.012) + 0.6 * Math.exp(-((u - p * 1.4 + 0.42) ** 2) / 0.008);
      wpts.push([x, 120 + Math.sin(x * 0.9 + t * 30) * 34 * env + Math.sin(x * 0.2) * 1.5]);
    }
    h.line(wpts, ICE, 1.6, 8);
    h.text('COUGH', 195, 222, 9.5, MUTE, 'center');
    // spectrogram
    const sx = 280, sy = 58, cols = 22, rows = 14, cw = 5.2, ch = 9;
    h.rect(sx - 6, sy - 6, cols * cw + 12, rows * ch + 12, 6, DIM, 1, 'rgba(4,10,24,0.7)', 0);
    const off = Math.floor(t * 9);
    for (let c = 0; c < cols; c++) {
      const gc = c + off, burst = Math.max(0, Math.sin(gc * 0.23)) ** 3;
      for (let r = 0; r < rows; r++) {
        const fr = (rows - r) / rows, e = burst * Math.exp(-((fr - 0.3) ** 2) / 0.05) * (0.7 + 0.3 * Math.sin(gc * 1.7 + r * 2.1)) + 0.08 * Math.abs(Math.sin(gc * 3.1 + r * 1.3));
        g.fillStyle = e > 0.55 ? `rgba(255,179,92,${clamp(e)})` : `rgba(137,230,255,${clamp(e * 1.1)})`;
        g.fillRect(sx + c * cw, sy + r * ch, cw - 1, ch - 1);
      }
    }
    h.text('SPECTROGRAM', sx + (cols * cw) / 2, 222, 9.5, MUTE, 'center');
    h.arrow(408, 120, 430);
    // model: CNN layers + trees
    const layers = [[440, 74, 92], [458, 82, 76], [476, 92, 56], [494, 100, 40]];
    layers.forEach(([x, y, hh], i) => h.rect(x, y, 12, hh, 3, i % 2 ? ICE : ICE_D, 1.4, 'rgba(137,230,255,0.08)', 6));
    for (let i = 0; i < 6; i++) { const on = Math.sin(t * 6 + i) > 0.3; h.line([[452, 84 + i * 13], [476, 98 + i * 7]], on ? ICE : 'rgba(137,230,255,0.12)', 1, on ? 6 : 0); }
    // tiny decision tree
    h.line([[520, 92], [512, 110], [520, 92], [528, 110], [512, 110], [507, 126], [512, 110], [517, 126], [528, 110], [534, 126]], AMB, 1.4, 6);
    h.text('CNN + XGB', 486, 222, 9.5, MUTE, 'center');
    h.arrow(540, 120, 556);
    // result gauge
    const gx = 598, gy = 132, R = 32, val = ease(clamp((p - 0.45) / 0.35)) * 0.85;
    g.save(); g.lineWidth = 6; g.lineCap = 'round';
    g.strokeStyle = 'rgba(137,230,255,0.15)'; g.beginPath(); g.arc(gx, gy, R, Math.PI, TAU); g.stroke();
    g.strokeStyle = AMB; g.shadowColor = AMB; g.shadowBlur = 10; g.beginPath(); g.arc(gx, gy, R, Math.PI, Math.PI + Math.PI * val); g.stroke(); g.restore();
    h.text(val.toFixed(2), gx, gy - 8, 15, INK, 'center', 700, 'Syne, sans-serif');
    h.text('AUC', gx, gy + 10, 9, MUTE, 'center');
    h.text(p > 0.8 ? 'FLAG ✓' : 'SCREENING', gx, 176, 10, p > 0.8 ? GRN : ICE, 'center');
    h.text('RESULT', gx, 222, 9.5, MUTE, 'center');
  }

  // =================================================================
  // Robot arm: "deal the cards" → Gemini plan → sim twin check → real arm
  // =================================================================
  function arm(g, t, h) {
    const per = 3.2, k = Math.floor(t / per) % 4, p = (t % per) / per;
    const ground = 222;
    h.line([[40, ground], [600, ground]], DIM, 1.2, 0);
    // command panel
    const cmd = '"Deal the cards"', typed = cmd.slice(0, Math.floor(clamp(((t % (per * 4)) / 1.2)) * cmd.length));
    h.rect(24, 24, 210, 66, 10, ICE_D, 1.2, 'rgba(4,10,24,0.7)', 0);
    h.text('YOU ›', 38, 42, 10, ICE);
    h.text(typed + ((t * 2) % 1 < 0.5 ? '▌' : ''), 82, 42, 12, INK, 'left', 400, 'Manrope, sans-serif');
    h.text('GEMINI ›', 38, 68, 10, AMB);
    h.text(['grab', 'lift', 'place'].map((s, i) => (p > 0.1 + i * 0.12 || k > 0 ? s : '···')).join(' → '), 98, 68, 11, INK);
    // deck and seats
    const base = [330, ground - 22], deck = [218, ground - 6], seats = [[396, ground - 6], [440, ground - 6], [484, ground - 6]];
    for (let i = 0; i < 6 - k; i++) h.rect(deck[0] - 16, deck[1] - 2 - i * 3, 32, 3, 1, ICE_D, 1, 'rgba(238,243,255,0.75)', 0);
    seats.forEach(([x, y], i) => { h.rect(x - 16, y - 2, 32, 4, 2, i < k ? AMB : DIM, 1, i < k ? 'rgba(255,179,92,0.5)' : null, i < k ? 6 : 0, i < k ? null : [3, 3]); });
    const target = seats[Math.min(k, 2)];
    // phase: 0-0.3 twin preview, 0.3-0.85 real move, 0.85-1 return
    const way = (u) => { const x = lerp(deck[0], target[0], u), y = lerp(deck[1] - 18, target[1] - 18, u) - Math.sin(u * Math.PI) * 70; return [x, y]; };
    const L1 = 86, L2 = 78;
    const drawArm = (tx, ty, col, ghost) => {
      const s = ik2(base[0], base[1], tx, ty, L1, L2, true);
      const lw = ghost ? 2 : 7, lw2 = ghost ? 2 : 5;
      h.line([[base[0], base[1]], [s.ex, s.ey]], col, lw, ghost ? 6 : 6, ghost ? [4, 4] : null);
      h.line([[s.ex, s.ey], [s.px, s.py]], col, lw2, ghost ? 6 : 6, ghost ? [4, 4] : null);
      if (!ghost) { h.circ(base[0], base[1], 6, ICE, 1.6, '#0b1428', 0); h.circ(s.ex, s.ey, 5, ICE, 1.6, '#0b1428', 0); }
      h.line([[s.px, s.py], [s.px, s.py + 12]], col, ghost ? 1.5 : 3, 4, ghost ? [3, 3] : null);
      return s;
    };
    if (k < 3) {
      // ghost preview sweeps the path
      if (p < 0.35) {
        const gu = ease(clamp(p / 0.3)); const pts = []; for (let i = 0; i <= 24; i++) pts.push(way((i / 24) * gu));
        h.line(pts, GRN, 1.4, 6, [2, 4]);
        const [gxx, gyy] = way(gu); drawArm(gxx, gyy, 'rgba(77,255,158,0.6)', true);
      }
      const ru = p < 0.35 ? 0 : p < 0.85 ? ease((p - 0.35) / 0.5) : 1 - ease((p - 0.85) / 0.15);
      const [ax, ay] = way(ru);
      drawArm(ax, ay, ICE, false);
      if (p >= 0.35 && p < 0.85) h.rect(ax - 16, ay + 12, 32, 3, 1, null, 0, 'rgba(238,243,255,0.9)', 0);
    } else {
      drawArm(base[0] + Math.sin(t) * 20, base[1] - 120, ICE, false);
    }
    h.rect(base[0] - 24, ground - 10, 48, 10, 3, ICE, 1.4, 'rgba(137,230,255,0.15)', 4);
    // safety badge
    const ok = (k < 3 && p > 0.3) || k === 3;
    h.rect(468, 24, 148, 30, 15, ok ? GRN : ICE_D, 1.4, ok ? 'rgba(77,255,158,0.1)' : 'rgba(4,10,24,0.6)', ok ? 10 : 0);
    h.text(ok ? 'SIM TWIN ✓ SAFE' : 'SIM TWIN · CHECKING', 542, 39, 10, ok ? GRN : ICE, 'center');
    h.text(`DEALT ${k}/3`, 542, 72, 11, AMB, 'center');
  }

  // =================================================================
  // GaitWay: phone LiDAR → skeleton + joint angles → metrics (no video)
  // =================================================================
  function gwy(g, t, h) {
    const ground = 214;
    // phone
    h.rect(30, 60, 58, 112, 10, ICE, 1.8, 'rgba(137,230,255,0.06)', 8);
    h.circ(76, 72, 4, null, 0, AMB, 10);
    h.text('LiDAR', 59, 188, 9.5, MUTE, 'center');
    // scan beam
    g.save(); const grd = g.createLinearGradient(80, 0, 300, 0); grd.addColorStop(0, 'rgba(255,179,92,0.35)'); grd.addColorStop(1, 'rgba(255,179,92,0)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(80, 72); g.lineTo(300, 26); g.lineTo(300, ground); g.closePath(); g.fill(); g.restore();
    // walker
    const cx = 220, s = t * 3.2, sw = Math.sin(s), sw2 = Math.sin(s + Math.PI);
    const hip = [cx, 128 + Math.abs(Math.cos(s)) * -3], neck = [cx + 2, 76], head = [cx + 3, 60];
    const leg = (ph) => { const th = Math.sin(ph) * 0.5, kn = [hip[0] + Math.sin(th) * 44, hip[1] + Math.cos(th) * 44]; const bend = Math.max(0, Math.sin(ph + 1.2)) * 0.9; const ft = [kn[0] + Math.sin(th - bend) * 44, kn[1] + Math.cos(th - bend) * 44]; return [kn, [ft[0], Math.min(ground, ft[1])], bend]; };
    const [k1, f1, b1] = leg(s), [k2, f2] = leg(s + Math.PI);
    const arm1 = [neck[0] + sw2 * 20, neck[1] + 36], arm2 = [neck[0] + sw * 20, neck[1] + 36];
    // lidar dot cloud on the body
    g.fillStyle = 'rgba(255,179,92,0.55)';
    for (let i = 0; i < 70; i++) { const u = (i * 0.618 + Math.floor(t * 8) * 0.13) % 1, v = (i * 0.37) % 1; const x = cx - 26 + u * 52, y = 50 + v * (ground - 54); if (Math.abs(x - cx) < 18 + (y > 128 ? 10 : 0)) g.fillRect(x, y, 2, 2); }
    h.circ(head[0], head[1], 11, ICE, 2, null, 8);
    h.line([neck, hip], ICE, 2.4, 8);
    h.line([[neck[0], neck[1] + 6], arm1], ICE_D, 2, 6); h.line([[neck[0], neck[1] + 6], arm2], ICE, 2, 6);
    h.line([hip, k2, f2], ICE_D, 2.4, 6);
    h.line([hip, k1, f1], ICE, 2.6, 8);
    [hip, k1, f1, neck].forEach(([x, y]) => h.circ(x, y, 3.2, null, 0, INK, 6));
    // knee angle arc
    const ang = Math.round(180 - b1 * 57.3);
    g.save(); g.strokeStyle = AMB; g.lineWidth = 1.6; g.shadowColor = AMB; g.shadowBlur = 6; g.beginPath(); g.arc(k1[0], k1[1], 14, -Math.PI / 2 - 0.2, -Math.PI / 2 + 0.9 + b1); g.stroke(); g.restore();
    h.text(`${ang}°`, k1[0] + 20, k1[1] - 8, 11, AMB);
    h.line([[110, ground], [330, ground]], DIM, 1.2, 0);
    // knee-angle chart
    const chx = 360, chy = 34, cw = 250, chh = 90;
    h.rect(chx, chy, cw, chh, 8, DIM, 1, 'rgba(4,10,24,0.6)', 0);
    h.text('KNEE ANGLE', chx + 10, chy + 13, 9.5, MUTE);
    const pts = []; for (let i = 0; i <= 100; i++) { const ph = s - (100 - i) * 0.06; pts.push([chx + 8 + i * 2.34, chy + 74 - Math.max(0, Math.sin(ph + 1.2)) * 44 - 6]); }
    h.line(pts, ICE, 1.8, 8);
    h.circ(pts[100][0], pts[100][1], 3, null, 0, AMB, 8);
    // metric chips
    const chips = [['STRIDE', (1.18 + Math.sin(t * 0.7) * 0.04).toFixed(2) + ' m/s'], ['SWAY', (1.6 + Math.sin(t * 1.3) * 0.3).toFixed(1) + '°'], ['VIDEO', 'NONE ✓']];
    chips.forEach(([k, v], i) => { const x = chx + i * 85; h.rect(x, 142, 78, 48, 8, i === 2 ? GRN : ICE_D, 1.2, 'rgba(4,10,24,0.6)', i === 2 ? 6 : 0); h.text(k, x + 39, 158, 9, MUTE, 'center'); h.text(v, x + 39, 177, 12, i === 2 ? GRN : INK, 'center', 700, 'Manrope, sans-serif'); });
    h.text('→ CLINICIAN DASHBOARD', chx + cw / 2, 214, 10, ICE, 'center');
  }

  // =================================================================
  // OmniGlasses: 3 cameras see behind you, warn, track eye strain
  // =================================================================
  const omnObjs = [{ a: 0.2, s: 0.11, o: 0 }, { a: -0.5, s: 0.08, o: 0.45 }, { a: 0.75, s: 0.1, o: 0.7 }];
  function omn(g, t, h) {
    const hx = 300, hy = 86;
    // camera cones (rear + two sides, looking backwards)
    const cone = (ang, spread, len, col) => { g.save(); const gr = g.createRadialGradient(hx, hy, 10, hx, hy, len); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(137,230,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(hx, hy); g.arc(hx, hy, len, ang - spread, ang + spread); g.closePath(); g.fill(); g.restore(); };
    cone(Math.PI / 2, 0.55, 170, 'rgba(137,230,255,0.22)');
    cone(Math.PI / 2 + 0.95, 0.4, 140, 'rgba(137,230,255,0.13)');
    cone(Math.PI / 2 - 0.95, 0.4, 140, 'rgba(137,230,255,0.13)');
    // head + glasses (top-down)
    h.circ(hx, hy, 30, ICE, 1.8, 'rgba(10,18,36,0.9)', 8);
    h.line([[hx - 4, hy - 31], [hx, hy - 38], [hx + 4, hy - 31]], ICE_D, 1.4, 0);
    h.rect(hx - 30, hy - 30, 24, 10, 4, INK, 1.6, null, 6); h.rect(hx + 6, hy - 30, 24, 10, 4, INK, 1.6, null, 6);
    h.line([[hx - 31, hy - 22], [hx - 33, hy + 14]], INK, 1.6, 4); h.line([[hx + 31, hy - 22], [hx + 33, hy + 14]], INK, 1.6, 4);
    [[hx, hy + 30], [hx - 32, hy + 16], [hx + 32, hy + 16]].forEach(([x, y]) => h.circ(x, y, 3.6, null, 0, AMB, 10));
    h.text('FRONT ↑', hx, hy - 52, 9.5, MUTE, 'center');
    // approaching objects from behind
    let warn = false;
    omnObjs.forEach((o) => {
      const u = (t * o.s + o.o) % 1, r = lerp(176, 46, ease(u)), ang = Math.PI / 2 + o.a;
      const x = hx + Math.cos(ang) * r, y = hy + Math.sin(ang) * r;
      if (y > 250) return;
      const close = r < 92; if (close) warn = true;
      h.rect(x - 9, y - 9, 18, 18, 3, close ? ROSE : ICE, 1.4, null, 8);
      h.text(`${(r / 40).toFixed(1)}m`, x + 13, y, 9.5, close ? ROSE : ICE);
    });
    if (warn) { const pr = 34 + ((t * 2) % 1) * 30; g.save(); g.strokeStyle = `rgba(255,122,144,${1 - ((t * 2) % 1)})`; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy, pr, 0, TAU); g.stroke(); g.restore(); }
    h.rect(hx - 70, 228 - 14, 140, 24, 12, warn ? ROSE : DIM, 1.2, warn ? 'rgba(255,122,144,0.12)' : 'rgba(4,10,24,0.6)', warn ? 10 : 0);
    h.text(warn ? '⚠ OBJECT BEHIND YOU' : 'REAR CLEAR', hx, 226, 10, warn ? ROSE : MUTE, 'center');
    // phone receiving 3 UDP feeds
    const px = 40, py = 40;
    h.rect(px, py, 96, 168, 12, ICE_D, 1.4, 'rgba(4,10,24,0.7)', 0);
    for (let i = 0; i < 3; i++) {
      const y = py + 16 + i * 46; h.rect(px + 10, y, 76, 38, 4, ICE_D, 1, 'rgba(137,230,255,0.06)', 0);
      g.fillStyle = 'rgba(137,230,255,0.25)'; for (let l = 0; l < 6; l++) g.fillRect(px + 12, y + 4 + l * 6 + ((t * 20 + i * 7) % 6), 72, 1);
      h.text(['REAR', 'LEFT', 'RIGHT'][i], px + 48, y + 19, 9, ICE, 'center');
    }
    for (let i = 0; i < 6; i++) { const u = (t * 0.8 + i / 6) % 1; h.circ(lerp(hx - 40, px + 98, u), lerp(hy + 10 + (i % 3) * 10, py + 34 + (i % 3) * 46, u), 2, null, 0, ICE, 6); }
    h.text('UDP ×3', 190, 46, 9.5, MUTE, 'center');
    // eye tracker
    const ex = 530, ey = 64, blink = Math.max(0, Math.sin(t * 2.2) ** 40);
    g.save(); g.strokeStyle = ICE; g.lineWidth = 1.8; g.shadowColor = ICE; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(ex - 40, ey); g.quadraticCurveTo(ex, ey - 26 * (1 - blink), ex + 40, ey); g.quadraticCurveTo(ex, ey + 26 * (1 - blink), ex - 40, ey); g.stroke(); g.restore();
    if (blink < 0.6) h.circ(ex, ey, 10 * (1 - blink), ICE, 1.4, 'rgba(137,230,255,0.3)', 6);
    const chx = 470, chy = 104;
    h.rect(chx, chy, 140, 66, 8, DIM, 1, 'rgba(4,10,24,0.6)', 0);
    const pts = []; for (let i = 0; i <= 64; i++) { const tt = t - (64 - i) * 0.03; const b = Math.max(0, Math.sin(tt * 2.2) ** 40); pts.push([chx + 6 + i * 2.0, chy + 18 + b * 36]); }
    h.line(pts, AMB, 1.6, 6);
    h.text('EYE OPENNESS', chx + 70, chy + 8, 8.5, MUTE, 'center');
    h.text('BLINK / SQUINT 98%', ex, 190, 10.5, INK, 'center');
  }

  // =================================================================
  // skadvising.org: code → site builds itself → inquiries roll in
  // =================================================================
  function ska(g, t, h) {
    const per = 7, p = (t % per) / per;
    // code
    const lines = ['<Hero />', '<Subjects />', '<Booking />', 'vite build', 'deploy ✓'];
    h.rect(20, 34, 128, 160, 10, ICE_D, 1.2, 'rgba(4,10,24,0.7)', 0);
    lines.forEach((l, i) => { const shown = clamp(p * 9 - i); if (shown <= 0) return; h.text(l.slice(0, Math.ceil(l.length * shown)), 32, 58 + i * 26, 11, i === 4 ? GRN : i === 3 ? AMB : ICE); });
    h.arrow(152, 114, 176);
    // browser
    const bx = 182, by = 26, bw = 300, bh = 196, build = clamp((p - 0.12) / 0.3);
    h.rect(bx, by, bw, bh, 12, ICE, 1.6, 'rgba(6,12,28,0.85)', 8);
    h.line([[bx, by + 24], [bx + bw, by + 24]], ICE_D, 1, 0);
    ['#ff7a90', '#ffb35c', '#4dff9e'].forEach((c, i) => h.circ(bx + 14 + i * 12, by + 12, 3.5, null, 0, c, 0));
    h.text('skadvising.org', bx + bw / 2, by + 12, 10, MUTE, 'center');
    const solid = build > 0.5;
    h.rect(bx + 18, by + 40, 170, 18, 4, solid ? null : ICE_D, 1, solid ? 'rgba(238,243,255,0.9)' : null, 0, [3, 3]);
    h.rect(bx + 18, by + 66, 130, 10, 3, solid ? null : ICE_D, 1, solid ? 'rgba(169,180,204,0.5)' : null, 0, [3, 3]);
    h.rect(bx + 18, by + 82, 110, 10, 3, solid ? null : ICE_D, 1, solid ? 'rgba(169,180,204,0.5)' : null, 0, [3, 3]);
    const btn = [bx + 18, by + 104, 108, 26], press = p > 0.55 && p < 0.6;
    h.rect(...btn, 13, solid ? null : ICE_D, 1, solid ? (press ? '#ffd29a' : AMB) : null, solid ? 12 : 0, [3, 3]);
    if (solid) h.text('Book a session', btn[0] + 54, btn[1] + 13, 10.5, '#1a0e02', 'center', 700, 'Manrope, sans-serif');
    for (let i = 0; i < 3; i++) h.rect(bx + 18 + i * 92, by + 146, 84, 36, 6, solid ? ICE_D : DIM, 1, solid ? 'rgba(137,230,255,0.06)' : null, 0, solid ? null : [3, 3]);
    h.rect(bx + 206, by + 40, 76, 90, 8, solid ? ICE_D : DIM, 1, solid ? 'rgba(137,230,255,0.1)' : null, 0, solid ? null : [3, 3]);
    // cursor
    const cu = ease(clamp((p - 0.38) / 0.17)), cx = lerp(bx + 250, btn[0] + 70, cu), cy = lerp(by + 180, btn[1] + 18, cu);
    if (p > 0.35 && p < 0.75) h.line([[cx, cy], [cx, cy + 14], [cx + 4, cy + 10], [cx + 10, cy + 10], [cx, cy]], INK, 1.4, 4);
    // toast
    if (p > 0.58 && p < 0.92) { const a = clamp((p - 0.58) * 10); g.save(); g.globalAlpha = a; h.rect(bx + bw - 150, by + bh - 46, 140, 34, 8, GRN, 1.2, 'rgba(10,30,22,0.95)', 10); h.text('✉ New inquiry', bx + bw - 80, by + bh - 29, 11, GRN, 'center', 700, 'Manrope, sans-serif'); g.restore(); }
    // counter
    const n = Math.min(100, Math.floor(((t % (per * 3)) / (per * 3)) * 130));
    h.text(n >= 100 ? '100+' : String(n), 560, 92, 34, INK, 'center', 800, 'Syne, sans-serif');
    h.text('INQUIRIES', 560, 120, 10, AMB, 'center');
    for (let i = 0; i < 8; i++) { const v = Math.min(1, n / 100) * (0.25 + i * 0.1); h.rect(512 + i * 12, 200 - v * 60, 8, v * 60, 2, null, 0, i === 7 ? AMB : 'rgba(137,230,255,0.55)', 0); }
    h.text('4 MONTHS', 560, 214, 9.5, MUTE, 'center');
  }

  // ---------- runner ----------
  const SCENES = { ftc, atb, arm, gwy, omn, ska };
  const items = [...document.querySelectorAll('canvas[data-viz]')].map((c) => ({ c, g: c.getContext('2d'), fn: SCENES[c.dataset.viz], vis: false, w: 0 }));
  const io = new IntersectionObserver((es) => es.forEach((e) => { const it = items.find((i) => i.c === e.target); if (it) it.vis = e.isIntersecting; }), { rootMargin: '120px' });
  items.forEach((it) => io.observe(it.c));
  function size(it) {
    const w = it.c.clientWidth; if (!w || w === it.w) return; it.w = w;
    it.c.width = Math.round(w * DPR); it.c.height = Math.round((w * VH / VW) * DPR);
  }
  const t0 = performance.now();
  function frame(now) {
    const t = reduce ? 2.2 : (now - t0) / 1000;
    for (const it of items) {
      if (!it.vis || !it.fn) continue;
      size(it);
      const s = it.c.width / VW;
      it.g.setTransform(s, 0, 0, s, 0, 0);
      it.g.clearRect(0, 0, VW, VH);
      it.fn(it.g, t, H(it.g));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
