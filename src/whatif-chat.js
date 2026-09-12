export const scenarioExamples=[
 {label:'홀드 단축',question:'기존 WIP의 홀드를 1시간으로 줄이면?',input:{count:'0',hold_hours:'1'}},
 {label:'빠른 복구',question:'장비 DOWN/PM이 6시간 후 복구되면?',input:{count:'0',recovery_hours:'6'}},
 {label:'병목 증설',question:'기존 WIP 병목에 최대 3대를 추가하면 어디가 효과적일까?',input:{count:'0',add_tools:'3'}},
 {label:'신규 투입 + 개선',question:'R01에 3일간 100 LOT 투입하고 홀드 1시간, 복구 12시간, 증설 2대를 비교해줘',input:{count:'100',days:'3',route_id:'R01',hold_hours:'1',recovery_hours:'12'}}
];
export function initWhatIfChat(api,context,getLLM,showResult){
 const $=s=>document.querySelector(s),panel=$('#release-panel');
 const style=document.createElement('link');style.rel='stylesheet';style.href='/src/whatif-chat.css';document.head.append(style);
 panel.setAttribute('aria-label','What-if 대화 및 분석');
 const manual=document.createElement('details');manual.id='whatif-manual';manual.innerHTML='<summary>직접 조건 입력</summary>';$('#release-form').before(manual);manual.append($('#release-form'));
 const analysis=document.createElement('section');analysis.id='whatif-analysis';panel.append(analysis);analysis.append($('#analysis-toggle'),$('#analytics-panel'));$('#analysis-toggle').textContent='관측 분석 · 맵 예측 설정';
 manual.insertAdjacentHTML('beforebegin','<section id="whatif-chat"><div class="whatif-chat-heading"><strong>시나리오 대화</strong><span id="whatif-model">예시 모드 · LLM 미연결</span><button id="whatif-settings">LLM 설정</button><button id="whatif-clear">새 대화</button></div><p>질문 → 가상 조건 구성 → 독립 계산 → 인사이트<br>미연결 상태에서는 예시 버튼을 선택해 체험하세요.</p><div id="whatif-examples"></div><div id="whatif-messages" role="log" aria-live="polite"></div><form id="whatif-chat-form"><textarea id="whatif-question" rows="3" maxlength="4000" aria-label="시나리오 질문" placeholder="예: 방금 조건에서 복구만 6시간으로 줄이면?" required></textarea><button id="whatif-send">시나리오 실행 / 질문</button></form><p id="whatif-progress" role="status"></p></section>');
 $('#release-open').addEventListener('click',()=>{$('#assistant-panel').hidden=true;$('#whatif-model').textContent=getLLM()?.client.model||'예시 모드 · LLM 미연결';});
 let busy=false,history=[];
 const message=(role,text)=>{const p=document.createElement('p');p.className='whatif-message '+role;p.textContent=(role==='user'?'나 · ':'What-if · ')+text;$('#whatif-messages').append(p);$('#whatif-messages').scrollTop=$('#whatif-messages').scrollHeight;};
 $('#whatif-settings').onclick=()=>{panel.hidden=true;$('#assistant-panel').hidden=false;$('#llm-settings-open').click();};
 $('#whatif-clear').onclick=()=>{if(busy)return;history=[];$('#whatif-messages').replaceChildren();$('#release-result').replaceChildren();$('#whatif-progress').textContent='새 대화 · 조건 초기화';};
 for(const e of scenarioExamples){const b=document.createElement('button');b.textContent=e.label;b.title=e.question;b.onclick=()=>{$('#whatif-question').value=e.question;};$('#whatif-examples').append(b);}
 $('#whatif-chat-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;const question=$('#whatif-question').value.trim();if(!question)return;
  busy=true;$('#whatif-send').disabled=true;$('#release-run').disabled=true;$('#whatif-progress').textContent='조건 검토 및 계산 중…';message('user',question);
  let runs=0,conditions=[];
  const wrapped={tools:api.tools,call:async(name,args)=>{
   if(name==='fab.what_if_release'&&++runs>2)return {isError:true,content:[{type:'text',text:'질문당 최대 2회 계산입니다. 현재 결과를 정리하세요.'}]};
   if(name==='fab.what_if_release'){conditions.push(args);$('#whatif-progress').textContent='가상 조건 생성 → 7일 계산 중…';message('assistant','계산 조건: '+JSON.stringify(args));}
   const output=await api.call(name,args);if(name==='fab.what_if_release'&&!output.isError)showResult(JSON.parse(output.content[0].text));return output;
  }};
  try{
   let answer;const llm=getLLM();
   if(llm?.client.connected){$('#whatif-model').textContent=llm.client.model;answer=await llm.client.ask(question,wrapped,{history,scenario:true});}
   else{
    const e=scenarioExamples.find(e=>e.question===question);if(!e)throw Error('자유 대화는 LLM 설정에서 연결해 주세요. 미연결 상태에서는 예시 버튼 또는 직접 조건 입력을 사용할 수 있습니다.');
    const input={mode:'optimization',route_id:context().routes[0].id,count:'0',days:'7',wf_qty:'25',hold_hours:'3',recovery_hours:'24',add_tools:'2',...e.input};
    const output=await wrapped.call('fab.what_if_release',input);if(output.isError)throw Error(output.content[0].text);
    const r=JSON.parse(output.content[0].text),base=r.scenarios[0];answer='[예시 실행 · AI 응답 아님]\n기준 완료 '+base.completed+' LOT / '+base.completedWF+' WF, 잔여 '+base.wip+' LOT.\n'+r.recommendation+'\n'+r.assumptions.join('\n');
   }
   message('assistant',answer);history.push({role:'user',content:question},{role:'assistant',content:answer+'\n실행 조건: '+JSON.stringify(conditions)});history=history.slice(-8);$('#whatif-progress').textContent=runs?'계산 완료 · 아래 비교표에서 근거 확인':'응답 완료';
  }catch(error){message('assistant',error.message);$('#whatif-progress').textContent='미완료 · 조건/연결 확인';}
  finally{busy=false;$('#whatif-send').disabled=false;$('#release-run').disabled=false;}
 };
}
