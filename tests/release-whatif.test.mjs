import test from 'node:test';
import assert from 'node:assert/strict';
import {runReleaseWhatIf,plannedLots,releaseInputs} from '../src/release-whatif.js';
import {forecastLots} from '../src/fab-analytics.js';
const data={nodes:[{desc:'ETCH',fab:'R3',equipment:{R3:{primary:['T1'],backup:[]}}},{desc:'OUT',fab:'R3',equipment:{R3:{primary:[],backup:[]}}}],routes:[{id:'R01'}],equipment:[{id:'T1',role:'primary',availability:'READY',demoSlots:1,maintenance:[]}],timingStats:[],lots:[{id:'LOT-00001',route:0,code:'A',fab:'R3',lot_type:'MAIN',WF_QTY:25,path:[0,1],events:[[10000,0,0]],equipmentByStep:['T1',null],recipeByStep:['RECIPE',null]}],forecast:{factor:1,holdHours:3}};
const input={count:'10',days:'3',route_id:'R01',wf_qty:'25'};
test('planned releases stay in the future and do not mutate baseline lots',()=>{
 const before=JSON.stringify(data),c=releaseInputs(data,input),lots=plannedLots(data,c,10,'uniform');
 assert.ok(lots.every(l=>l.plannedRelease>10080&&l.plannedRelease<=10080+3*1440));
 assert.equal(new Set(lots.map(l=>l.id)).size,10);assert.equal(lots[0].recipeByStep[0],'RECIPE');
 const f=forecastLots({...data,lots:[...data.lots,...lots]});
 for(const l of lots){const p=f.predictions.find(p=>p.id===l.id);assert.ok(p.events.length);assert.ok(p.events.every(e=>e[0]>=l.plannedRelease));}
 assert.equal(JSON.stringify(data),before);
});
test('what-if reconciles added WIP/completion and keeps baseline separate',()=>{
 const r=runReleaseWhatIf(data,input);assert.equal(r.scenarios.length,4);
 for(const s of r.scenarios){assert.equal(s.newCompleted+s.oldCompleted,s.completed);assert.equal(s.wip+s.completed,1+s.count);assert.equal(s.daily.at(-1).completed,s.completed);}
 assert.equal(r.scenarios[0].newCompleted,0);assert.equal(r.scenarios[1].newCompleted,10);
 assert.throws(()=>runReleaseWhatIf(data,{...input,count:'-1'}));
 assert.throws(()=>runReleaseWhatIf(data,{...input,route_id:'R99'}));
});
