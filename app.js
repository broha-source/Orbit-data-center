const canvas = document.querySelector('#flowCanvas');
const ctx = canvas.getContext('2d');
const fxCanvas = document.createElement('canvas');
const fx = fxCanvas.getContext('2d');
const fieldSourceCanvas = document.createElement('canvas');
const fieldSource = fieldSourceCanvas.getContext('2d', { willReadFrequently: true });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const familiesEl = document.querySelector('#families');
const representationsEl = document.querySelector('#representations');
const slider = document.querySelector('#condition');
const variableLabel = document.querySelector('#variableLabel');
const conditionOut = document.querySelector('#conditionOut');
const viewerLabel = document.querySelector('#viewerLabel');
const passMetric = document.querySelector('#passMetric');
const failMetric = document.querySelector('#failMetric');
const passCount = document.querySelector('#passCount');
const failCount = document.querySelector('#failCount');
const generateNext = document.querySelector('#generateNext');

let database;
let passDatabase;
let familyId = 'F0';
let view = 'mask';
let variantIndex = 0;
let randomSample = null;
let frame = 0;
let lastTime = performance.now();
const imageCache = new Map();
const flowFieldCache = new Map();
const FLOW_GRID = 128;

fieldSourceCanvas.width = FLOW_GRID;
fieldSourceCanvas.height = FLOW_GRID;

function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

function currentFamily() { return database.families[familyId]; }
function currentVariant() { return currentFamily().variants[variantIndex]; }

function atlasCrop(passFamily, sample) {
  const sheetIndex = Math.floor(sample / passFamily.samplesPerSheet);
  const localIndex = sample % passFamily.samplesPerSheet;
  return {
    sheetIndex,
    sx: (localIndex % passFamily.grid) * passFamily.tile,
    sy: Math.floor(localIndex / passFamily.grid) * passFamily.tile,
    size: passFamily.tile
  };
}

function resizeCanvas() {
  const box = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(box.width * dpr));
  const height = Math.max(1, Math.round(box.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    fxCanvas.width = width;
    fxCanvas.height = height;
  }
}

function imageRect() {
  const dpr = canvas.width / Math.max(canvas.getBoundingClientRect().width, 1);
  const top = 64 * dpr;
  const availableHeight = canvas.height - top - 24 * dpr;
  const size = Math.min(canvas.width - 36 * dpr, availableHeight);
  return { x: (canvas.width - size) / 2, y: top + (availableHeight - size) / 2, size };
}

function buildGeodesicField(alpha, crop, key) {
  if (flowFieldCache.has(key)) return flowFieldCache.get(key);
  fieldSource.clearRect(0, 0, FLOW_GRID, FLOW_GRID);
  if (crop) {
    fieldSource.drawImage(alpha, crop.sx, crop.sy, crop.size, crop.size, 0, 0, FLOW_GRID, FLOW_GRID);
  } else {
    fieldSource.drawImage(alpha, 0, 0, FLOW_GRID, FLOW_GRID);
  }
  const pixels = fieldSource.getImageData(0, 0, FLOW_GRID, FLOW_GRID).data;
  const occupied = new Uint8Array(FLOW_GRID * FLOW_GRID);
  const distance = new Int16Array(FLOW_GRID * FLOW_GRID);
  distance.fill(-1);

  for (let i = 0; i < occupied.length; i += 1) occupied[i] = pixels[i * 4 + 3] > 24 ? 1 : 0;

  let seed = -1;
  let seedScore = Infinity;
  for (let y = 0; y < FLOW_GRID; y += 1) {
    for (let x = 0; x < FLOW_GRID; x += 1) {
      const index = y * FLOW_GRID + x;
      if (!occupied[index]) continue;
      const score = x + (FLOW_GRID - 1 - y) * .42;
      if (score < seedScore) {
        seedScore = score;
        seed = index;
      }
    }
  }

  const queue = new Int32Array(FLOW_GRID * FLOW_GRID);
  let head = 0;
  let tail = 0;
  let maxDistance = 1;
  if (seed >= 0) {
    queue[tail++] = seed;
    distance[seed] = 0;
  }
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < tail) {
    const index = queue[head++];
    const x = index % FLOW_GRID;
    const y = Math.floor(index / FLOW_GRID);
    const nextDistance = distance[index] + 1;
    for (const [dx, dy] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= FLOW_GRID || ny < 0 || ny >= FLOW_GRID) continue;
      const next = ny * FLOW_GRID + nx;
      if (!occupied[next] || distance[next] >= 0) continue;
      distance[next] = nextDistance;
      maxDistance = Math.max(maxDistance, nextDistance);
      queue[tail++] = next;
    }
  }

  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = FLOW_GRID;
  renderCanvas.height = FLOW_GRID;
  const render = renderCanvas.getContext('2d');
  const field = { occupied, distance, maxDistance, canvas: renderCanvas, render };
  flowFieldCache.set(key, field);
  return field;
}

