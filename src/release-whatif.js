import {forecastLots,OBSERVED_END,FORECAST_END} from './fab-analytics.js';
import {lotState} from './graph-model.js';
import {compareCapacity} from './capacity-whatif.js';
export function releaseInputs(data,input){
 const count=Number(input.count),days=Number(input.days),wfQty=Number(input.wf_qty??25);
 if(!Number.isInteger(count)||count<0||count>2000)throw Error('투입 수는 0~2,000 LOT 정수로 입력하세요.');
 if(!Number.isFinite(days)||days<1||days>7)throw Error('투입 기간은 1~7일입니다.');
 if(!Number.isInteger(wfQty)||wfQty<1||wfQty>25)throw Error('WF_QTY는 1~25장입니다.');
 const route=data.routes.findIndex(r=>r.id.toUpperCase()===(input.route_id||'').toUpperCase());
 if(route<0)throw Error('유효한 라우트 ID를 선택하세요.');
 return {count,days,wfQty,route,routeId:data.routes[route].id};
}
export function plannedLots(data,config,count,policy){
 const templates=data.lots.filter(l=>l.route===config.route&&l.lot_type==='MAIN');
 if(!templates.length)throw Error('선택 라우트에 MAIN 템플릿이 없습니다.');
 return Array.from({length:count},(_,i)=>{
  const t=templates[i%templates.length],release=OBSERVED_END+1+(policy==='frontload'?0:i/count*(config.days*1440-1));
  return {...t,id:'PLAN-'+String(i+1).padStart(5,'0'),WF_QTY:config.wfQty,events:[],plannedRelease:release,holdReasons:{},downCause:{},sample_lot_ids:[],parent_lot_id:null};
 });
}
function summarize(data,forecast,newIds){
 let completed=0,completedWF=0,newCompleted=0,oldCompleted=0,waitMinutes=0,wip=0;
 const daily=Array.from({length:7},(_,i)=>({day:i+1,completed:0,newCompleted:0,wip:0})),waitByNode=new Map();
 const predictions=new Map(forecast.predictions.map(p=>[p.id,p]));
 for(const l of data.lots){
  const p=predictions.get(l.id),events=[...l.events,...p.events],out=p.events.find(e=>e[2]===5);
  if(out){completed++;completedWF+=l.WF_QTY;if(newIds.has(l.id))newCompleted++;else oldCompleted++;}
  for(let i=0;i<events.length;i++){const e=events[i];if(e[2]!==0)continue;const start=Math.max(OBSERVED_END,e[0]),end=Math.min(FORECAST_END,events[i+1]?.[0]??FORECAST_END);if(end<=start)continue;const duration=end-start;waitMinutes+=duration;const n=l.path[e[1]];waitByNode.set(n,(waitByNode.get(n)||0)+duration);}
  const combined={...l,events};const end=lotState(combined,FORECAST_END);if(end&&end.event[2]!==5)wip++;
  for(const d of daily){const boundary=OBSERVED_END+d.day*1440,s=lotState(combined,boundary);if(out&&out[0]<=boundary){d.completed++;if(newIds.has(l.id))d.newCompleted++;}if(s&&s.event[2]!==5)d.wip++;}
 }
 return {completed,completedWF,newCompleted,oldCompleted,wip,waitLotHours:Math.round(waitMinutes/60),daily,bottlenecks:[...waitByNode].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([node,m])=>({node,operation:data.nodes[node].desc,fab:data.nodes[node].fab,waitLotHours:Math.round(m/60)})),fallbackJobs:forecast.fallbackJobs};
}
export function runReleaseWhatIf(data,input,onProgress=()=>{}){
 const c=releaseInputs(data,input),factor=data.forecast?.factor??1,holdHours=data.forecast?.holdHours??3;
 // Preserve explicit no-release scenario.
 const options={factor,holdHours:data.forecast?.holdHours===null?null:holdHours};
 if(input.mode==='optimization'){
  const planned=plannedLots(data,c,c.count,'uniform'),scenarioData={...data,lots:[...data.lots,...planned]};
  const comparison=compareCapacity(scenarioData,input,options,summarize,new Set(planned.map(l=>l.id)),onProgress);
  return {synthetic:true,mode:'optimization',inputs:input,scope:'7일 / 전체 최신 WIP + 동일 신규 균등 투입 / 맵 변경 없음',...comparison,insights:[comparison.recommendation,...comparison.assumptions]};
 }
 const definitions=[{name:'기준 · 추가 투입 없음',count:0,policy:'uniform'},{name:'요청 물량 · 균등 투입',count:c.count,policy:'uniform'},{name:'요청 물량 · 일괄 투입',count:c.count,policy:'frontload'},{name:'절반 물량 · 균등 투입',count:c.count?Math.max(1,Math.floor(c.count/2)):0,policy:'uniform'}];
 const scenarios=definitions.map((s,i)=>{
  onProgress({done:i,total:definitions.length,name:s.name});
  const planned=s.count?plannedLots(data,c,s.count,s.policy):[],scenarioData={...data,lots:[...data.lots,...planned]};
  return {...s,...summarize(scenarioData,forecastLots(scenarioData,options),new Set(planned.map(l=>l.id)))};
 });
 const baseline=scenarios[0];for(const s of scenarios){s.additionalCompleted=s.completed-baseline.completed;s.existingLotImpact=s.oldCompleted-baseline.oldCompleted;s.extraWip=s.wip-baseline.wip;s.extraWaitLotHours=s.waitLotHours-baseline.waitLotHours;}
 const candidates=scenarios.slice(1),best=[...candidates].sort((a,b)=>b.completed-a.completed||a.waitLotHours-b.waitLotHours||a.count-b.count)[0];
 const requested=scenarios[1],insights=[
  `균등 ${c.count} LOT 추가 투입 시 +7일 완료 ${requested.additionalCompleted>=0?'+':''}${requested.additionalCompleted} LOT, 잔여 WIP +${requested.extraWip} LOT입니다.`,
  `기존 LOT 완료량 영향 ${requested.existingLotImpact} LOT. 신규 LOT 완료 ${requested.newCompleted}/${c.count} LOT입니다.`,
  `비교한 3개 투입안 중 완료 LOT 최대 → 대기 LOT·h 최소 → 투입량 최소 순으로 '${best.name}'가 우선입니다.`,
  requested.additionalCompleted<c.count*.5?'추가 투입 대비 7일 내 완료 증가가 작습니다. 투입량 확대 전에 병목 장비·대기 구간을 확인하세요.':'추가 투입이 완료량 증가로 이어지지만, 잔여 WIP와 기존 LOT 지연을 함께 확인하세요.',
  '유한한 후보 비교이며 생산량의 전역 최적해가 아닙니다. 수율·셋업·배치·비용·품질·납기는 목적함수에 포함하지 않았습니다.'
 ];
 return {synthetic:true,scope:'전체 최신 WIP + 선택 라우트의 신규 MAIN LOT / 화면 필터 무관',cutoff:OBSERVED_END,horizon:FORECAST_END,inputs:{count:c.count,days:c.days,wf_qty:c.wfQty,route_id:c.routeId},assumptions:{...options,capacity:'기존 가상 슬롯 유지 / 물리 장비능력 아님',releases:'균등: 기간 시작부터 마지막 직전까지 / 일괄: LIVE +1분',new_holds:'신규 홀드 발생 미모델링',recipes:'템플릿 레시피 유지 / 처리시간은 기존 통합 모델',confidence:'범위·확률 예측 미지원'},scenarios,recommendation:best.name,insights};
}
