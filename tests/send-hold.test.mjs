import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {lotState} from '../src/graph-model.js';
import {holdHistory} from '../src/hold-insights.js';
const data=JSON.parse(await readFile(new URL('../data/graph_demo.json',import.meta.url),'utf8'));
test('SEND is an animated inter-fab hold and clears exactly at arrival',()=>{
 const lot={path:[0,1],events:[[1,0,6,121,'SEND'],[121,1,0]],holdReasons:{1:'SEND'}};
 const middle=lotState(lot,61);assert.equal(middle.holdCode,'SEND');assert.equal(middle.eventCode,'hold');assert.equal(middle.fraction,.5);assert.equal(middle.nextNode,1);assert.equal(lotState(lot,121).holdCode,null);
 const history=holdHistory({},[lot],100);assert.equal(history[0].code,'SEND');assert.equal(history[0].lotHours,99/60);
});
test('only inter-fab movements receive SEND in actual and forecast records',()=>{
 let sends=0;for(const [i,lot] of data.lots.entries())for(const e of [...lot.events,...data.forecast.predictions[i].events]){if(e[2]!==6)continue;const crosses=data.nodes[lot.path[e[1]]].fab!==data.nodes[lot.path[e[1]+1]].fab;assert.equal(e[4]==='SEND',crosses);if(crosses)sends++;}assert.ok(sends>0);
});
