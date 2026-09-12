import {lotState} from './graph-model.js';
import {EventQueue} from './event-queue.js';
import {equipmentStatus,equipmentReadyAt,seedMaintenance} from './equipment-health.js';

export const OBSERVED_END=10080, FORECAST_END=20160;
export function observationMode(minute,cutoff=OBSERVED_END){return minute<cutoff?'PAST':minute>cutoff?'SIMULATION':'LIVE';}
export const holdRules={
  SEND:{label:'SEND · 팹 간 이송 홀드',owner:'생산 / 물류',action:'도착 팹의 인계·반입 상태를 확인하세요. SEND는 이송 완료 시 해제되며 일반 홀드 해제 시간 시나리오 대상에서 제외합니다.'},
  AHSO:{label:'AHSO · Auto Hold Spec Out',owner:'계측 / 공정 / 품질',action:'스펙 이탈 자동 홀드입니다. 측정값과 상·하한 스펙, 반복 이탈 항목, 직전 공정·장비를 확인하세요. 재측정 필요성과 공정·품질 판정을 검토하고 승인 전 실제 홀드를 해제하지 마세요.'},
  SPC:{label:'SPC 이탈',owner:'공정 / 품질',action:'관리도·최근 계측값과 영향 범위를 확인하고 재계측 필요성을 검토하세요. 품질 승인 전 해제하지 마세요.'},
  EQP:{label:'장비 이상',owner:'설비 / 공정',action:'알람·챔버 상태와 직전 처리 이력을 확인하세요. 적격 백업 장비의 상태와 레시피 승인을 검토하세요.'},
  SAMPLE:{label:'샘플 결과 대기',owner:'계측 / 품질',action:'연결된 샘플 랏의 진행과 결과 승인 상태를 확인하세요. 샘플 완료만으로 메인 랏을 자동 해제하지 마세요.'},
  RECIPE:{label:'레시피 확인',owner:'공정기술',action:'라우트 버전·레시피·장비 적격성을 대조하고 담당 엔지니어의 승인을 요청하세요.'}
};
export function equipmentAt(s){return s?.event[2]===5||s?.nextNode!=null?null:s?.lot.equipmentByStep?.[s.event[1]]||null;}
export function holdInfo(s,minute){
  if(s?.event[2]!==3)return null;
  const reason=s.lot.holdReasons?.[s.event[0]],rule=holdRules[reason];
  return {reason:reason||'UNKNOWN',label:rule?.label||'사유 미등록',owner:rule?.owner||'생산 / 품질',action:rule?.action||'홀드 사유와 담당자를 먼저 확인하세요. 자동 해제를 권하지 않습니다.',age:Math.max(0,minute-s.event[0])};
}
export function equipmentRanking(states){
  const groups=new Map();
  for(const s of states){const id=equipmentAt(s);if(!id)continue;const r=groups.get(id)||{id,total:0,wafers:0,wait:0,proc:0,hold:0,main:0,sample:0,nodes:new Set(),activeNodes:new Set()};
    r.total++;r.wafers+=s.lot.WF_QTY||0;r[s.lot.lot_type==='SAMPLE'?'sample':'main']++;
    if(s.event[2]===0)r.wait++;if([1,2].includes(s.event[2])){r.proc++;r.activeNodes.add(s.node);}if(s.event[2]===3)r.hold++;r.nodes.add(s.node);groups.set(id,r);
  }
  return [...groups.values()].sort((a,b)=>b.total-a.total||a.id.localeCompare(b.id));
}
export function holdRanking(states,minute){
  const groups=new Map();
  for(const s of states){const h=holdInfo(s,minute);if(!h)continue;const r=groups.get(s.node)||{node:s.node,total:0,wafers:0,maxAge:0,reasons:{},lots:[]};r.total++;r.wafers+=s.lot.WF_QTY;r.maxAge=Math.max(r.maxAge,h.age);r.reasons[h.reason]=(r.reasons[h.reason]||0)+1;r.lots.push(s);groups.set(s.node,r);}
  return [...groups.values()].sort((a,b)=>b.total-a.total||b.maxAge-a.maxAge||a.node-b.node);
}
export function pairJobs(lot,cutoff=OBSERVED_END){
  const jobs=[],open=new Map();
  for(const event of lot.events){const [t,p,status]=event;if(t>cutoff)break;
    if(status===1)open.set(p,{start:t,interrupted:false});
    if(status===3&&open.has(p))open.get(p).interrupted=true;
    if(status===4&&open.has(p)){const job=open.get(p);open.delete(p);if(!job.interrupted&&t>job.start&&Number.isFinite(lot.WF_QTY)&&lot.WF_QTY>0)jobs.push({lot_id:lot.id,node:lot.path[p],equipment_id:lot.equipmentByStep[p],recipe_id:lot.recipeByStep?.[p]||null,lot_type:lot.lot_type,WF_QTY:lot.WF_QTY,job_start:job.start,job_end:t,duration_min:t-job.start,sec_per_wafer:(t-job.start)*60/lot.WF_QTY});}
  }
  return jobs;
}
const percentile=(values,q)=>{const a=[...values].sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor((a.length-1)*q))];};
export function timingKey(equipment,desc,type){return `${equipment}|${desc}|${type}`;}
export function summarizeJobs(jobs,nodes){
  const groups=new Map();for(const j of jobs){const key=timingKey(j.equipment_id,nodes[j.node].desc,j.lot_type);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(j);}
  return [...groups].map(([key,rows])=>({key,equipment_id:rows[0].equipment_id,oper_desc:nodes[rows[0].node].desc,lot_type:rows[0].lot_type,count:rows.length,median_sec_per_wafer:percentile(rows.map(r=>r.sec_per_wafer),.5),p90_sec_per_wafer:percentile(rows.map(r=>r.sec_per_wafer),.9),weighted_sec_per_wafer:rows.reduce((n,r)=>n+r.duration_min*60,0)/rows.reduce((n,r)=>n+r.WF_QTY,0)}));
}

