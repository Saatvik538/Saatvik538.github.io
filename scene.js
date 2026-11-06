// The whole site is one circuit board. Scrolling flies the camera along a copper bus
// from the "SK" processor, through six project modules and five experience chips,
// to the UT Austin core — then pulls up to show every module connected.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('scene');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth <= 820;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no gl');
} catch (e) {
  document.body.classList.add('no-webgl');
  throw e;
}

// draw canvas text with the real fonts
await Promise.race([
  Promise.all(['500 64px "JetBrains Mono"', '800 64px "Unbounded"', '600 20px "Geist"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 1500)),
]).catch(() => {});

renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile() ? 1.5 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const BG = 0x050b09;
const COPPER = 0xf2a03d;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(BG, 0.02);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 400);

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xbfe8d8, 0x020504, 0.9));
const key = new THREE.DirectionalLight(0xfff1dd, 1.5);
key.position.set(-20, 30, 10);
scene.add(key);
const pulseLight = new THREE.PointLight(COPPER, 18, 14, 1.6);
scene.add(pulseLight);

// ---------- helpers ----------
const V = (x, z, y = 0) => new THREE.Vector3(x, y, z);
const glow = (hex, k = 2.2) => new THREE.Color(hex).multiplyScalar(k);
const mat = {
  board: null,
  chip: new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.45, metalness: 0.3 }),
  chipTop: new THREE.MeshStandardMaterial({ color: 0x1b1f22, roughness: 0.6, metalness: 0.2 }),
  pin: new THREE.MeshStandardMaterial({ color: 0xd8a24f, roughness: 0.3, metalness: 0.9 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc8913a, roughness: 0.35, metalness: 0.85 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa4a8, roughness: 0.35, metalness: 0.8 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x22282b, roughness: 0.5, metalness: 0.4 }),
  white: new THREE.MeshStandardMaterial({ color: 0xdfe6e2, roughness: 0.5, metalness: 0.1 }),
  lit: new THREE.MeshBasicMaterial({ color: glow(COPPER, 2.4) }),
  litSoft: new THREE.MeshBasicMaterial({ color: glow(COPPER, 1.2) }),
  trace: new THREE.MeshStandardMaterial({ color: 0x1d5a43, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide }),
  bus: new THREE.MeshStandardMaterial({ color: 0x6b4718, roughness: 0.4, metalness: 0.8 }),
};

function makeCanvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// flat silkscreen text lying on the board
function label(text, { size = 0.5, color = 'rgba(220,232,224,0.75)', weight = 500, align = 'left' } = {}) {
  const fontPx = 64;
  const font = `${weight} ${fontPx}px "JetBrains Mono", ui-monospace, monospace`;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = font;
  const w = Math.ceil(meas.measureText(text).width) + 16;
  const tex = makeCanvasTex(w, fontPx + 16, (g) => {
    g.font = font; g.fillStyle = color; g.textBaseline = 'middle';
    g.fillText(text, 8, (fontPx + 16) / 2);
  });
  const aspect = w / (fontPx + 16);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size * aspect, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  if (align === 'center') m.geometry.translate(0, 0, 0);
  else m.geometry.translate((size * aspect) / 2, 0, 0);
  return m;
}

// flat ribbon (trace) along a polyline, written into `out` position array
function ribbon(pts, w, y, out) {
  const h = w / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    const nx = (-dz / L) * h, nz = (dx / L) * h;
    // extend each segment by h so joints overlap cleanly
    const ex = (dx / L) * h, ez = (dz / L) * h;
    const a1 = [a.x + nx - ex, y, a.z + nz - ez], a2 = [a.x - nx - ex, y, a.z - nz - ez];
    const b1 = [b.x + nx + ex, y, b.z + nz + ez], b2 = [b.x - nx + ex, y, b.z - nz + ez];
    out.push(...a1, ...a2, ...b1, ...b1, ...a2, ...b2);
  }
}
function ribbonMesh(arr, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return new THREE.Mesh(g, material);
}

// seeded RNG so the board is identical on every visit
let seed = 1337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rr = (a, b) => a + rnd() * (b - a);

