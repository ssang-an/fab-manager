import test from 'node:test';
import assert from 'node:assert/strict';
import {operationSnapshot} from '../src/operation-drilldown.js';
test('operation drilldown partitions queues, active jobs and synthetic chambers without losing lots',()=>{
 const data={nodes:[{fab:'R3',equipment:{R3:{primary:['T1'],backup:['T2']}}}],equipment:[{id:'T1',availability:'READY'},{id:'T2',availability:'DOWN'}]};
 const make=(id,status,tool='T1')=>({node:0,nextNode:null,event:[0,0,status],lot:{id,equipmentByStep:[tool]}});
 const states=[make('W',0),make('L',1),make('P',2),make('H',3),make('E',4),make('U',2,'OTHER'),{...make('M',2),nextNode:1},make('OUT',5)];
 const before=JSON.stringify(states),s=operationSnapshot(data,states,0,10080);
 assert.equal(s.tools.length,2);assert.equal(s.tools[1].status,'DOWN');assert.equal(s.tools[0].active.length,2);
 assert.deepEqual(s.tools[0].ports.flatMap(c=>c.lots.map(s=>s.lot.id)),['L']);
 assert.deepEqual(s.tools[0].chambers.flatMap(c=>c.lots.map(s=>s.lot.id)),['P']);
 assert.deepEqual([s.wait.length,s.hold.length,s.end.length,s.unassigned.length],[1,1,1,1]);assert.equal(JSON.stringify(states),before);
});