// Deterministic demo augmentation. Assigned equipment is distinct from eligibility.
// Existing random history was not resource constrained: retain it and explicitly
// provision virtual parallel slots to its observed peak, rather than call it real capacity.
export function enrichDemo(data){
  const ready=new Set(data.equipment.filter(e=>e.role==='primary'&&e.availability==='READY').map(e=>e.id));
  for(const [i,lot] of data.lots.entries()){
    lot.lot_type=i%10===0?'SAMPLE':'MAIN';lot.WF_QTY=lot.lot_type==='SAMPLE'?1+Math.floor(i/10)%5:25-i%4*5;
    const parents=data.lots.filter((other,j)=>j%10!==0&&other.route===lot.route&&other.fab===lot.fab);
    lot.parent_lot_id=lot.lot_type==='SAMPLE'?parents[Math.floor(i/24)%parents.length].id:null;
    lot.sample_lot_ids=[];lot.holdReasons={};
    lot.equipmentByStep=lot.path.map((n,p)=>{const eligible=data.nodes[n].equipment[data.nodes[n].fab||lot.fab].primary.filter(id=>ready.has(id));return eligible.length?eligible[(i+p)%eligible.length]:null;});
    for(const e of lot.events){if(e[4]==='SEND')lot.holdReasons[e[0]]='SEND';else if(e[2]===3)lot.holdReasons[e[0]]=data.nodes[lot.path[e[1]]].operId.startsWith('MET')&&(i+e[1])%3!==0?'AHSO':['SPC','EQP','SAMPLE','RECIPE'][(i+e[1])%4];}
  }
  const byId=new Map(data.lots.map(l=>[l.id,l]));for(const l of data.lots)if(l.parent_lot_id)byId.get(l.parent_lot_id).sample_lot_ids.push(l.id);
  for(const l of data.lots)for(const time of Object.keys(l.holdReasons))if(l.holdReasons[time]==='SAMPLE'&&!l.sample_lot_ids.length)l.holdReasons[time]='SPC';
  seedMaintenance(data,OBSERVED_END,lotState);
  const jobs=data.lots.flatMap(l=>pairJobs(l));data.timingStats=summarizeJobs(jobs,data.nodes);
  for(const e of data.equipment){const marks=jobs.filter(j=>j.equipment_id===e.id).flatMap(j=>[[j.job_start,1],[j.job_end,-1]]);for(const l of data.lots){const s=lotState(l,OBSERVED_END);if(equipmentAt(s)===e.id&&[1,2].includes(s.event[2])){const start=[...l.events].reverse().find(v=>v[1]===s.event[1]&&v[2]===1);if(start)marks.push([start[0],1],[OBSERVED_END+.01,-1]);}}marks.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let active=0,peak=1;for(const [,delta] of marks){active+=delta;peak=Math.max(peak,active);}e.demoSlots=peak;e.name=e.id;}
  data.analytics={observedEnd:OBSERVED_END,forecastEnd:FORECAST_END,syntheticAssignments:true,capacityBasis:'virtual slots = observed peak concurrent jobs; NOT physical capacity',timingRecords:jobs.length};
  return jobs;
}