// ---------- board ----------
const boardTex = makeCanvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#071a14'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(30,80,60,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.strokeStyle = 'rgba(70,140,110,0.10)'; g.lineWidth = 1;
  for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i + .5, 0); g.lineTo(i + .5, h); g.stroke(); g.beginPath(); g.moveTo(0, i + .5); g.lineTo(w, i + .5); g.stroke(); }
});
boardTex.wrapS = boardTex.wrapT = THREE.RepeatWrapping;
boardTex.repeat.set(30, 55);
mat.board = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.75, metalness: 0.15 });
const board = new THREE.Mesh(new THREE.PlaneGeometry(130, 230), mat.board);
board.rotation.x = -Math.PI / 2;
board.position.set(0, -0.02, -85);
scene.add(board);

// ---------- layout ----------
const ZS = (k) => -16 - 18 * k;
const STATIONS = [7, -7, 7, -7, 7, -7].map((x, k) => V(x, ZS(k)));
const EXP_Z = -124;
const EXP_X = [-12, -6, 0, 6, 12];
const CORE = V(0, -152);
const keepOut = [V(0, 0), ...STATIONS, ...EXP_X.map((x) => V(x, EXP_Z - 3)), CORE];
const clear = (p, r = 4.6) => keepOut.every((c) => Math.hypot(p.x - c.x, p.z - c.z) > r);

// ---------- main bus (the signal path everything hangs off) ----------
const busPts = [V(0, -3), V(0, -9)];
const stationIdx = [];
STATIONS.forEach((s, k) => {
  const next = STATIONS[k + 1];
  busPts.push(V(s.x, s.z)); stationIdx.push(busPts.length - 1);
  busPts.push(V(s.x, s.z - 2));
  if (next) busPts.push(V(next.x, s.z - 2 - 14));
});
// into the experience row (runs left → right, oldest → newest)
busPts.push(V(-16, -117), V(-16, EXP_Z));
const expStartIdx = busPts.length - 1;
busPts.push(V(16, EXP_Z));
const expEndIdx = busPts.length - 1;
busPts.push(V(16, -130), V(0, -146), V(0, CORE.z + 3.6));

const busCurve = new THREE.CurvePath();
for (let i = 0; i < busPts.length - 1; i++) busCurve.add(new THREE.LineCurve3(busPts[i].clone().setY(0.06), busPts[i + 1].clone().setY(0.06)));
const busLen = busCurve.getLength();
const cum = [0];
for (let i = 1; i < busPts.length; i++) cum.push(cum[i - 1] + busPts[i].distanceTo(busPts[i - 1]));
const fracAt = (i) => cum[i] / busLen;

const TUBE_SEG = 1600, RAD = 6;
const busGeo = new THREE.TubeGeometry(busCurve, TUBE_SEG, 0.11, RAD, false);
scene.add(new THREE.Mesh(busGeo, mat.bus));
const litGeo = new THREE.TubeGeometry(busCurve, TUBE_SEG, 0.125, RAD, false);
const litBus = new THREE.Mesh(litGeo, mat.lit);
litGeo.setDrawRange(0, 0);
scene.add(litBus);
// three side-by-side bus lanes either side of the main bus
{
  const arr = [];
  for (const off of [-0.55, -0.35, 0.35, 0.55]) {
    const pts = busPts.slice(1, -1).map((p, i, a) => {
      const prev = a[i - 1] || p, next = a[i + 1] || p;
      const dx = next.x - prev.x, dz = next.z - prev.z, L = Math.hypot(dx, dz) || 1;
      return V(p.x + (-dz / L) * off, p.z + (dx / L) * off);
    });
    ribbon(pts, 0.07, 0.01, arr);
  }
  scene.add(ribbonMesh(arr, mat.trace));
}

// signal pulse
const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: glow(0xffd29a, 4) }));
scene.add(pulse);

