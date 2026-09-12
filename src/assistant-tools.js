export const filterTargets=['lot_code','lot_id','fab','route','equipment','rank','area','focus','hold_code','program'];
export const viewTargets=['dimension','orientation','labels','heat','theme','time','speed'];
export const toolSchemas=[
 {name:'fab.what_if_release',description:'7일 What-if. mode=optimization이면 동일 신규 투입 조건에서 홀드/복구/증설 비교 및 추천. count=0은 기존 WIP만. hold_hours=발생 후 홀드 시간, recovery_hours=LIVE부터 DOWN/PM 잔여 시간(0~168), add_tools=1~3대, target_node=공정 노드 인덱스(카탈로그로 확인), 빈 값이면 병목 상위 3개 자동 탐색. 가상 1슬롯/대. 실제 계획 변경 없음.',inputSchema:{type:'object',properties:{count:{type:'string',maxLength:10},days:{type:'string',maxLength:10},route_id:{type:'string',maxLength:30},wf_qty:{type:'string',maxLength:10},mode:{type:'string',enum:['release','optimization']},hold_hours:{type:'string',maxLength:10},recovery_hours:{type:'string',maxLength:10},add_tools:{type:'string',maxLength:10},target_node:{type:'string',maxLength:10}},required:['count','days','route_id'],additionalProperties:false}},
 {name:'fab.personal_workspace',description:'브라우저 로컬 관심 LOT 및 현재 필터 저장/조회.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['watch','unwatch','save_view','list']},lot_id:{type:'string',maxLength:100},name:{type:'string',maxLength:80}},required:['action'],additionalProperties:false}},
 {name:'fab.restore_view',description:'저장된 기본 필터·시점 복원. 카메라·장비 필터 제외.',inputSchema:{type:'object',properties:{name:{type:'string',maxLength:80}},required:['name'],additionalProperties:false}},
 {name:'fab.analyze_engineering',description:'LOT 계획·레시피·장비 비교, 도착 ETA, 의존관계, 문제 LOT, SEND, DOWN, 레시피 통계, 데이터 점검. 읽기 전용.',inputSchema:{type:'object',properties:{kind:{type:'string',enum:['plan','compare','eta','dependencies','issues','send','down','recipe_stats','quality']},lot_ids:{type:'array',items:{type:'string'},maxItems:2},target:{type:'string',maxLength:100}},required:['kind'],additionalProperties:false}},
 {name:'fab.select_routes',description:'여러 라우트 ID만 표시합니다. 빈 배열은 빈 맵이며 전체 보기는 set_filter route=all입니다.',inputSchema:{type:'object',properties:{route_ids:{type:'array',items:{type:'string'},maxItems:500}},required:['route_ids'],additionalProperties:false}},
 {name:'fab.get_state',description:'현재 필터와 시점 및 WIP를 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'fab.catalog',description:'유효한 랏코드·랏·라우트·장비 ID를 검색합니다.',inputSchema:{type:'object',properties:{query:{type:'string',maxLength:100}},additionalProperties:false}},
 {name:'fab.set_filter',description:'화면 필터 또는 강조를 변경합니다. area/focus는 강조만 변경합니다.',inputSchema:{type:'object',properties:{target:{type:'string',enum:filterTargets},value:{type:'string',maxLength:100}},required:['target','value'],additionalProperties:false}},
 {name:'fab.set_view',description:'화면·재생 시점·테마를 설정합니다.',inputSchema:{type:'object',properties:{target:{type:'string',enum:viewTargets},value:{type:'string',maxLength:100}},required:['target','value'],additionalProperties:false}},
 {name:'fab.set_scenario',description:'가상 시뮬레이션만 변경합니다. 실제 홀드·장비 제어가 아닙니다.',inputSchema:{type:'object',properties:{target:{type:'string',enum:['hold_hours','process_factor']},value:{type:'string',maxLength:100}},required:['target','value'],additionalProperties:false}},
 {name:'fab.compare_lots',description:'최대 6개 랏 경로 비교를 설정합니다. 빈 배열은 비교 해제입니다.',inputSchema:{type:'object',properties:{lot_ids:{type:'array',items:{type:'string'},maxItems:6}},required:['lot_ids'],additionalProperties:false}},
 {name:'fab.reset_filters',description:'랏·FAB·라우트·장비·강조 필터를 초기화합니다. 시점과 시나리오는 유지합니다.',inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
export function validateTool(name,args){
 const schema=toolSchemas.find(t=>t.name===name)?.inputSchema;if(!schema)throw Error('허용되지 않은 도구');
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('arguments는 객체여야 합니다.');
 for(const k of Object.keys(args))if(!Object.hasOwn(schema.properties,k))throw Error(`알 수 없는 인자: ${k}`);
 for(const k of schema.required||[])if(!Object.hasOwn(args,k))throw Error(`필수 인자: ${k}`);
 for(const [k,v] of Object.entries(args)){const s=schema.properties[k];if(s.type==='string'&&(typeof v!=='string'||v.length>(s.maxLength||100)))throw Error(`잘못된 ${k}`);if(s.enum&&!s.enum.includes(v))throw Error(`지원하지 않는 ${k}`);if(s.type==='array'&&(!Array.isArray(v)||v.length>s.maxItems||v.some(x=>typeof x!=='string'||x.length>100)))throw Error(`잘못된 ${k}`);}
 return args;
}
export function parseRequest(text){
 if(/기존 WIP만.*증설.*비교/i.test(text))return {name:'fab.what_if_release',arguments:{mode:'optimization',count:'0',days:'7',route_id:'R01',hold_hours:text.match(/홀드\s*(\d+(?:\.\d+)?)\s*시간/)?.[1]||'3',recovery_hours:text.match(/복구\s*(\d+(?:\.\d+)?)\s*시간/)?.[1]||'24',add_tools:text.match(/증설\s*(\d+)\s*대/)?.[1]||'2'}};
 if(/투입/.test(text)){const count=text.match(/(\d+)\s*개/),days=text.match(/(\d+)\s*일/),route=text.match(/\bR\d{2}\b/i);if(count&&route)return {name:'fab.what_if_release',arguments:{count:count[1],days:days?.[1]||'7',route_id:route[0].toUpperCase()}};}
 const watch=text.match(/LOT-?\d+/i);if(watch&&/관심|즐겨찾기/.test(text))return {name:'fab.personal_workspace',arguments:{action:/해제|삭제/.test(text)?'unwatch':'watch',lot_id:watch[0]}};
 if(/관심.*(목록|조회)/.test(text))return {name:'fab.personal_workspace',arguments:{action:'list'}};
 const saved=text.match(/필터\s*(저장|불러오기)\s+(.+)/);if(saved)return saved[1]==='저장'?{name:'fab.personal_workspace',arguments:{action:'save_view',name:saved[2].trim()}}:{name:'fab.restore_view',arguments:{name:saved[2].trim()}};
 const engineering=engineeringRequest(text);if(engineering)return {name:'fab.analyze_engineering',arguments:engineering};
 const routes=text.match(/\bR\d{2}\b/gi);if(routes&&/라우트|route/i.test(text))return {name:'fab.select_routes',arguments:{route_ids:[...new Set(routes.map(r=>r.toUpperCase()))]}};
 const q=text.trim(),m=q.match(/(?:LOT\s*CODE|랏\s*코드)\s*[:=]?\s*([\w-]+)/i);
 if(m)return {name:'fab.set_filter',arguments:{target:'lot_code',value:m[1]}};
 const id=q.match(/LOT-\d+/i);if(id)return {name:'fab.set_filter',arguments:{target:'lot_id',value:id[0]}};
 if(/초기화|필터.*해제/.test(q))return {name:'fab.reset_filters',arguments:{}};
 const fab=q.match(/\b(M10|M14|M15|M16|R3)\b(?!-)/i);if(fab)return {name:'fab.set_filter',arguments:{target:'fab',value:fab[1].toUpperCase()}};
 const eq=q.match(/(?:M10|M14|M15|M16|R3)-(?:ETCH|CVD|PHOTO|MET|RTP|CMP|WET|IMPL)-\d+/i);if(eq)return {name:'fab.set_filter',arguments:{target:'equipment',value:eq[0].toUpperCase()}};
 if(/R&D|알앤디|연구/i.test(q))return {name:'fab.set_filter',arguments:{target:'program',value:'R&D'}};
 if(/AHSO/i.test(q))return {name:'fab.set_filter',arguments:{target:'hold_code',value:'AHSO'}};
 if(/라이트|다크/.test(q))return {name:'fab.set_view',arguments:{target:'theme',value:q.includes('라이트')?'light':'dark'}};
 if(/LIVE|현재로|실시간/i.test(q))return {name:'fab.set_view',arguments:{target:'time',value:'10080'}};
 const day=q.match(/([1-7])일\s*(후|뒤)/);if(day)return {name:'fab.set_view',arguments:{target:'time',value:String(10080+Number(day[1])*1440)}};
 if(/WIP|재공|현황/i.test(q))return {name:'fab.get_state',arguments:{}};
 return null;
}
export function createToolAPI(adapter){
 const audit=[];
 const call=async(name,args={})=>{try{validateTool(name,args);const result=await adapter(name,args);audit.push({time:new Date().toISOString(),name,args,ok:true});if(audit.length>100)audit.shift();return {content:[{type:'text',text:JSON.stringify(result)}],isError:false};}catch(e){return {content:[{type:'text',text:e.message}],isError:true};}};
 return {tools:toolSchemas,call,audit,async rpc(request){if(request?.jsonrpc!=='2.0')return {jsonrpc:'2.0',id:request?.id??null,error:{code:-32600,message:'Invalid request'}};if(request.method==='tools/list')return {jsonrpc:'2.0',id:request.id,result:{tools:toolSchemas}};if(request.method==='tools/call')return {jsonrpc:'2.0',id:request.id,result:await call(request.params?.name,request.params?.arguments??{})};return {jsonrpc:'2.0',id:request.id,error:{code:-32601,message:'Method not found'}};}};
}
import {engineeringRequest} from './engineering-analysis.js';
