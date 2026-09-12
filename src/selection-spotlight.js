export function drawSelectionSpotlight(ctx,targets,width,height,light){
 const visible=targets.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height).slice(0,32);if(!visible.length)return;
 ctx.save();ctx.globalAlpha=1;
 // Solid dimming avoids blur filters and oversized animated heat textures.
 ctx.fillStyle=light?'rgba(27,43,57,.28)':'rgba(0,5,12,.56)';ctx.fillRect(0,0,width,height);
 for(const p of visible){
  const r=p.kind==='lot'?18:32;
  ctx.fillStyle=light?'rgba(255,255,255,.55)':'rgba(91,184,208,.22)';ctx.strokeStyle=light?'#086e84':'#83ebff';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fillStyle=p.color||ctx.strokeStyle;ctx.fill();
  ctx.strokeStyle=light?'#fff':'#081720';ctx.lineWidth=2;ctx.stroke();
  ctx.font='bold 12px "Malgun Gothic",sans-serif';const label=p.label||'선택';const w=Math.min(width-12,ctx.measureText(label).width+18),x=Math.max(6,Math.min(width-w-6,p.x-w/2)),y=Math.max(22,p.y-r-12);
  ctx.fillStyle=light?'#fff':'#102a37';ctx.fillRect(x,y-17,w,24);ctx.strokeStyle=light?'#086e84':'#83ebff';ctx.lineWidth=1;ctx.strokeRect(x,y-17,w,24);ctx.fillStyle=light?'#123744':'#edfcff';ctx.fillText(label,x+9,y,Math.max(1,w-18));
 }
 ctx.restore();
}
