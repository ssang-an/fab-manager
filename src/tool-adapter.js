import {workspaceAction} from './personal-workspace.js';
import {normalizeLot} from './engineering-analysis.js';
import {observationMode} from './fab-analytics.js';
export function createAdapter(hooks){
 const $=s=>document.querySelector(s),change=(id,value)=>{const el=$('#'+id);if(!el)throw Error('먼저 관련 분석 패널을 열어주세요.');el.value=value;el.dispatchEvent(new Event(id==='equipment-search'?'input':'change',{bubbles:true}));};
 const oneOf=(v,values)=>{if(!values.includes(v))throw Error(`허용 값: ${values.join(', ')}`);return v;};
 const number=(v,min,max)=>{const n=Number(v);if(v.trim()===''||!Number.isFinite(n)||n<min||n>max)throw Error(`${min}~${max} 범위 숫자가 필요합니다.`);return n;};
 return async(name,args)=>{
  const c=hooks.context(),{data,states}=c;if(!data)throw Error('데이터 로딩 중입니다.');
  if(name==='fab.personal_workspace'){
   const input={...args};if(['watch','unwatch'].includes(args.action)){input.lot_id=normalizeLot(args.lot_id||'');if(!data.lots.some(l=>l.id===input.lot_id))throw Error('존재하지 않는 LOT');}
   if(args.action==='save_view'){if(!args.name?.trim())throw Error('저장 이름이 필요합니다.');input.snapshot={fab:c.fab,rdOnly:c.rdOnly,route:c.route,search:c.search,minute:c.minute};}
   return workspaceAction(localStorage,input);
  }
  if(name==='fab.restore_view'){const v=workspaceAction(localStorage,{action:'list'}).views.find(v=>v.name===args.name);if(!v)throw Error('저장된 필터 없음');const p=v.snapshot;if(!p||!['all',...data.fabs].includes(p.fab)||!Number.isFinite(p.minute)||p.minute<0||p.minute>20160||typeof p.search!=='string'||p.route!==null&&(!Array.isArray(p.route)||p.route.some(i=>!Number.isInteger(i)||!data.routes[i])))throw Error('저장 필터가 현재 데이터와 호환되지 않습니다.');hooks.core({fab:p.fab,rdOnly:Boolean(p.rdOnly),route:p.route,search:p.search,exactCode:null});hooks.seek(p.minute);return {restored:args.name};}
  if(name==='fab.what_if_release')return releaseWhatIfAsync(data,args);
  if(name==='fab.analyze_engineering')return analyzeEngineering(data,args,c.minute,c.lots);
  if(name==='fab.select_routes'){const ids=[...new Set(args.route_ids.map(id=>id.toUpperCase()))],indices=ids.map(id=>data.routes.findIndex(r=>r.id.toUpperCase()===id));if(indices.some(i=>i<0))throw Error('존재하지 않는 라우트: 기존 선택을 유지합니다.');hooks.core({route:indices});return {route_ids:ids};}
  if(name==='fab.get_state'){const count=i=>states.filter(s=>s.event[2]===i).length;return {phase:observationMode(c.minute),minute:c.minute,filters:{fab:c.fab,program:c.rdOnly?'R&D':'ALL',route:c.route,search:c.search,equipment:$('#equipment-search').value,rank:$('#rank-mode').value,focus:$('#visual-lens').value},target:c.lots.length,wip:states.length-count(5),wait:count(0),proc:count(1)+count(2),hold:count(3),move:count(6),send:states.filter(s=>s.holdCode==='SEND').length,hold_total:count(3)+states.filter(s=>s.holdCode==='SEND').length,out:count(5),synthetic:true};}
  if(name==='fab.catalog'){const q=(args.query||'').toUpperCase(),match=v=>v.toUpperCase().includes(q);return {lot_codes:[...new Set(data.lots.map(l=>l.code))].filter(match).slice(0,30),lot_ids:data.lots.map(l=>l.id).filter(match).slice(0,30),routes:data.routes.map(r=>r.id).filter(match),equipment:data.equipment.map(e=>e.id).filter(match),operations:data.nodes.map((n,node)=>({node,fab:n.fab,operation:n.desc,equipment:n.equipment?.[n.fab]?.primary||[]})).filter(n=>n.equipment.length&&match(n.fab+' '+n.operation)).slice(0,30),limit:30};}
  if(name==='fab.reset_filters'){hooks.core({fab:'all',rdOnly:false,route:null,search:'',exactCode:null});change('equipment-search','');$('#visual-reset').click();change('rank-mode','process');if($('#hold-code-filter'))change('hold-code-filter','ALL');return {reset:true};}
  if(name==='fab.compare_lots'){const ids=[...new Set(args.lot_ids)];if(ids.some(id=>!data.lots.some(l=>l.id===id)))throw Error('존재하지 않는 LOT ID');hooks.compare(ids);return {compared:ids};}
  const {target,value}=args;
  if(name==='fab.set_filter'){
   if(target==='lot_code'||target==='lot_id'){const key=target==='lot_code'?'code':'id',q=value.toUpperCase();if(q&&!data.lots.some(l=>l[key].toUpperCase()===q))throw Error(`${value}: 해당 ${target} 없음. catalog 도구로 유효한 ID를 확인하세요. 기존 필터는 유지했습니다.`);hooks.core({search:q,exactCode:target==='lot_code'?q:null});}
   else if(target==='fab')hooks.core({fab:oneOf(value.toUpperCase(),['ALL',...data.fabs]).replace('ALL','all')});
   else if(target==='program')hooks.core({rdOnly:oneOf(value.toUpperCase(),['ALL','R&D'])==='R&D'});
   else if(target==='route'){const idx=data.routes.findIndex(r=>r.id.toUpperCase()===value.toUpperCase());if(value!=='all'&&idx<0)throw Error('존재하지 않는 라우트');hooks.core({route:value==='all'?null:idx});}
   else if(target==='equipment'){if(value&&!data.equipment.some(e=>e.id===value.toUpperCase()))throw Error('존재하지 않는 장비');change('equipment-search',value.toUpperCase());}
   else if(target==='rank')change('rank-mode',oneOf(value,['process','equipment','hold']));
   else if(target==='focus')change('visual-lens',oneOf(value,['all','hold','wait','move']));
   else if(target==='area')hooks.area(oneOf(value.toUpperCase(),['ALL','PHOTO','ETCH','DIFF','T/F','CMP','CLEAN','MI']));
   else if(target==='hold_code'){const q=value.toUpperCase();if(!['ALL',...new Set(data.lots.flatMap(l=>Object.values(l.holdReasons||{})))].includes(q))throw Error('존재하지 않는 홀드 코드');if($('#analytics-panel').hidden)$('#analysis-toggle').click();const el=$('#hold-code-filter');if(![...el.options].some(o=>o.value===q))throw Error('현재 시점·필터에 해당 홀드 이력이 없습니다.');change('hold-code-filter',q);}
  }else if(name==='fab.set_view'){
   if(target==='dimension')$('#'+oneOf(value,['2d','3d']).replace('2d','flat').replace('3d','depth')).click();
   else if(target==='orientation'){oneOf(value,['vertical','horizontal']);if((value==='vertical')!==c.vertical)$('#direction').click();}
   else if(target==='labels'||target==='heat'){oneOf(value,['true','false']);const el=$('#'+(target==='heat'?'heat-toggle':'labels'));el.checked=value==='true';el.dispatchEvent(new Event('change'));}
   else if(target==='theme'){oneOf(value,['light','dark']);if(document.documentElement.dataset.theme!==value)$('#theme-toggle').click();}
   else if(target==='time')hooks.seek(number(value,0,20160));
   else if(target==='speed'){oneOf(value,['2','5','30','120','720']);change('speed',value);}
  }else if(name==='fab.set_scenario')hooks.scenario(target,target==='hold_hours'?(value==='none'?null:number(value,0,168)):Number(oneOf(value,['0.8','1','1.25'])));
  return {applied:{target,value},scope:target==='area'||target==='focus'?'visual_highlight_only':target==='hold_code'?'hold_history_panel':'view_or_filter'};
 };
}
import {analyzeEngineering} from './engineering-analysis.js';
import {releaseWhatIfAsync} from './release-client.js';
