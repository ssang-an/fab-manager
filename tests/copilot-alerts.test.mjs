import test from 'node:test';
import assert from 'node:assert/strict';
import {createAlertDetector} from '../src/copilot-alerts.js';
const snap=(minute,down=[],wip=[],scope='all')=>({minute,down,wip,scope});
test('Copilot detects DOWN transitions, avoids repeats and labels seeks as current state',()=>{
 const d=createAlertDetector(),down=[{id:'R3-ETCH-1',key:'incident1'}];
 assert.equal(d(snap(0),0),null);
 assert.equal(d(snap(1,down),31000).kind,'equipment');
 assert.equal(d(snap(2,down),62000),null);
 assert.match(d(snap(200,down),93000).text,/현재 DOWN/);
 assert.equal(d(snap(201,down,[],'R3'),94000),null);
});
test('Copilot WIP threshold and cooldown suppress notification floods',()=>{
 const d=createAlertDetector(),w=total=>[{node:1,desc:'PLUG ETCH',total,wait:total}];
 d(snap(0,[],w(19)),0);
 assert.equal(d(snap(1,[],w(20)),31000).kind,'process');
 assert.equal(d(snap(2,[],w(21)),32000),null);
 assert.equal(d(snap(3,[],w(22)),62000),null);
});
