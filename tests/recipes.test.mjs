import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recipeAt} from '../src/recipes.js';
import {lotState} from '../src/graph-model.js';
import {pairJobs} from '../src/fab-analytics.js';
test('recipe IDs resolve to the correct operation and assigned tool for every lot step',()=>{
 const d=JSON.parse(fs.readFileSync(new URL('../data/graph_demo.json',import.meta.url)));
 const recipes=new Map(d.recipes.map(r=>[r.recipe_id,r]));
 assert.equal(recipes.size,d.recipes.length);
 for(const lot of d.lots){
  assert.equal(lot.recipeByStep.length,lot.path.length);
  lot.path.forEach((n,p)=>{const id=lot.recipeByStep[p];if(!id){assert.equal(d.nodes[n].recipe_ids.length,0);return;}const r=recipes.get(id);assert.equal(r.node,n);assert.ok(d.nodes[n].recipe_ids.includes(id));if(lot.equipmentByStep[p])assert.ok(r.equipment_ids.includes(lot.equipmentByStep[p]));});
 }
 const lot=d.lots.find(l=>pairJobs(l).length);
 for(const j of pairJobs(lot))assert.ok(recipes.has(j.recipe_id));
 const moving=d.lots.map(l=>lotState(l,10080)).find(s=>s?.nextNode!=null);
 assert.equal(recipeAt(moving),null);
});
