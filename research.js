const ids = { F0: 'Serpentine', F1: 'Parallel', F2: 'Pin', F3: 'Spiral', F4: 'Spider Web' };
const widthRanges = { Serpentine: [7,23], Parallel: [7,23], Pin: [7,15], Spiral: [5,13], 'Spider Web': [5,13] };
const $ = (selector) => document.querySelector(selector);
let manifest, selected, family = 'F0', renderToken = 0;
const bags = new Map();
const image = $('#cadSample');
const sdfCanvas = $('#sdfSample');
const presentationCache = new Map();
async function loadAsset(path) { const image = new Image(); image.src = `assets/research/${path}`; await image.decode(); return image; }
async function buildPresentation(sample) {
  if(presentationCache.has(sample.id)) return presentationCache.get(sample.id);
  const [cad,sdf] = await Promise.all([loadAsset(sample.cad),loadAsset(sample.sdf)]);
  const size=768;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(sdf,0,0,size,size);const field=ctx.getImageData(0,0,size,size);
  ctx.drawImage(cad,0,0,size,size);const shape=ctx.getImageData(0,0,size,size);
  for(let i=0;i<field.data.length;i+=4) {
    const value=field.data[i]/255;
    const coverage=1-shape.data[i]/255;
    const depth=Math.max(0,Math.min(1,(.5-value)*2));
    const halo=Math.exp(-Math.max(0,(value-.5)*2)*5.5);
    const inside=[191+Math.exp(-depth*5)*32,185+Math.exp(-depth*5)*32,174+Math.exp(-depth*5)*32];
    const outside=[70+halo*99,89+halo*91,107+halo*78];
    for(let c=0;c<3;c++) field.data[i+c]=Math.round(outside[c]*(1-coverage)+inside[c]*coverage);
    field.data[i+3]=255;
  }
  ctx.putImageData(field,0,0);
  const native=document.createElement('canvas');native.width=native.height=256;
  const nativeContext=native.getContext('2d',{willReadFrequently:true});nativeContext.drawImage(cad,0,0,256,256);
  const rgba=nativeContext.getImageData(0,0,256,256).data;const mask=new Uint8Array(256*256);
  for(let i=0;i<mask.length;i++)mask[i]=rgba[i*4]<128?1:0;
  const stats=tileGeometry(mask,256);
  const result={canvas,stats}; presentationCache.set(sample.id,result);
  if(presentationCache.size>12)presentationCache.delete(presentationCache.keys().next().value);
  return result;
}
const video = $('.hero-video');
if (video) { video.playbackRate = 1.5; video.defaultPlaybackRate = 1.5; }
function choose() {
  const key = family;
  let bag = bags.get(key);
  if (!bag?.length) {
    bag = manifest.samples.filter(s => s.family === ids[family]);
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
  let presentation;
  try { presentation = await buildPresentation(sample); } catch { if (token === renderToken) $('#sampleStatus').textContent = 'Sample unavailable. Please try another design.'; return; }
  if (token !== renderToken) return;
  image.src = `assets/research/${sample.cad}`; image.alt = `${sample.family} CAD — ${sample.id}, PASS`;
  image.dataset.sampleId = sample.id;
  sdfCanvas.width=sdfCanvas.height=768;sdfCanvas.getContext('2d').drawImage(presentation.canvas,0,0);
  sdfCanvas.dataset.sampleId=sample.id;sdfCanvas.setAttribute('aria-label',`${sample.family} SDF colour preview — ${sample.id}`);
  $('#viewerLabel').textContent = sample.family;
  const [widthMin,widthMax]=widthRanges[sample.family];
  $('#widthConditionLabel').textContent=sample.family==='Pin'?'INLET / OUTLET WIDTH':'CHANNEL WIDTH CONDITION';
  $('#widthConditionValue').textContent=`${sample.channel_width_px} px ≈ ${(sample.channel_width_px*1000/256).toFixed(1)} mm`;
  $('#widthConditionValue').dataset.sampleId=sample.id;
  $('#widthConditionRange').textContent=`Range: ${widthMin}–${widthMax} px (step 2)`;
  $('#sampleStatus').textContent = '';
  const mmPerPixel=1000/256;
  $('#thicknessMetric').textContent=(presentation.stats.thickness*mmPerPixel).toFixed(1);
  $('#lengthMetric').textContent=Math.round(presentation.stats.length*mmPerPixel).toLocaleString();
  $('#areaMetric').textContent=Number(sample.volume_fraction).toFixed(3);
  [sample.cad, sample.sdf].forEach(path => { const preload = new Image(); preload.src = `assets/research/${path}`; });
}
$('#families').addEventListener('click', e => {
  const button = e.target.closest('button[data-family]'); if (!button || !manifest) return;
  family = button.dataset.family;
  $('#families').querySelectorAll('button').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  choose();
});
$('#generateNext').addEventListener('click', () => {
  if (!manifest) return; choose();
  const button = $('#generateNext'); button.classList.remove('is-launching');
  requestAnimationFrame(() => button.classList.add('is-launching'));
  setTimeout(() => button.classList.remove('is-launching'), 750);
});
fetch('assets/research/data/samples_manifest.json?v=assumed-scale-1').then(r => { if (!r.ok) throw new Error('Manifest unavailable'); return r.json(); }).then(data => { manifest = data; choose(); }).catch(() => { $('#sampleStatus').textContent = 'Sample data unavailable. Please refresh.'; });
