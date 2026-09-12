// Decorative screen-space cleanroom shell; not physical fab geometry.
export function drawAmbientRoom(ctx,w,h,light){
 ctx.save();
 const vx=w*.53,vy=h*.43;
 const glow=ctx.createRadialGradient(vx,vy,20,vx,vy,Math.max(w,h)*.72);
 glow.addColorStop(0,light?'#b5d6e130':'#24476c30');
 glow.addColorStop(.55,light?'#658aa00a':'#090f2915');
 glow.addColorStop(1,light?'#46657925':'#01030ca8');
 ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 const line=(x,y,a,b)=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();};
 // Perspective service aisles, overhead rail and floor panels.
 ctx.strokeStyle=light?'#446f8b2b':'#7eafce27';ctx.lineWidth=.8;
 for(let i=-4;i<=14;i++){const x=i*w/10;line(vx+(x-vx)*.12,vy+h*.045,x,h);line(vx+(x-vx)*.12,vy-h*.07,x,0);}
 for(const t of [.10,.17,.27,.41,.60,.83,1]){
  const y=vy+(h-vy)*t*t;line(0,y,w,y);
  const cy=vy-vy*t*t;line(0,cy,w,cy);
 }
 // Equipment-bay silhouettes flank the clear central data plane.
 for(const side of [0,1])for(let i=0;i<5;i++){
  const depth=(i+1)/5,bw=28+depth*52,bh=55+depth*140;
  const x=side?w-bw-8-i*14:8+i*14,y=vy-bh*.48+i*23;
  ctx.fillStyle=light?'#bdd0da12':'#08152635';ctx.strokeStyle=light?'#527c9430':'#719fbf30';
  ctx.fillRect(x,y,bw,bh);ctx.strokeRect(x,y,bw,bh);
  ctx.fillStyle=light?'#378c9438':'#70dac362';ctx.fillRect(x+7,y+9,3,3);
  line(x+7,y+24,x+bw-7,y+24);
 }
 // Sparse, deterministic pin lights, visually distinct from moving lot dots.
 for(let i=0;i<90;i++){
  const x=((i*7919)%1009)/1009*w,y=((i*3571)%997)/997*h;
  ctx.fillStyle=light?'#45688230':i%5===0?'#c2dded70':'#87a5cb35';
  ctx.fillRect(x,y,i%5===0?1.4:.7,i%5===0?1.4:.7);
 }
 ctx.restore();
}