// ---------- decorative traces, vias, SMD parts ----------
const decorPolys = [];
{
  const arr = [];
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  for (let n = 0; n < 340; n++) {
    let p = V(Math.round(rr(-48, 48) * 2) / 2, Math.round(rr(-178, 14) * 2) / 2);
    if (!clear(p, 5)) continue;
    let d = Math.floor(rnd() * 4) * 2; // start axis-aligned
    const pts = [p.clone()];
    const segs = 2 + Math.floor(rnd() * 5);
    for (let s = 0; s < segs; s++) {
      const len = rr(1.5, 6);
      const [dx, dz] = dirs[d];
      const k = len / Math.hypot(dx, dz);
      const q = V(p.x + dx * k, p.z + dz * k);
      if (!clear(q, 4.4)) break;
      pts.push(q); p = q;
      d = (d + (rnd() < 0.5 ? 1 : 7)) % 8; // turn 45°
    }
    if (pts.length < 2) continue;
    const w = rnd() < 0.15 ? 0.16 : 0.07;
    // bundles of parallel traces
    const lanes = rnd() < 0.25 ? 4 : 1;
    for (let l = 0; l < lanes; l++) {
      const off = l * 0.28;
      const lp = pts.map((pt, i, a) => {
        const prev = a[i - 1] || pt, next = a[i + 1] || pt;
        const dx = next.x - prev.x, dz = next.z - prev.z, L = Math.hypot(dx, dz) || 1;
        return V(pt.x + (-dz / L) * off, pt.z + (dx / L) * off);
      });
      ribbon(lp, w, 0.005, arr);
      decorPolys.push(lp);
    }
  }
  scene.add(ribbonMesh(arr, mat.trace));

  // vias at trace ends
  const viaGeo = new THREE.RingGeometry(0.09, 0.2, 14);
  viaGeo.rotateX(-Math.PI / 2);
  const vias = new THREE.InstancedMesh(viaGeo, mat.gold, decorPolys.length * 2);
  const m4 = new THREE.Matrix4();
  let vi = 0;
  for (const poly of decorPolys) for (const p of [poly[0], poly[poly.length - 1]]) { m4.makeTranslation(p.x, 0.015, p.z); vias.setMatrixAt(vi++, m4); }
  vias.count = vi;
  scene.add(vias);

  // SMD resistors / caps
  const smd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.18, 0.26), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.6 }), 420);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.2, 0.28), mat.steel, 840);
  const q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  let si = 0, ci = 0;
  for (let n = 0; n < 900 && si < 420; n++) {
    const p = V(rr(-46, 46), rr(-176, 12));
    if (!clear(p, 4.2)) continue;
    const rot = rnd() < 0.5 ? 0 : Math.PI / 2;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    m4.compose(new THREE.Vector3(p.x, 0.09, p.z), q, s1); smd.setMatrixAt(si++, m4);
    for (const sgn of [-1, 1]) {
      const o = new THREE.Vector3(0.28 * sgn, 0, 0).applyQuaternion(q);
      m4.compose(new THREE.Vector3(p.x + o.x, 0.1, p.z + o.z), q, s1); caps.setMatrixAt(ci++, m4);
    }
  }
  smd.count = si; caps.count = ci;
  scene.add(smd, caps);
}

// little data packets running along random traces
const packets = [];
{
  const geo = new THREE.SphereGeometry(0.07, 8, 6);
  const m = new THREE.MeshBasicMaterial({ color: glow(0x8fffd0, 2) });
  const long = decorPolys.filter((p) => p.length >= 3);
  for (let i = 0; i < Math.min(46, long.length); i++) {
    const poly = long[Math.floor(rnd() * long.length)];
    const c = new THREE.CurvePath();
    for (let j = 0; j < poly.length - 1; j++) c.add(new THREE.LineCurve3(poly[j].clone().setY(0.05), poly[j + 1].clone().setY(0.05)));
    const mesh = new THREE.Mesh(geo, m);
    scene.add(mesh);
    packets.push({ c, mesh, speed: rr(0.08, 0.22), off: rnd() });
  }
}

