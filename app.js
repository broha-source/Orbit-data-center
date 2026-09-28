const canvas = document.querySelector('#flowCanvas');
const ctx = canvas.getContext('2d');
const fxCanvas = document.createElement('canvas');
const fx = fxCanvas.getContext('2d');
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

let database;
let familyId = 'F0';
let view = 'mask';
let variantIndex = 0;
let frame = 0;
let lastTime = performance.now();
const imageCache = new Map();

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

function updateInterface() {
  const family = currentFamily();
  const variant = currentVariant();
  slider.max = family.variants.length - 1;
  slider.value = variantIndex;
  variableLabel.textContent = family.variable;
  conditionOut.textContent = variant.value;
  viewerLabel.textContent = `${familyId} / ${family.name}`;
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
    const [geometry, alpha] = await Promise.all([loadImage(view === 'sdf' ? variant.sdf : variant.mask), loadImage(variant.alpha)]);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.shadowColor = 'rgba(255,255,255,.08)';
    ctx.shadowBlur = 22;
    ctx.drawImage(geometry, rect.x, rect.y, rect.size, rect.size);
    ctx.restore();

    fx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    drawDirectionalField(rect, time);
    drawPathParticles(rect, time, variant.paths);
    fx.globalCompositeOperation = 'destination-in';
    fx.drawImage(alpha, rect.x, rect.y, rect.size, rect.size);
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
  updateInterface();
});

fetch('assets/geometry/geometry-data.json?v=five-family')
  .then((response) => {
    if (!response.ok) throw new Error(`Geometry data: ${response.status}`);
    return response.json();
  })
  .then((data) => {
    database = data;
    updateInterface();
  })
  .catch((error) => {
    console.error(error);
    viewerLabel.textContent = 'GEOMETRY DATA UNAVAILABLE';
  });

addEventListener('resize', resizeCanvas);
requestAnimationFrame(animate);
