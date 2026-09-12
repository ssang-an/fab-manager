import {cameraFrame,followFrame,fitCamera} from './camera-motion.js';
import {createOperationDrilldown} from './operation-map.js';
import {routeMatches,routeIncluded,toggleRoute} from './route-selection.js';
import {lotState,projectPoint,graphBounds,linkPoint,wipRanking,waterfallLayout,flowLayout as compactLayout,processAreas,areaLayerGap,dragMode,rotationForDrag} from './graph-model.js';
import {forecastLots,OBSERVED_END,FORECAST_END} from './fab-analytics.js';
import {createAnalyticsUI} from './analytics-ui.js';
import {equipmentStatus,downImpact} from './equipment-health.js';
import {createVisualUI} from './visual-ui.js';
import {initTheme,themeColor} from './theme.js';
import {createToolAPI} from './assistant-tools.js';
import {createAdapter} from './tool-adapter.js';
import {initAssistant} from './assistant-ui.js';
import {fabNames,campusLayout,compactCampus,lotLocation,isFabTransfer} from './fab-campus.js';
import {createCampusUI} from './campus-ui.js';
const flatLayout={lengthScale:.7,groupSpacing:2200};
let flowLayout=flatLayout;
const $=s=>document.querySelector(s);
const canvas=$('#graph'),ctx=canvas.getContext('2d'),area=$('#canvas-area');
const colors=['#c9a15d','#a48cd9','#67cfb2','#f3777f','#8397ae','#547176','#70c8f2'];
const statusNames=['WAIT','JOB START','PROC','HOLD','JOB END','FAB OUT','MOVE'];
const palette=['#74b8b1','#8b9dd0','#bfab7c','#92b18d','#bb91af','#789fb9'];
const dateFormat=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const camera={x:0,y:0,scale:.15,depth:false,vertical:false,yaw:.24,pitch:-.4};
let data,width=1,height=1,route=null,fab='all',query='',exactCode=null,minute=10080,playing=false;
let rdOnly=false,candidateLots=[];
$('#all-routes').insertAdjacentHTML('beforebegin','<label for="route-search">ROUTE 검색 / 다중 선택</label><input id="route-search" placeholder="라우트 ID · 이름 · 랏코드" autocomplete="off"><div id="route-selection" aria-live="polite"></div>');
$('#route-search').oninput=()=>{if(data)renderRouteList();};
let states=[],visibleLots=[],nodeSet=new Set(),screenLots=[],screenNodes=[],selected=null;
let managedFilter=null;
let campusMove=null,campusTarget=null,viewMove=null;
function transitionView(patch){const from={depthMix:camera.depthMix??(camera.depth?1:0),orientationMix:camera.orientationMix??(camera.vertical?1:0)};Object.assign(camera,patch);viewMove={from,to:{depthMix:camera.depth?1:0,orientationMix:camera.vertical?1:0},start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:850};Object.assign(camera,from);dirty=true;}
let dirty=true,previousFrame=0,lastMetrics=-1,wasDragged=false;
const compared=new Set(),compareColors=['#7bdcf1','#efb36c','#d3a0ef','#f38dac','#9cdd87','#ecdf89'];
let rankings=[],nodeHits=[],lastDetailKey='';
const operationDrill=createOperationDrilldown({context:()=>({data,states,minute}),selectLot:id=>select({type:'lot',id}),capture:()=>({...camera,...(cameraMove?.from||{})}),restore:from=>{if(from){cancelCamera();moveCamera(from);}},origin:id=>projection(data.nodes[id])});
let doubleClickNode=null;
$('#route-list').insertAdjacentHTML('afterend','<section class="wip-panel"><div class="sidebar-heading">WIP RANKING <span>TOP 5</span></div><p>현재 필터 · 재생 시점 기준 / 이동 제외</p><div id="wip-ranking"></div></section>');
area.insertAdjacentHTML('beforeend','<section id="comparison" aria-label="선택 랏 비교" hidden></section>');
$('.view-switch').insertAdjacentHTML('afterend','<button id="multi" aria-pressed="false">다중 선택</button>');
$('#speed').innerHTML='<option value="2">2분 / 초</option><option value="5" selected>5분 / 초</option><option value="30">30분 / 초</option><option value="120">2시간 / 초</option>';
$('.legend').insertAdjacentHTML('beforeend','<span style="--color:#70c8f2">MOVE</span>');
$('.caption').insertAdjacentHTML('beforeend',`<div class="area-key" aria-label="공정 영역 레이어">${processAreas.map(a=>`<button data-area-name="${a.label}" style="--area-color:${a.color}" aria-pressed="false" title="${a.label} 영역 강조">${a.label}</button>`).join('')}<small>AREA / 샘플 분류 · 점 색상은 랏 상태</small></div>`);
$('#graph').setAttribute('aria-label','팹 라우트 그래프. 드래그 이동, 3D에서 Shift+드래그 회전, 휠 확대 축소. Ctrl+클릭 랏 비교. F 전체 보기.');
$('#sidebar footer>span').textContent='DATASET / V03';
$('#play').title='선택 시점부터 재생합니다. 관측 종료 이후는 예측이며, 예측 끝에서는 관측 종료부터 다시 재생합니다.';
let multi=false,cameraMove=null,followLot=null;
$('.view-switch').insertAdjacentHTML('afterend','<button id="follow-lot" disabled aria-pressed="false" title="랏 선택 후 추적. 직접 드래그하면 해제됩니다.">랏 추적 OFF</button>');
$('#follow-lot').onclick=()=>{if(followLot){cancelCamera();return;}if(selected?.type==='lot'){followLot=selected.id;focusLot(followLot);syncFollow();}};
function syncFollow(){const b=$('#follow-lot');b.disabled=selected?.type!=='lot';b.setAttribute('aria-pressed',String(Boolean(followLot)));b.textContent=followLot?'추적 중 · '+followLot:'랏 추적 OFF';}
function cancelCamera(){cameraMove=null;followLot=null;syncFollow();}
function moveCamera(to){cameraMove={from:{x:camera.x,y:camera.y,scale:camera.scale},to,start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:850};dirty=true;}
function viewCenter(){const panel=['inspector','analytics-panel','maintenance-panel','assistant-panel'].map(id=>$('#'+id)).find(el=>el&&!el.hidden);const right=panel?Math.min(width*.48,panel.getBoundingClientRect().width):0;return {x:(width-right)/2,y:Math.max(170,height/2)};}
function lotWorld(s){const a=data.nodes[s.node];if(s.nextNode===null)return a;const b=data.nodes[s.nextNode],p=linkPoint(a,b,s.fraction);return {...p,z:a.z+(b.z-a.z)*s.fraction*s.fraction*(3-2*s.fraction)};}
function focusLot(id){const s=states.find(s=>s.lot.id===id);if(!s)return;const p=projectPoint(lotWorld(s),camera),c=viewCenter(),scale=Math.max(.85,Math.min(1.5,camera.scale));moveCamera({scale,x:c.x-p.x*scale,y:c.y-p.y*scale});}
function focusNodes(ids){const nodes=[...ids].filter(n=>nodeSet.has(n)).map(n=>data.nodes[n]);if(!nodes.length)return;cancelCamera();const b=graphBounds(nodes,camera),c=viewCenter(),scale=Math.max(.025,Math.min(1.2,Math.min(Math.max(80,c.x*2-100)/(b.maxX-b.minX+160),Math.max(80,height-250)/(b.maxY-b.minY+160))));moveCamera({scale,x:c.x-(b.minX+b.maxX)/2*scale,y:c.y-(b.minY+b.maxY)/2*scale});}
function focusEquipment(id){const assigned=states.filter(s=>s.event[2]!==5&&s.nextNode===null&&s.lot.equipmentByStep?.[s.event[1]]===id).map(s=>s.node);const eligible=data.nodes.flatMap((n,i)=>Object.values(n.equipment||{}).some(group=>[...(group.primary||[]),...(group.backup||[])].includes(id))?[i]:[]);focusNodes(assigned.length?assigned:eligible);}

