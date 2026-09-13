import {equipmentRanking,holdRanking,holdInfo,pairJobs,OBSERVED_END,FORECAST_END,holdRules,timingKey,observationMode} from './fab-analytics.js';
import {createHealthUI} from './equipment-health-ui.js';
import {createHoldInsights} from './hold-insights-ui.js';
import {holdHistory} from './hold-insights.js';
import {processMetrics} from './process-metrics.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1});
export function createAnalyticsUI(api){
  const $=s=>document.querySelector(s);let mode='process',eqQuery='';
  $('#wip-ranking').insertAdjacentHTML('afterend','<div id="area-equipment-ranking" hidden></div>');
  const phaseStyle=document.createElement('link');phaseStyle.rel='stylesheet';phaseStyle.href='/src/phase-frame.css';document.head.append(phaseStyle);
  $('#canvas-area').insertAdjacentHTML('beforeend','<div id="phase-frame" aria-hidden="true"></div>');
  $('#latest').textContent='LIVE로 ↗';$('#latest').title='샘플 데이터의 최신 관측 시점으로 이동 (실시간 MES 미연결)';
  $('.wip-panel .sidebar-heading').innerHTML='WIP RANKING <select id="rank-mode" aria-label="WIP 랭킹 기준"><option value="process">공정</option><option value="equipment">장비</option><option value="hold">홀드</option></select>';
  $('.toolbar').insertAdjacentHTML('beforeend','<div class="equipment-search"><input id="equipment-search" list="equipment-options" placeholder="장비 검색 · M10-ETCH-1" aria-label="장비명 검색"><datalist id="equipment-options"></datalist><button id="clear-equipment" aria-label="장비 검색 해제">×</button></div><button id="analysis-toggle" aria-expanded="false">분석 / 예측</button>');
  $('#canvas-area').insertAdjacentHTML('beforeend','<div id="equipment-match" hidden></div><div id="forecast-banner" hidden>FORECAST · 관측 종료 이후의 모의 예측</div><aside id="analytics-panel" hidden aria-label="팹 분석과 예측"><button id="analysis-close" aria-label="분석 닫기">×</button><h2>FAB INSIGHTS</h2><div id="analysis-content"></div></aside>');
  $('.scrubber').insertAdjacentHTML('beforeend','<div class="forecast-axis"><span>이력 7일</span><button id="observed-boundary">관측 종료 │ 예측 시작</button><span>예측 +7일</span></div>');
  $('#time').max=String(FORECAST_END);$('#time').classList.add('forecast-range');
  $('#speed').insertAdjacentHTML('beforeend','<option value="720">12시간 / 초</option>');
  $('.legend').insertAdjacentHTML('beforeend','<span class="sample-key">□ SAMPLE</span>');
  $('#rank-mode').onchange=e=>{mode=e.target.value;api.refresh();};
  $('#equipment-search').oninput=e=>{eqQuery=e.target.value.trim().toUpperCase();api.refresh();if(matches().length===1)api.focusEquipment(matches()[0].id);};
  $('#clear-equipment').onclick=()=>{eqQuery='';$('#equipment-search').value='';api.refresh();};
  const show=()=>{$('#analytics-panel').hidden=false;$('#inspector').hidden=true;$('#maintenance-panel').hidden=true;$('#analysis-toggle').setAttribute('aria-expanded','true');update();};
  $('#analysis-toggle').onclick=()=>{$('#analytics-panel').hidden?show():close();};
  const close=()=>{$('#analytics-panel').hidden=true;$('#analysis-toggle').setAttribute('aria-expanded','false');};$('#analysis-close').onclick=close;
  $('#observed-boundary').onclick=()=>api.seek(OBSERVED_END);
  const healthUI=createHealthUI(api),holdInsights=createHoldInsights(api);
  function selectEquipment(id){eqQuery=id;$('#equipment-search').value=id;show();api.refresh();api.focusEquipment(id);}
  function matches(){const {data}=api.context();return eqQuery?data.equipment.filter(e=>`${e.id} ${e.name}`.toUpperCase().includes(eqQuery)):[];}
  function activeNodes(){const {states}=api.context(),ids=new Set(matches().map(e=>e.id));return new Set(equipmentRanking(states).filter(r=>ids.has(r.id)).flatMap(r=>[...r.activeNodes]));}
  function update(){
    const {data,states,minute,lots,forecast}=api.context();if(!data)return;
    healthUI.update();
    if(!$('#equipment-options').children.length)$('#equipment-options').innerHTML=data.equipment.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
    const predicted=minute>OBSERVED_END;$('#canvas-area').classList.toggle('forecast-view',predicted);$('#forecast-banner').hidden=!predicted;
    $('#forecast-banner').textContent=`SIMULATION +${fmt((minute-OBSERVED_END)/1440)}일 · ${forecast.factor===1?'기준':forecast.factor<1?'처리시간 −20%':'처리시간 +25%'} · HOLD ${forecast.holdHours===null?'미해제':forecast.holdHours+'h'} · 실측 아님`;
    const phase=observationMode(minute),explanation=phase==='LIVE'?'최신 샘플 관측 · 실시간 MES 미연결':phase==='PAST'?'과거 이력 조회 · 샘플 데이터':'가정 기반 미래 시뮬레이션 · 실측 아님';
    const badge=$('#mode');badge.textContent=phase;badge.dataset.phase=phase;badge.title=explanation;
    $('#canvas-area').dataset.phase=phase;
    const liveButton=$('#latest');liveButton.dataset.live=String(phase==='LIVE');liveButton.setAttribute('aria-pressed',String(phase==='LIVE'));liveButton.textContent=phase==='LIVE'?'LIVE':'LIVE로';liveButton.title=phase==='LIVE'?'최신 샘플 관측 상태 · 실시간 MES 미연결':'최신 관측 시점으로 이동';
    $('.eyebrow').textContent=`${phase} / ${explanation}`;
    $('#end-label').textContent=api.format(FORECAST_END);$('.scrubber>div:not(.forecast-axis)>span:nth-child(2)').textContent='14 DAYS / KST';
    const {areaLayer,areaName}=api.context(),areaStates=states.filter(s=>areaLayer==null||data.nodes[s.node].layer===areaLayer);
    const eq=equipmentRanking(areaStates),holds=holdRanking(areaStates,minute),resident=states.filter(s=>s.event[2]!==5),waitMain=resident.filter(s=>s.lot.lot_type==='MAIN'&&s.event[2]===0),sample=resident.filter(s=>s.lot.lot_type==='SAMPLE');
    const areaEquipment=$('#area-equipment-ranking');areaEquipment.hidden=areaLayer==null||mode==='equipment';
    if(!areaEquipment.hidden){areaEquipment.innerHTML=`<p>${esc(areaName)} · 장비 WIP TOP 3</p>`+eq.slice(0,3).map((r,i)=>`<button data-area-eqp="${esc(r.id)}"><b>${i+1}</b><span>${esc(r.id)}<small>대기 ${r.wait} · 진행 ${r.proc} · 홀드 ${r.hold}</small></span><strong>${r.total}</strong></button>`).join('');if(!eq.length)areaEquipment.insertAdjacentHTML('beforeend','<p>배정 재공 없음</p>');areaEquipment.querySelectorAll('button').forEach(b=>b.onclick=()=>selectEquipment(b.dataset.areaEqp));}
    if(mode!=='process'){
      const rows=mode==='equipment'?eq:holds;
      $('#wip-ranking').innerHTML=rows.slice(0,5).map((r,i)=>`<button ${mode==='equipment'?`data-eqp="${esc(r.id)}"`:`data-hold-node="${r.node}"`}><b>${i+1}</b><span>${esc(mode==='equipment'?r.id:data.nodes[r.node].desc)}<small>${mode==='equipment'?`대기 ${r.wait} · 진행 ${r.proc} · 홀드 ${r.hold}`:`최장 ${fmt(r.maxAge/60)}h · ${fmt(r.wafers)} WF`}</small></span><strong>${r.total}</strong></button>`).join('')||'<p>해당 시점·필터에 재공이 없습니다.</p>';
      $('#wip-ranking').querySelectorAll('[data-eqp]').forEach(b=>b.onclick=()=>selectEquipment(b.dataset.eqp));$('#wip-ranking').querySelectorAll('[data-hold-node]').forEach(b=>b.onclick=()=>{close();api.selectNode(+b.dataset.holdNode);});
    }
    const matching=matches(),selectedRows=eq.filter(r=>matching.some(e=>e.id===r.id)),active=activeNodes();
    $('#equipment-match').hidden=!eqQuery;$('#equipment-match').textContent=matching.length?`${matching.map(e=>e.id).join(', ')} · 진행 공정 ${active.size}개 강조 · 대기 ${selectedRows.reduce((n,r)=>n+r.wait,0)} LOT · ${predicted?'예측 배정':'샘플 배정'}`:'일치하는 장비가 없습니다.';
    if($('#analytics-panel').hidden)return;
    const content=$('#analysis-content'),scroll=$('#analytics-panel').scrollTop;
    content.innerHTML=`<p class="analysis-note">현재 시점·FAB·라우트·랏 필터 기준. 장비 검색은 진행 공정 강조용입니다.</p><div class="insight-numbers"><span>MAIN 대기<strong>${waitMain.length}</strong></span><span>SAMPLE 재공<strong>${sample.length}</strong></span><span>재공 WF<strong>${fmt(resident.reduce((n,s)=>n+s.lot.WF_QTY,0))}</strong></span><span>HOLD WF<strong>${fmt(holds.reduce((n,r)=>n+r.wafers,0))}</strong></span></div>
      <section id="hold-insights"></section><h3>장비 재공 / ${predicted?'예측':'샘플 배정'}</h3><p class="analysis-note">이동 제외. 대기는 지정 큐, 진행은 JOB START/PROC. 적격 장비 목록을 중복 집계하지 않습니다.</p>${(eqQuery?selectedRows:eq.slice(0,5)).map(r=>`<button class="insight-row" data-eqp="${r.id}"><strong>${r.id} · ${r.total} LOT / ${r.wafers} WF</strong><small>MAIN ${r.main} · SAMPLE ${r.sample} · 대기 ${r.wait} · 진행 ${r.proc} · HOLD ${r.hold}<br>가상 병렬 슬롯 ${data.equipment.find(e=>e.id===r.id)?.demoSlots||1} · 물리 장비 능력 아님</small></button>`).join('')||'<p>진행·대기 중인 랏이 없습니다.</p>'}
      ${eqQuery?`<h3>검색 장비 진행 공정</h3>${[...active].map(n=>`<button class="insight-row" data-node="${n}">${esc(data.nodes[n].desc)}<small>${esc(data.nodes[n].operId)}</small></button>`).join('')||'<p>현재 진행 공정 없음 · 적격 공정을 진행 중으로 표시하지 않습니다.</p>'}`:''}
      <h3>홀드 집중 / 검토 액션</h3><p class="analysis-note">사유 기반 규칙 제안입니다. 자동 해제·장비 전환은 하지 않습니다.</p>${holds.slice(0,4).map(r=>{const reason=Object.entries(r.reasons).sort((a,b)=>b[1]-a[1])[0][0],rule=holdRules[reason];return `<article class="hold-insight"><button data-node="${r.node}">${esc(data.nodes[r.node].desc)} · ${r.total} LOT</button><small>최장 ${fmt(r.maxAge/60)}h · ${r.wafers} WF · ${esc(rule?.owner||'담당자 확인')}</small><p>${esc(rule?.label||reason)}: ${esc(rule?.action||'홀드 사유 확인')}</p></article>`;}).join('')||'<p>현재 홀드 없음</p>'}
      <h3>장기 대기 / 우선 확인</h3>${waitMain.slice().sort((a,b)=>a.event[0]-b.event[0]).slice(0,3).map(s=>`<button class="insight-row" data-lot="${s.lot.id}">${s.lot.id} · ${fmt((minute-s.event[0])/60)}h<small>${esc(data.nodes[s.node].desc)} · ${s.lot.WF_QTY} WF</small></button>`).join('')||'<p>MAIN 대기 없음</p>'}
      <h3>JOB 시간 / WF_QTY</h3><p>${data.analytics.timingRecords.toLocaleString()}개 완료 JOB 저장<br><a href="/data/job_timing.json" download>JOB별 정규화 처리시간 다운로드</a></p><p class="analysis-note">(JOB END − JOB START) ÷ WF_QTY. 홀드 중단·미완료 JOB 제외. MAIN/SAMPLE·장비·공정명별 중앙값/P90 분리. 통계 학습 기준: ${api.format(OBSERVED_END)}.</p>
      <h3>7일 재공 소진 시뮬레이션</h3><label class="scenario-label">처리시간 가정<select id="forecast-scenario"><option value="1" ${forecast.factor===1?'selected':''}>기준 중앙값</option><option value="0.8" ${forecast.factor===.8?'selected':''}>−20% 빠른 처리</option><option value="1.25" ${forecast.factor===1.25?'selected':''}>+25% 느린 처리</option></select></label><p class="analysis-note">민감도 시나리오이며 신뢰구간이 아닙니다. 표본 5개 미만/미등록 경로 ${forecast.fallbackJobs} JOB: 저표본 중앙값 또는 60초/WF 가정.</p><div class="forecast-days">${[1,3,7].map(day=>{const ss=lots.map(l=>api.stateAt(l,OBSERVED_END+day*1440)).filter(Boolean),wip=ss.filter(s=>s.event[2]!==5);return `<button data-day="${day}">+${day}일<strong>${wip.length} WIP</strong><small>${wip.filter(s=>s.event[2]===3).length} HOLD</small></button>`;}).join('')}</div><ul class="forecast-assumptions">${forecast.assumptions.map(a=>`<li>${esc(a)}</li>`).join('')}</ul><p class="analysis-note">홀드 해제는 가정이며 향후 유입·고장 계획이 없으므로 실제 생산 예보로 사용하지 마세요.</p>`;
    content.querySelectorAll('[data-eqp]').forEach(b=>b.onclick=()=>selectEquipment(b.dataset.eqp));content.querySelectorAll('[data-node]').forEach(b=>b.onclick=()=>{close();api.selectNode(+b.dataset.node);});content.querySelectorAll('[data-lot]').forEach(b=>b.onclick=()=>{close();api.selectLot(b.dataset.lot);});content.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>api.seek(OBSERVED_END+Number(b.dataset.day)*1440));$('#forecast-scenario').onchange=e=>api.scenario(Number(e.target.value));$('#analytics-panel').scrollTop=scroll;
    holdInsights.render($('#hold-insights'));
  }
  function appendDetail(selected){
    const {data,states,minute}=api.context(),detail=$('#detail');if(!selected||!detail)return;
    detail.querySelector('.extended-detail')?.remove();let html='';
    if(selected.type==='node'){
      const here=states.filter(s=>s.node===selected.id&&s.event[2]!==5&&s.nextNode===null),samples=here.filter(s=>s.lot.lot_type==='SAMPLE'),main=here.filter(s=>s.lot.lot_type==='MAIN'&&s.event[2]===0);
      html=`<h3>MAIN 대기 ${main.length} · SAMPLE ${samples.length}</h3><p>공정 재공 ${here.reduce((n,s)=>n+s.lot.WF_QTY,0)} WF</p>${samples.map(s=>`<button class="insight-row" data-related="${s.lot.id}">□ ${s.lot.id} · ${s.lot.WF_QTY} WF<small>MAIN ${esc(s.lot.parent_lot_id)}</small></button>`).join('')}${here.filter(s=>s.event[2]===3).slice(0,8).map(s=>{const h=holdInfo(s,minute);return `<article class="hold-insight"><button data-related="${s.lot.id}">${s.lot.id} · ${h.label} · ${fmt(h.age/60)}h</button><p>${esc(h.action)}</p></article>`;}).join('')}`;
    }else{
      const l=data.lots.find(l=>l.id===selected.id),s=api.stateAt(l,minute),jobs=pairJobs(l,Math.min(minute,OBSERVED_END)),last=jobs.at(-1),related=l.parent_lot_id?[l.parent_lot_id]:l.sample_lot_ids;
      html=`<h3>${l.lot_type} · WF_QTY ${l.WF_QTY}</h3><p>${s?.event[2]===0&&l.lot_type==='MAIN'?'MAIN 공정 대기 중 · ':''}배정 장비: ${esc(s?.lot.equipmentByStep[s.event[1]]||'없음')}${s&&s.nextNode!==null?' (이동 중: 출발 공정 기준)':''}</p><h3>${l.parent_lot_id?'연결 MAIN':'연결 SAMPLE'}</h3>${related.map(id=>{const other=data.lots.find(l=>l.id===id),st=api.stateAt(other,minute);return `<button class="insight-row" data-related="${id}">${id} · ${other.WF_QTY} WF<small>${st?data.statuses[st.event[2]]:'미투입'} · 완료 ≠ 결과 승인</small></button>`;}).join('')||'<p>연결된 SAMPLE 없음</p>'}<h3>최근 완료 JOB 정규화 시간</h3>${last?`<p>${fmt(last.duration_min)}분 / ${last.WF_QTY} WF = <strong>${fmt(last.sec_per_wafer)}초/WF</strong><br>${esc(data.nodes[last.node].desc)} · ${esc(last.equipment_id)}</p>`:'<p>이 시점까지 짝지어진 완료 JOB 없음</p>'}`;
      const h=holdInfo(s,minute);if(h)html+=`<article class="hold-insight"><h3>${h.label} · ${fmt(h.age/60)}h</h3><p>${esc(h.action)}</p><small>담당: ${esc(h.owner)} · 검토 제안 / 자동 실행 없음</small></article>`;
      if(s?.holdCode==='SEND')html+=`<article class="hold-insight"><h3>SEND · 팹 간 이송 홀드</h3><p>${esc(holdRules.SEND.action)}</p><small>EVENT_CODE: hold · HOLD_CODE: SEND · 이동 상태 유지</small></article>`;
      if(s&&s.event[2]!==5){const tool=s.lot.equipmentByStep[s.event[1]],key=timingKey(tool,data.nodes[s.node].desc,l.lot_type),stat=data.timingStats.find(r=>r.key===key);html+=`<h3>현재 공정·장비 / ${l.lot_type} 통계</h3>${stat?`<p>중앙값 ${fmt(stat.median_sec_per_wafer)}초/WF · P90 ${fmt(stat.p90_sec_per_wafer)}초/WF<br>${stat.count} JOB · 학습 기준 ${api.format(OBSERVED_END)}${stat.count<5?' · 저표본 주의':''}</p>`:'<p>매칭 완료 JOB 없음 · 예측 시 60초/WF 가정</p>'}`;}
    }
    if(selected.type==='node'){const m=processMetrics(data,selected.id,minute),value=(v,unit)=>v===null?'데이터 없음':`${fmt(v)}${unit}`;html=`<h3>PROCESS TIME / 최근 관측 24시간</h3><p>${api.format(m.start)} ~ ${api.format(m.end)}${minute>OBSERVED_END?' · 예측값 아님 / LIVE 기준 고정':''}</p><div class="facts"><span>평균 JOB 처리시간</span><strong>${value(m.mean,'분')} · ${m.count} JOB</strong><span>WF당 처리시간</span><strong>${value(m.secPerWafer,'초/WF')}</strong><span>MAIN 평균</span><strong>${value(m.main.mean,'분')} · ${m.main.count} JOB</strong><span>SAMPLE 평균</span><strong>${value(m.sample.mean,'분')} · ${m.sample.count} JOB</strong><span>주 장비 가동률</span><strong>${value(m.util,'%')}</strong><span>주 장비 IDLE</span><strong>${fmt(m.idle/60)} slot·h</strong></div><p class="analysis-note">평균: 선택 공정 occurrence의 완료 JOB, 중단·미완료 제외. 장비: 해당 팹의 적격 장비 전체 작업 기준(랏 필터 무관). 가동률 = 처리 slot·분 / READY slot·분. IDLE = READY 용량 − 처리시간. DOWN/PM 제외, 가상 병렬 슬롯 기반이며 실제 OEE가 아닙니다.</p><h3>장비별 가동률 / IDLE</h3>${m.tools.map(t=>`<p><strong>${esc(t.id)}</strong> · ${t.role==='primary'?'주 장비':'백업 / 합계 제외'}<br>${value(t.util,'%')} · IDLE ${fmt(t.idle/60)} slot·h<br>DOWN/PM ${fmt(t.down/60)}h · 가상 ${t.slots} slots</p>`).join('')||'<p>처리 장비 없음</p>'}${html}`;}
    if(selected.type==='node'){const history=holdHistory(data,api.context().lots,minute).filter(r=>r.node===selected.id);html+=`<h3>이 공정의 관측 홀드 코드 이력</h3>${history.map(r=>`<p><strong>${esc(r.code)}</strong> · ${r.count}회 / ${r.days}일<br>${r.affected}/${r.visits} 방문 (${fmt(r.rate)}%) · ${fmt(r.lotHours)} LOT·h</p>`).join('')||'<p>해당 시점·필터에 홀드 이력 없음</p>'}`;}
    if(selected.type==='node'){
      const ids=data.nodes[selected.id].recipe_ids||[],rows=states.filter(s=>s.node===selected.id&&recipeAt(s));
      html+='<h3>RECIPE / 공정별 샘플 레시피</h3><p class="analysis-note">랏코드별 배정 · DEMO 레시피 / 실제 장비 승인 정보 아님</p><table class="equipment-table"><thead><tr><th>RECIPE ID</th><th>REV</th><th>대기</th><th>진행</th></tr></thead><tbody>'+ids.map(id=>{const recipe=data.recipes.find(r=>r.recipe_id===id),lots=rows.filter(s=>recipeAt(s)===id);return `<tr><td style="overflow-wrap:anywhere">${esc(id)}<small style="display:block">${esc(recipe?.recipe_name)}</small></td><td>${esc(recipe?.revision)}</td><td>${lots.filter(s=>s.event[2]===0).length}</td><td>${lots.filter(s=>[1,2].includes(s.event[2])).length}</td></tr>`;}).join('')+'</tbody></table>';
    }else{
      const lot=data.lots.find(l=>l.id===selected.id),s=api.stateAt(lot,minute),id=recipeAt(s),r=data.recipes?.find(r=>r.recipe_id===id);
      html=`<h3>RECIPE / ${s&&[1,2].includes(s.event[2])?'진행 중':'배정'}</h3><p style="overflow-wrap:anywhere"><strong>${esc(id||'해당 없음')}</strong>${r?`<br>${esc(r.recipe_name)} · REV ${esc(r.revision)}`:''}</p><p class="analysis-note">${s?.nextNode!=null?'이송 중 · 실행 레시피 없음':s?.event[2]===5?'FAB OUT · 실행 레시피 없음':'샘플 레시피 배정 / 실제 레시피 실행·변경 아님'}</p>`+html;
      const jobs=pairJobs(lot,Math.min(minute,OBSERVED_END)).slice(-5).reverse();html+='<h3>최근 완료 JOB · RECIPE ID</h3>'+jobs.map(j=>`<p style="overflow-wrap:anywhere">${esc(data.nodes[j.node].desc)}<br><strong>${esc(j.recipe_id||'미배정')}</strong><br>${esc(j.equipment_id)} · ${fmt(j.duration_min)}분</p>`).join('');
    }
    detail.insertAdjacentHTML('beforeend',`<section class="extended-detail">${html}</section>`);const facts=detail.querySelector('.facts');if(facts)facts.after(detail.querySelector('.extended-detail'));detail.querySelectorAll('[data-related]').forEach(b=>b.onclick=()=>api.selectLot(b.dataset.related));
  }
  return {update,activeNodes,appendDetail,close};
}
import {recipeAt} from './recipes.js';