// Closed-WIP FCFS discrete-event approximation. No new arrivals or new holds;
// Release is a scenario assumption, never an operational authorization.
export function forecastLots(data,{factor=1,holdHours=3,recoveryHours=null}={}){
  if(recoveryHours!==null&&(!Number.isFinite(recoveryHours)||recoveryHours<0||recoveryHours>168))throw new RangeError('recoveryHours must be 0..168 or null');
  if(holdHours!==null&&(!Number.isFinite(holdHours)||holdHours<0||holdHours>168))throw new RangeError('holdHours must be 0..168 or null (no release)');
  const cutoff=OBSERVED_END,horizon=FORECAST_END;
  const stats=new Map(data.timingStats.map(s=>[s.key,s]));
  // Scenario override is remaining time from LIVE, not a rewrite of maintenance history.
  const readyAt=e=>recoveryHours!==null&&equipmentStatus(e,cutoff).status!=='READY'?cutoff+recoveryHours*60:equipmentReadyAt(e,cutoff);
  const slots=new Map(data.equipment.filter(e=>e.role==='primary'&&readyAt(e)<=horizon).map(e=>[e.id,Array(e.demoSlots||1).fill(readyAt(e))]));
  const predictions=data.lots.map(l=>({id:l.id,events:[],equipmentByStep:[...l.equipmentByStep]}));
  const pending=new EventQueue();let fallbackJobs=0;
  const duration=(lot,p,id)=>{const stat=stats.get(timingKey(id,data.nodes[lot.path[p]].desc,lot.lot_type));if(!stat||stat.count<5)fallbackJobs++;return Math.max(3,(stat?.median_sec_per_wafer??60)*lot.WF_QTY/60*factor);};
  const emit=(i,t,p,status,arrival)=>{if(t>cutoff&&t<=horizon){const event=arrival===undefined?[t,p,status]:[t,p,status,arrival];if(status===6&&data.nodes[data.lots[i].path[p]].fab!==data.nodes[data.lots[i].path[p+1]]?.fab)event.push('SEND');predictions[i].events.push(event);}};
  const transfer=(i,p,end)=>{const depart=end+2,arrival=depart+(data.nodes[data.lots[i].path[p]].fab!==data.nodes[data.lots[i].path[p+1]]?.fab?120:16);emit(i,depart,p,6,arrival);if(arrival<=horizon){if(p+1>=data.lots[i].path.length-1)emit(i,arrival,p+1,5);else{emit(i,arrival,p+1,0);pending.push({i,p:p+1,ready:arrival});}}};
  for(const [i,l] of data.lots.entries()){
    const s=lotState(l,cutoff);
    if(!s&&l.plannedRelease!=null){if(l.plannedRelease>cutoff&&l.plannedRelease<=horizon){emit(i,l.plannedRelease,0,0);pending.push({i,p:0,ready:l.plannedRelease});}continue;}
    if(!s||s.event[2]===5)continue;const p=s.event[1],id=l.equipmentByStep[p];
    if(s.event[2]===3){if(holdHours===null)continue;const release=Math.max(cutoff+.01,s.event[0]+holdHours*60);if(release<=horizon){emit(i,release,p,0);pending.push({i,p,ready:release});}continue;}
    if(s.nextNode!==null){const arrival=s.event[3];if(p+1>=l.path.length-1)emit(i,arrival,p+1,5);else{emit(i,arrival,p+1,0);pending.push({i,p:p+1,ready:arrival});}}
    else if([1,2].includes(s.event[2])){if(!slots.has(id))continue;const start=[...l.events].reverse().find(e=>e[1]===p&&e[2]===1)?.[0]??cutoff;const end=Math.max(cutoff+1,start+duration(l,p,id));const lanes=slots.get(id);if(lanes){const k=lanes.indexOf(Math.min(...lanes));lanes[k]=end;}emit(i,end,p,4);transfer(i,p,end);}
    else if(s.event[2]===4)transfer(i,p,cutoff);
    else pending.push({i,p,ready:cutoff+1});
  }
  while(pending.length){const task=pending.pop(),{i,p,ready}=task,l=data.lots[i];
    const eligible=data.nodes[l.path[p]].equipment[data.nodes[l.path[p]].fab||l.fab].primary.filter(id=>slots.has(id));if(!eligible.length)continue;
    let best=null;for(const id of eligible){const lanes=slots.get(id),slot=lanes.indexOf(Math.min(...lanes)),start=Math.max(ready+.01,lanes[slot]);if(!best||start<best.start)best={id,slot,start};}
    predictions[i].equipmentByStep[p]=best.id;if(best.start>horizon)continue;
    const end=best.start+duration(l,p,best.id);slots.get(best.id)[best.slot]=end;
    emit(i,best.start,p,1);emit(i,best.start+Math.min(1,(end-best.start)/2),p,2);emit(i,end,p,4);transfer(i,p,end);
  }
  for(const p of predictions)p.events.sort((a,b)=>a[0]-b[0]);
  return {cutoff,horizon,factor,holdHours,fallbackJobs,predictions,assumptions:['신규 투입·신규 홀드 발생 미모델링',holdHours===null?'현재 홀드 유지':`홀드 발생 후 ${holdHours}시간에 해제 가정 / 이미 초과한 랏은 예측 시작 직후 해제`,'평균 목표를 고정 시간으로 근사 / 코드별 분포 미모델링','모든 코드의 승인 완료를 가정 / 실제 승인·해제 아님','해제 후 동일 공정 WAIT → 전체 JOB 재처리 가정','READY 주 장비만 사용 / 백업 전환 없음','DOWN 평균 24h · COPM 4~12h · 비정기 코드별 가상 복구 / AI 미연결','가상 병렬 슬롯 사용 / 물리 장비 능력 아님','중앙값×WF_QTY / 수율·배치·셋업 미모델링']};
}
