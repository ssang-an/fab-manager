import {initWhatIfChat} from './whatif-chat.js';
export function initReleaseUI(api,context,getLLM){
 const $=s=>document.querySelector(s);
 $('#analysis-toggle').insertAdjacentHTML('afterend','<button id="release-open">투입 What-if</button>');
 $('#canvas-area').insertAdjacentHTML('beforeend','<aside id="release-panel" hidden aria-label="신규 LOT 투입 What-if"><div class="release-heading"><strong>투입 WHAT-IF</strong><button id="release-close">닫기</button></div><p>전체 최신 WIP 기준 · 독립 비교 / 현재 맵·실제 계획은 변경하지 않습니다.</p><form id="release-form"><label>신규 MAIN LOT 수<input id="release-count" type="number" min="1" max="2000" step="1" value="100" required></label><label>투입 기간 (일)<input id="release-days" type="number" min="1" max="7" step="1" value="3" required></label><label>라우트<select id="release-route"></select></label><label>LOT당 WF_QTY<input id="release-wf" type="number" min="1" max="25" step="1" value="25" required></label><button id="release-run">4개 시나리오 비교</button></form><p id="release-status" role="status"></p><div id="release-result"></div></aside>');
 $('#release-open').textContent='What-if';
 $('#release-panel .release-heading strong').textContent='WHAT-IF · 생산 시나리오';
 $('#release-count').min='0';
 $('#release-panel>p').textContent='전체 최신 WIP · 신규 LOT 0 = 기존 재공만 비교. 증설 1대는 가상 슬롯 1개이며 실제 장비 능력과 다를 수 있습니다. 현재 맵·실제 계획은 변경하지 않습니다.';
 $('#release-run').textContent='시나리오 비교 실행';
 $('#release-form').insertAdjacentHTML('afterbegin','<label>비교 유형<select id="release-mode"><option value="optimization">홀드 · 복구 · 증설 최적화</option value="release">투입 일정 비교</option></select></label>');
 $('#release-run').insertAdjacentHTML('beforebegin','<label class="capacity-field">홀드 목표 (발생 후 시간)<input id="capacity-hold" type="number" min="0" max="168" step="0.5" value="3" required></label><label class="capacity-field">DOWN/PM 잔여 복구 (시간)<input id="capacity-recovery" type="number" min="0" max="168" step="0.5" value="24" required></label><label class="capacity-field">증설 공정<select id="capacity-target"><option value="">자동 · 대기 상위 3개 공정</option></select></label><label class="capacity-field">최대 추가 대수 (1대씩 비교)<input id="capacity-count" type="number" min="1" max="3" step="1" value="2" required></label>');
 $('#release-mode').onchange=()=>{for(const el of document.querySelectorAll('.capacity-field'))el.hidden=$('#release-mode').value!=='optimization';};
 $('#release-open').addEventListener('click',()=>{const select=$('#capacity-target');if(select.options.length>1)return;const d=context();if(!d)return;const seen=new Set();d.nodes.forEach((n,i)=>{const key=n.fab+'|'+n.desc;if(seen.has(key)||!n.equipment?.[n.fab]?.primary.length)return;seen.add(key);const o=document.createElement('option');o.value=i;o.textContent=n.fab+' / '+n.desc;select.append(o);});});
 let result=null;
 $('#release-open').onclick=()=>{const panel=$('#release-panel');panel.hidden=!panel.hidden;if(!panel.hidden){const d=context();if(!$('#release-route').options.length)for(const r of d.routes){const o=document.createElement('option');o.value=r.id;o.textContent=r.id+' · '+r.name;$('#release-route').append(o);}}};
 $('#release-close').onclick=()=>{$('#release-panel').hidden=true;};
 $('#release-form').onsubmit=async e=>{e.preventDefault();$('#release-run').disabled=true;$('#release-status').textContent='계산 중… 백그라운드에서 처리합니다.';try{
  const response=await api.call('fab.what_if_release',{count:$('#release-count').value,days:$('#release-days').value,route_id:$('#release-route').value,wf_qty:$('#release-wf').value,mode:$('#release-mode').value,hold_hours:$('#capacity-hold').value,recovery_hours:$('#capacity-recovery').value,add_tools:$('#capacity-count').value,target_node:$('#capacity-target').value});
  if(response.isError)throw Error(response.content[0].text);result=JSON.parse(response.content[0].text);render();$('#release-status').textContent='완료 · 가정 기반 SIMULATION / 실제 최적해 아님';
 }catch(error){$('#release-status').textContent=error.message;}finally{$('#release-run').disabled=false;}};
 initWhatIfChat(api,context,getLLM,value=>{result=value;render();});
 function render(){
  const box=$('#release-result');box.replaceChildren();
  if(result.mode==='optimization'){
   const heading=document.createElement('p');heading.textContent=result.scope;box.append(heading);
   const table=document.createElement('table');table.className='equipment-table';table.innerHTML='<thead><tr><th>조건</th><th>완료 LOT / WF</th><th>완료 증감</th><th>잔여 WIP</th><th>대기 감소 LOT·h</th></tr></thead>';
   for(const s of result.scenarios){const tr=document.createElement('tr');for(const value of [s.name,s.completed+' / '+s.completedWF,s.completedGain,s.wip,s.waitSaved]){const td=document.createElement('td');td.textContent=value;tr.append(td);}table.append(tr);}box.append(table);
   const recommendation=document.createElement('p');recommendation.textContent=result.recommendation;box.append(recommendation);
   for(const s of result.scenarios){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=s.name+' · 변경 후 병목';details.append(summary);for(const b of s.bottlenecks){const p=document.createElement('p');p.textContent=b.fab+' / '+b.operation+' · 대기 '+b.waitLotHours+' LOT·h';details.append(p);}box.append(details);}
   for(const note of result.assumptions){const p=document.createElement('p');p.textContent=note;box.append(p);}return;
  }
  const p=document.createElement('p');p.textContent=result.scope+' · 홀드 '+(result.assumptions.holdHours??'미해제')+'h · 처리시간 배율 '+result.assumptions.factor;box.append(p);
  const table=document.createElement('table');table.className='equipment-table';table.innerHTML='<thead><tr><th>투입안</th><th>7일 완료 LOT / WF</th><th>기존 LOT 영향</th><th>잔여 WIP</th><th>대기 LOT·h</th></tr></thead>';
  const body=document.createElement('tbody');for(const s of result.scenarios){const tr=document.createElement('tr');for(const value of [s.name,s.completed+' / '+s.completedWF,s.existingLotImpact,s.wip,s.waitLotHours]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}body.append(tr);}table.append(body);box.append(table);
  for(const text of result.insights){const p=document.createElement('p');p.textContent=text;box.append(p);}
  for(const s of result.scenarios.slice(1)){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=s.name+' · 일별 완료 / 병목';details.append(summary);const p=document.createElement('p');p.textContent=s.daily.map(d=>'+'+d.day+'일: 누적 완료 '+d.completed+' / 신규 '+d.newCompleted+' / WIP '+d.wip).join('\n');p.style.whiteSpace='pre-line';details.append(p);for(const n of s.bottlenecks){const row=document.createElement('p');row.textContent=n.fab+' / '+n.operation+' · 누적 대기 '+n.waitLotHours+' LOT·h';details.append(row);}box.append(details);}
  const note=document.createElement('p');note.textContent=Object.entries(result.assumptions).map(([k,v])=>k+': '+v).join('\n');note.style.whiteSpace='pre-line';box.append(note);
 }
}
