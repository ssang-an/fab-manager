import test from 'node:test';
import assert from 'node:assert/strict';
import {routeIncluded,toggleRoute,routeMatches} from '../src/route-selection.js';
test('route selection accumulates, removes, and distinguishes empty from all',()=>{
  let selection=toggleRoute(null,0);
  selection=toggleRoute(selection,4);
  assert.deepEqual(selection,[0,4]);
  assert.equal(routeIncluded(selection,2),false);
  assert.equal(routeIncluded(selection,4),true);
  selection=toggleRoute(toggleRoute(selection,0),4);
  assert.deepEqual(selection,[]);
  assert.equal(routeIncluded(selection,0),false);
  assert.equal(routeIncluded(null,0),true);
});
test('route search matches ID, name, fab and lot code without changing selection',()=>{
  const route={id:'R01',name:'PLUG TEST',homeFab:'R3',program:'R&D',codes:['RQQF']};
  for(const q of ['r01','plug','r3','rqqf','R&D plug',''])assert.equal(routeMatches(route,q),true);
  assert.equal(routeMatches(route,'R02'),false);
});
