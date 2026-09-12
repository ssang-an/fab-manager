import {sites} from './fab-campus.js';
export function flowTotals(lots,minute){
 let entered=0,out=0,recentIn=0,recentOut=0;
 for(const lot of lots){
  const entry=lot.events[0]?.[0],exit=lot.events.find(e=>e[2]===5)?.[0];
  if(entry!=null&&entry<=minute){entered++;if(entry>minute-1440)recentIn++;}
  if(exit!=null&&exit<=minute){out++;if(exit>minute-1440)recentOut++;}
 }
 return {entered,out,recentIn,recentOut,pending:lots.length-entered};
}
export function drawTwinGround(ctx,nodes,project,light){
 if(!nodes.length)return;
 ctx.save();
 for(const site of sites){
  const local=nodes.filter(n=>site.fabs.includes(n.fab));if(!local.length)continue;
  const x0=Math.min(...local.map(n=>n.x))-240,x1=Math.max(...local.map(n=>n.x))+240;
  const y0=Math.min(...local.map(n=>n.y))-220,y1=Math.max(...local.map(n=>n.y))+220;
  const polygon=[{x:x0,y:y0,z:-90},{x:x1,y:y0,z:-90},{x:x1,y:y1,z:-90},{x:x0,y:y1,z:-90}].map(project);
  ctx.beginPath();polygon.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
  ctx.fillStyle=light?'#438b9910':'#3d9bba10';ctx.strokeStyle=light?'#6194a477':'#6bb3c155';ctx.lineWidth=1;ctx.fill();ctx.stroke();
  ctx.save();ctx.clip();ctx.strokeStyle=light?'#638e9b25':'#5699ab25';ctx.lineWidth=.6;
  const line=(a,b)=>{const p=project(a),q=project(b);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();};
  for(let x=x0;x<=x1;x+=220)line({x,y:y0,z:-90},{x,y:y1,z:-90});
  for(let y=y0;y<=y1;y+=220)line({x:x0,y,z:-90},{x:x1,y,z:-90});
  ctx.restore();
 }
 ctx.restore();
}
