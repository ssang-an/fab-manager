// Synthetic IDs only: not production recipe parameters or qualification records.
export function seedRecipes(data){
 data.recipes=[];
 for(const [index,node] of data.nodes.entries()){
  const equipment=Object.values(node.equipment||{}).flatMap(g=>[...(g.primary||[]),...(g.backup||[])]);
  node.recipe_ids=equipment.length?Array.from({length:3},(_,v)=>{
   const recipe_id=`DEMO-${node.operId}-N${String(index).padStart(4,'0')}-V${v+1}`;
   data.recipes.push({recipe_id,recipe_name:`${node.desc} / SPLIT ${v+1}`,revision:'01',node:index,oper_id:node.operId,oper_desc:node.desc,fab:node.fab,equipment_ids:equipment,synthetic:true});
   return recipe_id;
  }):[];
 }
 for(const lot of data.lots){
  const hash=[...lot.code].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,0);
  lot.recipeByStep=lot.path.map(n=>{const ids=data.nodes[n].recipe_ids;return ids.length?ids[hash%ids.length]:null;});
 }
}
export function recipeAt(state){
 if(!state||state.nextNode!=null||state.event[2]===5)return null;
 return state.lot.recipeByStep?.[state.event[1]]||null;
}
