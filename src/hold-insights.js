import {lotState} from './graph-model.js';
import {OBSERVED_END,FORECAST_END} from './fab-analytics.js';
// Occurrence keys preserve route-step identity; repeated events within a hold are one episode.
export function holdHistory(data,lots=data.lots,until=OBSERVED_END){
  const end=Math.min(until,OBSERVED_END),visits=new Map(),groups=new Map();
  for(const lot of lots){const seen=new Set();let open=null;
    const finish=t=>{if(open){open.row.lotHours+=(t-open.start)/60;open=null;}};
    for(const e of lot.events){if(e[0]>end)break;const node=lot.path[e[1]],key=`${lot.id}|${e[1]}`;
      if(!seen.has(key)){seen.add(key);visits.set(node,(visits.get(node)||0)+1);}
      const held=e[2]===3||e[4]==='SEND';
      if(open&&(!held||open.node!==node))finish(e[0]);
      if(!held||open)continue;
      const code=e[4]==='SEND'?'SEND':lot.holdReasons?.[e[0]]||'UNKNOWN',id=`${node}|${code}`;
      const row=groups.get(id)||{node,code,count:0,lotHours:0,affected:new Set(),days:new Set(),open:0};
      row.count++;row.affected.add(key);row.days.add(Math.floor(e[0]/1440));groups.set(id,row);open={node,start:e[0],row};
    }
    if(open){open.row.open++;finish(end);}
  }
  return [...groups.values()].map(r=>({...r,affected:r.affected.size,days:r.days.size,visits:visits.get(r.node)||0,rate:100*r.affected.size/(visits.get(r.node)||1)})).sort((a,b)=>b.lotHours-a.lotHours||b.count-a.count||a.node-b.node);
}
export function forecastMetrics(data,forecast,lots=data.lots){
  const predictions=new Map(forecast.predictions.map(p=>[p.id,p]));let out1=0,out7=0,wip7=0,holdHours=0,wait7=0;
  for(const l of lots){const p=predictions.get(l.id),combined={...l,events:[...l.events,...p.events]},initial=lotState(l,OBSERVED_END);if(!initial)continue;
    const first=lotState(combined,OBSERVED_END+1440),last=lotState(combined,FORECAST_END);
    if(initial.event[2]!==5&&first.event[2]===5)out1++;
    if(initial.event[2]!==5&&last.event[2]===5)out7++;
    if(last.event[2]!==5)wip7++;if(last.event[2]===0)wait7++;
    if(initial.event[2]===3){const release=p.events.find(e=>e[2]!==3);holdHours+=((release?.[0]??FORECAST_END)-OBSERVED_END)/60;}
  }
  return {out1,out7,wip7,wait7,holdHours};
}