const pointers=new Map();let drag=null,pinch=null;
const format=m=>dateFormat.format(data.startTime+m*60000);
let forecastMap=new Map();
function installForecast(forecast){data.forecast=forecast;const byId=new Map(forecast.predictions.map(p=>[p.id,p]));forecastMap=new Map(data.lots.map(l=>{const p=byId.get(l.id);return [l.id,{...l,events:[...l.events,...(p?.events||[])],equipmentByStep:p?.equipmentByStep||l.equipmentByStep}];}));}
function stateAt(lot,time){return lotState(time>OBSERVED_END?(forecastMap.get(lot.id)||lot):lot,time);}
function seek(time){if(!data)return;stop();minute=time;$('#time').value=String(time);updateStates();updateMetrics();renderDetail();}
const analyticsUI=createAnalyticsUI({context:()=>({data,states,minute,lots:visibleLots,forecast:data?.forecast,areaLayer:visualUI.layer,areaName:processAreas[visualUI.layer]?.label||'ALL'}),format,stateAt,focusNodes,focusEquipment,refresh:()=>{if(data){updateStates();updateMetrics();dirty=true;}},seek,selectNode:n=>{analyticsUI.close();select({type:'node',id:n});focusNode(n);},selectLot:id=>{analyticsUI.close();$('#search').value='';filter();select({type:'lot',id},true);},holdScenario:holdHours=>{installForecast(forecastLots(data,{factor:data.forecast.factor,holdHours}));updateStates();updateMetrics();renderDetail();},scenario:factor=>{installForecast(forecastLots(data,{factor,holdHours:data.forecast.holdHours}));updateStates();updateMetrics();renderDetail();}});
const visualUI=createVisualUI({dirty:()=>{dirty=true;},refresh:()=>{if(data){updateMetrics();dirty=true;}},fit,pan:(x,y)=>{cancelCamera();moveCamera({x:camera.x+width/2-x,y:camera.y+height/2-y,scale:camera.scale});}},processAreas);
$('.area-key').onclick=e=>{const b=e.target.closest('[data-area-name]');if(b)visualUI.setArea(visualUI.layer===processAreas.findIndex(a=>a.label===b.dataset.areaName)?'ALL':b.dataset.areaName);};
const originalColors=[...colors],originalAreas=processAreas.map(a=>a.color);initTheme(light=>{colors.splice(0,colors.length,...originalColors.map(c=>themeColor(c,light)));processAreas.forEach((a,i)=>a.color=themeColor(originalAreas[i],light));document.querySelectorAll('.legend span[style]').forEach((el,i)=>el.style.setProperty('--color',colors[[0,1,2,3,4,6][i]]||colors[0]));if(data){visualUI.update(states,data.nodes);campusUI.update(states,data.nodes,rdOnly);}dirty=true;});
const campusUI=createCampusUI({research:value=>{rdOnly=value;select(null);filter();fit();},focus:site=>{focusNodes([...nodeSet].filter(n=>data.nodes[n].fab===site));}});
function renderDetail(){renderBaseDetail();analyticsUI.appendDetail(selected);if(selected?.type==='lot'){$('#detail').insertAdjacentHTML('beforeend',`<div class="detail-actions"><button id="detail-follow" aria-pressed="${followLot===selected.id}">${followLot===selected.id?'추적 해제':'이 랏 따라가기'}</button></div><p class="analysis-note">타임라인 이동·재생에 맞춰 카메라가 따라갑니다. 직접 드래그·줌 조작 또는 필터 밖으로 이동 시 해제됩니다.</p>`);$('#detail-follow').onclick=()=>{$('#follow-lot').click();renderDetail();};}}
function projection(node){const p=projectPoint(node,camera);return {x:p.x*camera.scale+camera.x,y:p.y*camera.scale+camera.y,depth:p.depth};}
function stop(){playing=false;$('#play').textContent='▶';$('#play').setAttribute('aria-label','타임라인 재생');}
function updateStates(){visibleLots=candidateLots.filter(l=>{const s=stateAt(l,minute);return (fab==='all'||lotLocation(s,data.nodes)===fab)&&matchesManaged(l,s,data.nodes,managedFilter);});states=visibleLots.map(l=>stateAt(l,minute)).filter(Boolean);rankings=wipRanking(states);dirty=true;}
function filter(){
  if(exactCode&&$('#search').value.trim().toUpperCase()!==exactCode)exactCode=null;
  if(!data.waterfall){installForecast(data.forecast);data.sourceNodes=data.nodes;data.nodes=campusLayout(waterfallLayout(data.sourceNodes,data.routes,flowLayout),{horizontal:!camera.vertical});data.waterfall=true;$('#direction').textContent=camera.vertical?'세로 ↓':'가로 →';}
  query=$('#search').value.trim().toLowerCase();
  candidateLots=data.lots.filter(l=>routeIncluded(route,l.route)&&(!rdOnly||l.program==='R&D')&&(!exactCode||l.code.toUpperCase()===exactCode)&&(!query||`${l.id} ${l.code}`.toLowerCase().includes(query)));
  const routes=new Set(candidateLots.map(l=>l.route));nodeSet=new Set();
  for(const r of routes)data.routes[r].segments.forEach(segment=>segment.forEach(n=>nodeSet.add(n)));
  arrangeCampus(routes.size<data.routes.length);
  updateStates();updateMetrics();renderRouteList();
  $('#view-caption').textContent=route===null?'전체 공정 네트워크':`선택 라우트 ${route.length}개 / ${route.map(i=>data.routes[i].id).join(', ')}`;
  $('#graph-summary').textContent=`${routes.size} routes · ${new Set(visibleLots.map(l=>l.code)).size} lot codes · ${nodeSet.size.toLocaleString()} operations`;
  $('#all-routes').classList.toggle('active',route===null);$('#all-routes').setAttribute('aria-pressed',String(route===null));
}
function arrangeCampus(compact){
  const base=campusLayout(waterfallLayout(data.sourceNodes,data.routes,flowLayout),{horizontal:!camera.vertical});
  campusTarget=compact?compactCampus(base,nodeSet,{horizontal:!camera.vertical}):base;
  const changed=campusTarget.some((n,i)=>Math.abs(n.y-data.nodes[i].y)>.01||Math.abs(n.x-data.nodes[i].x)>.01||Math.abs(n.z-data.nodes[i].z)>.01);
  if(!changed){campusMove=null;return;}
  campusMove={from:data.nodes.map(n=>({x:n.x,y:n.y,z:n.z})),start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:850};
}
function renderRouteList(){
  const search=$('#route-search').value;
  const results=data.routes.map((r,i)=>({r,i})).filter(({r})=>routeMatches(r,search));
  $('#route-selection').innerHTML=`<span>${route===null?'전체 라우트 표시':route.length+'개 선택'} · 검색 ${results.length}개</span>${(route||[]).map(i=>`<button data-remove-route="${i}" aria-label="${data.routes[i].id} 선택 해제">${data.routes[i].id} ×</button>`).join('')}`;
  const counts=new Map();for(const l of data.lots)if((!rdOnly||l.program==='R&D')&&(fab==='all'||lotLocation(stateAt(l,minute),data.nodes)===fab))counts.set(l.route,(counts.get(l.route)||0)+1);
  $('#route-list').innerHTML=results.map(({r,i})=>`<button class="route-item ${route?.includes(i)?'active':''}" data-route="${i}" aria-pressed="${Boolean(route?.includes(i))}" style="--route-color:${palette[r.group%palette.length]}"><b class="route-check" aria-hidden="true">${route?.includes(i)?'☑':'☐'}</b><span><strong>${r.id} / ${r.program==='R&D'?'R&D':'양산'} / ${esc(r.name)}</strong><small>${r.segments.length} steps · ${r.codes.length} codes</small></span><em>${counts.get(i)||0}</em></button>`).join('')||'<p class="empty">일치하는 라우트가 없습니다.</p>';
  const change=i=>{route=toggleRoute(route,i);select(null);filter();fit();};
  $('#route-list').querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>change(Number(b.dataset.route)));
  $('#route-selection').querySelectorAll('[data-remove-route]').forEach(b=>b.onclick=()=>change(Number(b.dataset.removeRoute)));
  if(query){const lots=visibleLots.slice(0,40);$('#route-list').insertAdjacentHTML('beforeend',`<div class="search-results"><p class="empty">LOT 검색 결과 · ${visibleLots.length}개</p>${lots.map(l=>`<button data-lot="${l.id}">${esc(l.id)}<small>${esc(l.code)} / ${data.routes[l.route].id}</small></button>`).join('')}</div>`);$('#route-list').querySelectorAll('[data-lot]').forEach(b=>b.onclick=()=>select({type:'lot',id:b.dataset.lot},true));}
}
function updateMetrics(){
  operationDrill.update();
  const eq=$('#equipment-search').value.trim().toUpperCase();const alertStates=states.filter(s=>(visualUI.layer===null||data.nodes[s.node].layer===visualUI.layer)&&(!eq||String(s.lot.equipmentByStep?.[s.event[1]]||'').toUpperCase().includes(eq)));
  copilot.update({data,states:alertStates,minute,scope:JSON.stringify([fab,rdOnly,route,query,managedFilter,visualUI.layer,eq]),rankings:wipRanking(alertStates)});
  const counts=Array(7).fill(0);states.forEach(s=>counts[s.event[2]]++);
  $('#metrics').innerHTML=`<span class="stat">WIP <strong>${(states.length-counts[5]).toLocaleString()}</strong></span><span class="stat">PROC <strong>${counts[1]+counts[2]}</strong></span><span class="stat">WAIT <strong>${counts[0]}</strong></span><span class="stat hold">HOLD <strong>${counts[3]}</strong></span><span class="stat">END <strong>${counts[4]}</strong></span><span class="stat">OUT <strong>${counts[5]}</strong></span><span class="stat gap">미투입 <strong>${visibleLots.length-states.length}</strong></span><span class="stat">대상 <strong>${visibleLots.length.toLocaleString()}</strong></span>`;
  $('#time-label').textContent=formatTimelineDate(data.startTime+minute*60000);
  $('#metrics').insertAdjacentHTML('beforeend',`<span class="stat">MOVE <strong>${counts[6]}</strong></span><span class="stat" title="팹 간 이송 홀드. MOVE에 포함되며 일반 HOLD와 별도 집계">SEND <strong>${states.filter(s=>s.holdCode==='SEND').length}</strong></span>`);
  $('.wip-panel>p').textContent=`${processAreas[visualUI.layer]?.label||'ALL AREA'} · 현재 필터 / 이동 제외`;
  $('#wip-ranking').innerHTML=rankings.filter(r=>visualUI.layer===null||data.nodes[r.node].layer===visualUI.layer).slice(0,5).map((r,i)=>`<button data-wip="${r.node}"><b>${i+1}</b><span>${esc(data.nodes[r.node].desc)}<small>${esc(data.nodes[r.node].operId)} · 대기 ${r.wait} / 진행 ${r.proc} / 홀드 ${r.hold}</small></span><strong>${r.total}</strong></button>`).join('')||'<p>해당 시점에 재공이 없습니다.</p>';
  $('#wip-ranking').querySelectorAll('button').forEach(b=>b.onclick=()=>{select({type:'node',id:Number(b.dataset.wip)});focusNode(Number(b.dataset.wip));});
  renderRouteList();renderComparison();analyticsUI.update();visualUI.update(states,data.nodes);campusUI.update(states,data.nodes,rdOnly);
}
function fit(){
  if(!data)return;cancelCamera();const b=graphBounds([...nodeSet].map(n=>(campusTarget||data.nodes)[n]),{...camera,depthMix:camera.depth?1:0,orientationMix:camera.vertical?1:0});
  moveCamera(fitCamera(b,width,height));
}
function zoomLabel(){$('#zoom').textContent=`${Math.round(camera.scale*100)}%`;}
function zoomAt(factor,x=width/2,y=height/2){cancelCamera();const next=Math.max(.025,Math.min(8,camera.scale*factor));const ratio=next/camera.scale;camera.x=x-(x-camera.x)*ratio;camera.y=y-(y-camera.y)*ratio;camera.scale=next;zoomLabel();dirty=true;}
function setDepth(value){if(camera.depth===value)return;transitionView({depth:value});flowLayout=value?compactLayout:flatLayout;if(data?.sourceNodes)arrangeCampus(new Set(candidateLots.map(l=>l.route)).size<data.routes.length);renderDetail();$('#depth').classList.toggle('active',value);$('#flat').classList.toggle('active',!value);$('#depth').setAttribute('aria-pressed',String(value));$('#flat').setAttribute('aria-pressed',String(!value));$('#reset-camera').hidden=!value;$('#graph-help').textContent=value?'드래그: 이동 · Shift+드래그: 회전 · 휠: 줌 · Ctrl+클릭: 비교':'휠: 줌 · 드래그: 이동 · 공정/랏 클릭: 상세 · Ctrl+클릭: 비교';fit();}
function resize(){const rect=area.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(data)fit();dirty=true;}
function draw(){
  dirty=false;ctx.clearRect(0,0,width,height);screenNodes=[];screenLots=[];nodeHits=[];
  if(!data)return;const projected=new Map();nodeSet.forEach(n=>projected.set(n,projection(data.nodes[n])));
  campusUI.draw(ctx,[...nodeSet].map(n=>data.nodes[n]),projection,document.documentElement.dataset.theme==='light');
  if(visualUI.heat){for(const r of rankings){if(r.total<5||(visualUI.layer!==null&&data.nodes[r.node].layer!==visualUI.layer))continue;const p=projected.get(r.node);if(!p)continue;const {radius}=wipHeat(r.total,r.hold,r.wait,document.documentElement.dataset.theme==='light');if(p.x+radius<0||p.x-radius>width||p.y+radius<0||p.y-radius>height)continue;drawWipHeat(ctx,p.x,p.y,r.total,r.hold,r.wait,document.documentElement.dataset.theme==='light');}}
  if(false&&!camera.depth&&camera.vertical){ctx.font='10px "Malgun Gothic",sans-serif';ctx.fillStyle=themeColor('#718996');data.stages.forEach((label,i)=>{const p=projection({x:i*420*flowLayout.lengthScale,y:-100,z:0});if(p.y>135&&p.y<height-55)ctx.fillText(`${String(i+1).padStart(2,'0')} / ${label}`,Math.max(width>950?190:10,p.x-130),p.y);});}
  if(false&&!camera.depth&&!camera.vertical){ctx.font='9px "Malgun Gothic",sans-serif';ctx.fillStyle=themeColor('#536a76');let lastRight=-Infinity;data.stages.forEach((label,i)=>{const x=projection({x:i*420*flowLayout.lengthScale,y:0,z:0}).x;const title=`${String(i+1).padStart(2,'0')} / ${label}`;if(x>-200&&x<width&&x>lastRight+16){ctx.fillText(title,x,Math.max(133,projection({x:0,y:-120,z:0}).y));lastRight=x+ctx.measureText(title).width;}});}
  const selectedState=selected?.type==='lot'?states.find(s=>s.lot.id===selected.id):null;
  const selectedPath=selectedState?new Set(selectedState.lot.path.slice(1).map((n,i)=>`${selectedState.lot.path[i]}:${n}`)):null;
  const comparePaths=[...compared].map(id=>{const lot=data.lots.find(l=>l.id===id);return new Set(lot.path.slice(1).map((n,i)=>`${lot.path[i]}:${n}`));});
  for(const e of data.edges){
    if(!nodeSet.has(e.source)||!nodeSet.has(e.target)||!e.routes.some(i=>routeIncluded(route,i)))continue;
    const a=projected.get(e.source),b=projected.get(e.target);
    if(Math.max(a.x,b.x)<-10||Math.min(a.x,b.x)>width+10||Math.max(a.y,b.y)<-10||Math.min(a.y,b.y)>height+10)continue;
    const key=`${e.source}:${e.target}`,matched=comparePaths.flatMap((p,i)=>p.has(key)?[i]:[]);
    const highlight=selectedPath?.has(key);ctx.strokeStyle=highlight?themeColor('#97dcc4'):(processAreas[data.nodes[e.source].layer]?.color||themeColor('#76929d'));ctx.globalAlpha=highlight?.85:(selectedState||compared.size)?.10:(route!==null?.48:.26);ctx.lineWidth=highlight?1.5:.7;
    const interFab=data.nodes[e.source].fab!==data.nodes[e.target].fab;if(interFab){ctx.strokeStyle=themeColor('#77bccb');ctx.globalAlpha=highlight?.85:.4;ctx.lineWidth=1.3;ctx.setLineDash([5,5]);}
    if(visualUI.layer!==null&&data.nodes[e.source].layer!==visualUI.layer&&data.nodes[e.target].layer!==visualUI.layer)ctx.globalAlpha*=.12;
    drawLink(data.nodes[e.source],data.nodes[e.target]);
    ctx.setLineDash([]);
    matched.forEach((index,j)=>{ctx.globalAlpha=.85;ctx.strokeStyle=compareColors[index];ctx.lineWidth=1.7;ctx.setLineDash(matched.length>1?[5,5*(matched.length-1)]:[]);ctx.lineDashOffset=j*5;drawLink(data.nodes[e.source],data.nodes[e.target]);});ctx.setLineDash([]);ctx.lineDashOffset=0;
  }
  ctx.globalAlpha=1;const occupancy=new Map(rankings.map(r=>[r.node,r.total]));
  const labels=$('#labels').checked,activeEquipmentNodes=analyticsUI.activeNodes(),heldAt=new Map(),downAt=new Map(),labelBoxes=[];
  for(const r of downImpact(data,states,minute))for(const s of r.lots)if(s.event[2]===0||s.lot.downCause?.[s.event[0]]===r.tool.id)downAt.set(s.node,(downAt.get(s.node)||0)+1);
  for(const s of states)if(s.event[2]===3)heldAt.set(s.node,(heldAt.get(s.node)||0)+1);
  for(const [n,p] of [...projected].sort((a,b)=>b[1].depth-a[1].depth)){
    if(p.x<-40||p.x>width+40||p.y<-40||p.y>height+40)continue;const node=data.nodes[n],isGate=node.kind==='gate'||node.kind==='merge',count=occupancy.get(n)||0;
    ctx.globalAlpha=visualUI.layer===null||node.layer===visualUI.layer?1:.12;
    if(visualUI.heat&&count>=8){ctx.fillStyle=document.documentElement.dataset.theme==='light'?'#d2be0026':'#ffe94226';ctx.beginPath();ctx.arc(p.x,p.y,Math.min(26,7+Math.sqrt(count)),0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle=processAreas[node.layer]?.color||themeColor('#567582');ctx.fillStyle=themeColor('#162128');ctx.lineWidth=.8;const r=isGate?Math.max(3,Math.min(6,camera.scale*5)):Math.max(1.7,Math.min(3,camera.scale*2));ctx.beginPath();if(isGate){ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x+r,p.y);ctx.lineTo(p.x,p.y+r);ctx.lineTo(p.x-r,p.y);ctx.closePath();}else ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();screenNodes.push({x:p.x,y:p.y,n});
    if(labels&&(camera.scale>.8||(node.kind==='gate'&&camera.scale>.32))){ctx.fillStyle=themeColor('#7895a2');ctx.font='9px "Malgun Gothic",sans-serif';const box={x:p.x+7,y:p.y-17,w:ctx.measureText(node.desc).width+6,h:12};if(!labelBoxes.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y)){ctx.fillText(node.desc,p.x+7,p.y-7);labelBoxes.push(box);}}
    if(count>=8&&camera.scale>.25){ctx.fillStyle=themeColor('#c1ae79');ctx.font='9px "Malgun Gothic",sans-serif';ctx.fillText(String(count),p.x+7,p.y+12);}
    if((heldAt.get(n)||0)>=2){ctx.strokeStyle=themeColor('#f3777f');ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.stroke();ctx.fillStyle=themeColor('#f4a0a6');ctx.font='11px "Malgun Gothic",sans-serif';if(camera.scale>.35)ctx.fillText(`H${heldAt.get(n)}`,p.x+9,p.y+18);}
    if(downAt.has(n)){ctx.strokeStyle=themeColor('#e9aa59');ctx.lineWidth=2;ctx.strokeRect(p.x-10,p.y-10,20,20);if(downAt.get(n)>=20||camera.scale>.35){ctx.fillStyle=themeColor('#e9aa59');ctx.font='bold 11px "Malgun Gothic",sans-serif';ctx.fillText(`DOWN ${downAt.get(n)} LOT`,p.x+13,p.y-12);}}
    if(activeEquipmentNodes.has(n)){ctx.strokeStyle=themeColor('#79e2ff');ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.stroke();ctx.fillStyle=themeColor('#aeefff');ctx.font='11px "Malgun Gothic",sans-serif';ctx.fillText(node.desc,p.x+13,p.y-10);}
  }
  const stacks=new Map();
  for(const state of states){
    if(state.event[2]===5&&!compared.has(state.lot.id)&&selected?.id!==state.lot.id)continue;const p=projected.get(state.node);if(!p)continue;
    const lotNumber=Number(state.lot.id.slice(-5)),k=lotNumber%23;const nextEvent=state.lot.events[state.index+1];let settle=state.event[2]===0?Math.min(1,(minute-state.event[0])/3):state.event[2]===5?0:1;if(state.event[2]===4&&nextEvent?.[2]===6)settle=Math.max(0,1-(minute-state.event[0])/(nextEvent[0]-state.event[0]));const angle=lotNumber*2.39996,spread=(5+Math.sqrt(k)*2)*Math.max(.7,Math.min(1.5,camera.scale))*settle;let x=p.x+Math.cos(angle)*spread,y=p.y+Math.sin(angle)*spread;
    if(state.nextNode!==null){const target=data.nodes[state.nextNode];if(target){const pos=curvePoint(data.nodes[state.node],target,state.fraction);x=pos.x;y=pos.y;ctx.globalAlpha=.55;ctx.strokeStyle=colors[6];ctx.lineWidth=1.2;ctx.beginPath();for(let j=0;j<=5;j++){const tail=curvePoint(data.nodes[state.node],target,Math.max(0,state.fraction-.12+j*.024));j?ctx.lineTo(tail.x,tail.y):ctx.moveTo(tail.x,tail.y);}ctx.stroke();}}
    if(x<-15||x>width+15||y<-15||y>height+15)continue;const active=selected?.type==='lot'&&selected.id===state.lot.id;
    const compareIndex=[...compared].indexOf(state.lot.id);ctx.globalAlpha=!visualUI.active(state,data.nodes[state.node])&&!active&&compareIndex<0?.08:(selectedState||compared.size)&&!active&&compareIndex<0?.3:.93;ctx.fillStyle=colors[state.event[2]];ctx.beginPath();if(state.lot.lot_type==='SAMPLE'){const size=active||compareIndex>=0?4:2.5;ctx.rect(x-size,y-size,size*2,size*2);ctx.strokeStyle=colors[state.event[2]];ctx.lineWidth=1;ctx.stroke();}else{ctx.arc(x,y,active||compareIndex>=0?3:Math.max(1.25,Math.min(2,camera.scale*1.8)),0,Math.PI*2);ctx.fill();}
    if(compareIndex>=0){ctx.strokeStyle=compareColors[compareIndex];ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.stroke();ctx.font='11px "Malgun Gothic",sans-serif';ctx.fillStyle=compareColors[compareIndex];ctx.fillText(String(compareIndex+1),x+10,y-8);}
    if(active){ctx.strokeStyle=themeColor('#def9f0');ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();}screenLots.push({x,y,state});
    if(isFabTransfer(state,data.nodes)&&visualUI.active(state,data.nodes)){ctx.globalAlpha=1;ctx.strokeStyle=themeColor('#70c8f2');ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.stroke();if(camera.scale>.3){ctx.fillStyle=themeColor('#70c8f2');ctx.font='10px "Malgun Gothic",sans-serif';ctx.fillText(`${data.nodes[state.node].fab} → ${data.nodes[state.nextNode].fab}`,x+8,y-8);}}
  }
  ctx.globalAlpha=1;drawHotspots(projected);
  visualUI.draw(projected,data.nodes,rankings,width,height);
  drawFabGates(projected);
  const spotTargets=[];
  if(selected?.type==='lot'){const p=screenLots.find(p=>p.state.lot.id===selected.id);if(p)spotTargets.push({...p,kind:'lot',label:p.state.lot.id,color:colors[p.state.event[2]]});}
  else if(selected?.type==='node'&&projected.has(selected.id)){spotTargets.push({...projected.get(selected.id),label:data.nodes[selected.id].desc+' · '+(occupancy.get(selected.id)||0)+' WIP'});}
  else if(compared.size){for(const p of screenLots)if(compared.has(p.state.lot.id))spotTargets.push({...p,kind:'lot',label:p.state.lot.id,color:compareColors[[...compared].indexOf(p.state.lot.id)]});}
  else for(const n of activeEquipmentNodes){const p=projected.get(n);if(p)spotTargets.push({...p,label:data.nodes[n].desc});}
  drawSelectionSpotlight(ctx,spotTargets,width,height,document.documentElement.dataset.theme==='light');
  ctx.globalAlpha=1;if(!visibleLots.length){ctx.font='13px sans-serif';ctx.fillStyle=themeColor('#8ca3af');ctx.textAlign='center';ctx.fillText('검색 조건에 맞는 랏이 없습니다.',width/2,height/2);ctx.textAlign='left';}
}
function curvePoint(a,b,t){const point=linkPoint(a,b,t);point.z=a.z+(b.z-a.z)*t*t*(3-2*t);return projection(point);}
function drawFabGates(projected){
 const gates=new Map(),routes=new Set(candidateLots.map(l=>l.route));
 for(const i of routes){const r=data.routes[i];for(const [n,kind] of [[r.segments[0][0],'IN'],[r.segments.at(-1)[0],'OUT']]){
  const key=routes.size>3?data.nodes[n].fab+kind:n+kind,old=gates.get(key);
  if(!old||(kind==='IN'?data.nodes[n].x<data.nodes[old.n].x:data.nodes[n].x>data.nodes[old.n].x))gates.set(key,{n,kind});
 }}
 for(const {n,kind} of gates.values()){
  const p=projected.get(n);if(!p)continue;const light=document.documentElement.dataset.theme==='light';
  ctx.fillStyle=kind==='IN'?(light?'#23865c':'#62c99a'):(light?'#c6454e':'#ee717b');ctx.beginPath();
  if(camera.vertical){ctx.moveTo(p.x-5,p.y-4);ctx.lineTo(p.x+5,p.y-4);ctx.lineTo(p.x,p.y+5);}
  else{ctx.moveTo(p.x-4,p.y-5);ctx.lineTo(p.x-4,p.y+5);ctx.lineTo(p.x+5,p.y);}
  ctx.closePath();ctx.fill();nodeHits.push({x:p.x-7,y:p.y-7,w:14,h:14,n});
 }
}
function drawLink(a,b){ctx.beginPath();for(let i=0;i<=12;i++){const p=curvePoint(a,b,i/12);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.stroke();}
function drawLayers(){
  const nodes=[...nodeSet].map(n=>data.nodes[n]);if(!nodes.length)return;
  const minX=Math.min(...nodes.map(n=>n.x))-70,maxX=Math.max(...nodes.map(n=>n.x))+70,minY=Math.min(...nodes.map(n=>n.y))-180,maxY=Math.max(...nodes.map(n=>n.y))+180;
  const layers=processAreas.map((area,layer)=>{const z=layer*areaLayerGap;return {area,layer,corners:[{x:minX,y:minY,z},{x:maxX,y:minY,z},{x:maxX,y:maxY,z},{x:minX,y:maxY,z}].map(projection)};}).filter(l=>nodes.some(n=>n.layer===l.layer)).sort((a,b)=>b.corners[0].depth-a.corners[0].depth);
  for(const {area,corners} of layers){ctx.fillStyle=area.color+'03';ctx.strokeStyle=area.color+'2b';ctx.lineWidth=.7;ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();}
}
function drawHotspots(projected){
  const candidates=rankings.filter(r=>visualUI.layer===null||data.nodes[r.node].layer===visualUI.layer).slice(0,5).map(r=>({...r}));
  if(selected?.type==='node'&&!candidates.some(r=>r.node===selected.id))candidates.push({node:selected.id,total:rankings.find(r=>r.node===selected.id)?.total||0});
  for(const [i,r] of candidates.entries()){const p=projected.get(r.node);if(!p||p.x<0||p.x>width||p.y<120||p.y>height-65)continue;const node=data.nodes[r.node];const text=`${i<5?'#'+(i+1)+' ':''}${node.desc} · ${r.total} WIP`;ctx.font='11px "Malgun Gothic",sans-serif';const w=ctx.measureText(text).width+18,x=Math.max(6,Math.min(width-w-6,p.x+13)),y=p.y-29;
    if(nodeHits.some(b=>x<b.x+b.w&&x+w>b.x&&y<b.y+b.h&&y+23>b.y))continue;
    ctx.fillStyle=themeColor('#1f3039');ctx.strokeStyle=themeColor('#d9af6b');ctx.lineWidth=1;ctx.fillRect(x,y,w,23);ctx.strokeRect(x,y,w,23);ctx.fillStyle=themeColor('#ead6a5');ctx.fillText(text,x+9,y+15);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(x,y+23);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.stroke();nodeHits.push({x,y,w,h:23,n:r.node});}
}
function focusNode(n){cancelCamera();const p=projectPoint(data.nodes[n],camera),c=viewCenter(),scale=Math.max(.7,Math.min(1.5,camera.scale));moveCamera({scale,x:c.x-p.x*scale,y:c.y-p.y*scale});}
function toggleCompare(id){if(compared.has(id))compared.delete(id);else if(compared.size<6)compared.add(id);else{$('#compare-limit').textContent='최대 6개까지 비교할 수 있습니다.';renderDetail();return;}renderComparison();renderDetail();dirty=true;}
function renderComparison(){
  const panel=$('#comparison');panel.hidden=!compared.size;if(!compared.size)return;
  panel.innerHTML=`<div class="compare-heading">LOT COMPARISON / ${compared.size}<button id="compare-fit">전체 맵에서 비교</button><button id="compare-clear">비우기 ×</button></div><div class="compare-items">${[...compared].map((id,i)=>{const l=data.lots.find(l=>l.id===id),s=stateAt(l,minute);return `<article style="--compare-color:${compareColors[i]}"><button data-compare-remove="${id}" aria-label="${id} 비교에서 제외">×</button><strong>${i+1} / ${esc(id)}</strong><span>${esc(l.code)} · ${s?statusNames[s.event[2]]:'미투입'}</span><small>${s?`${s.event[1]+1}/${l.path.length} · ${esc(data.nodes[s.node].operId)}`:'투입 전'}${visibleLots.includes(l)?'':' · 필터 밖'}</small></article>`;}).join('')}</div><p id="compare-limit" role="status"></p>`;
  panel.querySelectorAll('[data-compare-remove]').forEach(b=>b.onclick=()=>toggleCompare(b.dataset.compareRemove));$('#compare-clear').onclick=()=>{compared.clear();renderComparison();renderDetail();dirty=true;};$('#compare-fit').onclick=()=>{route=null;fab='all';rdOnly=false;$('#research-only').checked=false;$('#search').value='';$('.fab-filter').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.fab==='all');b.setAttribute('aria-pressed',String(b.dataset.fab==='all'));});filter();fit();};
}
function pick(x,y){for(const b of nodeHits)if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)return {type:'node',id:b.n};let best=null,dist=16;for(const p of screenNodes){const d=(p.x-x)**2+(p.y-y)**2;if(d<dist){dist=d;best={type:'node',id:p.n};}}if(best)return best;dist=81;for(const p of screenLots){const d=(p.x-x)**2+(p.y-y)**2;if(d<dist){dist=d;best={type:'lot',id:p.state.lot.id,state:p.state};}}if(best)return best;dist=64;for(const p of screenNodes){const d=(p.x-x)**2+(p.y-y)**2;if(d<dist){dist=d;best={type:'node',id:p.n};}}return best;}
function showTooltip(target,x,y){const tip=$('#tooltip');if(!target){tip.hidden=true;return;}tip.innerHTML=target.type==='lot'?`${esc(target.state.lot.id)} · ${target.state.lot.lot_type} · ${target.state.lot.WF_QTY} WF<small>${target.state.holdCode==='SEND'?'SEND · 이송 홀드':statusNames[target.state.event[2]]} / ${esc(data.nodes[target.state.node].desc)}</small>`:`${esc(data.nodes[target.id].desc)}<small>${esc(data.nodes[target.id].operId)} · ${esc(data.nodes[target.id].area)} · ${states.filter(s=>s.node===target.id&&s.event[2]!==5).length} WIP</small>`;tip.hidden=false;tip.style.left=`${Math.max(4,Math.min(width-280,x+15))}px`;tip.style.top=`${Math.max(4,Math.min(height-70,y+15))}px`;}
function select(target,focus=false){cancelCamera();selected=target;$('#inspector').hidden=!target;$('#tooltip').hidden=true;renderDetail();syncFollow();dirty=true;if(target?.type==='lot')focusLot(target.id);else if(target?.type==='node')focusNode(target.id);}
function renderBaseDetail(){
  if(!selected)return;
  const detailKey=`${selected.type}:${selected.id}`,sameDetail=detailKey===lastDetailKey;lastDetailKey=detailKey;
  $('#inspector').classList.toggle('operation-popup',selected.type==='node');
  if(selected.type==='node'){
    const scroll=sameDetail?$('#inspector').scrollTop:0,innerScroll=sameDetail?[...$('#detail').querySelectorAll('.popup-lots')].map(el=>el.scrollTop):[],node=data.nodes[selected.id],here=states.filter(s=>s.node===selected.id&&s.event[2]!==5&&s.nextNode===null);
    const fabs=[node.fab];const equipment=(role)=>fabs.flatMap(f=>node.equipment[f][role]).map(id=>data.equipment.find(e=>e.id===id));
    const tools=(role)=>equipment(role).map(e=>`<tr><td>${esc(e.id)}</td><td>${equipmentStatus(e,minute).status==='READY'?'READY':equipmentStatus(e,minute).status}</td><td>${equipmentStatus(e,minute).status!=='READY'?'정비 해제 필요':role==='backup'?'승인 후 전환':'진행 가능'}</td></tr>`).join('')||'<tr><td>이 거점에는 처리 장비가 없습니다.</td></tr>';
    const group=(title,indices)=>{const rows=here.filter(s=>indices.includes(s.event[2]));return `<h3>${title} <span>${rows.length}</span></h3><div class="popup-lots">${rows.map(s=>`<div class="popup-lot"><button data-detail-lot="${s.lot.id}">${esc(s.lot.id)}<small>${esc(s.lot.code)} · ${lotLocation(s,data.nodes)} · ${s.holdCode==='SEND'?'SEND · 이송 홀드':statusNames[s.event[2]]}</small></button><label><input type="checkbox" data-compare="${s.lot.id}" ${compared.has(s.lot.id)?'checked':''}> 비교</label></div>`).join('')||'<p>해당 상태의 랏이 없습니다.</p>'}</div>`;};
    $('#detail').innerHTML=`<div class="detail-kicker">OPERATION / ${node.fab} / ${esc(processAreas[node.layer]?.label||node.area)}</div><h2>${esc(node.desc)}</h2><h3>${esc(node.operId)}</h3><button id="expand-operation">장비 · 챔버 펼쳐보기 ↗</button><div class="facts"><span>현재 공정 WIP</span><strong>${here.length}</strong><span>유입 중</span><strong>${states.filter(s=>s.nextNode===selected.id).length}</strong></div><h3>진행 가능 장비</h3><table class="equipment-table"><tbody>${tools('primary')}</tbody></table><h3>백업 가능 장비</h3><table class="equipment-table"><tbody>${tools('backup')}</tbody></table><p>샘플 적격 장비 매핑입니다. 백업 전환은 실행하지 않습니다.</p>${group('진행 대기',[0])}${group('진행 중',[1,2])}${group('홀드 / 작업 완료',[3,4])}`;
    $('#expand-operation').onclick=()=>operationDrill.open(selected.id);
    $('#inspector').scrollTop=scroll;$('#detail').querySelectorAll('.popup-lots').forEach((el,i)=>{el.scrollTop=innerScroll[i]||0;});$('#detail').querySelectorAll('[data-detail-lot]').forEach(b=>b.onclick=()=>select({type:'lot',id:b.dataset.detailLot}));$('#detail').querySelectorAll('[data-compare]').forEach(b=>b.onchange=()=>toggleCompare(b.dataset.compare));return;
  }
  const lot=data.lots.find(l=>l.id===selected.id),s=stateAt(lot,minute),r=data.routes[lot.route];
  if(!s){$('#detail').innerHTML=`<div class="detail-kicker">LOT / NOT RELEASED</div><h2>${esc(lot.id)}</h2><p>${esc(lot.code)} · ${r.id}</p><p>이 시점에는 아직 투입되지 않았습니다.</p><button id="compare-add">${compared.has(lot.id)?'비교 제외':'비교에 추가'}</button>`;$('#compare-add').onclick=()=>toggleCompare(lot.id);return;}
  const node=data.nodes[s.node],events=s.lot.events.slice(Math.max(0,s.index-4),s.index+1).reverse();
  $('#detail').innerHTML=`<div class="detail-kicker">LOT INSPECTOR / ${lotLocation(s,data.nodes)} · ${lot.program}</div><h2>${esc(lot.id)}</h2><p>${esc(lot.code)} · ${r.id} / ${r.program==='R&D'?'R&D':'양산'} / ${esc(r.name)}</p><span class="detail-status" style="--state-color:${colors[s.event[2]]}">${s.holdCode==='SEND'?'SEND · 이송 홀드':statusNames[s.event[2]]}</span><h3>${esc(node.desc)}</h3><div class="facts"><span>공정 ID</span><strong>${esc(node.operId)}</strong><span>라우트 진행</span><strong>${s.event[1]+1} / ${lot.path.length}</strong><span>상태 유지</span><strong>${Math.floor(minute-s.event[0])}분</strong><span>관측 시점</span><strong>${format(minute)}</strong></div><div class="detail-actions"><button id="focus-lot">위치로 이동</button><button id="focus-route">라우트만 보기</button></div><h3>최근 이벤트</h3>${events.map(e=>`<div class="history-entry">${e[4]==='SEND'?'SEND · 이송 홀드':statusNames[e[2]]}<small>${esc(data.nodes[lot.path[e[1]]].operId)} · ${format(e[0])}</small></div>`).join('')}`;
  $('#detail').insertAdjacentHTML('beforeend',`<div class="detail-actions"><button id="compare-add">${compared.has(lot.id)?'비교 제외':'비교에 추가'}</button><button id="open-operation">공정 / 장비 보기</button></div><p>진입: ${data.stages[r.entryStage]}<br>종료: ${data.stages[r.exitStage]}</p>`);
  if(s.nextNode!==null)$('#detail').insertAdjacentHTML('beforeend',`<p class="travel-detail">${isFabTransfer(s,data.nodes)?'SEND 팹 간 이관':'공정 간 이동'}: ${node.fab} / ${esc(node.operId)} → ${data.nodes[s.nextNode].fab} / ${esc(data.nodes[s.nextNode].operId)}<br>구간 진행 ${Math.round(s.fraction*100)}% · 도착까지 ${Math.max(0,Math.ceil(s.event[3]-minute))}분</p>`);
  $('#compare-add').onclick=()=>toggleCompare(lot.id);$('#open-operation').onclick=()=>select({type:'node',id:s.node});
  $('#focus-lot').onclick=()=>select(selected,true);$('#focus-route').onclick=()=>{route=[lot.route];$('#search').value='';filter();fit();};
}
function animate(now){
  const delta=previousFrame?Math.min(.1,(now-previousFrame)/1000):0;previousFrame=now;
  if(playing&&data){minute=Math.min(FORECAST_END,minute+delta*Number($('#speed').value));$('#time').value=String(Math.floor(minute));updateStates();if(now-lastMetrics>300){updateMetrics();renderDetail();lastMetrics=now;}if(minute>=FORECAST_END){stop();updateMetrics();}dirty=true;}
  if(viewMove){const t=viewMove.duration?Math.max(0,Math.min(1,(now-viewMove.start)/viewMove.duration)):1,e=t*t*(3-2*t);for(const key of ['depthMix','orientationMix'])camera[key]=viewMove.from[key]+(viewMove.to[key]-viewMove.from[key])*e;if(t>=1)viewMove=null;dirty=true;}
  if(campusMove){const t=campusMove.duration?Math.max(0,Math.min(1,(now-campusMove.start)/campusMove.duration)):1,e=t*t*(3-2*t);data.nodes=campusTarget.map((n,i)=>({...n,x:campusMove.from[i].x+(n.x-campusMove.from[i].x)*e,y:campusMove.from[i].y+(n.y-campusMove.from[i].y)*e,z:campusMove.from[i].z+(n.z-campusMove.from[i].z)*e}));if(t>=1)campusMove=null;dirty=true;}
  if(cameraMove){const t=cameraMove.duration?(now-cameraMove.start)/cameraMove.duration:1;Object.assign(camera,cameraFrame(cameraMove.from,cameraMove.to,t));if(t>=1)cameraMove=null;dirty=true;zoomLabel();}
  if(followLot&&!cameraMove&&data){const s=states.find(s=>s.lot.id===followLot);if(!s){cancelCamera();}else{const p=projectPoint(lotWorld(s),camera),c=viewCenter();Object.assign(camera,followFrame(camera,{x:c.x-p.x*camera.scale,y:c.y-p.y*camera.scale},delta));dirty=true;}}
  if(dirty)draw();requestAnimationFrame(animate);
}
canvas.addEventListener('wheel',e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);zoomAt(Math.exp(-Math.max(-250,Math.min(250,delta))*.002),e.clientX-rect.left,e.clientY-rect.top);$('#tooltip').hidden=true;},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.focus();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});wasDragged=false;drag={x:e.clientX,y:e.clientY,button:e.button,shift:e.shiftKey};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}canvas.classList.add('dragging');});
canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;if(pointers.has(e.pointerId)){const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;if(pinch){cancelCamera();zoomAt(distance/Math.max(1,pinch.distance),cx-rect.left,cy-rect.top);camera.x+=cx-pinch.x;camera.y+=cy-pinch.y;}pinch={distance,x:cx,y:cy};wasDragged=true;}else if(drag){const dx=e.clientX-old.x,dy=e.clientY-old.y;if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>3){wasDragged=true;cancelCamera();}if(dragMode(camera.depth,drag.button,e.shiftKey)==='rotate'){camera.rotation=rotationForDrag(camera,dx,dy);}else{camera.x+=dx;camera.y+=dy;}}$('#tooltip').hidden=true;dirty=true;}else{const hover=pick(x,y);canvas.style.cursor=hover?'pointer':'grab';showTooltip(hover,x,y);}});
function clearMapSelection(){select(null);if($('#equipment-search').value)$('#clear-equipment').click();}
function endPointer(e){pointers.delete(e.pointerId);pinch=null;if(!pointers.size){canvas.classList.remove('dragging');if(!wasDragged&&e.type==='pointerup'&&e.button===0){const rect=canvas.getBoundingClientRect(),target=pick(e.clientX-rect.left,e.clientY-rect.top);if(!target)clearMapSelection();else if(target.type==='lot'&&(multi||e.ctrlKey||e.metaKey))toggleCompare(target.id);else select(target);}drag=null;}}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('pointerleave',()=>{$('#tooltip').hidden=true;});
canvas.addEventListener('click',e=>{if(e.detail!==1)return;const rect=canvas.getBoundingClientRect(),hit=pick(e.clientX-rect.left,e.clientY-rect.top);doubleClickNode=hit?.type==='node'?hit.id:null;});
canvas.addEventListener('dblclick',e=>{if(!data||wasDragged||e.button!==0)return;const rect=canvas.getBoundingClientRect(),hit=pick(e.clientX-rect.left,e.clientY-rect.top),id=doubleClickNode??(hit?.type==='node'?hit.id:null);doubleClickNode=null;if(id!==null){e.preventDefault();select({type:'node',id});operationDrill.open(id);return;}if(hit)return;e.preventDefault();clearMapSelection();fit();});
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='f'){e.preventDefault();fit();}if(e.key==='Escape')select(null);if(e.target===canvas){if(e.key==='+'||e.key==='=')zoomAt(1.2);if(e.key==='-')zoomAt(1/1.2);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();cancelCamera();camera.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;camera.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;dirty=true;}}});
$('#fit').onclick=fit;$('#zoom-in').onclick=()=>zoomAt(1.3);$('#zoom-out').onclick=()=>zoomAt(1/1.3);$('#flat').onclick=()=>setDepth(false);$('#depth').onclick=()=>setDepth(true);$('#direction').onclick=()=>{transitionView({vertical:!camera.vertical});if(data)arrangeCampus(new Set(candidateLots.map(l=>l.route)).size<data.routes.length);$('#direction').textContent=camera.vertical?'세로 ↓':'가로 →';fit();};$('#labels').onchange=()=>{dirty=true;};$('#reset-camera').onclick=()=>{camera.yaw=.24;camera.pitch=-.4;camera.rotation=null;fit();};$('#close-inspector').onclick=()=>select(null);
$('#sidebar-toggle').onclick=()=>{const app=$('#app');if(window.innerWidth<=700){app.classList.toggle('sidebar-open');$('#sidebar-toggle').setAttribute('aria-expanded',String(app.classList.contains('sidebar-open')));}else{app.classList.toggle('sidebar-hidden');$('#sidebar-toggle').setAttribute('aria-expanded',String(!app.classList.contains('sidebar-hidden')));}};
$('#search').oninput=()=>{if(!data)return;exactCode=null;select(null);filter();fit();};$('.fab-filter').onclick=e=>{if(!e.target.dataset.fab||!data)return;fab=e.target.dataset.fab;$('.fab-filter').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.fab===fab);b.setAttribute('aria-pressed',String(b.dataset.fab===fab));});select(null);filter();fit();};$('#all-routes').onclick=()=>{if(!data)return;route=null;$('#route-search').value='';select(null);filter();fit();};
$('#multi').onclick=()=>{multi=!multi;$('#multi').setAttribute('aria-pressed',String(multi));$('#multi').classList.toggle('active',multi);};
$('#time').oninput=()=>{if(!data)return;stop();minute=Number($('#time').value);updateStates();updateMetrics();renderDetail();};$('#latest').onclick=()=>{if(!data)return;stop();minute=10080;$('#time').value='10080';updateStates();updateMetrics();renderDetail();};$('#play').onclick=()=>{if(!data)return;if(playing){stop();return;}if(minute>=FORECAST_END){minute=10080;$('#time').value='10080';updateStates();updateMetrics();}playing=true;$('#play').textContent='Ⅱ';$('#play').setAttribute('aria-label','타임라인 일시정지');};
const fabAPI=createToolAPI(createAdapter({context:()=>({data,states,minute,lots:visibleLots,fab,route,search:$('#search').value,vertical:camera.vertical,rdOnly}),core:patch=>{stop();if('rdOnly' in patch){rdOnly=patch.rdOnly;$('#research-only').checked=rdOnly;}if('fab' in patch)fab=patch.fab;if('route' in patch)route=patch.route===null?null:Array.isArray(patch.route)?patch.route:[patch.route];if('exactCode' in patch)exactCode=patch.exactCode;if('search' in patch)$('#search').value=patch.search;$('.fab-filter').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.fab===fab);b.setAttribute('aria-pressed',String(b.dataset.fab===fab));});select(null);filter();fit();},area:name=>visualUI.setArea(name),seek,compare:ids=>{compared.clear();ids.forEach(id=>compared.add(id));renderComparison();renderDetail();dirty=true;},scenario:(target,value)=>{installForecast(forecastLots(data,{factor:target==='process_factor'?value:data.forecast.factor,holdHours:target==='hold_hours'?value:data.forecast.holdHours}));updateStates();updateMetrics();renderDetail();}}));
initReleaseUI(fabAPI,()=>data,()=>copilot.llm);
window.fabManagerAPI=fabAPI;const copilot=initAssistant(fabAPI,{selectLot:id=>{route=null;fab='all';rdOnly=false;$('#research-only').checked=false;$('#search').value=id;exactCode=null;filter();select({type:'lot',id},true);},selectNode:n=>select({type:'node',id:n}),selectEquipment:id=>{const input=$('#equipment-search');input.value=id;input.dispatchEvent(new Event('input'));}});
new ResizeObserver(resize).observe(area);requestAnimationFrame(animate);
initSidebarUI();
initManagedFavorites({data:()=>data,current:()=>({filter:managedFilter,base:{fab,rdOnly,route,search:$('#search').value,area:processAreas[visualUI.layer]?.label||'ALL',equipment:$('#equipment-search').value}}),apply:(value,base)=>{if(!data)return;if(base&&(!['all',...data.fabs].includes(base.fab)||base.route!==null&&(!Array.isArray(base.route)||base.route.some(i=>!Number.isInteger(i)||!data.routes[i]))))throw Error('저장한 화면 필터가 현재 데이터와 맞지 않습니다.');managedFilter=value;if(base){fab=base.fab;rdOnly=Boolean(base.rdOnly);route=base.route;$('#search').value=String(base.search||'');exactCode=null;$('#research-only').checked=rdOnly;$('#equipment-search').value=String(base.equipment||'');$('#equipment-search').dispatchEvent(new Event('input'));visualUI.setArea(base.area||'ALL');$('.fab-filter').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fab===fab)));}select(null);filter();fit();}});
const managedStyle=document.createElement('link');managedStyle.rel='stylesheet';managedStyle.href='/src/managed-filters.css';document.head.append(managedStyle);
try{const response=await fetch('/data/graph_demo.json');if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();if(data.version!==3||!data.nodes.length||!data.lots.length)throw Error('지원되지 않는 그래프 데이터');$('#route-count').textContent=String(data.routes.length);$('#data-summary').textContent=`${data.routes.flatMap(r=>r.codes).length} codes / ${data.lots.length.toLocaleString()} lots / ${data.edges.length.toLocaleString()} links`;$('#start-label').textContent=format(0);$('#end-label').textContent=format(10080);$('#search').setAttribute('list','lot-code-options');$('#search').insertAdjacentHTML('afterend',`<datalist id="lot-code-options">${[...new Set(data.lots.map(l=>l.code))].sort().map(code=>`<option value="${esc(code)}"></option>`).join('')}</datalist>`);$('#loading').hidden=true;filter();resize();}catch(error){$('#loading').textContent=`데이터를 불러오지 못했습니다: ${error.message}`;$('#loading').setAttribute('role','alert');console.error(error);}
import {wipHeat,drawWipHeat} from './wip-heat.js';
import {initReleaseUI} from './release-ui.js';
import {initSidebarUI} from './sidebar-ui.js';
import {drawSelectionSpotlight} from './selection-spotlight.js';
// Reparent existing controls: preserve playback handlers and one shared timeline.
document.querySelector('.toolbar').after(document.querySelector('.timeline'));
const timelineStyle=document.createElement('link');timelineStyle.rel='stylesheet';timelineStyle.href='/src/timeline-top.css';document.head.append(timelineStyle);
document.querySelector('.scrubber').title='왼쪽: 과거 7일 · 중앙선: 현재(최신 관측) · 오른쪽: 예측 7일';
document.querySelector('.scrubber').insertAdjacentHTML('beforeend','<span class="timeline-zone past" aria-hidden="true">과거</span><span class="timeline-zone future" aria-hidden="true">예측</span>');
document.querySelector('#time').setAttribute('aria-description','왼쪽은 과거 7일, 중앙 기준선은 최신 관측 시점, 오른쪽은 예측 7일입니다.');
import {formatTimelineDate} from './timeline-date.js';
import {initPlaybackControls} from './playback-controls.js';
initPlaybackControls();
import {initManagedFavorites,matchesManaged} from './managed-filters.js';
