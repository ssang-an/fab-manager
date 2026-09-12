import {createLLMClient,DEFAULT_LLM_URL} from './llm-connection.js';
export function initLLMSettings(){
 const $=s=>document.querySelector(s),client=createLLMClient();
 $('.assistant-heading strong').insertAdjacentHTML('afterend','<span id="copilot-model">미연결</span><button id="llm-settings-open" aria-label="LLM 연결 설정">설정</button>');
 $('.assistant-notice').textContent='개인 LLM 연결 · API 호환 및 사내망 필요 / 실제 생산 제어 없음';
 $('.assistant-notice').insertAdjacentHTML('afterend',`<section id="llm-settings"><h3>개인 LLM 연결</h3><p class="llm-security">사번 SSO 미연결 · 현재 브라우저 세션 전용<br>키는 메모리에만 보관하며 새로고침 시 삭제됩니다.</p><form id="llm-connect-form"><label>API URL<input id="llm-url" type="url" required value="${DEFAULT_LLM_URL}" autocomplete="off"></label><label>API Key<input id="llm-key" type="password" required placeholder="개인 API Key" autocomplete="off" spellcheck="false"></label><label>모델 선택 / 직접 입력<input id="llm-model" required placeholder="사용 권한이 있는 모델 ID 입력" autocomplete="off" spellcheck="false"></label><label class="llm-http"><input id="llm-http-consent" type="checkbox"> HTTP는 키와 질문이 평문으로 전송됩니다. 사내 보안 정책을 확인했습니다.</label><p class="llm-security">인증 시 입력한 서버로 키와 짧은 테스트 요청을 전송합니다. 연결 후 질문과 조회 결과가 해당 서버에 전달됩니다. 소량의 사용량이 발생할 수 있습니다.</p><div class="llm-buttons"><button id="llm-connect" type="submit">인증</button><a href="https://llm-ops.skhynix.com" target="_blank" rel="noopener noreferrer">llm-api key 발급받기 ↗</a><button id="llm-disconnect" type="button">연결 해제</button></div><p id="llm-status" role="status">연결 정보를 입력하세요.</p></form></section>`);
 const fields=['#llm-url','#llm-key','#llm-model'];
 $('.llm-buttons').insertAdjacentHTML('beforeend','<button id="llm-back" type="button">대화로 돌아가기</button>');
 $('#llm-back').onclick=()=>{if(client.connected){sync();}else{$('#llm-status').textContent='먼저 연결 인증을 완료하세요.';}};
 let busy=false;
 function sync(){const connected=client.connected;$('#copilot-model').textContent=connected?client.model:'미연결';$('#assistant-input').disabled=!connected;$('#assistant-form button').disabled=!connected;$('#llm-settings').hidden=connected;$('#assistant-panel').classList.toggle('llm-configuring',!connected);$('.assistant-notice').textContent=connected?'OK · '+client.model+' 연결 완료 / 질문과 도구 조회 결과가 설정 서버로 전송됩니다.':'개인 LLM 미연결 · 사내망/API 호환 필요 / 키는 세션 메모리에만 보관';}
 function invalidate(){client.disconnect();sync();$('#llm-status').textContent='설정 변경됨 · 다시 인증하세요.';}
 fields.forEach(id=>$(id).addEventListener('input',invalidate));$('#llm-http-consent').onchange=invalidate;
 $('#llm-settings-open').onclick=()=>{$('#llm-settings').hidden=false;$('#assistant-panel').classList.add('llm-configuring');$('#llm-status').textContent=client.connected?'현재 연결됨 · 변경 시 재인증':'연결 정보를 입력하세요.';};
 $('#llm-disconnect').onclick=()=>{client.disconnect();$('#llm-key').value='';sync();$('#llm-status').textContent='연결 해제 · 메모리에서 키 삭제';};
 $('#llm-connect-form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('#llm-connect').disabled=true;$('#llm-status').textContent='연결 확인 중…';try{await client.connect({url:$('#llm-url').value,key:$('#llm-key').value,model:$('#llm-model').value,allowHttp:$('#llm-http-consent').checked});$('#llm-key').value='';sync();$('#llm-status').textContent='OK · 연결 완료';$('.assistant-notice').textContent='OK · '+client.model+' 연결 완료 / LLM은 조회 도구만 사용합니다.';}catch(error){sync();$('#llm-status').textContent=error.message;}finally{busy=false;$('#llm-connect').disabled=false;}};
 sync();
 return {client,ensure(){if(!client.connected){sync();return false;}return true;}};
}
