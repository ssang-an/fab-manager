import test from 'node:test';
import assert from 'node:assert/strict';
import {operationMapLayout} from '../src/operation-map.js';
test('node map includes every lot once and fits dense queues and active groups',()=>{
 const lots=n=>Array.from({length:n},(_,i)=>({lot:{id:String(i)},event:[0,0,2]}));
 const s={tools:[{id:'T1',role:'주 장비',status:'READY',chambers:[{id:'CH1',lots:lots(100)}],ports:[{id:'LP1',lots:lots(5)}]}],wait:lots(600),hold:lots(70),end:[],unassigned:lots(3)};
 const l=operationMapLayout(s);assert.equal(l.lots.length,778);assert.equal(l.edges.length,3);
 for(const p of l.lots){assert.ok(p.x>=0&&p.x<=l.width);assert.ok(p.y>=0&&p.y<l.height);}
 assert.ok(operationMapLayout({...s,tools:[]}).height>0);
});
