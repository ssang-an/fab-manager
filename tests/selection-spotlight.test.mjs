import test from 'node:test';
import assert from 'node:assert/strict';
import {drawSelectionSpotlight} from '../src/selection-spotlight.js';
test('spotlight skips empty and offscreen selections, caps dense targets and restores canvas',()=>{const calls=[];const ctx=new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});drawSelectionSpotlight(ctx,[],800,600,true);assert.equal(calls.length,0);drawSelectionSpotlight(ctx,[{x:-2,y:1}],800,600,true);assert.equal(calls.length,0);drawSelectionSpotlight(ctx,Array.from({length:100},()=>({x:100,y:100,label:'LOT-123',kind:'lot'})),800,600,false);assert.equal(calls.filter(c=>c[0]==='arc').length,64);assert.equal(calls.at(-1)[0],'restore');});
