const ids = { F0: 'Serpentine', F1: 'Parallel', F2: 'Pin', F3: 'Spiral', F4: 'Spider Web' };
const $ = (selector) => document.querySelector(selector);
let manifest, selected, family = 'F0', representation = 'cad', renderToken = 0;
const bags = new Map();
const passes = [5, 7, 9, 11, 13];
const slider = $('#condition');
const image = document.createElement('img');
image.className = 'research-sample';
$('#cadViewer').append(image);
const video = $('.hero-video');
if (video) { video.playbackRate = 1.5; video.defaultPlaybackRate = 1.5; }
function choose() {
  const pass = passes[Number(slider.value)];
  const key = `${family}:${family === 'F0' ? pass : 'all'}`;
  let bag = bags.get(key);
  if (!bag?.length) {
    bag = manifest.samples.filter(s => s.family === ids[family] && (family !== 'F0' || s.pass_count === pass));
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  }
  if (bag.length > 1 && bag[bag.length - 1].id === selected?.id) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
  selected = bag.pop(); bags.set(key, bag);
  if (!selected) throw new Error('No sample for the selected condition');
  show();
}
async function show() {
  const token = ++renderToken;
  const sample = selected;
  const source = `assets/research/${sample[representation]}`;
  const next = new Image(); next.src = source;
  try { await next.decode(); } catch { if (token === renderToken) $('#sampleStatus').textContent = 'Sample unavailable. Please try another design.'; return; }
  if (token !== renderToken) return;
  image.src = source; image.alt = `${sample.family} ${representation.toUpperCase()} — ${sample.id}, PASS`;
  image.dataset.sampleId = sample.id;
  $('#viewerLabel').textContent = sample.family;
  $('#sampleStatus').textContent = '';
  $('#sampleFacts').textContent = `Channel width: ${sample.channel_width_px} px · Volume fraction: ${(sample.volume_fraction * 100).toFixed(1)}%`;
  $('#conditionOut').textContent = `${passes[Number(slider.value)]} passes`;
  slider.setAttribute('aria-valuetext', $('#conditionOut').textContent);
  slider.style.setProperty('--slider-progress', `${Number(slider.value) * 25}%`);
  [sample.cad, sample.sdf].forEach(path => { const preload = new Image(); preload.src = `assets/research/${path}`; });
}
$('#families').addEventListener('click', e => {
  const button = e.target.closest('button[data-family]'); if (!button || !manifest) return;
  family = button.dataset.family;
  $('#passCondition').hidden = family !== 'F0';
  $('#families').querySelectorAll('button').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  choose();
});
$('#representations').addEventListener('click', e => {
  const button = e.target.closest('button[data-view]'); if (!button || !selected) return;
  representation = button.dataset.view;
  $('#representations').querySelectorAll('button').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  show();
});
slider.addEventListener('input', () => { if (manifest) choose(); });
$('#generateNext').addEventListener('click', () => {
  if (!manifest) return; choose();
  const button = $('#generateNext'); button.classList.remove('is-launching');
  requestAnimationFrame(() => button.classList.add('is-launching'));
  setTimeout(() => button.classList.remove('is-launching'), 750);
});
fetch('assets/research/data/samples_manifest.json').then(r => { if (!r.ok) throw new Error('Manifest unavailable'); return r.json(); }).then(data => { manifest = data; choose(); }).catch(() => { $('#sampleStatus').textContent = 'Sample data unavailable. Please refresh.'; });
