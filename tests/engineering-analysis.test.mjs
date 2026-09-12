import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeEngineering,engineeringRequest,questionExamples} from '../src/engineering-analysis.js';
import {parseRequest,validateTool,toolSchemas} from '../src/assistant-tools.js';
import {workspaceAction} from '../src/personal-workspace.js';
const data={startTime:0,statuses:['wait','start','proc','hold','end','out','move'],nodes:[{desc:'ETCH',operId:'E1',fab:'R3'},{desc:'ETCH',operId:'E2',fab:'R3'},{desc:'OUT',operId:'O',fab:'R3'}],routes:[{id:'R01'}],equipment:[],lots:[
 {id:'LOT-01231',code:'A',route:0,WF_QTY:25,path:[0,1,2],recipeByStep:['A','B',null],equipmentByStep:['T1','T2',null],events:[[9000,0,0],[9010,0,1],[9020,0,4],[10000,1,0]],sample_lot_ids:[]},
 {id:'LOT-01203',code:'B',route:0,WF_QTY:20,path:[0,2],recipeByStep:['C',null],equipmentByStep:['T3',null],events:[[9000,0,0]],sample_lot_ids:[]}
 ],forecast:{predictions:[{id:'LOT-01231',events:[[10100,1,1],[10120,1,4],[10200,2,5]],equipmentByStep:['T1','T2',null]}]}};
test('question catalogue routes to validated tools and normalizes example LOT IDs',()=>{
 for(const q of questionExamples){const cmd=parseRequest(q);assert.ok(cmd,q);validateTool(cmd.name,cmd.arguments);}
 assert.deepEqual(engineeringRequest('LOT1231, LOT1203 진행 플랜이랑 레시피/진행장비 다른거 분석해줘'),{kind:'compare',lot_ids:['LOT-01231','LOT-01203']});
 assert.equal(engineeringRequest('LOT1231 PLUG ETCH 언제 도착할까?').target,'PLUG ETCH');
});
test('comparison aligns repeated operation occurrences and exposes absent steps',()=>{
 const r=analyzeEngineering(data,{kind:'compare',lot_ids:['LOT1231','LOT1203']});
 assert.equal(r.differences.find(d=>d.operation==='ETCH#1').fields.includes('recipe_id'),true);
 assert.deepEqual(r.differences.find(d=>d.operation==='ETCH#2').fields,['route_membership']);
 assert.throws(()=>analyzeEngineering(data,{kind:'plan',lot_ids:['LOT99999']}));
});
test('ETA preserves actual arrivals, distinguishes repeated visits and refuses past hindsight',()=>{
 const r=analyzeEngineering(data,{kind:'eta',lot_ids:['LOT1231'],target:'ETCH'});
 assert.equal(r.lots[0].arrivals.length,2);assert.equal(r.lots[0].arrivals[0].basis,'관측');
 const out=analyzeEngineering(data,{kind:'eta',lot_ids:['LOT1231'],target:'FAB OUT'});
 assert.equal(out.lots[0].arrivals[0].basis,'예측');
 assert.ok(analyzeEngineering(data,{kind:'eta',lot_ids:['LOT1231']},9000).unavailable);
 const missing=analyzeEngineering(data,{kind:'eta',lot_ids:['LOT1203'],target:'FAB OUT'});
 assert.equal(missing.lots[0].arrivals[0].arrival,null);
 assert.equal(analyzeEngineering(data,{kind:'eta',lot_ids:['LOT1231'],target:'NOPE'}).lots[0].status,'공정 없음 또는 이름 불명확');
});
test('problem LOT analysis obeys passed scope and excludes fabrication OUT',()=>{
 assert.equal(analyzeEngineering(data,{kind:'issues'},10080,[]).total,0);
 assert.equal(analyzeEngineering(data,{kind:'issues'},10080).rows[0].lot_id,'LOT-01203');
});
test('personal workspace persists deduplicated watches and named snapshots',()=>{
 let value=null;const storage={getItem:()=>value,setItem:(k,v)=>{value=v;}};
 workspaceAction(storage,{action:'watch',lot_id:'LOT-01231'});
 assert.equal(workspaceAction(storage,{action:'watch',lot_id:'LOT-01231'}).watch.length,1);
 workspaceAction(storage,{action:'save_view',name:'test',snapshot:{minute:10080}});
 assert.equal(workspaceAction(storage,{action:'list'}).views[0].snapshot.minute,10080);
 assert.equal(workspaceAction(storage,{action:'unwatch',lot_id:'LOT-01231'}).watch.length,0);
});
