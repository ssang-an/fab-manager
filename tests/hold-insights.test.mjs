import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {forecastLots,OBSERVED_END} from '../src/fab-analytics.js';
import {lotState} from '../src/graph-model.js';
import {holdHistory,forecastMetrics} from '../src/hold-insights.js';
const data=JSON.parse(await readFile(new URL('../data/graph_demo.json',import.meta.url),'utf8'));
test('default three-hour release ages from the original hold, preserves actual history and queues the same operation',()=>{
 assert.equal(data.forecast.holdHours,3);
 for(const [i,l] of data.lots.entries()){const s=lotState(l,OBSERVED_END);if(s.event[2]!==3)continue;const first=data.forecast.predictions[i].events[0];assert.equal(first[0],Math.max(OBSERVED_END+.01,s.event[0]+180));assert.equal(first[1],s.event[1]);assert.equal(first[2],0);}
});
test('no-release baseline retains holds and custom targets reduce hold exposure with a shared equipment recovery scenario',()=>{
 const frozen=forecastLots(data,{holdHours:null}),slow=forecastLots(data,{holdHours:12});
 for(const [i,l] of data.lots.entries())if(lotState(l,OBSERVED_END).event[2]===3)assert.equal(frozen.predictions[i].events.length,0);
 const normal=forecastMetrics(data,data.forecast),baseline=forecastMetrics(data,frozen),long=forecastMetrics(data,slow);
 assert.ok(normal.holdHours<baseline.holdHours);assert.ok(normal.holdHours<long.holdHours);assert.ok(normal.out7>=baseline.out7);
 for(const bad of [-1,169,NaN])assert.throws(()=>forecastLots(data,{holdHours:bad}),RangeError);
});
test('hold history counts episodes and distinct visits, clips open durations and excludes future',()=>{
 const lots=[{id:'L1',path:[0,1],holdReasons:{10:'AHSO',30:'AHSO',100:'SPC'},events:[[0,0,0],[10,0,3],[15,0,3],[20,0,0],[30,0,3],[90,1,0],[100,1,3]]},{id:'L2',path:[0],events:[[0,0,0]],holdReasons:{}}];
 const rows=holdHistory({},lots,60);assert.equal(rows.length,1);const r=rows[0];assert.equal(r.count,2);assert.equal(r.visits,2);assert.equal(r.affected,1);assert.equal(r.rate,50);assert.equal(r.open,1);assert.equal(r.lotHours,40/60);assert.equal(r.days,1);
 assert.equal(holdHistory({},lots,9).length,0);
});
test('synthetic AHSO occurrences exist on measurement operations across days',()=>{
 const rows=holdHistory(data).filter(r=>r.code==='AHSO');assert.ok(rows.length);assert.ok(rows.some(r=>r.days>=2));assert.ok(rows.every(r=>data.nodes[r.node].operId.startsWith('MET')&&r.rate<=100));
});
