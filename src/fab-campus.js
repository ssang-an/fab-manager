export const fabNames=['M10','M14','M15','M16','R3'];
export const sites=[{id:'ICHEON',label:'이천 SITE',fabs:['R3','R4','M10','M14','M16']},{id:'CHEONGJU',label:'청주 SITE',fabs:['M11','M12','M15']}];
export const campusOrder=['R3','R4','M10','M14','M16','M11','M12','M15'];
export const siteOf=fab=>sites.find(s=>s.fabs.includes(fab))?.id;

export function campusLayout(nodes,options={}){
  const active=campusOrder.filter(fab=>nodes.some(n=>n.fab===fab));
  const base=nodes.map(n=>{const site=active.indexOf(n.fab);if(site<0)return n;const group=n.group>3?0:(n.group??0),lane=n.routeLane??0;return {...n,y:site*2200+group*150+lane*32+(n.layer-3)*22+Math.sin(n.x/600)*35};});
  return compactCampus(base,new Set(base.map((_,i)=>i)),options);
}
// Pack only the visible route geometry; keep each fab's internal layout intact.
export function compactCampus(nodes,visible,{horizontal=false}={}){
 const offsets=new Map();let cursor=0,previousSite=null;
 for(const fab of campusOrder){
  const local=nodes.filter((n,i)=>visible.has(i)&&n.fab===fab);if(!local.length)continue;
  const low=Math.min(...local.map(n=>n.y)),high=Math.max(...local.map(n=>n.y));
  if(previousSite&&previousSite!==siteOf(fab))cursor+=horizontal?80:120;
  offsets.set(fab,cursor-low);cursor+=high-low+(horizontal?230:300);previousSite=siteOf(fab);
 }
 return nodes.map(n=>offsets.has(n.fab)?{...n,y:n.y+offsets.get(n.fab)}:n);
}
export function lotLocation(state,nodes){return state?nodes[state.node].fab:null;}
export function isFabTransfer(state,nodes){return state?.nextNode!=null&&nodes[state.node].fab!==nodes[state.nextNode].fab;}
export function fabSummary(states,nodes){return fabNames.map(fab=>({fab,rd:states.filter(s=>s.event[2]!==5&&lotLocation(s,nodes)===fab&&s.lot.program==='R&D').length,production:states.filter(s=>s.event[2]!==5&&lotLocation(s,nodes)===fab&&s.lot.program==='PRODUCTION').length,wip:states.filter(s=>s.event[2]!==5&&lotLocation(s,nodes)===fab).length,transfer:states.filter(s=>isFabTransfer(s,nodes)&&lotLocation(s,nodes)===fab).length}));}
