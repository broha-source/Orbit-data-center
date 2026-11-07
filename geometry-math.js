/* Native tile geometry estimates; no physical scale is assumed. */
globalThis.tileGeometry = function(mask, size) {
  const padded=new Uint8Array((size+2)*(size+2));
  for(let y=0;y<size;y++)padded.set(mask.subarray(y*size,(y+1)*size),(y+1)*(size+2)+1);
  mask=padded;size+=2;
  const skeleton = new Uint8Array(mask);
  const remove = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      remove.length = 0;
      for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
        const i = y * size + x; if (!skeleton[i]) continue;
        const n = [skeleton[i-size],skeleton[i-size+1],skeleton[i+1],skeleton[i+size+1],skeleton[i+size],skeleton[i+size-1],skeleton[i-1],skeleton[i-size-1]];
        const count = n.reduce((a,b)=>a+b,0); if(count<2||count>6) continue;
        let transitions=0; for(let k=0;k<8;k++) if(!n[k]&&n[(k+1)%8]) transitions++;
        if(transitions!==1) continue;
        if(pass===0 ? n[0]*n[2]*n[4] || n[2]*n[4]*n[6] : n[0]*n[2]*n[6] || n[0]*n[4]*n[6]) continue;
        remove.push(i);
      }
      if(remove.length) changed=true;
      for(const i of remove) skeleton[i]=0;
    }
  }
  const distance=new Float32Array(mask.length);
  for(let i=0;i<mask.length;i++)distance[i]=mask[i]?1e6:0;
  for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){const i=y*size+x;distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-size]+1,distance[i-size-1]+Math.SQRT2,distance[i-size+1]+Math.SQRT2);}
  for(let y=size-2;y>0;y--)for(let x=size-2;x>0;x--){const i=y*size+x;distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+size]+1,distance[i+size+1]+Math.SQRT2,distance[i+size-1]+Math.SQRT2);}
  let area=0,length=0;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=y*size+x; area+=mask[i]; if(!skeleton[i])continue;
    let neighbours=0;for(const dy of [-1,0,1])for(const dx of [-1,0,1])if((dx||dy)&&x+dx>=0&&x+dx<size&&y+dy>=0&&y+dy<size)neighbours+=skeleton[i+dy*size+dx];
    if(neighbours===1)length+=distance[i];
    if(x+1<size&&skeleton[i+1])length++;
    if(y+1<size&&skeleton[i+size])length++;
    if(x+1<size&&y+1<size&&skeleton[i+size+1]&&!skeleton[i+1]&&!skeleton[i+size])length+=Math.SQRT2;
    if(x&&y+1<size&&skeleton[i+size-1]&&!skeleton[i-1]&&!skeleton[i+size])length+=Math.SQRT2;
  }
  return { area, length, thickness:length ? area/length : 0 };
};
