// Conceptual area layers, not measured physical floors or production eligibility.
export const processAreas=[
  {id:'PHOTO',label:'PHOTO',color:'#a694df',types:['PHOTO']},
  {id:'ETCH',label:'ETCH',color:'#dbaf79',types:['ETCH']},
  {id:'DIFF',label:'DIFF',color:'#d28a97',types:['IMPL','RTP','ALT']},
  {id:'THINFILM',label:'T/F',color:'#7db5dd',types:['CVD','PVD']},
  {id:'CMP',label:'CMP',color:'#a9c981',types:['CMP']},
  {id:'CLEAN',label:'CLEAN',color:'#72c4ba',types:['WET','CLEAN']},
  {id:'MI',label:'MI',color:'#d5bf75',types:['MET','MI']}
];
export const areaLayerGap=140;
export function processArea(node){
  return processAreas.findIndex(area=>area.id===node.area||area.types.includes(node.operId.split('-')[0]));
}
export function dragMode(depth,button,shift){return depth&&button===0&&shift?'rotate':'pan';}
function cameraRotation(camera){
  if(camera.rotation)return camera.rotation;
  const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
  return [cy,0,sy,sp*sy,cp,-sp*cy,-cp*sy,sp,cp*cy];
}
// Apply incremental rotations in screen space, including after portrait-axis
// transposition. This avoids swapped controls and Euler-axis flips after orbiting.
export function rotationForDrag(camera,dx,dy){
  const m=cameraRotation(camera),rows=[m.slice(0,3),m.slice(3,6),m.slice(6,9)];
  if(camera.vertical)[rows[0],rows[1]]=[rows[1],rows[0]];
  const yaw=-dx*.006,pitch=dy*.006,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const x=rows[0].map((v,i)=>cy*v+sy*rows[2][i]);
  const z=rows[2].map((v,i)=>-sy*rows[0][i]+cy*v);
  const y=rows[1].map((v,i)=>cp*v-sp*z[i]);
  const depth=z.map((v,i)=>sp*rows[1][i]+cp*v);
  return (camera.vertical?[...y,...x,...depth]:[...x,...y,...depth]);
}

// Presentation only: preserve IDs, sequence and branch choices. Moderate lateral
// offsets reveal area changes while the downstream axis stays strictly ordered.
export const flowLayout={lengthScale:.95,groupSpacing:1100};
export function waterfallLayout(nodes, routes, layout=flowLayout) {
  const groups=new Map(),layers=nodes.map(processArea);
  for(const route of routes){let previous=5;for(const segment of route.segments){for(const index of segment){groups.set(index,route.group);if(layers[index]<0)layers[index]=previous;}previous=layers[segment[0]];}}
  return nodes.map((node,index)=>{
    const group=groups.get(index)??0,center=group*600+225,layer=layers[index];
    const drift=Math.sin(node.x/900+group*.38)*140;
    return {...node,layer,area:processAreas[layer]?.id??'UNASSIGNED',x:node.x*layout.lengthScale,y:group*layout.groupSpacing+225+(node.y-center)*.6+(layer-3)*55+drift,z:Math.max(0,layer)*areaLayerGap};
  });
}

export function eventAt(events, minute) {
  let low=0, high=events.length-1, found=-1;
  while(low<=high){const mid=(low+high)>>1;if(events[mid][0]<=minute){found=mid;low=mid+1;}else high=mid-1;}
  return found;
}
export function lotState(lot, minute) {
  const index=eventAt(lot.events,minute);if(index<0)return null;
  const event=lot.events[index],next=lot.events[index+1];
  const explicit=event[2]===6;
  const transit=explicit||(event[2]===4&&next&&next[1]!==event[1]);
  const arrival=explicit?event[3]:next?.[0];
  return {lot,index,event,node:lot.path[event[1]],nextNode:transit?lot.path[explicit?event[1]+1:next[1]]:null,fraction:transit?Math.max(0,Math.min(1,(minute-event[0])/(arrival-event[0]))):0};
}
export function projectPoint(point, camera) {
  let x=point.x-2535,y=(point.y-1725)*.45,z=(point.z||0)-780,depth=0;
  if(camera.depth){const m=cameraRotation(camera),rx=m[0]*x+m[1]*y+m[2]*z,ry=m[3]*x+m[4]*y+m[5]*z;depth=m[6]*x+m[7]*y+m[8]*z;const perspective=6500/(6500+depth);x=rx*perspective;y=ry*perspective;}
  return camera.vertical?{x:y,y:x,depth}:{x,y,depth};
}

export function wipRanking(states){
  const map=new Map();
  for(const s of states){if(s.event[2]===5||s.nextNode!==null)continue;const row=map.get(s.node)||{node:s.node,total:0,wait:0,proc:0,hold:0};row.total++;if(s.event[2]===0)row.wait++;if([1,2].includes(s.event[2]))row.proc++;if(s.event[2]===3)row.hold++;map.set(s.node,row);}
  return [...map.values()].sort((a,b)=>b.total-a.total||a.node-b.node);
}
export function graphBounds(nodes,camera) {
  if(!nodes.length)return {minX:-1,minY:-1,maxX:1,maxY:1};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const n of nodes){const p=projectPoint(n,camera);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
  return {minX,minY,maxX,maxY};
}

// Match the cubic used to draw the route: the two control points share its midpoint axis.
export function linkPoint(a,b,t,vertical=false) {
  const axis=1.5*t-1.5*t*t+t*t*t;
  const cross=t*t*(3-2*t);
  return {x:a.x+(b.x-a.x)*(vertical?cross:axis),y:a.y+(b.y-a.y)*(vertical?axis:cross)};
}
