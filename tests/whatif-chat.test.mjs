import test from 'node:test';
import assert from 'node:assert/strict';
import {createLLMClient} from '../src/llm-connection.js';
import {scenarioExamples} from '../src/whatif-chat.js';
import {validateTool} from '../src/assistant-tools.js';
test('example scenarios use validated simulation inputs',()=>{for(const e of scenarioExamples)validateTool('fab.what_if_release',{mode:'optimization',route_id:'R01',days:'7',...e.input});});
test('What-if conversation retains context and executes a simulation tool before insight',async()=>{
 const bodies=[];let calls=0;
 const client=createLLMClient(async(url,opts)=>{const b=JSON.parse(opts.body);bodies.push(b);const m=bodies.length===1?{content:'OK'}:bodies.length===2?{content:null,tool_calls:[{id:'sim1',type:'function',function:{name:'fab_what_if_release',arguments:JSON.stringify({count:'0',days:'7',route_id:'R01',mode:'optimization',recovery_hours:'6'})}}]}:{content:'시뮬레이션 근거 요약'};return {ok:true,json:async()=>({choices:[{message:m}]})};});
 await client.connect({url:'https://example.invalid/v1',key:'test',model:'test'});
 const api={tools:[{name:'fab.what_if_release',description:'simulation',inputSchema:{type:'object'}}],call:async()=>{calls++;return {content:[{type:'text',text:'{"completedGain":2}'}]};}};
 const answer=await client.ask('복구만 6시간으로 바꿔줘',api,{scenario:true,history:[{role:'user',content:'홀드 1시간으로 비교'},{role:'assistant',content:'hold_hours=1'}]});
 assert.equal(calls,1);assert.equal(answer,'시뮬레이션 근거 요약');assert.ok(bodies[1].messages.some(m=>m.content==='hold_hours=1'));assert.ok(bodies[2].messages.some(m=>m.role==='tool'));assert.ok(!JSON.stringify(bodies).includes('Bearer'));
});
