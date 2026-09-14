const canvas = document.querySelector('#flowCanvas');
const ctx = canvas.getContext('2d');
const condition = document.querySelector('#condition');
let family = 'F0';
let representation = 'mask';
let transition = 1;
let lastTime = performance.now();

const results = {
  F0: { name: 'SERPENTINE', pass: '90.2', fail: '9.8', passCount: '231 / 256', failCount: '25 / 256' },
  F1: { name: 'PARALLEL', pass: '70.7', fail: '29.3', passCount: '181 / 256', failCount: '75 / 256' },
  F6: { name: 'PIN-FIN', pass: '97.3', fail: '2.7', passCount: '249 / 256', failCount: '7 / 256' }
};

function resize() {
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function roundedRectPath(x, y, w, h, r) {
  const path = new Path2D();
  path.roundRect(x, y, w, h, r);
  return path;
}

function makeSerpentinePath(x, y, w, h, rows) {
  const path = new Path2D();
  const gap = h / (rows - 1);
  const radius = Math.min(gap * .5, w * .07);
  path.moveTo(x - 24, y + h);
  for (let row = 0; row < rows; row++) {
    const yy = y + h - row * gap;
    const goingRight = row % 2 === 0;
    if (goingRight) {
      path.lineTo(x + w - radius, yy);
      if (row < rows - 1) {
        path.quadraticCurveTo(x + w, yy, x + w, yy - radius);
        path.lineTo(x + w, yy - gap + radius);
        path.quadraticCurveTo(x + w, yy - gap, x + w - radius, yy - gap);
      }
    } else {
      path.lineTo(x + radius, yy);
      if (row < rows - 1) {
        path.quadraticCurveTo(x, yy, x, yy - radius);
        path.lineTo(x, yy - gap + radius);
        path.quadraticCurveTo(x, yy - gap, x + radius, yy - gap);
      }
    }
  }
  path.lineTo(x + w + 24, y);
  return { path, gap };
}

function drawSdfStroke(path, width) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(238,247,255,.88)';
  ctx.shadowColor = 'rgba(230,245,255,.9)';
  ctx.shadowBlur = 24;
  ctx.lineWidth = width + 34;
  ctx.stroke(path);
  ctx.shadowBlur = 18;
  ctx.shadowColor = 'rgba(255,93,55,.8)';
  ctx.strokeStyle = '#ff9675';
  ctx.lineWidth = width + 15;
  ctx.stroke(path);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffd1bf';
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.strokeStyle = 'rgba(20,24,28,.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke(path);
  ctx.restore();
}

function drawMaskStroke(path, width) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#050505';
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.restore();
}

function drawF0(x, y, w, h, n) {
  const { path, gap } = makeSerpentinePath(x, y, w, h, n);
  const width = Math.max(15, Math.min(34, gap * .34));
  if (representation === 'sdf') drawSdfStroke(path, width);
  else drawMaskStroke(path, width);
}

function drawF1(x, y, w, h, n) {
  const gap = h / n;
  const edge = Math.max(12, Math.min(22, gap * .24));
  const plate = roundedRectPath(x, y, w, h, 5);
  if (representation === 'sdf') {
    ctx.save();
    ctx.fillStyle = '#ff9a79';
    ctx.shadowColor = 'rgba(235,247,255,.9)';
    ctx.shadowBlur = 25;
    ctx.fill(plate);
    ctx.shadowBlur = 0;
    for (let i = 0; i < n; i++) {
      const cy = y + i * gap + gap * .5;
      const channel = roundedRectPath(x + edge * 1.7, cy - gap * .27, w - edge * 3.4, gap * .54, 4);
      ctx.fillStyle = '#86a8ff';
      ctx.shadowColor = 'rgba(220,239,255,.75)';
      ctx.shadowBlur = 14;
      ctx.fill(channel);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(15,18,24,.7)';
      ctx.lineWidth = 1.3;
      ctx.stroke(channel);
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#f7f7f4';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#050505';
    ctx.lineWidth = edge;
    ctx.strokeRect(x, y, w, h);
    for (let i = 1; i < n; i++) {
      const yy = y + i * gap;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      ctx.stroke();
    }
    ctx.clearRect(x - edge, y + h - edge * 1.05, edge * 2.5, edge * 2.1);
    ctx.clearRect(x + w - edge * 1.5, y - edge * 1.05, edge * 2.5, edge * 2.1);
    ctx.restore();
  }
}

function drawF6(x, y, w, h, n) {
  const cols = n;
  const rows = n;
  const gx = w / (cols + 1);
  const gy = h / (rows + 1);
  const radius = Math.min(gx, gy) * .27;
  if (representation === 'sdf') {
    const plate = roundedRectPath(x, y, w, h, 5);
    ctx.save();
    ctx.fillStyle = '#ff9a79';
    ctx.shadowColor = 'rgba(235,247,255,.9)';
    ctx.shadowBlur = 25;
    ctx.fill(plate);
    ctx.shadowBlur = 0;
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= cols; col++) {
        const px = x + col * gx;
        const py = y + row * gy;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, radius * 2.4);
        glow.addColorStop(0, '#83a6ff');
        glow.addColorStop(.52, '#dce9ff');
        glow.addColorStop(1, 'rgba(255,145,112,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, radius * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(15,18,24,.75)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#050505';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#f7f7f4';
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= cols; col++) {
        ctx.beginPath();
        ctx.arc(x + col * gx, y + row * gy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.clearRect(x - 1, y + h - 30, 30, 31);
    ctx.clearRect(x + w - 29, y - 1, 30, 31);
    ctx.restore();
  }
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const alpha = transition * transition * (3 - 2 * transition);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = representation === 'sdf' ? '#3d50c5' : '#f7f7f4';
  ctx.fillRect(0, 0, w, h);

  const pad = Math.max(62, Math.min(w, h) * .13);
  const x = pad;
  const y = pad * .72;
  const gw = w - pad * 2;
  const gh = h - pad * 1.45;
  const n = Number(condition.value);

  ctx.save();
  ctx.globalAlpha = alpha;
  if (family === 'F0') drawF0(x, y, gw, gh, n);
  if (family === 'F1') drawF1(x, y, gw, gh, n);
  if (family === 'F6') drawF6(x, y, gw, gh, n);
  ctx.restore();

  ctx.strokeStyle = representation === 'sdf' ? 'rgba(10,16,40,.5)' : 'rgba(0,0,0,.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(30, 30, w - 60, h - 60);
}

function update() {
  const r = results[family];
  document.querySelector('#conditionOut').value = condition.value;
  document.querySelector('#viewerLabel').textContent = `${family} / ${r.name}`;
  document.querySelector('#passMetric').innerHTML = `${r.pass}<small> %</small>`;
  document.querySelector('#passMetric').nextElementSibling.textContent = r.passCount;
  document.querySelector('#failMetric').innerHTML = `${r.fail}<small> %</small>`;
  document.querySelector('#failCount').textContent = r.failCount;
  draw();
}

document.querySelectorAll('#families button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('#families button').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  family = button.dataset.family;
  transition = 0;
  update();
}));

document.querySelectorAll('#representations button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('#representations button').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  representation = button.dataset.view;
  transition = 0;
  draw();
}));

condition.addEventListener('input', update);

function animate(time) {
  if (transition < 1) {
    transition = Math.min(1, transition + (time - lastTime) / 300);
    draw();
  }
  lastTime = time;
  requestAnimationFrame(animate);
}

addEventListener('resize', resize);
resize();
update();
requestAnimationFrame(animate);
