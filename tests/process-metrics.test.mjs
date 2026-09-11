import {test} from 'node:test';
import assert from 'node:assert/strict';
import {processMetrics} from '../src/process-metrics.js';
test('shared equipment workload, incomplete processing and downtime are distinguished',()=>{
 const data={nodes:[{equipment:{A:{primary:['E'],backup:[]}}}],equipment:[{id:'E',availability:'READY',demoSlots:2,maintenance:[{start:30,end:60,kind:'DOWN'}]}],lots:[{id:'L',lot_type:'MAIN',WF_QTY:10,path:[0],equipmentByStep:['E'],events:[[0,0,1],[10,0,2],[20,0,4]]},{id:'X',lot_type:'SAMPLE',WF_QTY:1,path:[99],equipmentByStep:['E'],events:[[60,0,1],[70,0,2]]}]};
 const m=processMetrics(data,0,120);assert.equal(m.count,1);assert.equal(m.mean,20);assert.equal(m.secPerWafer,120);assert.equal(m.tools[0].down,30);assert.equal(m.tools[0].busy,80);assert.equal(m.idle,100);assert.equal(m.util,80/180*100);assert.equal(m.sample.mean,null);
 assert.equal(processMetrics(data,0,10).count,0);assert.equal(processMetrics(data,0,0).util,null);
});
