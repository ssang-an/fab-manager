import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {equipmentStatus,downImpact,recoveryEstimate} from '../src/equipment-health.js';
import {lotState} from '../src/graph-model.js';
const data=JSON.parse(await readFile(new URL('../data/graph_demo.json',import.meta.url),'utf8'));
test('seeded recovery obeys code ranges and does not change observed maintenance history',()=>{
 for(const tool of data.equipment){const r=tool.maintenance.find(r=>r.estimate);if(!r)continue;assert.deepEqual(r.estimate,recoveryEstimate(tool.id,r.code,r.start));assert.ok(r.estimate.hours>=r.estimate.rangeHours[0]&&r.estimate.hours<=r.estimate.rangeHours[1]);if(r.code==='COPM')assert.ok(r.estimate.hours<=12);assert.notEqual(equipmentStatus(tool,10080).status,'READY');assert.notEqual(equipmentStatus(tool,r.estimate.upAt-.01).status,'READY');assert.equal(equipmentStatus(tool,r.estimate.upAt).status,'READY');assert.equal(r.end,null);if(tool.id==='A-ETCH-2')assert.ok(data.forecast.predictions.some(p=>p.events.some(e=>e[2]===1&&p.equipmentByStep[e[1]]===tool.id&&e[0]>=r.estimate.upAt)));}
});
test('maintenance status respects start/end boundaries and unknown recovery persists',()=>{
 const e={availability:'READY',maintenance:[{kind:'DOWN',start:10,end:20},{kind:'DOWN',start:30,end:null}]};
 for(const [t,status] of [[9,'READY'],[10,'DOWN'],[19,'DOWN'],[20,'READY'],[29,'READY'],[30,'DOWN'],[20160,'DOWN']])assert.equal(equipmentStatus(e,t).status,status);
});
test('down impacts identify assigned resident lots, and no processing remains on DOWN tools',()=>{
 const states=data.lots.map(l=>lotState(l,10080)).filter(Boolean),rows=downImpact(data,states,10080);
 assert.equal(rows.length,5);assert.equal(downImpact(data,states,10079).length,2);
 assert.ok(rows.some(r=>r.interrupted>0));assert.ok(rows.some(r=>r.wait>0));
 for(const r of rows){assert.ok(r.tool.maintenance.length);for(const s of r.lots){assert.equal(s.lot.equipmentByStep[s.event[1]],r.tool.id);assert.ok(![1,2].includes(s.event[2]));if(s.lot.downCause?.[s.event[0]])assert.equal(s.event[2],3);}}
});
test('forecast never starts work on DOWN or PM equipment',()=>{
 for(const p of data.forecast.predictions)for(const e of p.events)if(e[2]===1){const tool=data.equipment.find(t=>t.id===p.equipmentByStep[e[1]]);assert.equal(equipmentStatus(tool,e[0]).status,'READY');}
});
