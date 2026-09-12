import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventQueue} from '../src/event-queue.js';
test('priority queue preserves deterministic FCFS ordering across pushes and pops',()=>{const q=new EventQueue(),rows=Array.from({length:500},(_,i)=>({i,ready:(i*71)%29}));rows.forEach(r=>q.push(r));const expected=rows.sort((a,b)=>a.ready-b.ready||a.i-b.i);assert.deepEqual(expected.map(()=>q.pop()),expected);assert.equal(q.length,0);assert.equal(q.pop(),undefined);q.push({i:0,ready:2});q.push({i:1,ready:1});assert.equal(q.pop().i,1);q.push({i:2,ready:0});assert.equal(q.pop().i,2);assert.equal(q.pop().i,0);});
