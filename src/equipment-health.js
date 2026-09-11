// Synthetic maintenance records. Times use the same minute clock as lot history.
export const RECOVERY_CUTOFF=10080;
export const recoveryRanges={DOWN:[12,36],COPM:[4,12],NPM_RF:[24,72],NPM_STAGE:[12,48]};
export function recoveryEstimate(id,code,start){
  let hash=2166136261;for(const c of `${id}|${code}|${start}`)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  const [min,max]=recoveryRanges[code]||recoveryRanges.DOWN,hours=Math.round((min+(hash/4294967295)*(max-min))*10)/10;
  return {hours,upAt:start+hours*60,rangeHours:[min,max],source:'SYNTHETIC_SEEDED_RANDOM',note:'가상 코드별 랜덤 추정 · AI 인폼노트 분석 미연결'};
}
export function equipmentReadyAt(tool,cutoff=RECOVERY_CUTOFF){
  const s=equipmentStatus(tool,cutoff);return s.status==='READY'?cutoff:s.incident?.estimate?Math.max(cutoff+.01,s.incident.estimate.upAt):Infinity;
}
export function equipmentStatus(tool,minute){
  const incident=(tool.maintenance||[]).find(r=>r.start<=minute&&(r.end==null||minute<r.end));
  if(incident&&minute>RECOVERY_CUTOFF&&incident.estimate&&minute>=incident.estimate.upAt)return {status:'READY',incident,simulatedRecovery:true};
  return incident?{status:incident.kind,incident}:{status:tool.availability,incident:null};
}
export function equipmentArea(tool){return ({WET:'CLEAN',CVD:'T/F',PVD:'T/F',IMPL:'DIFF',RTP:'DIFF',MET:'MI'})[tool.type]||tool.type;}
export function downImpact(data,states,minute){
  return data.equipment.filter(e=>['DOWN','PM'].includes(equipmentStatus(e,minute).status)).map(tool=>{
    const lots=states.filter(s=>s.nextNode==null&&[0,1,2,3].includes(s.event[2])&&s.lot.equipmentByStep?.[s.event[1]]===tool.id);
    return {tool,...equipmentStatus(tool,minute),lots,wait:lots.filter(s=>s.event[2]===0).length,interrupted:lots.filter(s=>s.lot.downCause?.[s.event[0]]===tool.id).length,nodes:new Set(lots.map(s=>s.node))};
  });
}
export function seedMaintenance(data,cutoff,stateAt){
  const reasons={'A-ETCH-1':['VACUUM LOW','진공 압력 인터록','진공 누설 및 펌프 상태 점검'], 'B-CVD-1':['RF MATCH FAIL','RF 매칭 이상','RF 계통 진단 및 챔버 점검'], 'A-MET-1':['STAGE ERROR','계측 스테이지 알람','스테이지 정렬 및 반복 정밀도 확인']};
  for(const tool of data.equipment){
    tool.maintenance=[];
    if(tool.availability==='PM'){const start=cutoff;tool.maintenance.push({id:`${tool.id}-COPM`,kind:'PM',code:'COPM',start,end:null,reason:'정기 PM',alarm:'COPM',owner:'설비 보전',updates:[{time:start,status:'정비 진행',note:'정기 챔버 청소 및 소모품 점검 · 가상 인폼노트'}],estimate:recoveryEstimate(tool.id,'COPM',start)});}
    if(tool.role==='backup')tool.maintenance.push({id:`${tool.id}-PM-01`,kind:'PM',start:1440,end:1560,reason:'예방 정비',alarm:'SCHEDULED PM',owner:'설비 보전',updates:[{time:1440,status:'접수',note:'정기 점검 시작'},{time:1500,status:'작업',note:'소모품 교체 및 청소'},{time:1560,status:'복구 승인',note:'점검 및 적격성 확인 완료'}]});
    if(!reasons[tool.id])continue;
    tool.maintenance.push({id:`${tool.id}-DOWN-PREV`,kind:'DOWN',start:-1440,end:-1260,reason:'이전 챔버 인터록 점검',alarm:'INTERLOCK',owner:'설비 보전',updates:[{time:-1440,status:'접수',note:'이상 알람 확인 및 점검 접수'},{time:-1350,status:'정비 완료',note:'센서 점검 및 부품 교체'},{time:-1260,status:'복구 승인',note:'공정 적격성 확인 후 READY 복귀'}]});
    const [alarm,reason,note]=reasons[tool.id];
    const code=tool.id==='B-CVD-1'?'NPM_RF':tool.id==='A-MET-1'?'NPM_STAGE':'DOWN';
    tool.maintenance.push({id:`${tool.id}-DOWN-01`,kind:'DOWN',code,start:cutoff,end:null,reason,alarm,owner:'설비 보전 / 공정기술',updates:[{time:cutoff,status:'접수 / 진단 대기',note}],estimate:recoveryEstimate(tool.id,code,cutoff),restoration:'가상 복구 추정 · 실제 승인 필요'});
    // All demo failures begin at the observation boundary; no fabricated earlier outage.
    for(const lot of data.lots){const s=stateAt(lot,cutoff);if(!s||s.nextNode!=null||![1,2].includes(s.event[2])||lot.equipmentByStep[s.event[1]]!==tool.id)continue;
      lot.events=lot.events.filter(e=>e[0]<cutoff);lot.events.push([cutoff,s.event[1],3]);lot.holdReasons[cutoff]='EQP';lot.downCause={[cutoff]:tool.id};
    }
  }
}
