import {equipmentStatus} from './equipment-health.js';
export function operationSnapshot(data,states,nodeId,minute){
 const node=data.nodes[nodeId],mapping=node.equipment?.[node.fab]||{};
 const resident=states.filter(s=>s.node===nodeId&&s.nextNode==null&&[0,1,2,3,4].includes(s.event[2]));
 const primary=new Set(mapping.primary||[]),ids=[...new Set([...primary,...(mapping.backup||[])])];
 const tools=ids.map(id=>{
  const tool=data.equipment.find(t=>t.id===id),status=tool?equipmentStatus(tool,minute).status:'UNKNOWN';
  const active=resident.filter(s=>[1,2].includes(s.event[2])&&s.lot.equipmentByStep?.[s.event[1]]===id);
  // Existing demo uses parallel slots, not physical chamber telemetry.
  const proc=active.filter(s=>s.event[2]===2),load=active.filter(s=>s.event[2]===1);
  const chambers=Array.from({length:3},(_,i)=>({id:`CH${i+1}`,lots:proc.filter((_,j)=>j%3===i)}));
  const ports=Array.from({length:2},(_,i)=>({id:`LP${i+1}`,lots:load.filter((_,j)=>j%2===i)}));
  return {id,status,role:primary.has(id)?'주 장비':'백업 · 승인 필요',active,chambers,ports};
 });
 return {node,tools,wait:resident.filter(s=>s.event[2]===0),hold:resident.filter(s=>s.event[2]===3),end:resident.filter(s=>s.event[2]===4),unassigned:resident.filter(s=>[1,2].includes(s.event[2])&&!ids.includes(s.lot.equipmentByStep?.[s.event[1]]))};
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createOperationDrilldown(api){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/src/operation-drilldown.css';document.head.append(style);
 const panel=document.createElement('section');panel.id='operation-drilldown';panel.hidden=true;panel.setAttribute('aria-label','공정 장비 확장 보기');document.querySelector('#canvas-area').append(panel);
 let id=null,last='',previousFocus;
 const row=s=>`<button data-drill-lot="${esc(s.lot.id)}"><span>${esc(s.lot.id)}</span><small>${esc(s.lot.code)} · ${s.lot.WF_QTY??'—'} WF</small><b data-state="${s.event[2]}">${['WAIT','LOAD','PROC','HOLD','END'][s.event[2]]}${s.holdCode?' · '+esc(s.holdCode):''}</b></button>`;
 const list=rows=>`<div class="drill-lots">${rows.map(row).join('')||'<p>해당 랏 없음</p>'}</div>`;
 function close(){id=null;panel.hidden=true;previousFocus?.focus();}
 function update(){
  if(id==null)return;const {data,states,minute}=api.context();if(!data)return;
  const s=operationSnapshot(data,states,id,minute),key=JSON.stringify([id,Math.floor(minute),s]);if(key===last)return;last=key;
  const scroll=panel.querySelector('.drill-body')?.scrollTop||0,lists=[...panel.querySelectorAll('.drill-lots')].map(e=>e.scrollTop);
  panel.innerHTML=`<header><div><small>${esc(s.node.fab)} / ${esc(s.node.operId)} · ${minute>10080?'SIMULATION':minute===10080?'LIVE':'PAST'}</small><h2>${esc(s.node.desc)}</h2></div><button data-drill-close aria-label="공정 확장 닫기">맵으로 돌아가기 ×</button></header><p class="drill-note">현재 필터·타임라인 기준 · 장비 적격 매핑은 샘플. CH 3개 / LP 2개는 가상 그룹이며 실제 챔버·포트 점유가 아닙니다. LOAD는 JOB START의 표시명입니다.</p><div class="drill-body"><div class="drill-root">${esc(s.node.desc)}<small>↓ 진행 가능 장비</small></div><div class="drill-branches">${s.tools.map(t=>`<article class="drill-tool"><div class="drill-tool-title"><strong>${esc(t.id)}</strong><b>${esc(t.status)}</b></div><small>${t.role}</small><h3>CHAMBER · 가상 분배</h3><div class="drill-slots">${t.chambers.map(c=>`<div data-busy="${c.lots.length>0}"><b>${c.id}</b><span>${t.status!=='READY'?'사용 불가':c.lots.length?'PROC':'IDLE'}</span><small>${c.lots.length} LOT</small></div>`).join('')}</div><h3>LOAD PORT · 가상 분배</h3><div class="drill-slots">${t.ports.map(p=>`<div data-busy="${p.lots.length>0}"><b>${p.id}</b><span>${t.status!=='READY'?'사용 불가':p.lots.length?'LOAD':'EMPTY'}</span><small>${p.lots.length} LOT</small></div>`).join('')}</div>${t.status!=='READY'&&t.active.length?'<p class="drill-warning">상태 불일치: 비가동 장비에 활성 JOB 존재 · 확인 필요</p>':''}<h3>PROC / LOAD · ${t.active.length} LOT</h3>${list(t.active)}</article>`).join('')||'<p>매핑된 장비 없음</p>'}</div><div class="drill-queues"><section><h3>WAIT · ${s.wait.length} LOT</h3>${list(s.wait)}</section><section><h3>HOLD · ${s.hold.length} LOT</h3>${list(s.hold)}</section></div>${s.unassigned.length?`<section><h3>장비 매핑 확인 필요 · ${s.unassigned.length}</h3>${list(s.unassigned)}</section>`:''}${s.end.length?`<details><summary>JOB END · ${s.end.length} LOT</summary>${list(s.end)}</details>`:''}</div>`;
  panel.querySelector('.drill-note').append(' IDLE/EMPTY는 선택 공정의 매칭 JOB 없음이며 장비 전체 유휴를 뜻하지 않습니다.');
  panel.querySelector('.drill-body').scrollTop=scroll;panel.querySelectorAll('.drill-lots').forEach((e,i)=>e.scrollTop=lists[i]||0);
 }
 panel.onclick=e=>{if(e.target.closest('[data-drill-close]'))close();const b=e.target.closest('[data-drill-lot]');if(b){close();api.selectLot(b.dataset.drillLot);}};
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
 return {open(nodeId){previousFocus=document.activeElement;id=nodeId;last='';panel.hidden=false;update();panel.querySelector('[data-drill-close]').focus();},close,update};
}