function drawGeodesicFlow(rect, time, field) {
  const image = field.render.createImageData(FLOW_GRID, FLOW_GRID);
  const slugLength = Math.max(28, field.maxDistance * .42);
  const pause = Math.max(12, field.maxDistance * .08);
  const cycleLength = field.maxDistance + slugLength + pause;
  const headDistance = (time * .018) % cycleLength;
  for (let i = 0; i < field.occupied.length; i += 1) {
    const distance = field.distance[i];
    if (!field.occupied[i] || distance < 0) continue;
    const behindHead = headDistance - distance;
    let intensity = 0;
    if (behindHead >= 0 && behindHead <= slugLength) {
      const tailFade = Math.min(1, (slugLength - behindHead) / (slugLength * .28));
      const headGlow = Math.exp(-Math.pow(behindHead / Math.max(8, slugLength * .16), 2));
      intensity = Math.min(1, .48 * tailFade + .52 * headGlow);
    }
    const offset = i * 4;
    image.data[offset] = 91;
    image.data[offset + 1] = 211;
    image.data[offset + 2] = 244;
    image.data[offset + 3] = Math.round(6 + intensity * 72);
  }
  field.render.putImageData(image, 0, 0);
  fx.save();
  fx.imageSmoothingEnabled = true;
  fx.imageSmoothingQuality = 'high';
  fx.globalCompositeOperation = 'lighter';
  fx.shadowColor = 'rgba(88, 210, 244, .18)';
  fx.shadowBlur = rect.size * .009;
  fx.drawImage(field.canvas, rect.x, rect.y, rect.size, rect.size);
  fx.restore();
}

function updateInterface() {
  const family = currentFamily();
  const variant = currentVariant();
  slider.max = family.variants.length - 1;
  slider.value = variantIndex;
  variableLabel.textContent = family.variable;
  conditionOut.textContent = variant.value;
  viewerLabel.textContent = randomSample === null
    ? `${familyId} / ${family.name}`
    : `${familyId} / ${family.name} · PASS #${String(randomSample).padStart(3, '0')}`;
  passMetric.innerHTML = `${family.metrics.passRate}<small> %</small>`;
  failMetric.innerHTML = `${family.metrics.failRate}<small> %</small>`;
  passCount.textContent = `${family.metrics.pass} / 256`;
  failCount.textContent = `${family.metrics.fail} / 256`;
  document.querySelectorAll('.port').forEach((port) => {
    port.hidden = familyId === 'F2' || familyId === 'F4';
  });
  [variant.sdf, variant.mask, variant.alpha].forEach(loadImage);
}

function drawBackdrop() {
  ctx.fillStyle = '#050607';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(canvas.width * .5, canvas.height * .48, 0, canvas.width * .5, canvas.height * .48, canvas.width * .58);
  glow.addColorStop(0, 'rgba(70, 96, 107, .16)');
  glow.addColorStop(.55, 'rgba(19, 27, 31, .09)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function pointOnPath(path, distance) {
  if (path.length < 2) return path[0] || [128, 128];
  const lengths = [];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    lengths.push(total);
  }
  const target = ((distance % 1) + 1) % 1 * total;
  let segment = lengths.findIndex((length) => length >= target);
  if (segment < 0) segment = lengths.length - 1;
  const before = segment === 0 ? 0 : lengths[segment - 1];
  const ratio = (target - before) / Math.max(lengths[segment] - before, 1);
  const a = path[segment];
  const b = path[segment + 1];
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
}

function drawDirectionalField(rect, time) {
  fx.save();
  fx.beginPath();
  fx.rect(rect.x, rect.y, rect.size, rect.size);
  fx.clip();
  fx.globalCompositeOperation = 'lighter';
  if (familyId === 'F3' || familyId === 'F4') {
    const cx = rect.x + rect.size / 2;
    const cy = rect.y + rect.size / 2;
    const sweep = fx.createConicGradient(time * .00022, cx, cy);
    sweep.addColorStop(0, 'rgba(97, 220, 255, 0)');
    sweep.addColorStop(.08, 'rgba(97, 220, 255, .22)');
    sweep.addColorStop(.18, 'rgba(155, 236, 255, .04)');
    sweep.addColorStop(.42, 'rgba(97, 220, 255, 0)');
    sweep.addColorStop(1, 'rgba(97, 220, 255, 0)');
    fx.fillStyle = sweep;
    fx.fillRect(rect.x, rect.y, rect.size, rect.size);
  } else {
    const offset = (time * .045) % (rect.size * .42);
    for (let x = rect.x - rect.size * .45 + offset; x < rect.x + rect.size * 1.2; x += rect.size * .42) {
      const band = fx.createLinearGradient(x, 0, x + rect.size * .25, 0);
      band.addColorStop(0, 'rgba(69, 191, 229, 0)');
      band.addColorStop(.5, 'rgba(113, 224, 255, .16)');
      band.addColorStop(1, 'rgba(69, 191, 229, 0)');
      fx.fillStyle = band;
      fx.fillRect(x, rect.y, rect.size * .25, rect.size);
    }
  }
  fx.restore();
}

