import {forecastLots,timingKey} from './fab-analytics.js';

export function addCapacity(data,nodeIndex,count){
 const node=data.nodes[nodeIndex],ids=node?.equipment?.[node.fab]?.primary||[];
 const donor=data.equipment.find(e=>ids.includes(e.id)&&e.role==='primary');
 if(!donor)throw Error('선택 공정에 증설 기준 주 장비가 없습니다.');
 const additions=Array.from({length:count},(_,i)=>({...donor,id:`SIM-${donor.id}-${i+1}`,demoSlots:1,availability:'READY',maintenance:[]}));
 // Each new virtual tool is dedicated to the selected operation; no eligibility expansion elsewhere.
 const nodes=data.nodes.map(n=>n.fab===node.fab&&n.desc===node.desc&&n.equipment?.[n.fab]?.primary.includes(donor.id)?{...n,equipment:{...n.equipment,[n.fab]:{...n.equipment[n.fab],primary:[...n.equipment[n.fab].primary,...additions.map(e=>e.id)]}}}:n);
 const timingStats=[...data.timingStats,...additions.flatMap(e=>data.timingStats.filter(s=>s.equipment_id===donor.id&&s.oper_desc===node.desc).map(s=>({...s,equipment_id:e.id,key:timingKey(e.id,s.oper_desc,s.lot_type)})))];
 return {data:{...data,nodes,equipment:[...data.equipment,...additions],timingStats},target:{node:nodeIndex,operation:node.desc,fab:node.fab,equipment:donor.id,added:count}};
}

export function compareCapacity(data,input,options,summarize,newIds,onProgress){
 const hours=Number(input.hold_hours??3),recovery=Number(input.recovery_hours??24),max=Number(input.add_tools??2);
 if(!Number.isFinite(hours)||hours<0||hours>168||!Number.isFinite(recovery)||recovery<0||recovery>168)throw Error('홀드/복구 시간은 0~168시간입니다.');
 if(!Number.isInteger(max)||max<1||max>3)throw Error('증설 탐색은 1~3대입니다.');
 const run=(name,d,opts,target=null)=>{onProgress({name});return {name,...summarize(d,forecastLots(d,opts),newIds),target};};
 const base=run('동일 투입 · 현재 가정',data,options);
 const scenarios=[base,run(`홀드 ${hours}h`,data,{...options,holdHours:hours}),run(`DOWN/PM 잔여 ${recovery}h`,data,{...options,recoveryHours:recovery}),run('홀드 + 복구 조합',data,{...options,holdHours:hours,recoveryHours:recovery})];
 let targets;
 if(input.target_node!=null&&input.target_node!==''){
  const n=Number(input.target_node);if(!Number.isInteger(n)||!data.nodes[n])throw Error('유효한 공정을 선택하세요.');targets=[n];
 }else{
  const seen=new Set();targets=base.bottlenecks.filter(b=>{const key=b.fab+'|'+b.operation;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,3).map(b=>b.node);
 }
 for(const n of targets)for(let count=1;count<=max;count++){
  const expanded=addCapacity(data,n,count),t=expanded.target;
  scenarios.push(run(`${t.fab} ${t.operation} · ${t.equipment} 동등 +${count}대`,expanded.data,options,t));
 }
 const rank=(a,b)=>b.completed-a.completed||a.waitLotHours-b.waitLotHours||(a.target?.added||0)-(b.target?.added||0);
 for(const s of scenarios){s.completedGain=s.completed-base.completed;s.waitSaved=base.waitLotHours-s.waitLotHours;}
 const capacities=scenarios.filter(s=>s.target).sort(rank),best=capacities.find(s=>s.completedGain>0||(s.completedGain===0&&s.waitSaved>0));
 if(best){const expanded=addCapacity(data,best.target.node,best.target.added);const combined=run('추천 증설 + 홀드 + 복구',expanded.data,{...options,holdHours:hours,recoveryHours:recovery},best.target);combined.completedGain=combined.completed-base.completed;combined.waitSaved=base.waitLotHours-combined.waitLotHours;scenarios.push(combined);}
 return {scenarios,recommendation:best?`${best.name}: 완료 ${best.completedGain>=0?'+':''}${best.completedGain} LOT, 대기 ${best.waitSaved} LOT·h 감소. 검토 후보입니다.`:'탐색한 증설 후보에서 개선 효과가 없습니다. 증설보다 홀드·복구 조건을 먼저 검토하세요.',assumptions:['모든 안은 동일 신규 투입량·균등 일정이며 기존 WIP 전체를 포함합니다.','홀드는 발생 후 목표시간, DOWN/PM은 LIVE부터 남은 시간으로 전체 비가동 주 장비에 적용합니다. SEND 이동시간은 변경하지 않습니다.','추가 1대 = 전용 가상 슬롯 1개, LIVE 즉시 가동. 선택 공정의 첫 적격 주 장비 처리시간을 복제합니다. 실제 장비 대수 환산은 검증이 필요합니다.','자동 탐색: 기준 대기 상위 공정 중 최대 3곳 × 1~설정 대수. 완료 LOT 우선, 대기시간 다음. 전역 최적화·투자비 ROI가 아닙니다.','레시피 적격성·설치기간·수율·신규 고장/홀드·셋업/배치 제약 미반영. 실제 홀드 해제 및 장비 변경은 수행하지 않습니다.']};
}
