export function workspaceAction(storage,args){
 const key='fab-manager-workspace-v1';let state;
 try{state=JSON.parse(storage.getItem(key)||'null');}catch{state=null;}
 if(!state||!Array.isArray(state.watch)||!Array.isArray(state.views))state={watch:[],views:[]};
 if(args.action==='watch'){if(!state.watch.includes(args.lot_id))state.watch.push(args.lot_id);}
 else if(args.action==='unwatch')state.watch=state.watch.filter(id=>id!==args.lot_id);
 else if(args.action==='save_view'){state.views=state.views.filter(v=>v.name!==args.name);state.views.push({name:args.name,snapshot:args.snapshot});}
 else if(args.action!=='list')throw Error('지원하지 않는 개인 설정 동작');
 if(state.watch.length>100||state.views.length>20)throw Error('관심 LOT 100개, 저장 필터 20개까지 지원합니다.');
 if(args.action!=='list')storage.setItem(key,JSON.stringify(state));
 return {...state,storage:'이 브라우저 로컬 저장 / SSO 계정 동기화 아님'};
}
