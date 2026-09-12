import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fabNames,campusLayout,lotLocation,isFabTransfer,fabSummary} from '../src/fab-campus.js';
import {waterfallLayout,lotState} from '../src/graph-model.js';
import {parseRequest} from '../src/assistant-tools.js';
const data=JSON.parse(await readFile(new URL('../data/graph_demo.json',import.meta.url),'utf8'));
test('five real-named synthetic sites, hundreds of codes and R&D cohorts',()=>{
 assert.deepEqual(data.fabs,fabNames);const codes=new Set(data.lots.map(l=>l.code));assert.equal(codes.size,360);for(const code of ['RQQF','RSAB','5TP'])assert.ok(codes.has(code));assert.equal(data.lots.filter(l=>l.program==='R&D').length,1200);
 for(const horizontal of [false,true]){const mapped=campusLayout(waterfallLayout(data.nodes,data.routes),{horizontal});const ranges=fabNames.map(f=>{const a=mapped.filter(n=>n.fab===f);return [Math.min(...a.map(n=>n.y)),Math.max(...a.map(n=>n.y))];}).sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++){const gap=ranges[i][0]-ranges[i-1][1];assert.ok(gap>=229.99&&gap<=420.01);}}
 for(const l of data.lots)for(const [i,eq] of l.equipmentByStep.entries())if(eq)assert.equal(data.equipment.find(e=>e.id===eq).fab,data.nodes[l.path[i]].fab);
});
test('inter-fab trips preserve source until arrival and use longer transport times',()=>{
 let trips=0;for(const l of data.lots)for(const e of l.events){if(e[2]!==6)continue;const s=lotState(l,e[0]);if(!isFabTransfer(s,data.nodes))continue;trips++;assert.ok(e[3]-e[0]>=60);assert.equal(lotLocation(lotState(l,e[3]-.01),data.nodes),data.nodes[s.node].fab);if(e[3]<=10080)assert.equal(lotLocation(lotState(l,e[3]),data.nodes),data.nodes[s.nextNode].fab);}
 assert.ok(trips>100);const states=data.lots.map(l=>lotState(l,10080)).filter(Boolean);assert.equal(fabSummary(states,data.nodes).reduce((n,r)=>n+r.wip,0),states.filter(s=>s.event[2]!==5).length);
});
test('R3 research stays local except short returning support segments; production starts at its own fab',()=>{
 const rd=data.routes.filter(r=>r.program==='R&D'),prod=data.routes.filter(r=>r.program==='PRODUCTION');assert.equal(rd.length,16);assert.equal(prod.length,8);assert.equal(data.lots.filter(l=>l.program==='PRODUCTION').length,4800);
 for(const route of rd){const nodes=route.segments.flat().map(n=>data.nodes[n]);assert.equal(nodes[0].fab,'R3');assert.equal(nodes.at(-1).fab,'R3');assert.ok(nodes.filter(n=>n.fab==='R3').length/nodes.length>.9);assert.ok(nodes.filter(n=>n.fab!=='R3').length<=2);}
 for(const route of prod){assert.ok(route.segments.every(s=>s.length===1));assert.ok(route.segments.flat().every(n=>data.nodes[n].fab===route.homeFab));assert.equal(route.entryStage,0);assert.equal(data.lots.filter(l=>l.route===data.routes.indexOf(route)).length,600);}
});
test('assistant understands site IDs, equipment IDs and R&D program requests',()=>{
 assert.deepEqual(parseRequest('M14 현재 WIP'),{name:'fab.set_filter',arguments:{target:'fab',value:'M14'}});assert.equal(parseRequest('R3-MET-1 장비 검색').arguments.target,'equipment');assert.equal(parseRequest('알앤디 중심으로').arguments.value,'R&D');
});