// ---------- chip factory ----------
function chip(w, d, h = 0.35, pinsPerSide = 10, topText = null, sub = null) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.chip);
  body.position.y = h / 2 + 0.04;
  g.add(body);
  const pin = new THREE.BoxGeometry(0.12, 0.06, 0.38);
  const pins = new THREE.InstancedMesh(pin, mat.pin, pinsPerSide * 4);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  let i = 0;
  for (let side = 0; side < 4; side++) {
    const along = side % 2 === 0 ? w : d;
    for (let k = 0; k < pinsPerSide; k++) {
      const t = (k + 0.5) / pinsPerSide - 0.5;
      const pos = side === 0 ? V(t * w * 0.86, d / 2 + 0.15, 0.06) : side === 1 ? V(w / 2 + 0.15, t * d * 0.86, 0.06)
        : side === 2 ? V(t * w * 0.86, -d / 2 - 0.15, 0.06) : V(-w / 2 - 0.15, t * d * 0.86, 0.06);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), side % 2 ? Math.PI / 2 : 0);
      m4.compose(pos, q, s); pins.setMatrixAt(i++, m4);
      void along;
    }
  }
  g.add(pins);
  if (topText) {
    const tex = makeCanvasTex(512, 512, (c, W, H) => {
      c.fillStyle = '#1b1f22'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(242,160,61,0.55)'; c.lineWidth = 6; c.strokeRect(22, 22, W - 44, H - 44);
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.arc(60, H - 60, 14, 0, 7); c.fill();
      c.fillStyle = '#f2a03d'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const fs = topText.length > 7 ? 64 : 110;
      c.font = `800 ${fs}px "Unbounded", "Arial Black", sans-serif`;
      c.fillText(topText, W / 2, H / 2 - (sub ? 26 : 0));
      if (sub) { c.fillStyle = 'rgba(220,232,224,0.7)'; c.font = `500 30px "JetBrains Mono", monospace`; c.fillText(sub, W / 2, H / 2 + 62); }
    });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, d * 0.96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = h + 0.045;
    g.add(top);
  }
  return g;
}

// station platform: socket + glowing ring when active
function platform(text) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 5.2), mat.chipTop);
  pad.position.y = 0.06;
  g.add(pad);
  const ringMat = new THREE.MeshBasicMaterial({ color: glow(COPPER, 0.4) });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.05, 3.15, 4, 1), ringMat);
  ring.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  ring.position.y = 0.03;
  g.add(ring);
  const corners = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.14, 0.4), mat.gold, 4);
  [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]].forEach(([x, z], i) => corners.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.1, z)));
  g.add(corners);
  const l = label(text, { size: 0.42, color: 'rgba(242,160,61,0.9)' });
  l.position.set(-2.6, 0.02, 3.05);
  g.add(l);
  return { g, ringMat };
}

// ---------- hero processor ----------
const cpu = chip(5, 5, 0.42, 12, 'SK', 'KESARWANI');
scene.add(cpu);
{
  const l = label('U0  MAIN PROCESSOR', { size: 0.36 }); l.position.set(-2.6, 0.02, 3.4); scene.add(l);
}

// ---------- the six project modules ----------
const stations = [];
const NAMES = ['U1  ACOUSTICTB', 'U2  ROBOT ARM', 'U3  OMNIGLASSES', 'U4  GAITWAY', 'U5  FTC 15167', 'U6  SKADVISING'];
const builders = [buildAcoustic, buildArm, buildGlasses, buildGait, buildFTC, buildWeb];
STATIONS.forEach((p, k) => {
  const { g, ringMat } = platform(NAMES[k]);
  g.position.copy(p);
  const model = builders[k]();
  g.add(model.group);
  scene.add(g);
  stations.push({ g, ringMat, update: model.update, k });
});

function buildAcoustic() {
  const group = new THREE.Group();
  const dev = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.4), mat.dark);
  dev.position.set(-0.9, 0.36, 0.6); group.add(dev);
  const grille = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 28), mat.steel);
  grille.position.set(-0.9, 0.61, 0.2); group.add(grille);
  for (const x of [-1.2, -0.6]) { const u = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 18), mat.steel); u.rotation.x = Math.PI / 2; u.position.set(x, 0.36, 1.9); group.add(u); }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat.lit); led.position.set(-0.5, 0.62, 1.4); group.add(led);
  const bars = [];
  const barGeo = new THREE.BoxGeometry(0.16, 1, 0.16); barGeo.translate(0, 0.5, 0);
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(barGeo, i % 3 === 0 ? mat.lit : mat.litSoft);
    b.position.set(0.25 + i * 0.16, 0.12, -0.9 + Math.sin(i * 0.5) * 0.1);
    group.add(b); bars.push(b);
  }
  return { group, update(t) { bars.forEach((b, i) => { b.scale.y = 0.15 + Math.abs(Math.sin(t * 3 + i * 0.6) * Math.sin(t * 1.3 + i * 0.25)) * 1.9 * Math.exp(-((i - 6) ** 2) / 30); }); } };
}

