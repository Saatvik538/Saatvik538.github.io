(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(2, devicePixelRatio || 1);
  const RAD = Math.PI / 180;

  /* ====================================================================
     TRAVEL DATA — edit these lists to update the globe.
     [longitude, latitude]
     ==================================================================== */
  const HOME = { name: 'Austin, Texas', note: 'Home base · UT Austin', at: [-97.74, 30.27] };
  const BEEN = [
    { name: 'Alaska', note: 'United States', at: [-149.9, 61.2] },
    { name: 'Las Vegas, Nevada', note: 'United States', at: [-115.14, 36.17] },
    { name: 'Hawaii', note: 'United States', at: [-157.86, 21.31] },
    { name: 'Michigan', note: 'United States', at: [-83.05, 42.33] },
    { name: 'New York', note: 'East Coast', at: [-74.0, 40.71] },
    { name: 'New Jersey', note: 'East Coast', at: [-74.45, 40.06] },
    { name: 'Virginia', note: 'East Coast · where I grew up', at: [-77.05, 38.8] },
    { name: 'Boston', note: 'East Coast · New England', at: [-71.06, 42.36] },
    { name: 'The Carolinas', note: 'East Coast', at: [-79.93, 32.78] },
    { name: 'Florida', note: 'East Coast', at: [-80.19, 25.76] },
    { name: 'Toronto, Ontario', note: 'Canada', at: [-79.38, 43.65] },
    { name: 'Puerto Rico', note: 'U.S. territory', at: [-66.1, 18.47] },
    { name: 'St. Thomas', note: 'U.S. Virgin Islands', at: [-64.93, 18.34] },
    { name: 'St. John', note: 'U.S. Virgin Islands', at: [-64.74, 18.33] },
    { name: 'St. Croix', note: 'U.S. Virgin Islands', at: [-64.75, 17.73] },
    { name: 'Tortola', note: 'British Virgin Islands', at: [-64.62, 18.43] },
    { name: 'The Bahamas', note: 'Caribbean', at: [-77.35, 25.05] },
    { name: 'Cancún', note: 'Mexico', at: [-86.85, 21.16] },
    { name: 'Honduras', note: 'Central America', at: [-86.53, 16.32] },
    { name: 'Costa Rica', note: 'Central America', at: [-84.09, 9.93] },
    { name: 'Lisbon', note: 'Portugal', at: [-9.14, 38.72] },
    { name: 'Madrid', note: 'Spain', at: [-3.7, 40.42] },
    { name: 'Barcelona', note: 'Spain', at: [2.17, 41.39] },
    { name: 'Paris', note: 'France', at: [2.35, 48.86] },
    { name: 'Amsterdam', note: 'Netherlands', at: [4.9, 52.37] },
    { name: 'Rome', note: 'Italy', at: [12.5, 41.9] },
    { name: 'Athens', note: 'Greece', at: [23.73, 37.98] },
    { name: 'Dubai', note: 'United Arab Emirates', at: [55.27, 25.2] },
    { name: 'India', note: 'New Delhi', at: [77.21, 28.61] },
  ];
  // Wishlist: placeholders, swap in your own.
  const NEXT = [
    { name: 'Tokyo', note: 'Japan', at: [139.69, 35.69] },
    { name: 'Iceland', note: 'Reykjavík', at: [-21.94, 64.15] },
    { name: 'Swiss Alps', note: 'Switzerland', at: [7.75, 46.02] },
    { name: 'Machu Picchu', note: 'Peru', at: [-72.55, -13.16] },
    { name: 'Cape Town', note: 'South Africa', at: [18.42, -33.92] },
    { name: 'New Zealand', note: 'Queenstown', at: [168.66, -45.03] },
  ];
  const COUNTRIES = ['United States of America', 'Canada', 'Mexico', 'Costa Rica', 'Honduras', 'Bahamas', 'Portugal', 'Spain', 'Italy', 'Greece', 'France', 'Netherlands', 'India', 'United Arab Emirates'];
  const TERRITORIES = ['Puerto Rico', 'U.S. Virgin Islands', 'British Virgin Islands'];
  const STATES = ['Maine', 'New Hampshire', 'Massachusetts', 'Rhode Island', 'Connecticut', 'New York', 'New Jersey', 'Pennsylvania', 'Delaware', 'Maryland', 'Virginia', 'North Carolina', 'South Carolina', 'Georgia', 'Florida', 'Alaska', 'Texas', 'Nevada', 'Hawaii', 'Michigan'];
  const FILL_STATES = [...STATES, 'District of Columbia'];
  const FILL_COUNTRIES = COUNTRIES.filter((c) => c !== 'United States of America' && c !== 'Canada').concat(['Puerto Rico']);

  $('#statCountries').textContent = COUNTRIES.length;
  $('#statStates').textContent = STATES.length;
  const statT = $$('.stats div')[2]; statT.querySelector('b').textContent = TERRITORIES.length; statT.querySelector('span').textContent = 'territories';

  /* ====================================================================
     NAV
     ==================================================================== */
  const nav = $('.nav');
  const onNav = () => nav.classList.toggle('solid', scrollY > 40);
  addEventListener('scroll', onNav, { passive: true }); onNav();

  /* ====================================================================
     STARFIELD (fixed sky)
     ==================================================================== */
  const sky = $('#sky'), sg = sky.getContext('2d');
  let SW = 0, SH = 0, stars = [], shooting = null;
  function sizeSky() {
    SW = innerWidth; SH = innerHeight;
    sky.width = SW * DPR; sky.height = SH * DPR; sg.setTransform(DPR, 0, 0, DPR, 0, 0);
    const n = Math.round((SW * SH) / 2600);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * SW, y: Math.random() * SH * 1.6, z: Math.random(),
      r: Math.random() < 0.06 ? 1.6 : Math.random() * 1.1 + 0.3, tw: Math.random() * 6.28, hue: Math.random() < 0.15 ? 'rgba(255,214,170,' : Math.random() < 0.3 ? 'rgba(170,215,255,' : 'rgba(255,255,255,',
    }));
  }
  sizeSky(); addEventListener('resize', sizeSky);
  function drawSky(t) {
    sg.clearRect(0, 0, SW, SH);
    // faint nebula band
    const g = sg.createLinearGradient(0, 0, SW, SH);
    g.addColorStop(0, 'rgba(40,60,140,0.10)'); g.addColorStop(0.5, 'rgba(90,50,140,0.06)'); g.addColorStop(1, 'rgba(10,20,40,0)');
    sg.fillStyle = g; sg.fillRect(0, 0, SW, SH);
    const sy = scrollY;
    for (const s of stars) {
      const y = ((s.y - sy * (0.05 + s.z * 0.18)) % (SH * 1.6) + SH * 1.6) % (SH * 1.6);
      if (y > SH) continue;
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.0012 * (0.5 + s.z) + s.tw));
      sg.fillStyle = s.hue + (reduce ? 0.8 : a).toFixed(2) + ')';
      sg.fillRect(s.x, y, s.r, s.r);
    }
    if (!reduce) {
      if (!shooting && Math.random() < 0.004) shooting = { x: Math.random() * SW * 0.8, y: Math.random() * SH * 0.4, life: 0 };
      if (shooting) {
        shooting.life += 0.02;
        const L = 120, x = shooting.x + shooting.life * 500, y = shooting.y + shooting.life * 200;
        const gr = sg.createLinearGradient(x - L, y - L * 0.4, x, y);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(200,235,255,${1 - shooting.life})`);
        sg.strokeStyle = gr; sg.lineWidth = 1.4; sg.beginPath(); sg.moveTo(x - L, y - L * 0.4); sg.lineTo(x, y); sg.stroke();
        if (shooting.life >= 1) shooting = null;
      }
    }
  }

  /* ====================================================================
     GEO: build dotted land from world-atlas
     ==================================================================== */
  let dotsFine = null, dotsCoarse = null, world = null, states = null, fillShapes = null;

  function buildDots(landFeature, visitedFeature, step) {
    const W = 1440, H = 720;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const proj = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
    const a = mk(), ag = a.getContext('2d', { willReadFrequently: true });
    ag.fillStyle = '#fff'; ag.beginPath(); d3.geoPath(proj, ag)(landFeature); ag.fill();
    const b = mk(), bg = b.getContext('2d', { willReadFrequently: true });
    bg.fillStyle = '#fff'; bg.beginPath(); d3.geoPath(proj, bg)(visitedFeature); bg.fill();
    const A = ag.getImageData(0, 0, W, H).data, B = bg.getImageData(0, 0, W, H).data;
    const out = [];
    for (let lat0 = -84; lat0 <= 84; lat0 += step) {
      const dl = step / Math.max(0.15, Math.cos(lat0 * RAD));
      for (let lon0 = -180 + Math.random() * dl; lon0 < 180; lon0 += dl) {
        // a little jitter breaks up the moire of perfectly regular rows
        const lon = lon0 + (Math.random() - 0.5) * dl * 0.5, lat = lat0 + (Math.random() - 0.5) * step * 0.5;
        const [px, py] = proj([lon, lat]);
        const i = ((py | 0) * W + (px | 0)) * 4;
        if (A[i] > 100) out.push({ lam: lon * RAD, sp: Math.sin(lat * RAD), cp: Math.cos(lat * RAD), v: B[i] > 100 ? 1 : 0, s: Math.random() });
      }
    }
    return out;
  }

  // orthographic projection helpers (center lon0/lat0 in degrees)
  function makeOrtho(lon0, lat0, R, cx, cy) {
    const l0 = lon0 * RAD, sp0 = Math.sin(lat0 * RAD), cp0 = Math.cos(lat0 * RAD);
    return {
      dot(d, out) { const dl = d.lam - l0, cdl = Math.cos(dl); const z = sp0 * d.sp + cp0 * d.cp * cdl; if (z <= 0) return 0; out[0] = cx + R * d.cp * Math.sin(dl); out[1] = cy - R * (cp0 * d.sp - sp0 * d.cp * cdl); return z; },
      pt(lon, lat, lift = 1) {
        const dl = lon * RAD - l0, sp = Math.sin(lat * RAD), cp = Math.cos(lat * RAD), cdl = Math.cos(dl);
        const z = sp0 * sp + cp0 * cp * cdl;
        return [cx + R * lift * cp * Math.sin(dl), cy - R * lift * (cp0 * sp - sp0 * cp * cdl), z];
      },
    };
  }

  /* ====================================================================
     HERO EARTH (horizon)
     ==================================================================== */
  const earth = $('#earth'), eg = earth.getContext('2d');
  let EW = 0, EH = 0, heroVisible = true;
  function sizeEarth() { const r = earth.getBoundingClientRect(); EW = r.width; EH = r.height; earth.width = EW * DPR; earth.height = EH * DPR; eg.setTransform(DPR, 0, 0, DPR, 0, 0); }
  sizeEarth(); addEventListener('resize', sizeEarth);
  new IntersectionObserver(([e]) => (heroVisible = e.isIntersecting)).observe($('.hero'));

  const tmp = [0, 0];
  const buckets = Array.from({ length: 6 }, () => []);
  function drawEarth(t) {
    eg.clearRect(0, 0, EW, EH);
    const R = Math.max(EW * 0.78, EH * 2.4), cx = EW / 2, cy = EH * 0.3 + R;
    // atmosphere
    const atm = eg.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.09);
    atm.addColorStop(0, 'rgba(90,190,255,0.55)'); atm.addColorStop(0.25, 'rgba(60,150,255,0.22)'); atm.addColorStop(1, 'rgba(40,100,255,0)');
    eg.fillStyle = atm; eg.beginPath(); eg.arc(cx, cy, R * 1.09, 0, 7); eg.fill();
    // sunrise glint on the limb
    const sun = eg.createRadialGradient(cx + R * 0.38, cy - R * 0.93, 0, cx + R * 0.38, cy - R * 0.93, R * 0.42);
    sun.addColorStop(0, 'rgba(255,190,120,0.55)'); sun.addColorStop(0.3, 'rgba(255,140,90,0.15)'); sun.addColorStop(1, 'rgba(255,120,80,0)');
    // ocean body
    const oc = eg.createLinearGradient(0, cy - R, 0, cy - R + EH);
    oc.addColorStop(0, '#0b2350'); oc.addColorStop(0.4, '#06142e'); oc.addColorStop(1, '#030914');
    eg.fillStyle = oc; eg.beginPath(); eg.arc(cx, cy, R, 0, 7); eg.fill();
    eg.save(); eg.beginPath(); eg.arc(cx, cy, R, 0, 7); eg.clip();
    eg.fillStyle = sun; eg.fillRect(0, 0, EW, EH);
    if (dotsFine) {
      const lon0 = HOME.at[0] + 40 - (reduce ? 0 : t * 0.0012), lat0 = 52;
      const P = makeOrtho(lon0, lat0, R, cx, cy);
      buckets.forEach((b) => (b.length = 0));
      for (const d of dotsFine) {
        const z = P.dot(d, tmp); if (!z) continue;
        if (tmp[1] < -4 || tmp[1] > EH + 4 || tmp[0] < -4 || tmp[0] > EW + 4) continue;
        const k = d.v ? 5 : Math.min(4, (z * 5) | 0);
        buckets[k].push(tmp[0], tmp[1], d.s);
      }
      const cols = ['rgba(120,170,255,0.10)', 'rgba(120,180,255,0.20)', 'rgba(130,195,255,0.32)', 'rgba(140,210,255,0.45)', 'rgba(160,225,255,0.6)', 'rgba(255,190,110,0.85)'];
      const size = Math.max(1.4, R / 650);
      buckets.forEach((b, k) => {
        eg.fillStyle = cols[k];
        for (let i = 0; i < b.length; i += 3) eg.fillRect(b[i], b[i + 1], size, size);
      });
      // city-light twinkles on visited land
      if (!reduce) {
        eg.fillStyle = 'rgba(255,230,180,0.9)';
        const b = buckets[5];
        for (let i = 0; i < b.length; i += 3) if (Math.sin(t * 0.003 + b[i + 2] * 60) > 0.96) eg.fillRect(b[i] - 0.5, b[i + 1] - 0.5, size + 1, size + 1);
      }
      // home pin
      const [hx, hy, hz] = P.pt(HOME.at[0], HOME.at[1]);
      if (hz > 0 && hy < EH) { const pr = 4 + ((t * 0.002) % 1) * 14; eg.strokeStyle = `rgba(255,179,92,${1 - ((t * 0.002) % 1)})`; eg.lineWidth = 1.5; eg.beginPath(); eg.arc(hx, hy, pr, 0, 7); eg.stroke(); eg.fillStyle = '#ffb35c'; eg.beginPath(); eg.arc(hx, hy, 3.5, 0, 7); eg.fill(); }
    }
    eg.restore();
    // crisp limb line
    eg.strokeStyle = 'rgba(160,220,255,0.55)'; eg.lineWidth = 1.2; eg.beginPath(); eg.arc(cx, cy, R, Math.PI * 1.05, Math.PI * 1.95); eg.stroke();
  }

  /* ====================================================================
     INTERACTIVE GLOBE
     ==================================================================== */
  const globe = $('#globe'), gg = globe.getContext('2d'), tip = $('#globeTip');
  let GW = 0, globeVisible = false;
  const view = { lon: HOME.at[0], lat: 25, vlon: 0, vlat: 0, drag: false, idle: 0, target: null };
  function sizeGlobe() { const r = globe.getBoundingClientRect(); GW = r.width; globe.width = GW * DPR; globe.height = GW * DPR; gg.setTransform(DPR, 0, 0, DPR, 0, 0); }
  sizeGlobe(); addEventListener('resize', sizeGlobe);
  new IntersectionObserver(([e]) => (globeVisible = e.isIntersecting), { rootMargin: '100px' }).observe(globe);

  // drag to spin
  let last = null;
  globe.addEventListener('pointerdown', (e) => { view.drag = true; view.target = null; last = [e.clientX, e.clientY, performance.now()]; globe.setPointerCapture(e.pointerId); globe.classList.add('drag'); });
  globe.addEventListener('pointermove', (e) => {
    if (view.drag && last) {
      const k = 180 / (GW * 0.42 * Math.PI) * 1.0;
      const dx = e.clientX - last[0], dy = e.clientY - last[1];
      view.lon -= dx * k; view.lat = Math.max(-70, Math.min(70, view.lat + dy * k));
      view.vlon = -dx * k; view.vlat = dy * k;
      last = [e.clientX, e.clientY];
      view.idle = 0;
    }
    hover(e);
  });
  const endDrag = () => { view.drag = false; globe.classList.remove('drag'); };
  globe.addEventListener('pointerup', endDrag); globe.addEventListener('pointercancel', endDrag);
  globe.addEventListener('pointerleave', () => { tip.hidden = true; hoverPin = null; });

  const ALL = [{ ...HOME, kind: 'home' }, ...BEEN.map((p) => ({ ...p, kind: 'been' })), ...NEXT.map((p) => ({ ...p, kind: 'next' }))];
  let screenPins = [], hoverPin = null;
  function hover(e) {
    const r = globe.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 16;
    for (const p of screenPins) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    hoverPin = best ? best.p : null;
    if (best) { tip.hidden = false; tip.style.left = best.x + 'px'; tip.style.top = best.y + 'px'; tip.innerHTML = `<b>${best.p.name}</b><span>${best.p.kind === 'next' ? 'Next on the list · ' : best.p.kind === 'home' ? '' : 'Been there · '}${best.p.note}</span>`; }
    else tip.hidden = true;
  }
  globe.addEventListener('click', () => { if (hoverPin) flyTo(hoverPin); });

  function flyTo(p) { view.target = [p.at[0], Math.max(-60, Math.min(60, p.at[1]))]; view.idle = 0; highlight(p); }

  function drawGlobe(t) {
    const W = GW, R = W * 0.4, cx = W / 2, cy = W / 2;
    gg.clearRect(0, 0, W, W);
    // outer glow + rim
    const halo = gg.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.28);
    halo.addColorStop(0, 'rgba(63,183,255,0.35)'); halo.addColorStop(0.3, 'rgba(63,140,255,0.12)'); halo.addColorStop(1, 'rgba(63,120,255,0)');
    gg.fillStyle = halo; gg.beginPath(); gg.arc(cx, cy, R * 1.28, 0, 7); gg.fill();
    const body = gg.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    body.addColorStop(0, '#12305e'); body.addColorStop(0.6, '#081a38'); body.addColorStop(1, '#040b1c');
    gg.fillStyle = body; gg.beginPath(); gg.arc(cx, cy, R, 0, 7); gg.fill();

    const P = makeOrtho(view.lon, view.lat, R, cx, cy);
    // graticule
    gg.strokeStyle = 'rgba(137,200,255,0.07)'; gg.lineWidth = 1;
    for (let lon = -180; lon < 180; lon += 30) { gg.beginPath(); let pen = false; for (let lat = -90; lat <= 90; lat += 3) { const [x, y, z] = P.pt(lon, lat); if (z > 0) { pen ? gg.lineTo(x, y) : gg.moveTo(x, y); pen = true; } else pen = false; } gg.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) { gg.beginPath(); let pen = false; for (let lon = -180; lon <= 180; lon += 3) { const [x, y, z] = P.pt(lon, lat); if (z > 0) { pen ? gg.lineTo(x, y) : gg.moveTo(x, y); pen = true; } else pen = false; } gg.stroke(); }

    if (dotsCoarse) {
      // visited regions, filled softly
      const proj = d3.geoOrthographic().scale(R).translate([cx, cy]).rotate([-view.lon, -view.lat]).clipAngle(90);
      const path = d3.geoPath(proj, gg);
      gg.beginPath(); path(fillShapes); gg.fillStyle = 'rgba(137,230,255,0.13)'; gg.fill();
      gg.strokeStyle = 'rgba(137,230,255,0.35)'; gg.lineWidth = 0.6; gg.stroke();
      // land dots
      buckets.forEach((b) => (b.length = 0));
      for (const d of dotsCoarse) {
        const z = P.dot(d, tmp); if (!z) continue;
        buckets[d.v ? 5 : Math.min(4, (z * 5) | 0)].push(tmp[0], tmp[1]);
      }
      const cols = ['rgba(120,160,230,0.12)', 'rgba(120,170,240,0.22)', 'rgba(130,185,250,0.34)', 'rgba(140,200,255,0.46)', 'rgba(150,210,255,0.56)', 'rgba(137,230,255,0.95)'];
      const s = Math.max(1.5, R / 160);
      buckets.forEach((b, k) => { gg.fillStyle = cols[k]; for (let i = 0; i < b.length; i += 2) gg.fillRect(b[i] - s / 2, b[i + 1] - s / 2, s, s); });
    }

    // flight arcs from Austin
    const tt = reduce ? 0 : t * 0.00025;
    for (let i = 0; i < ALL.length; i++) {
      const p = ALL[i]; if (p.kind === 'home') continue;
      const interp = d3.geoInterpolate(HOME.at, p.at), dist = d3.geoDistance(HOME.at, p.at);
      const lift = 0.06 + dist * 0.09, N = 48;
      gg.beginPath(); let pen = false;
      for (let k = 0; k <= N; k++) {
        const u = k / N, [lon, lat] = interp(u), [x, y, z] = P.pt(lon, lat, 1 + Math.sin(u * Math.PI) * lift);
        if (z > -0.05) { pen ? gg.lineTo(x, y) : gg.moveTo(x, y); pen = true; } else pen = false;
      }
      const on = hoverPin === p || activeStamp === p;
      gg.strokeStyle = p.kind === 'next' ? `rgba(255,122,144,${on ? 0.9 : 0.35})` : `rgba(137,230,255,${on ? 1 : 0.32})`;
      gg.lineWidth = on ? 1.8 : 1; gg.setLineDash(p.kind === 'next' ? [3, 4] : []); gg.stroke(); gg.setLineDash([]);
      // moving "plane" dot along each arc
      if (p.kind === 'been') {
        const u = (tt + i * 0.137) % 1, [lon, lat] = interp(u), [x, y, z] = P.pt(lon, lat, 1 + Math.sin(u * Math.PI) * lift);
        if (z > 0) { gg.fillStyle = 'rgba(220,250,255,0.95)'; gg.fillRect(x - 1.5, y - 1.5, 3, 3); }
      }
    }

    // pins
    screenPins = [];
    for (const p of ALL) {
      const [x, y, z] = P.pt(p.at[0], p.at[1]);
      if (z <= 0.02) continue;
      screenPins.push({ x, y, p });
      const on = hoverPin === p || activeStamp === p;
      if (p.kind === 'home') {
        const ph = reduce ? 0.5 : (t * 0.0012) % 1;
        gg.strokeStyle = `rgba(255,179,92,${1 - ph})`; gg.lineWidth = 2; gg.beginPath(); gg.arc(x, y, 5 + ph * 20, 0, 7); gg.stroke();
        gg.fillStyle = '#ffb35c'; gg.shadowColor = '#ffb35c'; gg.shadowBlur = 14; gg.beginPath(); gg.arc(x, y, 5.5, 0, 7); gg.fill(); gg.shadowBlur = 0;
        gg.font = '600 12px Manrope, sans-serif'; gg.fillStyle = '#ffd7a8'; gg.fillText('AUSTIN · NOW', x + 10, y + 4);
      } else if (p.kind === 'been') {
        gg.fillStyle = on ? '#ffffff' : '#89e6ff'; gg.shadowColor = '#89e6ff'; gg.shadowBlur = on ? 16 : 8;
        gg.beginPath(); gg.arc(x, y, on ? 4.5 : 3, 0, 7); gg.fill(); gg.shadowBlur = 0;
      } else {
        gg.strokeStyle = '#ff7a90'; gg.lineWidth = 1.6; gg.setLineDash([2, 2]); gg.beginPath(); gg.arc(x, y, on ? 6 : 4.5, 0, 7); gg.stroke(); gg.setLineDash([]);
      }
      if (on && p.kind !== 'home') { gg.font = '600 12px Manrope, sans-serif'; gg.fillStyle = '#fff'; gg.fillText(p.name, x + 9, y - 8); }
    }
    // rim light
    gg.strokeStyle = 'rgba(160,225,255,0.35)'; gg.lineWidth = 1.2; gg.beginPath(); gg.arc(cx, cy, R, 0, 7); gg.stroke();
  }

  function stepGlobe(dt) {
    if (view.target) {
      let dl = ((view.target[0] - view.lon + 540) % 360) - 180;
      view.lon += dl * Math.min(1, dt * 4); view.lat += (view.target[1] - view.lat) * Math.min(1, dt * 4);
      if (Math.abs(dl) < 0.2 && Math.abs(view.target[1] - view.lat) < 0.2) view.target = null;
    } else if (!view.drag) {
      view.lon += view.vlon; view.lat = Math.max(-70, Math.min(70, view.lat + view.vlat));
      view.vlon *= 0.93; view.vlat *= 0.93;
      view.idle += dt;
      if (view.idle > 2.5 && !reduce) view.lon += dt * 6;
    }
  }

  /* stamps list */
  const stampsEl = $('#stamps');
  let activeStamp = null;
  const stampBtns = new Map();
  function group(label, list, cls) {
    const h = document.createElement('p'); h.className = 'stamps-label'; h.textContent = label; stampsEl.appendChild(h);
    for (const p of list) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'stamp ' + cls; b.textContent = p.name;
      const ref = ALL.find((a) => a.name === p.name);
      b.addEventListener('click', () => flyTo(ref)); b.addEventListener('mouseenter', () => highlight(ref));
      stampsEl.appendChild(b); stampBtns.set(ref, b);
    }
  }
  function highlight(p) { activeStamp = p; stampBtns.forEach((b, k) => b.classList.toggle('on', k === p)); }
  group('Home base', [HOME], 'home');
  group(`Been there · ${BEEN.length} stops`, BEEN, 'been');
  group('Next on the list', NEXT, 'next');

  /* open globe from hero */
  function openGlobe() { $('#map').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); setTimeout(() => flyTo(ALL[0]), 500); }
  $('#earthHit').addEventListener('click', openGlobe);
  $('#openGlobe').addEventListener('click', openGlobe);

  /* load geo */
  Promise.all([fetch('assets/data/countries-110m.json').then((r) => r.json()), fetch('assets/data/states-10m.json').then((r) => r.json())]).then(([w, s]) => {
    world = w; states = s;
    const countries = topojson.feature(w, w.objects.countries).features;
    const st = topojson.feature(s, s.objects.states).features;
    const land = { type: 'FeatureCollection', features: countries };
    fillShapes = { type: 'FeatureCollection', features: [...countries.filter((f) => FILL_COUNTRIES.includes(f.properties.name)), ...st.filter((f) => FILL_STATES.includes(f.properties.name))] };
    dotsFine = buildDots(land, fillShapes, 0.55);
    dotsCoarse = buildDots(land, fillShapes, 1.5);
  }).catch((e) => console.warn('geo data failed', e));

  /* ====================================================================
     DEPARTURES BOARD
     ==================================================================== */
  const stops = $$('.stop');
  const boardRows = $('#boardRows');
  const flap = (txt) => `<span class="flap">${[...txt.toUpperCase()].map((c) => `<i data-c="${c === ' ' ? '&nbsp;' : c}">${c === ' ' ? '&nbsp;' : c}</i>`).join('')}</span>`;
  stops.forEach((s) => {
    const live = /flight/i.test(s.dataset.status);
    const b = document.createElement('button'); b.className = 'board-row'; b.type = 'button'; b.setAttribute('role', 'row');
    b.innerHTML = `<span class="yr" role="cell">${flap(s.dataset.year.slice(0, 7))}</span><span role="cell">${flap(s.dataset.name.slice(0, innerWidth <= 760 ? 13 : 22))}</span><span class="gate" role="cell">${flap(s.dataset.code)}</span><span class="st${live ? ' live' : ''}" role="cell">${flap(s.dataset.status)}</span>`;
    b.addEventListener('click', () => { const r = s.getBoundingClientRect(); scrollTo({ top: r.top + scrollY - innerHeight / 2 + r.height / 2, behavior: reduce ? 'auto' : 'smooth' }); });
    boardRows.appendChild(b);
  });
  if (!reduce) {
    const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bo = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; bo.disconnect();
      $$('.flap i', boardRows).forEach((el, i) => {
        const fin = el.dataset.c; if (fin === '&nbsp;') return;
        let n = 6 + (i % 9);
        const tick = () => { if (n-- <= 0) { el.innerHTML = fin; return; } el.textContent = CH[(Math.random() * CH.length) | 0]; setTimeout(tick, 45); };
        setTimeout(tick, (i % 30) * 12);
      });
    }, { threshold: 0.3 });
    bo.observe($('.board'));
  }

  /* ====================================================================
     FLIGHT ROUTE (plane follows the path while scrolling)
     ==================================================================== */
  const route = $('#route'), rsvg = $('#routeSvg'), base = $('#routeBase'), flown = $('#routeFlown'), plane = $('#routePlane');
  let samples = [], total = 0, planeL = 0;
  function buildRoute() {
    const rr = route.getBoundingClientRect(), top = rr.top + scrollY, W = rr.width, mobile = innerWidth <= 760;
    rsvg.setAttribute('viewBox', `0 0 ${W} ${route.offsetHeight}`);
    const pts = [[mobile ? 26 : W / 2, 0]];
    const items = $$('.leg, .stop, .arrival', route);
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect(), y = r.top + scrollY - top + r.height / 2;
      if (mobile) { pts.push([26 + (i % 2 ? 6 : -6), el.classList.contains('arrival') ? r.top + scrollY - top + 10 : y]); return; }
      if (el.classList.contains('stop')) {
        const leftCard = r.left - rr.left < W * 0.2;
        pts.push([leftCard ? W * 0.78 : W * 0.22, y]);
      } else if (el.classList.contains('arrival')) pts.push([W / 2, r.top + scrollY - top - 34]);
      else pts.push([W / 2, y]);
    });
    // catmull-rom → cubic bezier
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    base.setAttribute('d', d); flown.setAttribute('d', d);
    total = flown.getTotalLength();
    flown.style.strokeDasharray = `${total} ${total}`;
    samples = [];
    for (let l = 0; l <= total; l += 6) { const p = flown.getPointAtLength(l); samples.push([l, p.y]); }
  }
  function lengthAtY(y) {
    let lo = 0, hi = samples.length - 1;
    if (!samples.length) return 0;
    while (lo < hi) { const m = (lo + hi) >> 1; if (samples[m][1] < y) lo = m + 1; else hi = m; }
    return samples[lo][0];
  }
  function stepRoute() {
    if (!total) return;
    const rr = route.getBoundingClientRect();
    const targetY = innerHeight * 0.52 - rr.top;
    const L = targetY <= 0 ? 0 : lengthAtY(targetY);
    planeL += (L - planeL) * (reduce ? 1 : 0.14);
    const p = flown.getPointAtLength(planeL), q = flown.getPointAtLength(Math.min(total, planeL + 4));
    const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI + 90;
    plane.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${ang}deg)`;
    plane.style.opacity = planeL > 2 ? 1 : 0;
    flown.style.strokeDashoffset = total - planeL;
    for (const s of stops) {
      const top = s.offsetTop, h = s.offsetHeight;
      s.classList.toggle('arrived', p.y >= top + h * 0.3);
    }
  }
  const nearObs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('near')), { rootMargin: '0px 0px -12% 0px' });
  stops.forEach((s) => nearObs.observe(s));
  const rebuild = () => { buildRoute(); stepRoute(); };
  addEventListener('resize', rebuild);
  addEventListener('load', rebuild);
  if (document.fonts) document.fonts.ready.then(rebuild);
  new ResizeObserver(rebuild).observe(route);
  rebuild();

  /* hero HUD flicker */
  const alt = $('#hudAlt'), gs = $('#hudGs');

  /* ====================================================================
     MAIN LOOP
     ==================================================================== */
  let prev = performance.now(), frameN = 0;
  function loop(t) {
    const dt = Math.min(0.05, (t - prev) / 1000); prev = t; frameN++;
    drawSky(t);
    if (heroVisible) drawEarth(t);
    if (globeVisible) { stepGlobe(dt); drawGlobe(t); }
    stepRoute();
    if (heroVisible && frameN % 30 === 0 && !reduce) { alt.textContent = (35000 + Math.round(Math.sin(t / 3000) * 40)).toLocaleString() + ' ft'; gs.textContent = 512 + Math.round(Math.sin(t / 2100) * 3) + ' kt'; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
