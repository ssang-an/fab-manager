import {lotState} from './graph-model.js';
import {pairJobs,OBSERVED_END,FORECAST_END} from './fab-analytics.js';
import {equipmentStatus} from './equipment-health.js';
export const questionExamples=[
 '기존 WIP만 홀드 1시간, 복구 12시간, 증설 2대 비교해줘',
 '앞으로 3일 동안 R01 100개 랏 투입하면 어떻게 될까?',
 'LOT1231 관심 등록',
 '관심 LOT 목록',
 '필터 저장 내 업무',
 '필터 불러오기 내 업무',
 'LOT1231, LOT1203 진행 플랜이랑 레시피/진행장비 다른거 분석해줘',
 'LOT1231 PLUG ETCH 언제 도착할까?',
 'LOT1231 예상 팹아웃 일정은?',
 'LOT1231 진행 플랜 알려줘',
 'LOT1231 MAIN SAMPLE 관계 알려줘',
 '문제 LOT 분석해줘',
 '장기 SEND 분석해줘',
 '레시피별 처리시간 분석해줘',
 '장비 DOWN 영향 분석해줘',
 '데이터 정합성 점검해줘'
];
export const normalizeLot=id=>/^LOT-?\d+$/i.test(id)?'LOT-'+id.replace(/\D/g,'').padStart(5,'0'):id.toUpperCase();
export function engineeringRequest(text){
 const ids=[...new Set((text.match(/LOT-?\d+/gi)||[]).map(normalizeLot))];
 if(ids.length>1&&/비교|다른|차이|분석/.test(text))return {kind:'compare',lot_ids:ids};
 if(ids.length&&/도착|언제|일정|ETA|팹아웃|FAB\s*OUT/i.test(text)){
  const target=text.replace(/LOT-?\d+/gi,'').replace(/예상|언제즘|언제쯤|언제|도착할까|도착|일정은|일정|알려줘|까지|공정|진행|\?|은\s*$/g,' ').trim();
  return {kind:'eta',lot_ids:ids,target:/팹아웃|FAB\s*OUT/i.test(text)?'FAB OUT':target};
 }
 if(ids.length&&/MAIN|SAMPLE|샘플|부모|계보/i.test(text))return {kind:'dependencies',lot_ids:ids};
 if(ids.length&&/플랜|계획|레시피|장비|진행|분석/.test(text))return {kind:'plan',lot_ids:ids};
 if(/데이터.*(정합|점검|누락)/.test(text))return {kind:'quality'};
 if(/레시피.*(시간|통계)/.test(text))return {kind:'recipe_stats'};
 if(/장비.*(DOWN|다운).*?(영향|분석)/i.test(text))return {kind:'down'};
 if(/SEND.*(분석|장기)|장기.*SEND/i.test(text))return {kind:'send'};
 if(/문제.*(LOT|랏)|장기.*대기/i.test(text))return {kind:'issues'};
 return null;
}
export function analyzeEngineering(data,args,minute=OBSERVED_END,scopeLots=data.lots){
 const format=m=>m==null?null:new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(data.startTime+m*60000)+' KST';
 const predictions=new Map((data.forecast?.predictions||[]).map(p=>[p.id,p]));
 const merged=l=>({...l,events:[...l.events,...(predictions.get(l.id)?.events||[])],equipmentByStep:predictions.get(l.id)?.equipmentByStep||l.equipmentByStep});
 const at=l=>lotState(minute>OBSERVED_END?merged(l):l,minute);
 const requested=(args.lot_ids||[]).map(id=>{const lot=data.lots.find(l=>l.id===normalizeLot(id));if(!lot)throw Error(id+': 존재하지 않는 LOT입니다.');return lot;});
 const rowsFor=l=>{
  const seen=new Map(),state=at(l),future=predictions.get(l.id);
  return l.path.map((n,p)=>{const node=data.nodes[n],occurrence=(seen.get(node.desc)||0)+1;seen.set(node.desc,occurrence);
   return {step:p+1,node:n,oper_id:node.operId,oper_desc:node.desc,occurrence,fab:node.fab,recipe_id:l.recipeByStep?.[p]||null,assigned_equipment:l.equipmentByStep?.[p]||null,forecast_equipment:future?.equipmentByStep[p]||null,state:!state?'미투입':p<state.event[1]?'통과':p===state.event[1]?data.statuses[state.event[2]]:'예정'};
  });
 };
 const base={synthetic:true,as_of:format(minute),scope:requested.length?'explicit_lots':'current_lot_filters',forecast_basis:format(OBSERVED_END),limitations:['가상 데이터이며 실제 실행·승인 아님','예측은 최신 관측 기준, 신규 투입 없음','ETA 범위·신뢰구간은 아직 산출하지 않음']};
 if(['plan','compare','eta','dependencies'].includes(args.kind)&&!requested.length)throw Error('LOT ID가 필요합니다.');
 if(args.kind==='plan')return {...base,kind:args.kind,lots:requested.map(l=>({lot_id:l.id,lot_code:l.code,wf_qty:l.WF_QTY,route:data.routes[l.route].id,steps:rowsFor(l)}))};
 if(args.kind==='compare'){
  if(requested.length!==2)throw Error('계획 비교는 LOT 2개를 지정하세요.');
  const [a,b]=requested.map(rowsFor),key=r=>r.oper_desc+'#'+r.occurrence,bmap=new Map(b.map(r=>[key(r),r])),amap=new Map(a.map(r=>[key(r),r]));
  const differences=[...new Set([...amap.keys(),...bmap.keys()])].flatMap(k=>{const left=amap.get(k),right=bmap.get(k),fields=!left||!right?['route_membership']:['step','fab','recipe_id','assigned_equipment','forecast_equipment'].filter(f=>left[f]!==right[f]);return fields.length?[{operation:k,fields,left:left||null,right:right||null}]:[];});
  return {...base,kind:args.kind,lot_ids:requested.map(l=>l.id),step_counts:[a.length,b.length],alignment:'공정명 + 경로 내 방문 차수 (의미상 동일 공정 보장 아님)',differences};
 }
 if(args.kind==='eta'){
  if(minute<OBSERVED_END)return {...base,kind:args.kind,unavailable:'과거 시점 기준 예측 모델은 없습니다. LIVE에서 조회하세요.'};
  const target=(args.target||'FAB OUT').trim().toUpperCase();
  return {...base,kind:args.kind,target,lots:requested.map(l=>{
   const all=merged(l),state=at(l),steps=rowsFor(l),matches=target==='FAB OUT'?[steps.at(-1)]:steps.filter(r=>r.oper_id.toUpperCase()===target||r.oper_desc.toUpperCase()===target);
   if(!matches.length)return {lot_id:l.id,status:'공정 없음 또는 이름 불명확',available_operations:[...new Set(steps.map(r=>r.oper_desc))]};
   return {lot_id:l.id,arrivals:matches.map(r=>{
    const p=r.step-1,events=all.events.filter(e=>e[1]===p&&(target==='FAB OUT'?e[2]===5:e[2]!==6));
    const arrival=events[0]?.[0]??null,jobStart=events.find(e=>e[2]===1)?.[0]??null;
    return {...r,arrival:format(arrival),job_start:format(jobStart),minutes_from_now:arrival==null?null:Math.round(arrival-minute),basis:arrival==null?'예측 구간 내 도달 미산출':arrival<=OBSERVED_END?'관측':'예측',passed:arrival!=null&&arrival<=minute,current_step:state?.event[1]+1||null,horizon:format(FORECAST_END)};
   })};
  })};
 }
 if(args.kind==='dependencies')return {...base,kind:args.kind,lots:requested.map(l=>({lot_id:l.id,parent:l.parent_lot_id,samples:(l.sample_lot_ids||[]).map(id=>{const other=data.lots.find(x=>x.id===id),s=at(other);return {lot_id:id,status:s?data.statuses[s.event[2]]:'미투입'};}),approval:'측정값·승인 데이터 없음. SAMPLE 완료는 승인으로 간주하지 않음',split_genealogy:'실제 SPLIT 이력 미연결'}))};
 const states=scopeLots.map(at).filter(Boolean);
 if(args.kind==='issues'||args.kind==='send'){
  const rows=states.flatMap(s=>{const age=minute-s.event[0],status=s.event[2],reason=status===3?'HOLD':status===0&&age>=360?'WAIT_6H':s.holdCode==='SEND'&&age>=180?'SEND_3H':null;if(!reason||args.kind==='send'&&reason!=='SEND_3H')return [];return [{lot_id:s.lot.id,lot_code:s.lot.code,operation:data.nodes[s.node].desc,reason,hold_code:s.holdCode,age_hours:Math.round(age/6)/10,wf_qty:s.lot.WF_QTY,action:reason==='HOLD'?'홀드 코드·담당자·해제 승인 조건 확인':reason==='SEND_3H'?'출고·운송·입고 확인':'적격 장비 상태 및 지정 큐 확인'}];}).sort((a,b)=>b.age_hours-a.age_hours);
  return {...base,kind:args.kind,total:rows.length,returned:Math.min(rows.length,100),ranking:'상태 체류시간 내림차순 / 병목 인과 점수 아님',rows:rows.slice(0,100)};
 }
 if(args.kind==='down')return {...base,kind:args.kind,equipment:data.equipment.flatMap(tool=>{const health=equipmentStatus(tool,minute);if(!['DOWN','PM'].includes(health.status))return [];const lots=states.filter(s=>s.event[2]!==5&&s.nextNode==null&&s.lot.equipmentByStep?.[s.event[1]]===tool.id);return [{equipment_id:tool.id,status:health.status,code:health.incident?.code,estimated_up:format(health.incident?.estimate?.upAt),assigned_lots:lots.length,wait:lots.filter(s=>s.event[2]===0).length,hold:lots.filter(s=>s.event[2]===3).length,causality:'지정 큐 노출량, 모든 홀드가 DOWN 원인이라는 의미 아님'}];}).sort((a,b)=>b.assigned_lots-a.assigned_lots)};
 if(args.kind==='recipe_stats'){
  const groups=new Map();for(const l of scopeLots)for(const j of pairJobs(l,Math.min(minute,OBSERVED_END))){const k=[j.recipe_id,j.equipment_id,j.lot_type].join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(j);}
  const rows=[...groups.values()].map(jobs=>({recipe_id:jobs[0].recipe_id,equipment_id:jobs[0].equipment_id,lot_type:jobs[0].lot_type,jobs:jobs.length,mean_minutes:jobs.reduce((a,j)=>a+j.duration_min,0)/jobs.length,sec_per_wafer:jobs.reduce((a,j)=>a+j.duration_min*60,0)/jobs.reduce((a,j)=>a+j.WF_QTY,0)})).sort((a,b)=>b.jobs-a.jobs);
  return {...base,kind:args.kind,total:rows.length,rows:rows.slice(0,100),forecast_note:'레시피별 관측 통계이며 기존 예측 엔진은 아직 레시피 통합 모델'};
 }
 if(args.kind==='quality'){
  let reversed=0,duplicates=0,missingRecipes=0;for(const l of scopeLots){const seen=new Set();for(let i=0;i<l.events.length;i++){const e=l.events[i];if(i&&e[0]<l.events[i-1][0])reversed++;const key=JSON.stringify(e);if(seen.has(key))duplicates++;seen.add(key);if(e[2]===1&&!l.recipeByStep?.[e[1]])missingRecipes++;}}
  return {...base,kind:args.kind,checked_lots:scopeLots.length,reversed_events:reversed,duplicate_events:duplicates,job_start_without_recipe:missingRecipes,connection:'샘플 파일 / MES 수신시각·지연 측정 불가'};
 }
 throw Error('지원하지 않는 분석 종류');
}
export function engineeringAnswer(result){
 const head='[샘플 분석] '+result.as_of+'\n';
 if(result.unavailable)return head+result.unavailable;
 if(result.kind==='compare')return head+result.lot_ids.join(' ↔ ')+'\n스텝 수: '+result.step_counts.join(' / ')+'\n차이 '+result.differences.length+'건 · '+result.alignment+'\n'+result.differences.slice(0,12).map(d=>d.operation+'\n  '+d.fields.map(f=>f+': '+(d.left?.[f]??'없음')+' → '+(d.right?.[f]??'없음')).join('\n  ')).join('\n')+(result.differences.length>12?'\n나머지는 분석 결과 JSON 다운로드에서 확인하세요.':'');
 if(result.kind==='eta')return head+result.lots.map(l=>l.lot_id+'\n'+(l.arrivals?l.arrivals.map(r=>r.oper_desc+' #'+r.step+' · '+r.basis+'\n도착: '+(r.arrival||'7일 구간 내 미산출')+'\nJOB START: '+(r.job_start||'없음')+(r.passed?' · 이미 도달':'')).join('\n'):l.status+'\n후보: '+l.available_operations.join(', '))).join('\n')+'\n예측은 현재 해제·복구 가정에 따르며 확정 일정이 아닙니다.';
 if(result.kind==='plan')return head+result.lots.map(l=>l.lot_id+' / '+l.route+' / '+l.wf_qty+' WF\n'+l.steps.slice(0,12).map(r=>r.step+'. '+r.oper_desc+' · '+r.state+'\n'+(r.recipe_id||'레시피 없음')+' / '+(r.assigned_equipment||'장비 없음')).join('\n')+'\n전체 플랜은 분석 결과 JSON 다운로드에서 확인하세요.').join('\n');
 if(result.kind==='issues'||result.kind==='send')return head+'문제 LOT '+result.total+'개 · '+result.ranking+'\n'+result.rows.slice(0,15).map(r=>r.lot_id+' / '+r.operation+' / '+r.reason+' '+r.age_hours+'h\n'+r.action).join('\n')+'\n목록은 현재 LOT 필터 기준이며 전체 반환 결과는 JSON 다운로드에서 확인하세요.';
 if(result.kind==='down')return head+result.equipment.map(r=>r.equipment_id+' · '+r.status+' / '+r.code+'\n지정 '+r.assigned_lots+' LOT · 대기 '+r.wait+' / 홀드 '+r.hold+'\n가상 복구 예정 '+(r.estimated_up||'미정')).join('\n')+'\n지정 재공 전체가 DOWN 원인이라는 의미는 아닙니다.';
 if(result.kind==='recipe_stats')return head+'레시피 × 장비 × LOT 유형 '+result.total+'개 그룹\n'+result.rows.slice(0,10).map(r=>r.recipe_id+'\n'+r.equipment_id+' / '+r.lot_type+' / '+r.jobs+' JOB\n평균 '+r.mean_minutes.toFixed(1)+'분 · '+r.sec_per_wafer.toFixed(1)+'초/WF').join('\n')+'\n'+result.forecast_note;
 return head+JSON.stringify(result,null,2);
}