function drawMaskFlowTexture(rect, time) {
  fx.save();
  fx.beginPath();
  fx.rect(rect.x, rect.y, rect.size, rect.size);
  fx.clip();
  fx.globalCompositeOperation = 'lighter';

  const travel = (time * .000028) % 1;
  for (let wave = 0; wave < 3; wave += 1) {
    const progress = (travel + wave / 3) % 1;
    const center = rect.x - rect.size * .2 + progress * rect.size * 1.4;
    const width = rect.size * .24;
    const wash = fx.createLinearGradient(center - width, 0, center + width, 0);
    wash.addColorStop(0, 'rgba(48, 166, 205, 0)');
    wash.addColorStop(.3, 'rgba(70, 194, 230, .025)');
    wash.addColorStop(.5, 'rgba(174, 242, 255, .14)');
    wash.addColorStop(.7, 'rgba(70, 194, 230, .025)');
    wash.addColorStop(1, 'rgba(48, 166, 205, 0)');
    fx.fillStyle = wash;
    fx.fillRect(rect.x, rect.y, rect.size, rect.size);
  }

  const streamCount = familyId === 'F1' ? 20 : familyId === 'F2' ? 17 : 15;
  for (let stream = 0; stream < streamCount; stream += 1) {
    const phase = ((time * (.000018 + (stream % 4) * .0000015)) + stream * .137) % 1;
    const head = rect.x - rect.size * .18 + phase * rect.size * 1.36;
    const length = rect.size * (.12 + (stream % 5) * .015);
    const y = rect.y + ((stream + .5) / streamCount) * rect.size;
    const amplitude = rect.size * (.0035 + (stream % 3) * .0012);
    const streamGradient = fx.createLinearGradient(head - length, 0, head, 0);
    streamGradient.addColorStop(0, 'rgba(60, 176, 214, 0)');
    streamGradient.addColorStop(.55, 'rgba(79, 202, 237, .07)');
    streamGradient.addColorStop(.9, 'rgba(170, 240, 255, .25)');
    streamGradient.addColorStop(1, 'rgba(220, 252, 255, .34)');
    fx.strokeStyle = streamGradient;
    fx.lineWidth = rect.size * (.0045 + (stream % 3) * .0008);
    fx.lineCap = 'round';
    fx.shadowColor = 'rgba(92, 215, 246, .22)';
    fx.shadowBlur = rect.size * .012;
    fx.beginPath();
    fx.moveTo(head - length, y);
    fx.bezierCurveTo(
      head - length * .66, y + Math.sin(stream * 1.7 + time * .00055) * amplitude,
      head - length * .34, y - Math.cos(stream * 1.3 + time * .00048) * amplitude,
      head, y
    );
    fx.stroke();
  }
  fx.shadowBlur = 0;
  fx.restore();
}

function drawPathParticles(rect, time, paths) {
  const scale = rect.size / 256;
  const maxPaths = familyId === 'F2' ? 46 : familyId === 'F4' ? 58 : 30;
  paths.slice(0, maxPaths).forEach((path, pathIndex) => {
    const particleCount = familyId === 'F0' || familyId === 'F3' ? 8 : 2;
    for (let p = 0; p < particleCount; p += 1) {
      const speed = .000018 + (pathIndex % 5) * .000002;
      const position = pointOnPath(path, time * speed + p / particleCount + pathIndex * .073);
      const x = rect.x + position[0] * scale;
      const y = rect.y + position[1] * scale;
      const radius = Math.max(1.2, rect.size * (.0026 + (pathIndex % 3) * .0005));
      const halo = fx.createRadialGradient(x, y, 0, x, y, radius * 4.2);
      halo.addColorStop(0, 'rgba(202, 249, 255, .72)');
      halo.addColorStop(.22, 'rgba(104, 218, 246, .34)');
      halo.addColorStop(1, 'rgba(53, 160, 200, 0)');
      fx.fillStyle = halo;
      fx.beginPath();
      fx.arc(x, y, radius * 4.2, 0, Math.PI * 2);
      fx.fill();
    }
  });
}