function buildArm() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.4, 32), mat.dark); base.position.y = 0.32; group.add(base);
  const yaw = new THREE.Group(); yaw.position.y = 0.52; group.add(yaw);
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.35, 24), mat.white); turret.position.y = 0.17; yaw.add(turret);
  const shoulder = new THREE.Group(); shoulder.position.y = 0.4; yaw.add(shoulder);
  const j = (r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 24), mat.dark); m.rotation.x = Math.PI / 2; return m; };
  shoulder.add(j(0.26));
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.7, 0.32), mat.white); l1.position.y = 0.85; shoulder.add(l1);
  const elbow = new THREE.Group(); elbow.position.y = 1.7; shoulder.add(elbow); elbow.add(j(0.22));
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.4, 0.26), mat.white); l2.position.y = 0.7; elbow.add(l2);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.12, 0.27), mat.lit); stripe.position.y = 0.6; elbow.add(stripe);
  const wrist = new THREE.Group(); wrist.position.y = 1.4; elbow.add(wrist);
  const fingers = [];
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.2), mat.steel); f.position.set(0.12 * s, 0.18, 0); wrist.add(f); fingers.push(f); }
  // a little deck of cards being dealt
  const cards = [];
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.72), mat.white); c.position.set(1.6, 0.14 + i * 0.03, 1.4 - i * 0.02); group.add(c); cards.push(c); }
  return {
    group, update(t) {
      yaw.rotation.y = Math.sin(t * 0.6) * 0.9;
      shoulder.rotation.z = -0.35 + Math.sin(t * 0.9) * 0.3;
      elbow.rotation.z = -1.1 + Math.sin(t * 0.9 + 1) * 0.35;
      wrist.rotation.z = 1.2 - shoulder.rotation.z - elbow.rotation.z - 1.1;
      const g = 0.08 + (Math.sin(t * 1.8) * 0.5 + 0.5) * 0.08;
      fingers[0].position.x = -g; fingers[1].position.x = g;
    }
  };
}

function buildGlasses() {
  const group = new THREE.Group();
  const rig = new THREE.Group(); rig.position.y = 1.5; rig.scale.setScalar(0.85); group.add(rig);
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x264a44, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55 });
  for (const s of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 12, 40), mat.dark); rim.position.x = 0.78 * s; rig.add(rim);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), lensMat); lens.position.x = 0.78 * s; rig.add(lens);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 2.1), mat.dark); arm.position.set(1.4 * s, 0.1, -1.05); rig.add(arm);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), mat.steel); cam.position.set(1.4 * s, 0.12, -1.6); rig.add(cam);
  }
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 16, Math.PI), mat.dark); bridge.position.y = 0.12; rig.add(bridge);
  const backCam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.24), mat.steel); backCam.position.set(0, 0.12, -2.15); rig.add(backCam);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat.lit); eye.position.set(0, 0.12, -2.29); rig.add(eye);
  // rear "vision" cone sweeping behind the wearer
  const coneGeo = new THREE.ConeGeometry(1.5, 3.4, 32, 1, true); coneGeo.translate(0, -1.7, 0); coneGeo.rotateX(-Math.PI / 2);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: glow(COPPER, 0.9), transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  cone.position.set(0, 0.12, -2.3); rig.add(cone);
  const blip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), mat.lit); group.add(blip);
  return {
    group, update(t) {
      rig.position.y = 1.5 + Math.sin(t * 1.4) * 0.12; rig.rotation.y = Math.sin(t * 0.4) * 0.35;
      cone.rotation.y = Math.sin(t * 1.1) * 0.5;
      const a = (t * 0.7) % 1; blip.position.set(Math.sin(t) * 1.2, 0.3, -2 - a * 2.2); blip.scale.setScalar(1 - a * 0.6);
    }
  };
}

