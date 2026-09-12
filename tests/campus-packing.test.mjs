import test from 'node:test';
import assert from 'node:assert/strict';
import {compactCampus} from '../src/fab-campus.js';
test('selected nonadjacent fabs pack together while preserving local geometry',()=>{
 const nodes=[{fab:'M10',x:1,y:0,z:5},{fab:'M10',x:2,y:120,z:6},{fab:'M14',x:3,y:2200,z:7},{fab:'R3',x:4,y:4400,z:8},{fab:'R3',x:5,y:4700,z:9}];
 const packed=compactCampus(nodes,new Set([0,1,3,4]));
 assert.equal(packed[0].y-packed[4].y,300);
 const horizontal=compactCampus(nodes,new Set([0,1,3,4]),{horizontal:true});
 assert.equal(horizontal[0].y-horizontal[4].y,230);
 assert.equal(packed[4].y-packed[3].y,300);
 assert.equal(packed[1].y-packed[0].y,120);
 assert.deepEqual(packed.map(n=>[n.fab,n.x,n.z]),nodes.map(n=>[n.fab,n.x,n.z]));
 assert.equal(nodes[3].y,4400);
 assert.deepEqual(compactCampus(nodes,new Set()),nodes);
});
