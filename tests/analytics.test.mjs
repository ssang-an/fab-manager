import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {lotState} from '../src/graph-model.js';
import {pairJobs,equipmentRanking,equipmentAt,holdRanking,holdInfo,forecastLots,OBSERVED_END,FORECAST_END,timingKey,observationMode} from '../src/fab-analytics.js';
const data=JSON.parse(await readFile(new URL('../data/graph_demo.json',import.meta.url),'utf8'));
test('observation badges distinguish past, exact latest snapshot and any forecast instant',()=>{
  assert.equal(observationMode(0),'PAST');assert.equal(observationMode(OBSERVED_END-.01),'PAST');
  assert.equal(observationMode(OBSERVED_END),'LIVE');assert.equal(observationMode(OBSERVED_END+.01),'SIMULATION');assert.equal(observationMode(FORECAST_END),'SIMULATION');
  assert.equal(observationMode(20,20),'LIVE');
});
test('sample links, wafer quantities and assigned equipment have consistent identities',()=>{
  const byId=new Map(data.lots.map(l=>[l.id,l]));assert.equal(data.lots.filter(l=>l.lot_type==='SAMPLE').length,180);
  for(const l of data.lots){assert.ok(Number.isInteger(l.WF_QTY)&&l.WF_QTY>0&&l.WF_QTY<=25);if(l.parent_lot_id){const parent=byId.get(l.parent_lot_id);assert.equal(parent.lot_type,'MAIN');assert.equal(parent.fab,l.fab);assert.equal(parent.route,l.route);assert.ok(parent.sample_lot_ids.includes(l.id));}
    for(const [p,id] of l.equipmentByStep.entries())if(id){assert.ok(data.nodes[l.path[p]].equipment[l.fab].primary.includes(id));assert.equal(data.equipment.find(e=>e.id===id).availability,'READY');}
  }
});
test('JOB pairing excludes incomplete, interrupted and zero-wafer runs without crossing steps',()=>{
  const l={id:'test',path:[1,2],WF_QTY:10,equipmentByStep:['EQ1','EQ2'],lot_type:'MAIN',events:[[0,0,1],[5,0,4],[6,1,1],[7,1,3],[9,1,4],[10,0,1]]};
  const rows=pairJobs(l);assert.equal(rows.length,1);assert.equal(rows[0].sec_per_wafer,30);assert.equal(rows[0].duration_min,5);assert.deepEqual(pairJobs({...l,WF_QTY:0}),[]);assert.deepEqual(pairJobs(l,4),[]);
});
test('equipment WIP reconciles once per resident lot, hold rankings expose reason and age',()=>{
  const states=data.lots.map(l=>lotState(l,OBSERVED_END)).filter(Boolean),rank=equipmentRanking(states);
  assert.equal(rank.reduce((n,r)=>n+r.total,0),states.filter(s=>equipmentAt(s)).length);
  assert.equal(rank.reduce((n,r)=>n+r.wafers,0),states.filter(s=>equipmentAt(s)).reduce((n,s)=>n+s.lot.WF_QTY,0));
  const holds=holdRanking(states,OBSERVED_END);assert.equal(holds.reduce((n,r)=>n+r.total,0),states.filter(s=>s.event[2]===3).length);
  for(const s of states.filter(s=>s.event[2]===3)){const h=holdInfo(s,OBSERVED_END);assert.ok(h.age>=0&&h.action.length>0&&h.owner);}
});
test('forecast only appends after cutoff, preserves observed/out states and obeys virtual tool slots',()=>{
  const byId=new Map(data.forecast.predictions.map(p=>[p.id,p]));const intervals=new Map();
  for(const l of data.lots){const p=byId.get(l.id),current=lotState(l,OBSERVED_END);let last=OBSERVED_END;
    for(const e of p.events){assert.ok(e[0]>last&&e[0]<=FORECAST_END);last=e[0];assert.ok(e[1]<l.path.length);}
    if(current.event[2]===5)assert.equal(p.events.length,0);
    const combined={...l,events:[...l.events,...p.events],equipmentByStep:p.equipmentByStep};
    assert.deepEqual(lotState(combined,OBSERVED_END).event,current.event);
    for(const j of pairJobs(combined,FORECAST_END).filter(j=>j.job_end>OBSERVED_END)){const rows=intervals.get(j.equipment_id)||[];rows.push([Math.max(OBSERVED_END,j.job_start),1],[j.job_end,-1]);intervals.set(j.equipment_id,rows);}
    const final=lotState(combined,FORECAST_END);assert.ok(final);if(current.event[2]===3)assert.notEqual(final.event[2],3);
  }
  for(const [id,marks] of intervals){marks.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let n=0;for(const [,delta] of marks){n+=delta;assert.ok(n<=data.equipment.find(e=>e.id===id).demoSlots,`${id} capacity exceeded`);}}
});
test('forecast is deterministic and slower processing changes near-term outcomes',()=>{
  const normal=forecastLots(data),slow=forecastLots(data,{factor:1.25});assert.deepEqual(normal,data.forecast);
  const out=(f,t)=>f.predictions.filter((p,i)=>lotState({...data.lots[i],events:[...data.lots[i].events,...p.events]},t).event[2]===5).length;
  assert.ok(out(slow,OBSERVED_END+1440)<=out(normal,OBSERVED_END+1440));const active=normal.predictions.findIndex(p=>p.events.some(e=>e[2]===1));assert.ok(active>=0);assert.notDeepEqual(slow.predictions[active],normal.predictions[active]);
  assert.ok(data.timingStats.every(s=>s.key===timingKey(s.equipment_id,s.oper_desc,s.lot_type)&&s.count>0&&s.p90_sec_per_wafer>=s.median_sec_per_wafer));
});
