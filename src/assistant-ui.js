import {initLLMSettings} from './llm-settings-ui.js';
import {initGuardianPoses} from './guardian-poses.js';
import {createAlertDetector} from './copilot-alerts.js';
import {equipmentStatus} from './equipment-health.js';
import {observationMode} from './fab-analytics.js';
import {parseRequest} from './assistant-tools.js';
export function initAssistant(api,hooks={}){
 const copilotStyle=document.createElement('link');copilotStyle.rel='stylesheet';copilotStyle.href='/src/copilot.css';document.head.append(copilotStyle);
 const style=document.createElement('link');style.rel='stylesheet';style.href='/src/enterprise.css';document.head.append(style);
 document.querySelector('.breadcrumb').textContent='AI와 함께 FAB 전체 현황을 분석하고 예측합니다';document.querySelector('h1').firstChild.textContent='공정 흐름 ';
 document.querySelector('#sidebar-toggle').insertAdjacentHTML('beforebegin','<div id="user-profile" title="SSO 미연결 · 프로필 이미지 연동 예정"><span class="profile-avatar" aria-hidden="true">U</span><span>사용자<small>SSO 미연결</small></span></div>');
 document.querySelector('#canvas-area').insertAdjacentHTML('beforeend','<aside id="assistant-panel" hidden aria-label="Fab Copilot"><div class="assistant-heading"><strong>Fab Copilot</strong><button id="assistant-close" aria-label="대화창 닫기">×</button></div><p class="assistant-notice">로컬 명령 모드 · LLM 미연결<br>계획·ETA·레시피·문제 LOT 분석 지원. 실제 생산 제어 없음.</p><div id="assistant-messages" role="log" aria-live="polite"></div><details id="assistant-toolbox"><summary>사용 가능한 필터 도구</summary><label>도구<select id="assistant-tool"></select></label><label>값<input id="assistant-tool-value" placeholder="예: RQQF, M14, 3d, 180"></label><button id="assistant-tool-run">실행</button><small>값 형식: 시간은 데이터 시작 후 분, labels/heat는 true/false. 비교 랏은 쉼표로 구분.</small></details><form id="assistant-form"><label for="assistant-input">요청 입력</label><textarea id="assistant-input" rows="2" maxlength="1000" placeholder="LOT CODE RQQF 현재 WIP 상황을 알려줘"></textarea><button type="submit">보내기</button></form></aside>');
 document.querySelector('#canvas-area').insertAdjacentHTML('beforeend','<div id="copilot-dock"><section id="copilot-bubble" hidden aria-label="Fab Copilot 알림"><div><strong>Fab Copilot</strong><button id="copilot-dismiss" aria-label="알림 닫기">×</button></div><small id="copilot-phase"></small><p id="copilot-alert-text" role="status" aria-live="polite"></p><button id="copilot-action">관련 현황 보기 ↗</button></section><button id="assistant-open" aria-label="Fab Copilot 대화 열기" aria-expanded="false"><span class="copilot-pet" aria-hidden="true"><span class="pet-eyes"><i></i><i></i></span><span class="pet-mouth"></span></span><span>Fab Copilot<small>현황을 살피고 있어요</small></span><i id="copilot-dot" hidden></i></button></div>');
 const $=s=>document.querySelector(s),panel=$('#assistant-panel'),log=$('#assistant-messages');
 const petButton=$('#assistant-open');petButton.replaceChildren();petButton.insertAdjacentHTML('beforeend','<img class="guardian-pet" src="/src/assets/fab-guardian.png" alt="" draggable="false"><i id="copilot-dot" hidden></i>');petButton.title='Fab Copilot · 클릭해서 대화하기';
 const petStyle=document.createElement('link');petStyle.rel='stylesheet';petStyle.href='/src/guardian-pet.css';document.head.append(petStyle);
 let petTimer;const petReact=()=>{clearTimeout(petTimer);petButton.classList.remove('guardian-alert');void petButton.offsetWidth;petButton.classList.add('guardian-alert');petTimer=setTimeout(()=>petButton.classList.remove('guardian-alert'),1400);};
 const llm=initLLMSettings();
 let lastAnalysis=null;
 $('#assistant-messages').insertAdjacentHTML('beforebegin','<details id="engineering-questions"><summary>엔지니어 질문 예시 · 분석 도구</summary><div></div><button id="engineering-download" disabled>분석 결과 JSON 다운로드</button></details>');
 questionExamples.forEach(q=>{const button=document.createElement('button');button.textContent=q;button.onclick=()=>{$('#assistant-input').value=q;$('#assistant-input').focus();};$('#engineering-questions div').append(button);});
 $('#engineering-download').onclick=()=>{if(!lastAnalysis)return;const url=URL.createObjectURL(new Blob([JSON.stringify(lastAnalysis,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='fab-engineering-analysis.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 function message(text,role){const p=document.createElement('p');p.className=`chat-${role}`;p.textContent=text;log.append(p);while(log.children.length>60)log.firstChild.remove();log.scrollTop=log.scrollHeight;}
 async function execute(name,args){message(`${name} ${JSON.stringify(args)}`,'tool');const result=await api.call(name,args);let text=result.content[0].text;
 if(name==='fab.what_if_release'){if(!result.isError){lastAnalysis=JSON.parse(text);$('#engineering-download').disabled=false;text='[SIMULATION · 신규 투입 What-if]\n'+lastAnalysis.insights.join('\n')+'\n전체 비교는 JSON 다운로드에서 확인하세요.';}message(text,result.isError?'error':'reply');return;}
 if(name==='fab.analyze_engineering'){if(!result.isError){lastAnalysis=JSON.parse(text);$('#engineering-download').disabled=false;text=engineeringAnswer(lastAnalysis);}message(text,result.isError?'error':'reply');if(!result.isError)analysisActions(lastAnalysis);return;}
 if(!result.isError){const state=await api.call('fab.get_state',{});if(!state.isError){const s=JSON.parse(state.content[0].text);text=`적용 기준: ${s.phase} / ${s.filters.fab} / ${s.filters.search||'전체 랏'}\n대상 ${s.target} LOT · WIP ${s.wip} · WAIT ${s.wait} · PROC ${s.proc} · HOLD ${s.hold} · MOVE ${s.move} (SEND ${s.send})\n${JSON.stringify(JSON.parse(result.content[0].text),null,2)}`;}}
 message(text,result.isError?'error':'reply');
 }
 $('#assistant-open').onclick=()=>{panel.hidden=!panel.hidden;$('#assistant-open').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){$('#copilot-bubble').hidden=true;$('#copilot-dot').hidden=true;for(const id of ['inspector','analytics-panel','maintenance-panel'])$('#'+id).hidden=true;$('#analysis-toggle').setAttribute('aria-expanded','false');if(llm.ensure())$('#assistant-input').focus();}};
 $('#assistant-close').onclick=()=>{panel.hidden=true;$('#assistant-open').setAttribute('aria-expanded','false');};
 function analysisActions(r){
  const box=document.createElement('div');box.className='engineering-actions';
  const action=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;box.append(b);};
  if(r.kind==='compare')action('두 LOT를 맵에서 비교',()=>api.call('fab.compare_lots',{lot_ids:r.lot_ids}));
  for(const row of (r.rows||[]).filter(r=>r.lot_id).slice(0,5))action(row.lot_id+' 위치 보기',()=>{hooks.selectLot?.(row.lot_id);panel.hidden=true;$('#assistant-open').setAttribute('aria-expanded','false');});
  for(const row of (r.equipment||[]).slice(0,5))action(row.equipment_id+' 보기',()=>{hooks.selectEquipment?.(row.equipment_id);panel.hidden=true;$('#assistant-open').setAttribute('aria-expanded','false');});
  if(box.children.length)log.append(box);
 }
 let chatBusy=false;
 $('#assistant-form').onsubmit=async e=>{e.preventDefault();if(chatBusy||!llm.ensure())return;const q=$('#assistant-input').value.trim();if(!q)return;chatBusy=true;$('#assistant-form button').disabled=true;$('#assistant-input').value='';message(q,'user');try{message(await llm.client.ask(q,api),'reply');}catch(error){message(error.message,'error');}finally{chatBusy=false;$('#assistant-form button').disabled=!llm.client.connected;}};

 const options=[];for(const t of api.tools){const targets=t.inputSchema.properties.target?.enum;if(targets)for(const target of targets)options.push({name:t.name,target});else options.push({name:t.name});}
 options.forEach((o,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=o.name.replace('fab.','')+(o.target?' / '+o.target:'');$('#assistant-tool').append(option);});
 $('#assistant-tool-run').onclick=()=>{const o=options[+$('#assistant-tool').value],value=$('#assistant-tool-value').value.trim();execute(o.name,['fab.personal_workspace','fab.restore_view'].includes(o.name)?(parseRequest(value)?.arguments||{}):o.name==='fab.analyze_engineering'?(engineeringRequest(value)||{kind:value}):o.target?{target:o.target,value}:o.name==='fab.catalog'?{query:value}:o.name==='fab.select_routes'?{route_ids:value?value.split(',').map(s=>s.trim()):[]}:o.name==='fab.compare_lots'?{lot_ids:value?value.split(',').map(s=>s.trim()):[]}:{});};
 const detector=createAlertDetector();let currentAlert=null,lastKey='',lastAlertScope='';
 $('#copilot-dismiss').onclick=()=>{$('#copilot-bubble').hidden=true;$('#copilot-dot').hidden=true;};
 $('#copilot-action').onclick=()=>{if(!currentAlert)return;$('#copilot-bubble').hidden=true;$('#copilot-dot').hidden=true;if(currentAlert.kind==='process')hooks.selectNode?.(currentAlert.id);else hooks.selectEquipment?.(currentAlert.id);};
 function update({data,states,minute,scope,rankings}){
  if(scope!==lastAlertScope){lastAlertScope=scope;currentAlert=null;$('#copilot-bubble').hidden=true;$('#copilot-dot').hidden=true;}
  const key=scope+'|'+Math.floor(minute);if(key===lastKey)return;lastKey=key;
  const scopedEquipment=new Set(states.filter(s=>s.nextNode==null&&s.event[2]!==5).map(s=>s.lot.equipmentByStep?.[s.event[1]]));
  const down=data.equipment.filter(tool=>scopedEquipment.has(tool.id)).flatMap(tool=>{const status=equipmentStatus(tool,minute);return status.status==='DOWN'?[{id:tool.id,key:tool.id+':'+status.incident?.start}]:[];});
  const alert=detector({scope,minute,down,wip:rankings.map(r=>({...r,desc:data.nodes[r.node].desc}))});
  if(!alert)return;currentAlert=alert;const phase=observationMode(minute),label=phase==='SIMULATION'?'SIMULATION · 가상 예측':phase==='PAST'?'PAST · 과거 재생':'LIVE · 최신 샘플';
  $('#copilot-phase').textContent=label+' / 규칙 기반 알림';
  $('#copilot-alert-text').textContent=alert.text;
  message('['+label+'] '+alert.text,'reply');
  if(panel.hidden){$('#copilot-bubble').hidden=false;$('#copilot-dot').hidden=false;petReact();}
 }
 message('예: “LOT CODE RQQF 현재 WIP 상황을 알려줘”. 존재하지 않는 코드는 임의로 생성하지 않습니다. catalog 도구로 샘플 코드를 검색할 수 있습니다.','reply');
 initGuardianPoses();
 return {update,llm};
}
import {questionExamples,engineeringRequest,engineeringAnswer} from './engineering-analysis.js';
