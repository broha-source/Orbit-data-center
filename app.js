const canvas = document.querySelector('#flowCanvas');
const ctx = canvas.getContext('2d');
const seed = document.querySelector('#seed');
const complexity = document.querySelector('#complexity');
let family = 'F0';
let representation = 'mask';
let transition = 1;
let lastTime = 0;

const results = {
  F0: { name: 'SERPENTINE', pass: '90.2', count: '231 / 256', unique: 256, time: '8.78' },
  F1: { name: 'PARALLEL', pass: '70.7', count: '181 / 256', unique: 242, time: '8.77' },
  F6: { name: 'PIN-FIN', pass: '97.3', count: '249 / 256', unique: 256, time: '8.77' }
};

const effects = {
  F0: { heat:.76, uniform:.62, pressure:.82, response:'HIGH-MIXING PATH', summary:'Long turning path promotes mixing, with a higher pumping penalty.' },
  F1: { heat:.58, uniform:.92, pressure:.36, response:'UNIFORM LOW-LOSS FLOW', summary:'Parallel paths favor even distribution and lower pumping demand.' },
  F6: { heat:.91, uniform:.80, pressure:.64, response:'WAKE-ENHANCED EXCHANGE', summary:'Pin wakes increase exchange area and local mixing at moderate pressure cost.' }
};

function resize(){
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}

function roundedLine(points, width){
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.lineWidth=width; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke();
}

function drawF0(x,y,w,h,n,t){
  const rows=Math.max(3,Math.min(9,n)), gap=h/(rows-1), pts=[];
  for(let i=0;i<rows;i++) pts.push([i%2===0?x:x+w,y+i*gap]);
  ctx.strokeStyle='#f1f1f1'; roundedLine(pts,Math.max(9,gap*.3));
  const segments=pts.length-1;
  for(let p=0;p<18;p++){
    const q=(t*.00014+p/18)%1*segments, s=Math.min(segments-1,Math.floor(q)), f=q-s;
    const px=pts[s][0]+(pts[s+1][0]-pts[s][0])*f, py=pts[s][1]+(pts[s+1][1]-pts[s][1])*f;
    particle(px,py,p%3===0?3:1.7);
  }
}

function drawF1(x,y,w,h,n,t){
  const rows=Math.max(4,Math.min(10,n)), gap=h/(rows-1);
  ctx.strokeStyle='#f1f1f1'; ctx.lineCap='square'; ctx.lineWidth=Math.max(7,gap*.28);
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+h);ctx.moveTo(x+w,y);ctx.lineTo(x+w,y+h);ctx.stroke();
  for(let i=0;i<rows;i++){
    ctx.beginPath();ctx.moveTo(x,y+i*gap);ctx.lineTo(x+w,y+i*gap);ctx.stroke();
    const px=x+((t*.075+i*43)%w); particle(px,y+i*gap,2);
  }
}

function drawF6(x,y,w,h,n,t){
  ctx.fillStyle='#f1f1f1'; ctx.fillRect(x-18,y,18,h);ctx.fillRect(x+w,y,18,h);
  const cols=Math.max(4,Math.min(9,n)), rows=Math.max(4,Math.min(8,n-1));
  const gx=w/(cols+1), gy=h/(rows+1), r=Math.min(gx,gy)*.24;
  for(let j=1;j<=rows;j++)for(let i=1;i<=cols;i++){
    const offset=j%2?gx*.16:-gx*.16;ctx.beginPath();ctx.arc(x+i*gx+offset,y+j*gy,r,0,Math.PI*2);ctx.fill();
  }
  for(let p=0;p<20;p++){
    const px=x+((t*.055+p*w/20)%w), lane=p%rows+1;
    const py=y+lane*gy+Math.sin(px/gx*Math.PI)*gy*.18; particle(px,py,p%4===0?2.8:1.6);
  }
}

function particle(x,y,r){
  const glow=ctx.createRadialGradient(x,y,0,x,y,r*4); glow.addColorStop(0,'rgba(255,255,255,.95)'); glow.addColorStop(.25,'rgba(165,210,235,.7)'); glow.addColorStop(1,'rgba(120,180,210,0)');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r*4,0,Math.PI*2);ctx.fill();
}

function draw(t=performance.now()){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#050607';ctx.fillRect(0,0,w,h);
  const pad=Math.max(70,Math.min(w,h)*.16), x=pad,y=pad*.72, gw=w-pad*2,gh=h-pad*1.45;
  if(representation==='sdf'){
    const g=ctx.createRadialGradient(w*.5,h*.5,10,w*.5,h*.5,w*.55);g.addColorStop(0,'#48515a');g.addColorStop(.55,'#15191d');g.addColorStop(1,'#020303');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.globalAlpha=.7;
  }
  const n=+complexity.value;
  ctx.globalAlpha*=Math.min(1,transition);
  if(family==='F0') drawF0(x,y,gw,gh,n,t);
  if(family==='F1') drawF1(x,y,gw,gh,n,t);
  if(family==='F6') drawF6(x,y,gw,gh,n,t);
  ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1;ctx.strokeRect(30,30,w-60,h-60);
}

function level(value){return value>.74?'HIGH':value>.49?'MED':'LOW'}

function updateEffects(){
  const base=effects[family], density=(+complexity.value-6)*.035;
  const values={heat:Math.max(.1,Math.min(1,base.heat+density)),uniform:Math.max(.1,Math.min(1,base.uniform-density*.45)),pressure:Math.max(.1,Math.min(1,base.pressure+density*1.4))};
  ['heat','uniform','pressure'].forEach(key=>{
    document.querySelector(`#${key}Bar`).style.width=`${values[key]*100}%`;
    document.querySelector(`#${key}Effect`).value=level(values[key]);
  });
  document.querySelector('#flowResponse').textContent=base.response;
  document.querySelector('#effectSummary').textContent=base.summary;
}

function update(){
  const r=results[family];
  document.querySelector('#seedOut').value=String(seed.value).padStart(4,'0');
  document.querySelector('#complexityOut').value=complexity.value;
  document.querySelector('#viewerLabel').textContent=`${family} / ${r.name}`;
  document.querySelector('#passMetric').innerHTML=`${r.pass}<small> %</small>`;
  document.querySelector('#passMetric').nextElementSibling.textContent=r.count;
  document.querySelector('#uniqueMetric').innerHTML=`${r.unique}<small> / 256</small>`;
  document.querySelector('#timeMetric').innerHTML=`${r.time}<small> min</small>`;
  updateEffects();
  draw();
}

document.querySelectorAll('#families button').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('#families button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');family=btn.dataset.family;transition=0;update();
}));
document.querySelectorAll('#representations button').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('#representations button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');representation=btn.dataset.view;draw();
}));
[seed,complexity].forEach(el=>el.addEventListener('input',update));
function animate(t){transition=Math.min(1,transition+(t-lastTime)/260);lastTime=t;draw(t);requestAnimationFrame(animate)}
addEventListener('resize',resize);resize();update();requestAnimationFrame(animate);
