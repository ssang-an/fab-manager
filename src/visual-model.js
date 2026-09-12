export function areaLoad(states,nodes){
  const rows=Array.from({length:7},()=>({total:0,wait:0,proc:0,hold:0,move:0}));
  for(const s of states){if(s.event[2]===5)continue;const r=rows[nodes[s.node]?.layer];if(!r)continue;r.total++;if(s.nextNode!=null)r.move++;else if(s.event[2]===3)r.hold++;else if(s.event[2]===0)r.wait++;else if([1,2].includes(s.event[2]))r.proc++;}
  return rows;
}
export function miniTransform(points,width,height){
  if(!points.length)return null;const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys);
  const scale=Math.min((width-16)/Math.max(1,maxX-minX),(height-16)/Math.max(1,maxY-minY));return {scale,x:width/2-(minX+maxX)/2*scale,y:height/2-(minY+maxY)/2*scale};
}