async function draw(time) {
  resizeCanvas();
  drawBackdrop();
  if (!database) return;
  const variant = currentVariant();
  const rect = imageRect();
  try {
    let geometry;
    let alpha;
    let crop = null;
    if (randomSample === null || !passDatabase) {
      [geometry, alpha] = await Promise.all([loadImage(view === 'sdf' ? variant.sdf : variant.mask), loadImage(variant.alpha)]);
    } else {
      const passFamily = passDatabase[familyId];
      crop = atlasCrop(passFamily, randomSample);
      [geometry, alpha] = await Promise.all([
        loadImage(view === 'sdf' ? passFamily.sdfSheets[crop.sheetIndex] : passFamily.maskSheets[crop.sheetIndex]),
        loadImage(passFamily.maskSheets[crop.sheetIndex])
      ]);
    }
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.shadowColor = 'rgba(255,255,255,.08)';
    ctx.shadowBlur = 22;
    if (crop) {
      if (view === 'mask') {
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
      }
      ctx.drawImage(geometry, crop.sx, crop.sy, crop.size, crop.size, rect.x, rect.y, rect.size, rect.size);
    } else {
      ctx.drawImage(geometry, rect.x, rect.y, rect.size, rect.size);
    }
    ctx.restore();

    fx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    const fieldKey = crop
      ? `${familyId}:sample:${randomSample}`
      : `${familyId}:variant:${variantIndex}`;
    const flowField = buildGeodesicField(alpha, crop, fieldKey);
    drawGeodesicFlow(rect, time, flowField);
    fx.globalCompositeOperation = 'destination-in';
    if (crop) {
      fx.drawImage(alpha, crop.sx, crop.sy, crop.size, crop.size, rect.x, rect.y, rect.size, rect.size);
    } else {
      fx.drawImage(alpha, rect.x, rect.y, rect.size, rect.size);
    }
    fx.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = view === 'sdf' ? 'screen' : 'source-over';
    ctx.globalAlpha = view === 'sdf' ? .6 : .92;
    ctx.drawImage(fxCanvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = Math.max(1, canvas.width / 1600);
    ctx.strokeRect(rect.x - 1, rect.y - 1, rect.size + 2, rect.size + 2);
  } catch (error) {
    ctx.fillStyle = '#999';
    ctx.font = '14px Arial';
    ctx.fillText('Geometry asset could not be loaded.', 30, 100);
  }
}

function animate(time) {
  if (!reducedMotion || frame === 0 || time - lastTime > 500) {
    draw(time);
    lastTime = time;
    frame += 1;
  }
  requestAnimationFrame(animate);
}

familiesEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-family]');
  if (!button) return;
  familyId = button.dataset.family;
  variantIndex = 0;
  randomSample = null;
  familiesEl.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
  updateInterface();
});

representationsEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-view]');
  if (!button) return;
  view = button.dataset.view;
  representationsEl.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
});

slider.addEventListener('input', () => {
  variantIndex = Number(slider.value);
  randomSample = null;
  updateInterface();
});

generateNext.addEventListener('click', () => {
  if (!passDatabase) return;
  const samples = passDatabase[familyId].passSamples;
  let next = samples[Math.floor(Math.random() * samples.length)];
  if (samples.length > 1) {
    while (next === randomSample) next = samples[Math.floor(Math.random() * samples.length)];
  }
  randomSample = next;
  generateNext.classList.remove('is-launching');
  requestAnimationFrame(() => generateNext.classList.add('is-launching'));
  setTimeout(() => generateNext.classList.remove('is-launching'), 520);
  updateInterface();
});

Promise.all([
  fetch('assets/geometry/geometry-data.json?v=pass-flow-3').then((response) => {
    if (!response.ok) throw new Error(`Geometry data: ${response.status}`);
    return response.json();
  }),
  fetch('assets/geometry/pass-atlases.json?v=pass-flow-3').then((response) => {
    if (!response.ok) throw new Error(`PASS atlas data: ${response.status}`);
    return response.json();
  })
])
  .then(([geometryData, atlasData]) => {
    database = geometryData;
    passDatabase = atlasData;
    updateInterface();
  })
  .catch((error) => {
    console.error(error);
    viewerLabel.textContent = 'GEOMETRY DATA UNAVAILABLE';
  });

addEventListener('resize', resizeCanvas);
requestAnimationFrame(animate);
