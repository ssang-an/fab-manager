import {forecastLots,OBSERVED_END} from './fab-analytics.js';
import {holdHistory,forecastMetrics} from './hold-insights.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:1});
export function createHoldInsights(api){
  const style=document.createElement('link');style.rel='stylesheet';style.href='/src/hold-insights.css';document.head.append(style);
  let code='ALL',comparison=false;const cache=new Map();
  function forecast(data,factor,hours){const key=`${factor}|${hours}`;if(!cache.has(key))cache.set(key,forecastLots(data,{factor,holdHours:hours}));return cache.get(key);}
  function render(container){
    const {data,lots,minute,forecast:current}=api.context(),hours=current.holdHours,rows=holdHistory(data,lots,minute),codes=[...new Set(rows.map(r=>r.code))].sort();
    const top=rows.filter(r=>code==='ALL'||r.code===code).slice(0,8),ahso=rows.filter(r=>r.code==='AHSO'&&data.nodes[r.node].operId.startsWith('MET')).sort((a,b)=>b.days-a.days||b.count-a.count).slice(0,5);
    let compareHTML='';
    if(comparison){
      const options=[...new Set([1,3,6,12,hours,null])],results=options.map(h=>({h,...forecastMetrics(data,forecast(data,current.factor,h),lots)})),baseline=results.find(r=>r.h===null),best=results.slice().sort((a,b)=>b.out1-a.out1||a.holdHours-b.holdHours)[0];
      compareHTML=`<p class="analysis-note">같은 최신 WIP·장비 상태·처리시간, 현재 랏 필터 기준. 완료는 LIVE 이후 추가 OUT입니다.</p><table class="hold-table"><thead><tr><th>해제</th><th>+1일 완료</th><th>+7일 완료</th><th>+7일 WIP</th><th>HOLD LOT·h</th></tr></thead><tbody>${results.map(r=>`<tr ${r.h===hours?'class="selected-hold"':''}><td><button data-hold-preset="${r.h===null?'none':r.h}">${r.h===null?'미해제':`${r.h}h`}</button></td><td>${r.out1} <small>(${r.out1-baseline.out1>=0?'+':''}${r.out1-baseline.out1})</small></td><td>${r.out7}</td><td>${r.wip7}</td><td>${num(r.holdHours)}</td></tr>`).join('')}</tbody></table><p class="analysis-note">괄호: 미해제 대비 +1일 완료 증가. HOLD LOT·h: 예측 7일 동안 누적 홀드 체류량.</p><p>비교 범위에서 <strong>${best.h===null?'미해제':best.h+'h'}</strong>가 +1일 완료량 우선·동률 시 홀드 체류량 기준 최상입니다. 미해제 대비 +1일 ${best.out1-baseline.out1} LOT 증가. +7일에도 ${best.wait7} LOT는 대기합니다.</p><p class="analysis-note">해제 단축으로 완료량이 늘지 않으면 장비 용량·DOWN 병목을 먼저 확인하세요. 비용·품질 리스크를 반영하지 않아 실제 최적 정책이라는 뜻은 아닙니다.</p>`;
    }
    container.innerHTML=`<h3>HOLD CONTROL / 해제 시나리오</h3><label class="scenario-label">평균 해제 목표 (시간)<input id="hold-hours" aria-label="홀드 해제 목표 시간" type="number" min="0" max="168" step="0.5" value="${hours??3}"></label><button id="hold-apply">맵에 적용</button><button id="hold-preview">+3시간 보기</button><button id="hold-compare">${comparison?'비교 다시 계산':'1 / 3 / 6 / 12시간 비교'}</button><p class="analysis-note">현재 ${hours===null?'미해제':hours+'시간'} · 발생 시점부터 고정 시간으로 근사. 초과 랏은 예측 시작 직후 해제. SEND 제외 공정 홀드 승인 완료 가정이며 실제 해제 아님. 해제 후 동일 공정 대기로 전환하며 DOWN은 별도의 가상 추정 시점에 복구됩니다.</p>${compareHTML}<h3>공정 × 홀드 코드 / 반복 발생</h3><label>코드 <select id="hold-code-filter" aria-label="홀드 코드 필터"><option value="ALL">전체 코드</option>${codes.map(c=>`<option ${code===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><p class="analysis-note">관측 시작 ~ ${api.format(Math.min(minute,OBSERVED_END))} · 현재 랏 필터 · 누적 LOT·h 순. SEND는 이송 홀드로 별도 구분하며 3시간 해제 대상에서 제외. 미해제는 조회 시점까지 계산. 발생률 = 해당 코드 홀드 방문 수 / 공정 방문 수. 같은 공정명도 occurrence ID별 분리합니다.</p>${top.map(r=>rowHTML(r,data)).join('')||'<p>해당 시점·필터의 이력 없음</p>'}<h3>AHSO / AUTO HOLD SPEC OUT</h3><p class="analysis-note">스펙 이탈 자동 홀드 · 반복 계측 공정의 발생 일수 → 횟수 순. 코드 의미는 사용자 정의를 반영했으며 발생 이력은 샘플입니다.</p>${ahso.map(r=>rowHTML(r,data)).join('')||'<p>AHSO 계측 이력 없음</p>'}<p>반복 AHSO 공정은 측정값·상하한 스펙·반복 이탈 항목 및 직전 처리 장비를 우선 확인하고, 체류량이 큰 코드는 승인 대기·담당 인계 시간을 나눠 분석하세요. 빈도만 높은 공정과 오래 막는 공정을 구분해야 합니다.</p>`;
    container.querySelector('#hold-apply').onclick=()=>{const input=container.querySelector('#hold-hours');if(!input.reportValidity()||input.value==='')return;api.holdScenario(Number(input.value));};
    container.querySelector('#hold-compare').onclick=()=>{comparison=true;render(container);};
    container.querySelector('#hold-preview').onclick=()=>api.seek(OBSERVED_END+180);
    container.querySelector('#hold-code-filter').onchange=e=>{code=e.target.value;render(container);};
    container.querySelectorAll('[data-hold-preset]').forEach(b=>b.onclick=()=>api.holdScenario(b.dataset.holdPreset==='none'?null:Number(b.dataset.holdPreset)));
    container.querySelectorAll('[data-hold-operation]').forEach(b=>b.onclick=()=>api.selectNode(Number(b.dataset.holdOperation)));
  }
  function rowHTML(r,data){return `<button class="insight-row" data-hold-operation="${r.node}"><strong>${esc(data.nodes[r.node].desc)} · ${esc(r.code)}</strong><small>${esc(data.nodes[r.node].operId)} · ${r.count}회 / ${r.days}일 발생<br>${r.affected}/${r.visits} 방문 (${num(r.rate)}%) · ${num(r.lotHours)} LOT·h · 미해제 ${r.open}건${r.visits<20?' · 저표본':''}</small></button>`;}
  return {render};
}
