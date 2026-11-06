(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const builds = $$('.build');
  const listLinks = $$('.build-list a');
  const steps = $$('.step');
  const idxLabel = $('#buildIdx');
  const hudLabel = $('#hudLabel');
  const hudFill = $('#hudFill');
  const buildsSec = $('#projects');

  const names = ['ACOUSTICTB', 'ROBOT ARM', 'OMNIGLASSES', 'GAITWAY', 'FTC 15167', 'SKADVISING'];
  let active = -1;

  function setBuild(i) {
    if (i === active) return;
    active = i;
    builds.forEach(b => b.classList.toggle('active', +b.dataset.i === i));
    listLinks.forEach(a => a.classList.toggle('active', +a.dataset.i === i));
    idxLabel.textContent = 'MODULE 0' + (i + 1);
  }
  setBuild(0);

  // Smooth-scroll list links to the step (centre of its scroll window)
  listLinks.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const step = steps[+a.dataset.i];
    window.scrollTo({ top: step.offsetTop + buildsSec.offsetTop + 2, behavior: 'smooth' });
  }));

  // Section labels for the HUD
  const marks = [
    ['top', 'U0 · POWER ON'], ['projects', 'BUS · SIX BUILDS'],
    ['experience', 'BUS · EXPERIENCE'], ['about', 'CORE · UT AUSTIN'], ['contact', 'OUT · SAY HELLO']
  ].map(([id, label]) => ({ el: document.getElementById(id), label }));

  function onScroll() {
    const y = scrollY, vh = innerHeight;
    // active build: which step contains the viewport centre
    const top = buildsSec.offsetTop;
    const rel = y + vh * 0.5 - top;
    const inBuilds = rel > 0 && rel < buildsSec.offsetHeight;
    document.body.classList.toggle('builds-active', inBuilds && innerWidth > 820);
    if (inBuilds) {
      // on mobile the panel overlaps the steps, so steps start at section top too
      const i = Math.max(0, Math.min(5, Math.floor(rel / (buildsSec.offsetHeight / 6))));
      setBuild(i);
    }
    // HUD
    let label = marks[0].label;
    for (const m of marks) if (m.el && m.el.getBoundingClientRect().top < vh * 0.5) label = m.label;
    if (inBuilds) label = 'U' + (active + 1) + ' · ' + names[active];
    hudLabel.textContent = label;
    const about = document.getElementById('about');
    document.body.classList.toggle('hud-off', about.getBoundingClientRect().top < vh * 0.6);
    const max = document.documentElement.scrollHeight - vh;
    hudFill.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  // Experience: light the nodes one after another, left to right
  const jobs = $$('.job');
  const path = $('#tracePath');
  if (path) {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(.4,.1,.2,1)';
  }
  const expObs = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    expObs.disconnect();
    if (path) path.style.strokeDashoffset = 0;
    jobs.forEach((j, i) => setTimeout(() => j.classList.add('lit'), 150 + i * 340));
  }, { threshold: 0.25 });
  expObs.observe($('#experience'));
})();
