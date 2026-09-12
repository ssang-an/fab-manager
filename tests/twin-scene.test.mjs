import test from 'node:test';
import assert from 'node:assert/strict';
import {flowTotals} from '../src/twin-scene.js';
import {siteOf,sites} from '../src/fab-campus.js';
test('FAB IN and OUT totals respect time and do not count SEND as FAB OUT',()=>{
 const lots=[{events:[[10,0,0],[20,0,6,30,'SEND'],[40,1,5]]},{events:[[100,0,0]]}];
 assert.deepEqual(flowTotals(lots,30),{entered:1,out:0,recentIn:1,recentOut:0,pending:1});
 assert.equal(flowTotals(lots,40).out,1);
 assert.equal(flowTotals(lots,2000).recentOut,0);
});
test('user specified sites contain all eight fabs without mixing sites',()=>{
 assert.equal(siteOf('M16'),'ICHEON');assert.equal(siteOf('M15'),'CHEONGJU');
 assert.equal(siteOf('R4'),'ICHEON');assert.equal(siteOf('M12'),'CHEONGJU');
 assert.equal(new Set(sites.flatMap(s=>s.fabs)).size,8);
});
