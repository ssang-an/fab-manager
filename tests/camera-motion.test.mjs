import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraFrame,followFrame,fitCamera} from '../src/camera-motion.js';
test('fit centers projected bounds with symmetric margins in wide and tall viewports',()=>{
 for(const [width,height] of [[1400,740],[740,1000]])for(const b of [{minX:-300,maxX:4000,minY:100,maxY:1100},{minX:20,maxX:300,minY:-500,maxY:4500}]){
  const c=fitCamera(b,width,height);
  assert.ok(Math.abs(c.x+(b.minX+b.maxX)/2*c.scale-width/2)<1e-8);
  assert.ok(Math.abs(c.y+(b.minY+b.maxY)/2*c.scale-height/2)<1e-8);
  assert.ok((b.maxY-b.minY)*c.scale<=height-160);
  assert.ok((b.maxX-b.minX)*c.scale<=width-110);
 }
});
test('camera transitions are bounded, continuous and converge at both endpoints',()=>{
 const a={x:-800,y:40,scale:.08},b={x:500,y:-90,scale:1.2};
 for(const t of [0,.1,.5,.9,1]){const p=cameraFrame(a,b,t);assert.ok(p.scale>=a.scale-1e-9&&p.scale<=b.scale+1e-9);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
 for(const k of ['x','y','scale']){assert.ok(Math.abs(cameraFrame(a,b,0)[k]-a[k])<1e-8);assert.ok(Math.abs(cameraFrame(a,b,1)[k]-b[k])<1e-8);}
});
test('follow damping is frame-rate independent and does not overshoot',()=>{
 const a={x:0,y:100},b={x:500,y:-100};
 const once=followFrame(a,b,.1),twice=followFrame(followFrame(a,b,.05),b,.05);
 assert.ok(Math.abs(once.x-twice.x)<1e-8);assert.ok(Math.abs(once.y-twice.y)<1e-8);
 assert.ok(once.x>0&&once.x<500);assert.deepEqual(followFrame(a,b,0),a);
});