function buildGait() {
  const group = new THREE.Group();
  const phone = new THREE.Group(); phone.position.set(-1.4, 1.35, 1.2); phone.rotation.set(-0.15, 0.55, 0); group.add(phone);
  phone.add(new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.1, 0.1), mat.dark));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.0), new THREE.MeshBasicMaterial({ color: glow(0x0f3b33, 1.4) })); screen.position.z = 0.051; phone.add(screen);
  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), mat.lit); lidar.rotation.x = Math.PI / 2; lidar.position.set(0.3, 0.8, -0.06); phone.add(lidar);
  // skeleton on screen-ish: stick figure overlay in front of phone
  // LiDAR dot field projected toward the walkway
  const N = 260, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = rr(-1.2, 2.2); pos[i * 3 + 1] = rr(0.05, 2.4); pos[i * 3 + 2] = rr(-2.2, 0.4); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dots = new THREE.Points(pg, new THREE.PointsMaterial({ color: glow(COPPER, 1.6), size: 0.05, transparent: true, opacity: 0.8, depthWrite: false }));
  group.add(dots);
  const steps = [];
  const fg = new THREE.CircleGeometry(0.22, 20); fg.scale(1, 1.8, 1); fg.rotateX(-Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: glow(COPPER, 1.6), transparent: true, opacity: 0.15 }));
    m.position.set(1.4 + (i % 2 ? 0.35 : -0.35), 0.14, 1.9 - i * 0.75); group.add(m); steps.push(m);
  }
  return { group, update(t) { const a = (t * 2) % 6; steps.forEach((s, i) => { s.material.opacity = 0.12 + Math.max(0, 1 - Math.abs(a - i)) * 0.85; }); dots.rotation.y = Math.sin(t * 0.5) * 0.05; } };
}

function buildFTC() {
  const group = new THREE.Group();
  const bot = new THREE.Group(); group.add(bot);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.6), mat.steel); chassis.position.y = 0.4; bot.add(chassis);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.5), mat.lit); plate.position.y = 0.55; plate.scale.set(1, 1, 0.08); bot.add(plate);
  const wheels = [];
  for (const [x, z] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 18), mat.dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.3, z); bot.add(w); wheels.push(w);
  }
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.16), mat.white); mast.position.set(0, 1.3, -0.5); bot.add(mast);
  const claw = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.5), mat.dark); claw.position.set(0, 1.2, -0.25); bot.add(claw);
  return {
    group, update(t) {
      const a = t * 0.7; bot.position.set(Math.sin(a) * 1.2, 0, Math.sin(a * 2) * 0.8);
      bot.rotation.y = Math.atan2(Math.cos(a) * 1.2, Math.cos(a * 2) * 1.6);
      claw.position.y = 0.9 + (Math.sin(t * 1.5) * 0.5 + 0.5) * 0.9;
      wheels.forEach((w) => (w.rotation.x = t * 6));
    }
  };
}

function buildWeb() {
  const group = new THREE.Group();
  const mon = new THREE.Group(); mon.position.set(0, 1.9, 0); group.add(mon);
  mon.add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.1, 0.12), mat.dark));
  const tex = makeCanvasTex(680, 420, (g, W, H) => {
    g.fillStyle = '#0c1714'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#16251f'; g.fillRect(0, 0, W, 40);
    ['#ff6b5a', '#f2c94c', '#3ccf8e'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(22 + i * 22, 20, 7, 0, 7); g.fill(); });
    g.fillStyle = '#9fb0a6'; g.font = '500 18px "JetBrains Mono", monospace'; g.fillText('skadvising.org', 100, 26);
    g.fillStyle = '#e8efe9'; g.font = '800 46px "Unbounded", "Arial Black", sans-serif'; g.fillText('Learn smarter.', 40, 130);
    g.fillStyle = '#5f7268'; g.fillRect(40, 160, 360, 14); g.fillRect(40, 186, 280, 14);
    g.fillStyle = '#f2a03d'; g.beginPath(); g.roundRect(40, 230, 170, 50, 25); g.fill();
    g.fillStyle = '#1a0e02'; g.font = '600 20px "Geist", sans-serif'; g.fillText('Book a session', 56, 262);
    for (let i = 0; i < 3; i++) { g.strokeStyle = '#2a3d36'; g.lineWidth = 2; g.strokeRect(40 + i * 205, 310, 185, 84); }
    g.fillStyle = '#f2a03d'; g.font = '800 30px "Unbounded", sans-serif'; g.fillText('100+', 470, 140); g.fillStyle = '#9fb0a6'; g.font = '16px "Geist", sans-serif'; g.fillText('inquiries', 470, 166);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 1.95), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.25, 1.25, 1.25) }));
  screen.position.z = 0.065; mon.add(screen);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.12), mat.steel); neck.position.set(0, 0.55, -0.1); group.add(neck);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.7), mat.steel); foot.position.set(0, 0.15, -0.1); group.add(foot);
  return { group, update(t) { mon.rotation.y = Math.sin(t * 0.5) * 0.2; mon.position.y = 1.9 + Math.sin(t * 1.2) * 0.06; } };
}

