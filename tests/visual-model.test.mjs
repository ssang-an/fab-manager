import {test} from 'node:test';
import assert from 'node:assert/strict';
import {areaLoad,miniTransform} from '../src/visual-model.js';
test('area loads exclude out and separate moving WIP',()=>{const rows=areaLoad([{node:0,event:[0,0,0],nextNode:null},{node:0,event:[0,0,3],nextNode:null},{node:0,event:[0,0,6],nextNode:1},{node:0,event:[0,0,5],nextNode:null}],[{layer:0}]);assert.deepEqual(rows[0],{total:3,wait:1,hold:1,proc:0,move:1});});
test('navigator transform fits and can invert projected positions',()=>{assert.equal(miniTransform([],180,100),null);const t=miniTransform([{x:-30,y:10},{x:800,y:300}],180,100);for(const p of [{x:-30,y:10},{x:800,y:300}]){const x=p.x*t.scale+t.x,y=p.y*t.scale+t.y;assert.ok(x>=7&&x<=173&&y>=7&&y<=93);assert.ok(Math.abs((x-t.x)/t.scale-p.x)<1e-8);}});
