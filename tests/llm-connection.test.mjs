import test from 'node:test';
import assert from 'node:assert/strict';
import {createLLMClient,validateConnection,DEFAULT_LLM_URL} from '../src/llm-connection.js';
const input={url:DEFAULT_LLM_URL,key:'test-not-a-real-key',model:'test-model',allowHttp:true};
test('configuration requires key/model and explicit HTTP consent',()=>{
 assert.throws(()=>validateConnection({...input,allowHttp:false}));
 assert.throws(()=>validateConnection({...input,key:''}));
 assert.throws(()=>validateConnection({...input,url:'https://user:secret@example.com/v1'}));
 assert.equal(validateConnection(input).url,DEFAULT_LLM_URL);
});
test('connect sends only test prompt, succeeds on compatible response, disconnect clears state',async()=>{
 let request;const client=createLLMClient(async(url,opts)=>{request={url,opts};return {ok:true,json:async()=>({choices:[{message:{content:'OK'}}]})};});
 assert.equal(client.connected,false);await client.connect(input);
 assert.equal(client.model,'test-model');assert.equal(request.url,DEFAULT_LLM_URL+'/chat/completions');
 assert.equal(request.opts.redirect,'error');assert.equal(JSON.parse(request.opts.body).messages.length,1);
 client.disconnect();assert.equal(client.connected,false);assert.equal(client.model,null);
});
test('auth and incompatible response failures do not set connected or echo secrets',async()=>{
 const denied=createLLMClient(async()=>({ok:false,status:401}));
 await assert.rejects(()=>denied.connect(input),/인증 실패/);assert.equal(denied.connected,false);
 const invalid=createLLMClient(async()=>({ok:true,json:async()=>({})}));
 await assert.rejects(()=>invalid.connect(input),/호환/);assert.equal(invalid.connected,false);
});
test('late authentication after disconnect is discarded',async()=>{
 let finish;const c=createLLMClient(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=c.connect(input);c.disconnect();finish({ok:true,json:async()=>({choices:[{message:{content:'OK'}}]})});
 await assert.rejects(()=>pending,/폐기/);assert.equal(c.connected,false);
});
