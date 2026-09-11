import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {enrichDemo,forecastLots} from '../src/fab-analytics.js';

// Synthetic topology and event log. This is not a production process recipe.
let seed = 731029;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const int = (a,b) => a + Math.floor(random() * (b-a+1));
const endTime = Date.parse('2026-09-11T09:00:00+09:00');
const startTime = endTime - 7*86400000;
const minute = 60000;
const stages = ['START','ISOLATION','WELL','GATE','LDD','SOURCE / DRAIN','CONTACT','METAL 1','VIA 1','METAL 2','PASSIVATION','WAFER TEST'];
const steps = [['WET','Pre-clean'],['CVD','Film deposition'],['PHOTO','Pattern exposure'],['ETCH','Pattern etch'],['IMPL','Ion implantation'],['RTP','Activation anneal'],['CMP','Planarization'],['MET','Inspection']];
// Industry-style display names only; this fixture is not a qualified recipe.
const modules=['WAFER','STI','WELL','GATE','LDD','S/D','PLUG','M1','VIA1','M2','PASSIVATION','PAD'];
function operationName(stage,type){
  const module=modules[stage];
  const specific={
    '1:ETCH':'SN ETCH','1:CVD':'STI OX DEP','1:CMP':'STI CMP',
    '3:CVD':'GATE POLY DEP','3:ETCH':'POLY GATE ETCH',
    '6:PHOTO':'PLUG HM','6:CVD':'PLUG HM DEP','6:ETCH':'PLUG ETCH','6:CMP':'W PLUG CMP',
    '7:CVD':'M1 BARRIER DEP','8:ETCH':'VIA ETCH','8:CVD':'VIA LINER DEP',
    '9:CVD':'M2 BARRIER DEP','10:CVD':'PASSIVATION SIN DEP','11:ETCH':'PAD OPEN ETCH'
  };
  const action={WET:'PRE CLEAN',CVD:'OX DEP',PHOTO:'PHOTO',ETCH:'ETCH',IMPL:'IMP',RTP:'RTA',CMP:'CMP',MET:'CD SEM'};
  return specific[`${stage}:${type}`]||`${module} ${action[type]}`;
}
const nodes=[], edges=[], routes=[], lots=[];
const nodeIds = new Map(), edgeIds = new Set();
const addNode = node => {if(nodeIds.has(node.id))return nodeIds.get(node.id);const id=nodes.length;nodeIds.set(node.id,id);nodes.push(node);return id;};
const edge = (source,target,route) => {const key=`${source}:${target}`;if(!edgeIds.has(key)){edges.push({source,target,routes:[route]});edgeIds.add(key);}else edges.find(e=>e.source===source&&e.target===target).routes.push(route);};
for(let r=0;r<24;r++){
  const group=Math.floor(r/4), lane=r%4;
  const route={id:`R${String(r+1).padStart(2,'0')}`,name:`${['LOGIC','DRAM','NAND','CIS'][r%4]} / REV ${Math.floor(r/4)+1}`,group,segments:[],codes:[]};
  for(let code=0;code<5;code++)route.codes.push(`${['LG','DR','NA','CI'][r%4]}${String(r+1).padStart(2,'0')}-${String(code+1).padStart(2,'0')}`);
  route.entryStage=r%4===0?0:r%4;
  route.exitStage=r%5===0?5+(r%5):11-(r%3);
  let previous=null;
  for(let s=route.entryStage;s<=route.exitStage;s++){
    const x=s*420;
    const gate=addNode({id:`G${group}-${s}`,desc:s===0?'INCOMING WAFER INSPECTION':`${modules[s]} DEFECT INSPECTION`,operId:`MET-G${group}-${s}`,stage:s,x,y:group*600+225,z:group*130,kind:'gate'});
    if(previous!==null)edge(previous,gate,r);
    route.segments.push([gate]);previous=gate;
    const count=4+(r+s)%4+(r%3);
    for(let k=0;k<count;k++){
      const [type]=steps[(k+s)%steps.length];
      const n=addNode({id:`${route.id}-${s}-${k}`,desc:operationName(s,type),operId:`${type}-${r+1}-${s+1}-${k+1}`,stage:s,x:x+45+(k+1)*310/(count+1),y:group*600+lane*145,z:group*130+(lane-1.5)*70,kind:'step'});
      edge(previous,n,r);route.segments.push([n]);previous=n;
      if(k===1&&s%3===1){
        const branches=[-1,1].map((side,b)=>addNode({id:`${route.id}-${s}-ALT${b}`,desc:`${modules[s]} ${b?'N2 ANNEAL':'RTA'}`,operId:`ALT-${r+1}-${s+1}-${b}`,stage:s,x:nodes[n].x+8,y:nodes[n].y+side*40,z:nodes[n].z+side*45,kind:'branch'}));
        const merge=addNode({id:`${route.id}-${s}-JOIN`,desc:`${modules[s]} ROUTE MERGE`,operId:`JOIN-${r+1}-${s+1}`,stage:s,x:nodes[n].x+16,y:nodes[n].y,z:nodes[n].z,kind:'merge'});
        branches.forEach(b=>{edge(n,b,r);edge(b,merge,r);});route.segments.push(branches,[merge]);previous=merge;
      }
    }
  }
  const finish=addNode({id:`OUT-${r}`,desc:`${modules[route.exitStage]} ROUTE OUT`,operId:`OUT-${r}`,stage:route.exitStage,x:(route.exitStage+1)*420-12,y:group*600+lane*145,z:0,kind:'exit'});
  edge(previous,finish,r);route.segments.push([finish]);routes.push(route);
}
for(let i=0;i<1800;i++){
  const r=i%routes.length,route=routes[r];
  const path=route.segments.map(options=>options[int(0,options.length-1)]);
  const lot={id:`LOT-${String(i+1).padStart(5,'0')}`,code:route.codes[Math.floor(i/24)%5],route:r,fab:i%7<3?'B':'A',path,events:[]};
  // Each event is [minutes since the beginning of the window, path index, status].
  // 0 wait, 1 job start, 2 proc, 3 hold, 4 job end, 5 fab out.
  let t=int(0,8500);
  for(let p=0;p<path.length;p++){
    if(t>10080)break;
    if(p===path.length-1){lot.events.push([t,p,5]);break;}
    lot.events.push([t,p,0]);
    const stage=nodes[path[p]].stage;
    const congested=(stage===7&&lot.fab==='A')||(stage===4&&lot.fab==='B');
    t+=int(3,22)+(congested?(nodes[path[p]].kind==='gate'?int(600,1800):int(50,150)):0);
    if(random()<(congested?.1:.018)) {if(t<=10080)lot.events.push([t,p,3]);t+=int(120,660);if(t<=10080)lot.events.push([t,p,0]);t+=int(10,40);}
    if(t<=10080)lot.events.push([t,p,1]);t+=2;
    if(t<=10080)lot.events.push([t,p,2]);t+=int(6,32);
    if(t<=10080)lot.events.push([t,p,4]);t+=int(1,3);
    const arrival=t+int(8,24);
    if(t<=10080)lot.events.push([t,p,6,arrival]);
    t=arrival;
  }
  lots.push(lot);
}
// Distinct physical-style layers: routes climb and descend between process areas.
const equipment=[];
const types=['WET','CVD','PHOTO','ETCH','IMPL','RTP','CMP','MET'];
for(const fab of ['A','B'])for(const type of types)for(let n=1;n<=3;n++)equipment.push({id:`${fab}-${type}-${n}`,fab,type,role:n===3?'backup':'primary',availability:n===2&&type==='ETCH'?'PM':'READY'});
for(const node of nodes){
  const type=types.includes(node.operId.split('-')[0])?node.operId.split('-')[0]:(node.kind==='branch'?'RTP':'MET');
  node.layer=(Math.floor(node.stage/2)+types.indexOf(type))%4;
  node.z=node.layer*520;
  node.equipment={};
  for(const fab of ['A','B'])node.equipment[fab]=node.kind==='exit'?{primary:[],backup:[]}:{primary:equipment.filter(e=>e.fab===fab&&e.type===type&&e.role==='primary').map(e=>e.id),backup:equipment.filter(e=>e.fab===fab&&e.type===type&&e.role==='backup').map(e=>e.id)};
}
const data={version:3,synthetic:true,startTime,endTime,stages,statuses:['wait','job start','proc','hold','job end','fab out','move'],equipment,nodes,edges,routes,lots};
const timingRecords=enrichDemo(data);
data.forecast=forecastLots(data);
const target=resolve(import.meta.dirname,'../data/graph_demo.json');
await mkdir(resolve(import.meta.dirname,'../data'),{recursive:true});
await writeFile(target,JSON.stringify(data));
await writeFile(resolve(import.meta.dirname,'../data/job_timing.json'),JSON.stringify({synthetic:true,unit:'minutes from dataset start; sec_per_wafer = elapsed job seconds / WF_QTY',cutoff:10080,records:timingRecords}));
console.log(JSON.stringify({routes:routes.length,codes:routes.flatMap(r=>r.codes).length,lots:lots.length,nodes:nodes.length,edges:edges.length,events:lots.reduce((n,l)=>n+l.events.length,0)}));
