import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {lotState,eventAt,projectPoint,linkPoint,wipRanking,waterfallLayout,processAreas,areaLayerGap,dragMode,rotationForDrag} from '../src/graph-model.js';
const data=JSON.parse(await readFile(new URL('../data/graph_demo.json',import.meta.url),'utf8'));
test('area layout preserves downstream order with bounded diagonal layer changes',()=>{
  const nodes=waterfallLayout(data.nodes,data.routes);
  for(const edge of data.edges){
    const a=nodes[edge.source],b=nodes[edge.target];
    assert.ok(b.x>a.x);assert.ok(Math.abs(b.z-a.z)<=6*areaLayerGap);
    const from=projectPoint(a,{vertical:true,depth:false}),to=projectPoint(b,{vertical:true,depth:false});
    assert.ok(to.y>from.y);
    assert.equal(a.id,data.nodes[edge.source].id);
  }
  assert.notEqual(nodes[0],data.nodes[0]);
  assert.equal(new Set(nodes.map(n=>n.area)).size,7);
  for(const node of nodes){assert.equal(node.z,node.layer*areaLayerGap);assert.equal(node.area,processAreas[node.layer].id);if(node.operId.startsWith('MET-'))assert.equal(node.area,'MI');}
  assert.ok(data.edges.some(e=>nodes[e.source].z>nodes[e.target].z));
  assert.ok(data.edges.some(e=>nodes[e.source].z<nodes[e.target].z));
  const again=waterfallLayout(data.nodes,data.routes);assert.deepEqual(nodes,again);
});
test('plain mouse drag pans; only Shift with the primary button rotates in 3D',()=>{
  assert.equal(dragMode(true,0,false),'pan');assert.equal(dragMode(true,0,true),'rotate');
  assert.equal(dragMode(false,0,true),'pan');assert.equal(dragMode(true,2,true),'pan');
});
test('screen-space orbit follows drag axes in both orientations, even after prior rotations',()=>{
  const point={x:2600,y:1800,z:200};
  for(const vertical of [false,true])for(const [yaw,pitch] of [[0,0],[.24,-.4],[2,1.8]]){
    const camera={depth:true,vertical,yaw,pitch};
    // Remove perspective to check axis alignment in the screen-space view plane.
    const view=c=>{const p=projectPoint(point,c),f=(6500+p.depth)/6500;return {x:p.x*f,y:p.y*f,z:p.depth};};
    for(const prior of [false,true]){
      if(prior)camera.rotation=rotationForDrag(camera,67,-43);
      const before=view(camera),right=view({...camera,rotation:rotationForDrag(camera,10,0)}),down=view({...camera,rotation:rotationForDrag(camera,0,10)});
      assert.ok(Math.abs(right.y-before.y)<1e-8,'horizontal drag keeps view-plane y');
      assert.ok(Math.abs(down.x-before.x)<1e-8,'vertical drag keeps view-plane x');
    }
  }
  for(const vertical of [false,true]){
    const camera={depth:true,vertical,yaw:0,pitch:0},front={x:2535,y:1725,z:280};
    assert.ok(projectPoint(front,{...camera,rotation:rotationForDrag(camera,10,0)}).x>0);
    assert.ok(projectPoint(front,{...camera,rotation:rotationForDrag(camera,0,10)}).y>0);
  }
});
test('route alternatives split and merge; every realized lot path uses a valid directed edge',()=>{
  const edges=new Map(data.edges.map(e=>[`${e.source}:${e.target}`,e]));
  assert.equal(data.lots.length,1800);assert.equal(data.routes.length,24);
  assert.ok(new Set(data.routes.map(r=>r.segments.length)).size>1);
  assert.equal(new Set(data.routes.flatMap(r=>r.codes)).size,120);
  for(const e of data.edges)assert.ok(data.nodes[e.source].x<data.nodes[e.target].x,'forward route ordering');
  for(const r of data.routes)assert.ok(r.segments.some(s=>s.length===2));
  for(const lot of data.lots){
    assert.ok(data.routes[lot.route].codes.includes(lot.code));
    for(let p=1;p<lot.path.length;p++)assert.ok(edges.get(`${lot.path[p-1]}:${lot.path[p]}`)?.routes.includes(lot.route));
    let last=-1;
    for(const [time,index,status] of lot.events){assert.ok(time>last);last=time;assert.ok(time<=10080);assert.ok(index>=0&&index<lot.path.length);assert.ok(status>=0&&status<=6);}
  }
});
test('replay hides future lots and interpolates only a recorded transfer',()=>{
  const lot={path:[5,8],events:[[10,0,0],[20,0,2],[30,0,4],[40,1,0]]};
  assert.equal(eventAt(lot.events,9),-1);assert.equal(lotState(lot,9),null);
  assert.equal(lotState(lot,25).nextNode,null);
  assert.equal(lotState(lot,35).fraction,.5);assert.equal(lotState(lot,35).nextNode,8);
  assert.equal(lotState(lot,40).node,8);
});
test('WIP, out and unreleased reconcile at time boundaries',()=>{
  for(const time of [0,1,1440,5000,10080]){
    let wip=0,out=0,unreleased=0;
    for(const lot of data.lots){const state=lotState(lot,time);if(!state)unreleased++;else if(state.event[2]===5)out++;else wip++;}
    assert.equal(wip+out+unreleased,1800);
  }
});
test('3D projection uses route depth and changes with orbit',()=>{
  const node={x:100,y:200,z:300};const flat=projectPoint(node,{depth:false});
  const orbit=projectPoint(node,{depth:true,yaw:.5,pitch:.7});
  assert.notDeepEqual(flat,orbit);assert.ok(Number.isFinite(orbit.x)&&Number.isFinite(orbit.y));
});
test('animated lots follow the drawn cubic connection',()=>{
  const a={x:0,y:0},b={x:100,y:100};
  assert.deepEqual(linkPoint(a,b,0),a);assert.deepEqual(linkPoint(a,b,1),b);
  assert.deepEqual(linkPoint(a,b,.5),{x:50,y:50});
  assert.deepEqual(linkPoint(a,b,.25),{x:29.6875,y:15.625});
  assert.deepEqual(linkPoint(a,b,.25,true),{x:15.625,y:29.6875});
});
test('explicit travel keeps its fractional position even when arrival is outside the data window',()=>{
  const lot={path:[4,8],events:[[9999,0,4],[10000,0,6,10020]]};
  const state=lotState(lot,10010);assert.equal(state.nextNode,8);assert.equal(state.fraction,.5);
  assert.deepEqual(wipRanking([state]),[]);
});
test('route entry and exit vary, routes cross layers, equipment respects fab and role',()=>{
  assert.ok(data.routes.some(r=>r.entryStage>0));assert.ok(data.routes.some(r=>r.exitStage<11));
  for(const route of data.routes){assert.equal(data.nodes[route.segments[0][0]].stage,route.entryStage);assert.equal(data.nodes[route.segments.at(-1)[0]].stage,route.exitStage);assert.ok(new Set(route.segments.flat().map(n=>data.nodes[n].layer)).size>1);}
  for(const node of data.nodes)for(const fab of ['A','B'])for(const role of ['primary','backup'])for(const id of node.equipment[fab][role]){const tool=data.equipment.find(e=>e.id===id);assert.equal(tool.fab,fab);assert.equal(tool.role,role);}
});
test('rankings change with time and count only lots resident at a process',()=>{
  const states=t=>data.lots.map(l=>lotState(l,t)).filter(Boolean);
  const at=states(10080),rank=wipRanking(at);
  assert.equal(rank.reduce((sum,r)=>sum+r.total,0),at.filter(s=>s.event[2]!==5&&s.nextNode===null).length);
  assert.notDeepEqual(rank.slice(0,5),wipRanking(states(5000)).slice(0,5));
  assert.ok(rank.every((r,i)=>!i||rank[i-1].total>=r.total));
});
