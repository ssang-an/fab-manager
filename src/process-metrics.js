import {pairJobs,OBSERVED_END} from './fab-analytics.js';
import {equipmentStatus} from './equipment-health.js';

// Observed 24-hour window only. Equipment workload includes ALL operations/lots,
// not just the selected operation, to avoid calling shared-tool work idle.
export function processMetrics(data,nodeId,minute){
  const end=Math.min(minute,OBSERVED_END),start=Math.max(0,end-1440),node=data.nodes[nodeId];
  const ids=new Map();for(const [fab,roles] of Object.entries(node.equipment))for(const role of ['primary','backup'])for(const id of roles[role])ids.set(id,{fab,role});
  const tools=data.equipment.filter(e=>ids.has(e.id)).map(e=>{
    const marks=[start,end];for(const m of e.maintenance||[]){if(m.start>start&&m.start<end)marks.push(m.start);if(m.end!=null&&m.end>start&&m.end<end)marks.push(m.end);}
    marks.sort((a,b)=>a-b);const available=[];for(let i=1;i<marks.length;i++)if(equipmentStatus(e,(marks[i-1]+marks[i])/2).status==='READY')available.push([marks[i-1],marks[i]]);
    const ready=available.reduce((n,[a,b])=>n+b-a,0),slots=e.demoSlots||1;
    return {id:e.id,...ids.get(e.id),slots,available,ready,down:end-start-ready,busy:0,capacity:ready*slots};
  }),byTool=new Map(tools.map(t=>[t.id,t])),jobs=[];
  for(const lot of data.lots){
    jobs.push(...pairJobs(lot,end).filter(j=>j.node===nodeId&&j.job_end>start));
    for(let i=0;i<lot.events.length;i++){const e=lot.events[i];if(e[0]>=end)break;if(![1,2].includes(e[2]))continue;
      const tool=byTool.get(lot.equipmentByStep?.[e[1]]);if(!tool)continue;
      const a=Math.max(start,e[0]),b=Math.min(end,lot.events[i+1]?.[0]??end);if(b<=a)continue;
      for(const [x,y] of tool.available)tool.busy+=Math.max(0,Math.min(b,y)-Math.max(a,x));
    }
  }
  for(const t of tools){t.idle=Math.max(0,t.capacity-t.busy);t.util=t.capacity?t.busy/t.capacity*100:null;}
  const primary=tools.filter(t=>t.role==='primary'),capacity=primary.reduce((n,t)=>n+t.capacity,0),busy=primary.reduce((n,t)=>n+t.busy,0),idle=primary.reduce((n,t)=>n+t.idle,0);
  const stats=rows=>({count:rows.length,mean:rows.length?rows.reduce((n,j)=>n+j.duration_min,0)/rows.length:null,secPerWafer:rows.length?rows.reduce((n,j)=>n+j.duration_min*60,0)/rows.reduce((n,j)=>n+j.WF_QTY,0):null});
  return {start,end,tools,util:capacity?busy/capacity*100:null,idle,...stats(jobs),main:stats(jobs.filter(j=>j.lot_type==='MAIN')),sample:stats(jobs.filter(j=>j.lot_type==='SAMPLE'))};
}
