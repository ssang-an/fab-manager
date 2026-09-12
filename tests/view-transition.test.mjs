import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPoint} from '../src/graph-model.js';
test('projection blends preserve both mode endpoints and remain finite',()=>{
 const point={x:1600,y:900,z:280},camera={depth:false,vertical:false,yaw:.24,pitch:-.4};
 assert.deepEqual(projectPoint(point,{...camera,depthMix:0,orientationMix:0}),projectPoint(point,camera));
 assert.deepEqual(projectPoint(point,{...camera,depthMix:1,orientationMix:1}),projectPoint(point,{...camera,depth:true,vertical:true}));
 let last=projectPoint(point,camera);
 for(let i=1;i<=100;i++){const p=projectPoint(point,{...camera,depthMix:i/100,orientationMix:i/100});assert.ok(Object.values(p).every(Number.isFinite));assert.ok(Math.hypot(p.x-last.x,p.y-last.y)<50);last=p;}
});
