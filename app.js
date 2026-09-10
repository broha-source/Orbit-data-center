const canvas = document.querySelector('#flowCanvas');
const ctx = canvas.getContext('2d');
const power = document.querySelector('#power');
const pump = document.querySelector('#pump');
const sun = document.querySelector('#sun');
const particles = Array.from({length: 110}, (_, i) => ({
  x: Math.random(), y: Math.random(), seed: Math.random() * 10, size: 0.6 + Math.random() * 1.8, lane: i % 3
}));

function resize(){
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function updateMetrics(){
  const p = +power.value, f = +pump.value / 10, s = +sun.value;
  document.querySelector('#powerOut').value = `${p}%`;
  document.querySelector('#pumpOut').value = `${f.toFixed(1)} L/min`;
  document.querySelector('#sunOut').value = `${s}%`;
  const temp = 31 + p * .26 + s * .045 - f * 2.1;
  const uniform = Math.max(72, 86 + f * 2.2 - p * .04);
  const margin = Math.max(2, 62 - temp);
  document.querySelector('#tempMetric').innerHTML = `${temp.toFixed(1)}<small> °C</small>`;
  document.querySelector('#flowMetric').innerHTML = `${uniform.toFixed(1)}<small> %</small>`;
  document.querySelector('#marginMetric').innerHTML = `${margin.toFixed(1)}<small> °C</small>`;
}

function draw(t){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  const heat = +power.value / 100;
  const speed = +pump.value / 32;
  const glow = ctx.createRadialGradient(w*.52,h*.52,10,w*.52,h*.52,w*.42);
  glow.addColorStop(0,`rgba(255,92,45,${.18*heat})`);
  glow.addColorStop(.45,`rgba(255,150,50,${.08*heat})`);
  glow.addColorStop(1,'rgba(20,190,190,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  particles.forEach((p,i)=>{
    const phase = (t*.000035*speed + p.x + p.seed) % 1;
    const x = phase*w*1.18-w*.09;
    const laneY = h*(.34+p.lane*.16);
    const y = laneY + Math.sin(phase*11+p.seed)*h*(.08+.03*heat) + Math.sin(t*.001+p.seed)*5;
    const hot = Math.max(0,1-Math.abs(x-w*.52)/(w*.28))*heat;
    ctx.beginPath();ctx.arc(x,y,p.size+hot*1.2,0,Math.PI*2);
    ctx.fillStyle = hot>.45 ? `rgba(255,${120-hot*50},50,${.35+hot*.55})` : `rgba(66,223,219,${.18+p.size*.13})`;
    ctx.fill();
    if(i%4===0){ctx.beginPath();ctx.moveTo(x-18*speed,y);ctx.lineTo(x,y);ctx.strokeStyle=`rgba(88,230,213,${.12+hot*.2})`;ctx.stroke()}
  });
  requestAnimationFrame(draw);
}

document.querySelectorAll('#modes button').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('#modes button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  const presets={nominal:[68,32,42],peak:[94,45,70],safe:[38,25,18]};
  [power.value,pump.value,sun.value]=presets[btn.dataset.mode];updateMetrics();
}));
[power,pump,sun].forEach(el=>el.addEventListener('input',updateMetrics));
addEventListener('resize',resize);resize();updateMetrics();requestAnimationFrame(draw);
