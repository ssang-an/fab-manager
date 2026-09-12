// null means all routes; [] means an explicit empty selection.
export const routeIncluded=(selection,index)=>selection===null||selection.includes(index);
export function toggleRoute(selection,index){
  const next=new Set(selection||[]);
  if(next.has(index))next.delete(index);else next.add(index);
  return [...next];
}
export function routeMatches(route,query){
  const haystack=[route.id,route.name,route.program,route.homeFab,...route.codes].join(' ').toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).every(word=>haystack.includes(word));
}
