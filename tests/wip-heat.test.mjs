import test from 'node:test';
import assert from 'node:assert/strict';
import {wipHeat} from '../src/wip-heat.js';
test('heat expands with WIP, stays bounded and uses distinct theme colors',()=>{
 const small=wipHeat(5,0,5,true),big=wipHeat(1000,0,5,true);
 assert.ok(small.radius>25&&small.radius<35);assert.equal(big.radius,58);
 assert.notDeepEqual(small.stops,wipHeat(5,0,5,false).stops);
 assert.notDeepEqual(small.stops,wipHeat(5,5,0,true).stops);
 assert.match(small.stops.at(-1)[1],/,0\)$/);
});