// ---------- experience chips ----------
const EXP_NAMES = [['ORANGEWOOD', '2024'], ['DARTMOUTH', '2025'], ['OBSCURITY', '2025'], ['TAR · IARC', '2026'], ['NESTEYE', 'NOW']];
const expChips = EXP_X.map((x, i) => {
  const c = chip(3.6, 2.4, 0.32, 8, EXP_NAMES[i][0], EXP_NAMES[i][1]);
  c.position.set(x, 0, EXP_Z - 3.4);
  scene.add(c);
  // stub from bus to chip
  const arr = []; ribbon([V(x, EXP_Z), V(x, EXP_Z - 2)], 0.16, 0.01, arr);
  const stub = ribbonMesh(arr, mat.bus.clone()); scene.add(stub);
  return { c, stub, at: (x + 16) / 32 };
});

// ---------- UT core ----------
const core = chip(7, 7, 0.5, 16, 'UT AUSTIN', 'ECE · ROBOTICS');
core.position.copy(CORE);
scene.add(core);
const coreHalo = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.35, 64), new THREE.MeshBasicMaterial({ color: glow(0xbf5700, 2.2), transparent: true, opacity: 0.9 }));
coreHalo.rotation.x = -Math.PI / 2; coreHalo.position.set(CORE.x, 0.03, CORE.z); scene.add(coreHalo);
{ const l = label('CORE  ·  THE UNIVERSITY OF TEXAS AT AUSTIN', { size: 0.4, color: 'rgba(242,160,61,0.85)' }); l.position.set(-3.6, 0.02, CORE.z + 5.2); scene.add(l); }

// ---------- camera keyframes, tied to DOM sections ----------
const P = (x, y, z) => new THREE.Vector3(x, y, z);
function keyframes() {
  const m = isMobile();
  const portrait = innerWidth / innerHeight < 0.9;
  const frames = {};
  frames.hero = m
    ? { pos: P(0.5, 19, 16), look: P(0.3, 0, 3.4), bus: 0, fog: 0.018 }
    : { pos: P(-4.5, 10.5, 9.5), look: P(-3.8, 0, -1.4), bus: 0, fog: 0.018 };
  STATIONS.forEach((s, k) => {
    frames['p' + k] = m
      ? { pos: P(s.x, portrait ? 9 : 7, s.z + (portrait ? 11.5 : 9)), look: P(s.x, 0.4, s.z + 3.2), bus: fracAt(stationIdx[k]), fog: 0.02 }
      : { pos: P(s.x - 2.8, 5.2, s.z + 8.2), look: P(s.x - 3.4, 1.0, s.z - 0.4), bus: fracAt(stationIdx[k]), fog: 0.022 };
  });
  frames.exp = m
    ? { pos: P(0, 26, EXP_Z + 14), look: P(0, 0, EXP_Z - 7), bus: fracAt(expEndIdx), fog: 0.012 }
    : { pos: P(0, 13, EXP_Z + 11), look: P(0, 0, EXP_Z - 9), bus: fracAt(expEndIdx), fog: 0.014 };
  frames.edu = m
    ? { pos: P(0, 22, CORE.z + 16), look: P(0, 0, CORE.z - 2), bus: 1, fog: 0.012 }
    : { pos: P(-3, 15, CORE.z + 13), look: P(-1.5, 0, CORE.z - 0.5), bus: 1, fog: 0.014 };
  frames.end = { pos: P(0, m ? 165 : 110, -52), look: P(0, 0, -80), bus: 1, fog: 0.004 };
  return frames;
}

let anchors = [];
function measure() {
  const frames = keyframes();
  anchors = [...document.querySelectorAll('[data-cam]')].map((el) => {
    const r = el.getBoundingClientRect();
    const top = r.top + scrollY;
    const key = el.dataset.cam;
    let y;
    if (key === 'hero') y = 0;
    else if (key.startsWith('p')) y = top + r.height / 2 - innerHeight / 2;
    else if (key === 'end') y = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    else y = top;
    return { y, f: frames[key], key };
  }).sort((a, b) => a.y - b.y);
}

const ease = (t) => t * t * (3 - 2 * t);
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
let busNow = 0, busTgt = 0, fogTgt = 0.02, activeKey = 'hero';

function sample() {
  const y = scrollY;
  let i = 0;
  while (i < anchors.length - 2 && y > anchors[i + 1].y) i++;
  const a = anchors[i], b = anchors[i + 1] || a;
  let t = b.y > a.y ? (y - a.y) / (b.y - a.y) : 0;
  t = Math.min(1, Math.max(0, t));
  // hold at each project module before travelling to the next
  const hold = a.key.startsWith('p') && b.key.startsWith('p') ? 0.22 : 0.05;
  const k = ease(Math.min(1, Math.max(0, (t - hold) / (1 - 2 * hold))));
  tgtPos.lerpVectors(a.f.pos, b.f.pos, k);
  tgtLook.lerpVectors(a.f.look, b.f.look, k);
  // let the signal lead the camera slightly
  busTgt = a.f.bus + (b.f.bus - a.f.bus) * Math.min(1, k * 1.15);
  fogTgt = a.f.fog + (b.f.fog - a.f.fog) * k;
  activeKey = k < 0.5 ? a.key : b.key;
}

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.45, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h;
  camera.fov = w / h < 0.9 ? 55 : 42;
  camera.updateProjectionMatrix();
  measure();
}
addEventListener('resize', resize);
new ResizeObserver(() => measure()).observe(document.body);
resize();
sample();
camPos.copy(tgtPos); camLook.copy(tgtLook); busNow = busTgt;

// pointer parallax
const mouse = new THREE.Vector2();
addEventListener('pointermove', (e) => { mouse.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5); }, { passive: true });

// ---------- loop ----------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  sample();
  const s = reduce ? 1 : 1 - Math.pow(0.0025, dt);
  camPos.lerp(tgtPos, s); camLook.lerp(tgtLook, s);
  busNow += (busTgt - busNow) * (reduce ? 1 : 1 - Math.pow(0.02, dt));
  scene.fog.density += (fogTgt - scene.fog.density) * s;

  camera.position.copy(camPos);
  if (!reduce) camera.position.add(tmp.set(mouse.x * 0.8, -mouse.y * 0.4, 0));
  camera.lookAt(camLook);

  // signal along the bus
  const bt = Math.max(0.0005, Math.min(0.9995, busNow));
  litGeo.setDrawRange(0, Math.floor(bt * TUBE_SEG) * RAD * 6);
  busCurve.getPointAt(bt, pulse.position);
  pulse.position.y = 0.12;
  pulse.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
  pulseLight.position.copy(pulse.position).setY(1.2);

  // modules: animate; light up the one in view
  for (const st of stations) {
    const on = activeKey === 'p' + st.k;
    st.ringMat.color.lerp(on ? glow(COPPER, 2.4) : glow(COPPER, 0.35), 0.08);
    if (!reduce) st.update(t);
  }
  for (const e of expChips) {
    const on = busNow >= fracAt(expStartIdx) + (fracAt(expEndIdx) - fracAt(expStartIdx)) * e.at - 0.0005;
    e.stub.material.color.lerp(on ? glow(COPPER, 2.2) : new THREE.Color(0x6b4718), 0.1);
  }
  coreHalo.material.opacity = 0.5 + Math.sin(t * 2) * 0.25 + (busNow > 0.995 ? 0.25 : 0);
  if (!reduce) for (const p of packets) { const u = (t * p.speed + p.off) % 1; p.c.getPointAt(u, p.mesh.position); }

  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
