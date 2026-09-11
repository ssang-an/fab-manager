import {lotState,projectPoint,graphBounds,linkPoint,wipRanking,waterfallLayout,flowLayout as compactLayout,processAreas,areaLayerGap,dragMode,rotationForDrag} from './graph-model.js';
import {forecastLots,OBSERVED_END,FORECAST_END} from './fab-analytics.js';
import {createAnalyticsUI} from './analytics-ui.js';
import {equipmentStatus,downImpact} from './equipment-health.js';
const flatLayout={lengthScale:.7,groupSpacing:2200};
let flowLayout=flatLayout;
const $=s=>document.querySelector(s);
const canvas=$('#graph'),ctx=canvas.getContext('2d'),area=$('#canvas-area');
const colors=['#c9a15d','#a48cd9','#67cfb2','#f3777f','#8397ae','#547176','#70c8f2'];
const statusNames=['WAIT','JOB START','PROC','HOLD','JOB END','FAB OUT','MOVE'];
const palette=['#74b8b1','#8b9dd0','#bfab7c','#92b18d','#bb91af','#789fb9'];
const dateFormat=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const camera={x:0,y:0,scale:.15,depth:false,vertical:true,yaw:.24,pitch:-.4};
let data,width=1,height=1,route=null,fab='all',query='',minute=10080,playing=false;
let states=[],visibleLots=[],nodeSet=new Set(),screenLots=[],screenNodes=[],selected=null;
let dirty=true,previousFrame=0,lastMetrics=-1,wasDragged=false;
const compared=new Set(),compareColors=['#7bdcf1','#efb36c','#d3a0ef','#f38dac','#9cdd87','#ecdf89'];
let rankings=[],nodeHits=[],lastDetailKey='';
$('#route-list').insertAdjacentHTML('afterend','<section class="wip-panel"><div class="sidebar-heading">WIP RANKING <span>TOP 5</span></div><p>현재 필터 · 재생 시점 기준 / 이동 제외</p><div id="wip-ranking"></div></section>');
area.insertAdjacentHTML('beforeend','<section id="comparison" aria-label="선택 랏 비교" hidden></section>');
$('.view-switch').insertAdjacentHTML('afterend','<button id="multi" aria-pressed="false">다중 선택</button>');
$('#speed').innerHTML='<option value="2">2분 / 초</option><option value="5" selected>5분 / 초</option><option value="30">30분 / 초</option><option value="120">2시간 / 초</option>';
$('.legend').insertAdjacentHTML('beforeend','<span style="--color:#70c8f2">MOVE</span>');
$('.caption').insertAdjacentHTML('beforeend',`<div class="area-key" aria-label="공정 영역 레이어">${processAreas.map(a=>`<span style="--area-color:${a.color}" title="샘플 영역 매핑">${a.label}</span>`).join('')}<small>AREA / 샘플 분류 · 점 색상은 랏 상태</small></div>`);
$('#graph').setAttribute('aria-label','팹 라우트 그래프. 드래그 이동, 3D에서 Shift+드래그 회전, 휠 확대 축소. Ctrl+클릭 랏 비교. F 전체 보기.');
$('#sidebar footer>span').textContent='DATASET / V03';
$('#play').title='선택 시점부터 재생합니다. 관측 종료 이후는 예측이며, 예측 끝에서는 관측 종료부터 다시 재생합니다.';
let multi=false;
const pointers=new Map();let drag=null,pinch=null;
const format=m=>dateFormat.format(data.startTime+m*60000);
let forecastMap=new Map();
function installForecast(forecast){data.forecast=forecast;const byId=new Map(forecast.predictions.map(p=>[p.id,p]));forecastMap=new Map(data.lots.map(l=>{const p=byId.get(l.id);return [l.id,{...l,events:[...l.events,...(p?.events||[])],equipmentByStep:p?.equipmentByStep||l.equipmentByStep}];}));}
function stateAt(lot,time){return lotState(time>OBSERVED_END?(forecastMap.get(lot.id)||lot):lot,time);}
function seek(time){if(!data)return;stop();minute=time;$('#time').value=String(time);updateStates();updateMetrics();renderDetail();}
const analyticsUI=createAnalyticsUI({context:()=>({data,states,minute,lots:visibleLots,forecast:data?.forecast}),format,stateAt,refresh:()=>{if(data){updateStates();updateMetrics();dirty=true;}},seek,selectNode:n=>{analyticsUI.close();select({type:'node',id:n});focusNode(n);},selectLot:id=>{analyticsUI.close();$('#search').value='';filter();select({type:'lot',id},true);},holdScenario:holdHours=>{installForecast(forecastLots(data,{factor:data.forecast.factor,holdHours}));updateStates();updateMetrics();renderDetail();},scenario:factor=>{installForecast(forecastLots(data,{factor,holdHours:data.forecast.holdHours}));updateStates();updateMetrics();renderDetail();}});
function renderDetail(){renderBaseDetail();analyticsUI.appendDetail(selected);}
function projection(node){const p=projectPoint(node,camera);return {x:p.x*camera.scale+camera.x,y:p.y*camera.scale+camera.y,depth:p.depth};}
function stop(){playing=false;$('#play').textContent='▶';$('#play').setAttribute('aria-label','타임라인 재생');}
function updateStates(){states=visibleLots.map(l=>stateAt(l,minute)).filter(Boolean);rankings=wipRanking(states);dirty=true;}
function filter(){
  if(!data.waterfall){installForecast(data.forecast);data.sourceNodes=data.nodes;data.nodes=waterfallLayout(data.sourceNodes,data.routes,flowLayout);data.waterfall=true;$('#direction').textContent='세로 ↓';}
  query=$('#search').value.trim().toLowerCase();
  visibleLots=data.lots.filter(l=>(route===null||l.route===route)&&(fab==='all'||l.fab===fab)&&(!query||`${l.id} ${l.code}`.toLowerCase().includes(query)));
  const routes=new Set(visibleLots.map(l=>l.route));nodeSet=new Set();
  for(const r of routes)data.routes[r].segments.forEach(segment=>segment.forEach(n=>nodeSet.add(n)));
  updateStates();updateMetrics();renderRouteList();
  $('#view-caption').textContent=route===null?'전체 공정 네트워크':`${data.routes[route].id} / ${data.routes[route].name}`;
  $('#graph-summary').textContent=`${routes.size} routes · ${new Set(visibleLots.map(l=>l.code)).size} lot codes · ${nodeSet.size.toLocaleString()} operations`;
  $('#all-routes').classList.toggle('active',route===null);$('#all-routes').setAttribute('aria-pressed',String(route===null));
}
function renderRouteList(){
  if(query){const results=visibleLots.slice(0,40);$('#route-list').innerHTML=`<div class="search-results">${results.map(l=>`<button data-lot="${l.id}">${esc(l.id)}<small>${esc(l.code)} / ${data.routes[l.route].id} / FAB ${l.fab}</small></button>`).join('')}</div>${visibleLots.length>40?'<p class="empty">상위 40개 표시 · 검색어를 좁혀보세요.</p>':''}${!results.length?'<p class="empty">일치하는 랏이 없습니다.</p>':''}`;$('#route-list').querySelectorAll('[data-lot]').forEach(b=>b.onclick=()=>select({type:'lot',id:b.dataset.lot},true));return;}
  $('#route-list').innerHTML=data.routes.map((r,i)=>{const count=data.lots.filter(l=>l.route===i&&(fab==='all'||l.fab===fab)).length;return `<button class="route-item ${route===i?'active':''}" data-route="${i}" aria-pressed="${route===i}" style="--route-color:${palette[r.group]}"><i></i><span><strong>${r.id} / ${esc(r.name)}</strong><small>${r.segments.length} steps · ${r.codes.length} codes</small></span><em>${count}</em></button>`;}).join('');
  $('#route-list').querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{route=Number(b.dataset.route);select(null);filter();fit();});
}
function updateMetrics(){
  const counts=Array(7).fill(0);states.forEach(s=>counts[s.event[2]]++);
  $('#metrics').innerHTML=`<span class="stat">WIP <strong>${(states.length-counts[5]).toLocaleString()}</strong></span><span class="stat">PROC <strong>${counts[1]+counts[2]}</strong></span><span class="stat">WAIT <strong>${counts[0]}</strong></span><span class="stat hold">HOLD <strong>${counts[3]}</strong></span><span class="stat">END <strong>${counts[4]}</strong></span><span class="stat">OUT <strong>${counts[5]}</strong></span><span class="stat gap">미투입 <strong>${visibleLots.length-states.length}</strong></span><span class="stat">대상 <strong>${visibleLots.length.toLocaleString()}</strong></span>`;
  $('#time-label').textContent=format(minute);
  $('#metrics').insertAdjacentHTML('beforeend',`<span class="stat">MOVE <strong>${counts[6]}</strong></span>`);
  $('#wip-ranking').innerHTML=rankings.slice(0,5).map((r,i)=>`<button data-wip="${r.node}"><b>${i+1}</b><span>${esc(data.nodes[r.node].desc)}<small>${esc(data.nodes[r.node].operId)} · 대기 ${r.wait} / 진행 ${r.proc} / 홀드 ${r.hold}</small></span><strong>${r.total}</strong></button>`).join('')||'<p>해당 시점에 재공이 없습니다.</p>';
  $('#wip-ranking').querySelectorAll('button').forEach(b=>b.onclick=()=>{select({type:'node',id:Number(b.dataset.wip)});focusNode(Number(b.dataset.wip));});
  renderComparison();analyticsUI.update();
}
function fit(){
  if(!data)return;const b=graphBounds([...nodeSet].map(n=>data.nodes[n]),camera),top=Math.max(170,$('.caption').offsetTop+$('.caption').offsetHeight+24);
  camera.scale=Math.max(.025,Math.min(2,Math.min(Math.max(50,width-110)/(b.maxX-b.minX+120),Math.max(50,height-top-50)/(b.maxY-b.minY+120))));
  camera.x=width/2-(b.minX+b.maxX)/2*camera.scale;camera.y=top+(height-top-50)/2-(b.minY+b.maxY)/2*camera.scale;dirty=true;zoomLabel();
}
function zoomLabel(){$('#zoom').textContent=`${Math.round(camera.scale*100)}%`;}
function zoomAt(factor,x=width/2,y=height/2){const next=Math.max(.025,Math.min(8,camera.scale*factor));const ratio=next/camera.scale;camera.x=x-(x-camera.x)*ratio;camera.y=y-(y-camera.y)*ratio;camera.scale=next;zoomLabel();dirty=true;}
function setDepth(value){camera.depth=value;flowLayout=value?compactLayout:flatLayout;if(data?.sourceNodes)data.nodes=waterfallLayout(data.sourceNodes,data.routes,flowLayout);renderDetail();$('#depth').classList.toggle('active',value);$('#flat').classList.toggle('active',!value);$('#depth').setAttribute('aria-pressed',String(value));$('#flat').setAttribute('aria-pressed',String(!value));$('#reset-camera').hidden=!value;$('#graph-help').textContent=value?'드래그: 이동 · Shift+드래그: 회전 · 휠: 줌 · Ctrl+클릭: 비교':'휠: 줌 · 드래그: 이동 · 공정/랏 클릭: 상세 · Ctrl+클릭: 비교';fit();}
function resize(){const rect=area.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(data)fit();dirty=true;}
function draw(){
  dirty=false;ctx.clearRect(0,0,width,height);screenNodes=[];screenLots=[];nodeHits=[];
  const gap=Math.max(22,160*camera.scale);ctx.fillStyle='#26333b';for(let x=((camera.x%gap)+gap)%gap;x<width;x+=gap)for(let y=((camera.y%gap)+gap)%gap;y<height;y+=gap)ctx.fillRect(x,y,1,1);
  if(!data)return;const projected=new Map();nodeSet.forEach(n=>projected.set(n,projection(data.nodes[n])));
  if(camera.depth)drawLayers();
  if(!camera.depth&&camera.vertical){ctx.font='10px "IBM Plex Mono",monospace';ctx.fillStyle='#718996';data.stages.forEach((label,i)=>{const p=projection({x:i*420*flowLayout.lengthScale,y:-100,z:0});if(p.y>135&&p.y<height-55)ctx.fillText(`${String(i+1).padStart(2,'0')} / ${label}`,Math.max(10,p.x-130),p.y);});}
  if(!camera.depth&&!camera.vertical){ctx.font='9px "IBM Plex Mono",monospace';ctx.fillStyle='#536a76';let lastRight=-Infinity;data.stages.forEach((label,i)=>{const x=projection({x:i*420*flowLayout.lengthScale,y:0,z:0}).x;const title=`${String(i+1).padStart(2,'0')} / ${label}`;if(x>-200&&x<width&&x>lastRight+16){ctx.fillText(title,x,Math.max(133,projection({x:0,y:-120,z:0}).y));lastRight=x+ctx.measureText(title).width;}});}
  const selectedState=selected?.type==='lot'?states.find(s=>s.lot.id===selected.id):null;
  const selectedPath=selectedState?new Set(selectedState.lot.path.slice(1).map((n,i)=>`${selectedState.lot.path[i]}:${n}`)):null;
  const comparePaths=[...compared].map(id=>{const lot=data.lots.find(l=>l.id===id);return new Set(lot.path.slice(1).map((n,i)=>`${lot.path[i]}:${n}`));});
  for(const e of data.edges){
    if(!nodeSet.has(e.source)||!nodeSet.has(e.target)||(route!==null&&!e.routes.includes(route)))continue;
    const a=projected.get(e.source),b=projected.get(e.target);
    if(Math.max(a.x,b.x)<-10||Math.min(a.x,b.x)>width+10||Math.max(a.y,b.y)<-10||Math.min(a.y,b.y)>height+10)continue;
    const key=`${e.source}:${e.target}`,matched=comparePaths.flatMap((p,i)=>p.has(key)?[i]:[]);
    const highlight=selectedPath?.has(key);ctx.strokeStyle=highlight?'#97dcc4':(processAreas[data.nodes[e.source].layer]?.color||'#76929d');ctx.globalAlpha=highlight?.85:(selectedState||compared.size)?.10:(route!==null?.48:.26);ctx.lineWidth=highlight?1.5:.7;
    drawLink(data.nodes[e.source],data.nodes[e.target]);
    matched.forEach((index,j)=>{ctx.globalAlpha=.85;ctx.strokeStyle=compareColors[index];ctx.lineWidth=1.7;ctx.setLineDash(matched.length>1?[5,5*(matched.length-1)]:[]);ctx.lineDashOffset=j*5;drawLink(data.nodes[e.source],data.nodes[e.target]);});ctx.setLineDash([]);ctx.lineDashOffset=0;
  }
  ctx.globalAlpha=1;const occupancy=new Map(rankings.map(r=>[r.node,r.total]));
  const labels=$('#labels').checked,activeEquipmentNodes=analyticsUI.activeNodes(),heldAt=new Map(),downAt=new Map();
  for(const r of downImpact(data,states,minute))for(const s of r.lots)if(s.event[2]===0||s.lot.downCause?.[s.event[0]]===r.tool.id)downAt.set(s.node,(downAt.get(s.node)||0)+1);
  for(const s of states)if(s.event[2]===3)heldAt.set(s.node,(heldAt.get(s.node)||0)+1);
  for(const [n,p] of [...projected].sort((a,b)=>b[1].depth-a[1].depth)){
    if(p.x<-40||p.x>width+40||p.y<-40||p.y>height+40)continue;const node=data.nodes[n],isGate=node.kind==='gate'||node.kind==='merge',count=occupancy.get(n)||0;
    if(count>=8){ctx.fillStyle='#b49c5420';ctx.beginPath();ctx.arc(p.x,p.y,Math.min(20,5+Math.sqrt(count)),0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle=processAreas[node.layer]?.color||'#567582';ctx.fillStyle='#162128';ctx.lineWidth=.8;const r=isGate?Math.max(3,Math.min(6,camera.scale*5)):Math.max(1.7,Math.min(3,camera.scale*2));ctx.beginPath();if(isGate){ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x+r,p.y);ctx.lineTo(p.x,p.y+r);ctx.lineTo(p.x-r,p.y);ctx.closePath();}else ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();screenNodes.push({x:p.x,y:p.y,n});
    if(labels&&(camera.scale>.8||(node.kind==='gate'&&camera.scale>.32))){ctx.fillStyle='#7895a2';ctx.font='9px "IBM Plex Mono",monospace';ctx.fillText(node.desc,p.x+7,p.y-7);}
    if(count>=8&&camera.scale>.25){ctx.fillStyle='#c1ae79';ctx.font='9px "IBM Plex Mono",monospace';ctx.fillText(String(count),p.x+7,p.y+12);}
    if((heldAt.get(n)||0)>=2){ctx.strokeStyle='#f3777f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f4a0a6';ctx.font='10px monospace';ctx.fillText(`H${heldAt.get(n)}`,p.x+9,p.y+18);}
    if(downAt.has(n)){ctx.strokeStyle='#e9aa59';ctx.lineWidth=2;ctx.strokeRect(p.x-10,p.y-10,20,20);if(downAt.get(n)>=3||camera.scale>.35){ctx.fillStyle='#e9aa59';ctx.font='bold 10px monospace';ctx.fillText(`DOWN ${downAt.get(n)} LOT`,p.x+13,p.y-12);}}
    if(activeEquipmentNodes.has(n)){ctx.strokeStyle='#79e2ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#aeefff';ctx.font='11px monospace';ctx.fillText(node.desc,p.x+13,p.y-10);}
  }
  const stacks=new Map();
  for(const state of states){
    if(state.event[2]===5&&!compared.has(state.lot.id)&&selected?.id!==state.lot.id)continue;const p=projected.get(state.node);if(!p)continue;
    const lotNumber=Number(state.lot.id.slice(-5)),k=lotNumber%23;const nextEvent=state.lot.events[state.index+1];let settle=state.event[2]===0?Math.min(1,(minute-state.event[0])/3):state.event[2]===5?0:1;if(state.event[2]===4&&nextEvent?.[2]===6)settle=Math.max(0,1-(minute-state.event[0])/(nextEvent[0]-state.event[0]));const angle=lotNumber*2.39996,spread=(5+Math.sqrt(k)*2)*Math.max(.7,Math.min(1.5,camera.scale))*settle;let x=p.x+Math.cos(angle)*spread,y=p.y+Math.sin(angle)*spread;
    if(state.nextNode!==null){const target=data.nodes[state.nextNode];if(target){const pos=curvePoint(data.nodes[state.node],target,state.fraction);x=pos.x;y=pos.y;ctx.globalAlpha=.55;ctx.strokeStyle=colors[6];ctx.lineWidth=1.2;ctx.beginPath();for(let j=0;j<=5;j++){const tail=curvePoint(data.nodes[state.node],target,Math.max(0,state.fraction-.12+j*.024));j?ctx.lineTo(tail.x,tail.y):ctx.moveTo(tail.x,tail.y);}ctx.stroke();}}
    if(x<-15||x>width+15||y<-15||y>height+15)continue;const active=selected?.type==='lot'&&selected.id===state.lot.id;
    const compareIndex=[...compared].indexOf(state.lot.id);ctx.globalAlpha=(selectedState||compared.size)&&!active&&compareIndex<0?.3:.93;ctx.fillStyle=colors[state.event[2]];ctx.beginPath();if(state.lot.lot_type==='SAMPLE'){const size=active||compareIndex>=0?4:2.5;ctx.rect(x-size,y-size,size*2,size*2);ctx.strokeStyle=colors[state.event[2]];ctx.lineWidth=1;ctx.stroke();}else{ctx.arc(x,y,active||compareIndex>=0?3:Math.max(1.25,Math.min(2,camera.scale*1.8)),0,Math.PI*2);ctx.fill();}
    if(compareIndex>=0){ctx.strokeStyle=compareColors[compareIndex];ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.stroke();ctx.font='10px monospace';ctx.fillStyle=compareColors[compareIndex];ctx.fillText(String(compareIndex+1),x+10,y-8);}
    if(active){ctx.strokeStyle='#def9f0';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();}screenLots.push({x,y,state});
  }
  ctx.globalAlpha=1;drawHotspots(projected);
  for(const [i,r] of data.routes.entries()){if(route!==null&&route!==i)continue;for(const [n,word,color] of [[r.segments[0][0],'IN','#7dd1bb'],[r.segments.at(-1)[0],'OUT','#9fa6b8']]){const p=projected.get(n);if(!p)continue;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(p.x-5,p.y-8);ctx.lineTo(p.x+5,p.y-8);ctx.lineTo(p.x,p.y-2);ctx.closePath();ctx.fill();if(route!==null){ctx.font='10px monospace';ctx.fillText(`${r.id} ${word}`,p.x+8,p.y-10);}}}
  ctx.globalAlpha=1;if(!visibleLots.length){ctx.font='13px sans-serif';ctx.fillStyle='#8ca3af';ctx.textAlign='center';ctx.fillText('검색 조건에 맞는 랏이 없습니다.',width/2,height/2);ctx.textAlign='left';}
}
function curvePoint(a,b,t){const point=linkPoint(a,b,t);point.z=a.z+(b.z-a.z)*t*t*(3-2*t);return projection(point);}
function drawLink(a,b){ctx.beginPath();for(let i=0;i<=12;i++){const p=curvePoint(a,b,i/12);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.stroke();}
function drawLayers(){
  const nodes=[...nodeSet].map(n=>data.nodes[n]);if(!nodes.length)return;
  const minX=Math.min(...nodes.map(n=>n.x))-70,maxX=Math.max(...nodes.map(n=>n.x))+70,minY=Math.min(...nodes.map(n=>n.y))-180,maxY=Math.max(...nodes.map(n=>n.y))+180;
  const layers=processAreas.map((area,layer)=>{const z=layer*areaLayerGap;return {area,layer,corners:[{x:minX,y:minY,z},{x:maxX,y:minY,z},{x:maxX,y:maxY,z},{x:minX,y:maxY,z}].map(projection)};}).filter(l=>nodes.some(n=>n.layer===l.layer)).sort((a,b)=>b.corners[0].depth-a.corners[0].depth);
  for(const {area,corners} of layers){ctx.fillStyle=area.color+'03';ctx.strokeStyle=area.color+'2b';ctx.lineWidth=.7;ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();}
}
function drawHotspots(projected){
  const candidates=rankings.slice(0,5).map(r=>({...r}));
  if(selected?.type==='node'&&!candidates.some(r=>r.node===selected.id))candidates.push({node:selected.id,total:rankings.find(r=>r.node===selected.id)?.total||0});
  for(const [i,r] of candidates.entries()){const p=projected.get(r.node);if(!p||p.x<0||p.x>width||p.y<120||p.y>height-65)continue;const node=data.nodes[r.node];const text=`${i<5?'#'+(i+1)+' ':''}${node.desc} · ${r.total} WIP`;ctx.font='10px monospace';const w=ctx.measureText(text).width+18,x=Math.max(6,Math.min(width-w-6,p.x+13)),y=p.y-29;
    if(nodeHits.some(b=>x<b.x+b.w&&x+w>b.x&&y<b.y+b.h&&y+23>b.y))continue;
    ctx.fillStyle='#1f3039';ctx.strokeStyle='#d9af6b';ctx.lineWidth=1;ctx.fillRect(x,y,w,23);ctx.strokeRect(x,y,w,23);ctx.fillStyle='#ead6a5';ctx.fillText(text,x+9,y+15);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(x,y+23);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.stroke();nodeHits.push({x,y,w,h:23,n:r.node});}
}
function focusNode(n){const p=projectPoint(data.nodes[n],camera);camera.scale=Math.max(.6,camera.scale);camera.x=Math.max(110,(width-440)/2)-p.x*camera.scale;camera.y=height/2-p.y*camera.scale;zoomLabel();dirty=true;}
function toggleCompare(id){if(compared.has(id))compared.delete(id);else if(compared.size<6)compared.add(id);else{$('#compare-limit').textContent='최대 6개까지 비교할 수 있습니다.';renderDetail();return;}renderComparison();renderDetail();dirty=true;}
function renderComparison(){
  const panel=$('#comparison');panel.hidden=!compared.size;if(!compared.size)return;
  panel.innerHTML=`<div class="compare-heading">LOT COMPARISON / ${compared.size}<button id="compare-fit">전체 맵에서 비교</button><button id="compare-clear">비우기 ×</button></div><div class="compare-items">${[...compared].map((id,i)=>{const l=data.lots.find(l=>l.id===id),s=stateAt(l,minute);return `<article style="--compare-color:${compareColors[i]}"><button data-compare-remove="${id}" aria-label="${id} 비교에서 제외">×</button><strong>${i+1} / ${esc(id)}</strong><span>${esc(l.code)} · ${s?statusNames[s.event[2]]:'미투입'}</span><small>${s?`${s.event[1]+1}/${l.path.length} · ${esc(data.nodes[s.node].operId)}`:'투입 전'}${visibleLots.includes(l)?'':' · 필터 밖'}</small></article>`;}).join('')}</div><p id="compare-limit" role="status"></p>`;
  panel.querySelectorAll('[data-compare-remove]').forEach(b=>b.onclick=()=>toggleCompare(b.dataset.compareRemove));$('#compare-clear').onclick=()=>{compared.clear();renderComparison();renderDetail();dirty=true;};$('#compare-fit').onclick=()=>{route=null;fab='all';$('#search').value='';$('.fab-filter').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.fab==='all');b.setAttribute('aria-pressed',String(b.dataset.fab==='all'));});filter();fit();};
}
function pick(x,y){for(const b of nodeHits)if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)return {type:'node',id:b.n};let best=null,dist=16;for(const p of screenNodes){const d=(p.x-x)**2+(p.y-y)**2;if(d<dist){dist=d;best={type:'node',id:p.n};}}if(best)return best;dist=81;for(const p of screenLots){const d=(p.x-x)**2+(p.y-y)**2;if(d<dist){dist=d;best={type:'lot',id:p.state.lot.id,state:p.state};}}if(best)return best;dist=64;for(const p of screenNodes){const d=(p.x-x)**2+(p.y-y)**2;if(d<dist){dist=d;best={type:'node',id:p.n};}}return best;}
function showTooltip(target,x,y){const tip=$('#tooltip');if(!target){tip.hidden=true;return;}tip.innerHTML=target.type==='lot'?`${esc(target.state.lot.id)} · ${target.state.lot.lot_type} · ${target.state.lot.WF_QTY} WF<small>${statusNames[target.state.event[2]]} / ${esc(data.nodes[target.state.node].desc)}</small>`:`${esc(data.nodes[target.id].desc)}<small>${esc(data.nodes[target.id].operId)} · ${esc(data.nodes[target.id].area)} · ${states.filter(s=>s.node===target.id&&s.event[2]!==5).length} WIP</small>`;tip.hidden=false;tip.style.left=`${Math.max(4,Math.min(width-280,x+15))}px`;tip.style.top=`${Math.max(4,Math.min(height-70,y+15))}px`;}
function select(target,focus=false){selected=target;$('#inspector').hidden=!target;$('#tooltip').hidden=true;renderDetail();dirty=true;if(focus&&target?.type==='lot'){const s=states.find(s=>s.lot.id===target.id);if(s){camera.scale=Math.max(.85,camera.scale);const p=projectPoint(data.nodes[s.node],camera);camera.x=Math.max(100,(width-280)/2)-p.x*camera.scale;camera.y=height/2-p.y*camera.scale;zoomLabel();}}}
function renderBaseDetail(){
  if(!selected)return;
  const detailKey=`${selected.type}:${selected.id}`,sameDetail=detailKey===lastDetailKey;lastDetailKey=detailKey;
  $('#inspector').classList.toggle('operation-popup',selected.type==='node');
  if(selected.type==='node'){
    const scroll=sameDetail?$('#inspector').scrollTop:0,innerScroll=sameDetail?[...$('#detail').querySelectorAll('.popup-lots')].map(el=>el.scrollTop):[],node=data.nodes[selected.id],here=states.filter(s=>s.node===selected.id&&s.event[2]!==5&&s.nextNode===null);
    const fabs=fab==='all'?['A','B']:[fab];const equipment=(role)=>fabs.flatMap(f=>node.equipment[f][role]).map(id=>data.equipment.find(e=>e.id===id));
    const tools=(role)=>equipment(role).map(e=>`<tr><td>${esc(e.id)}</td><td>${equipmentStatus(e,minute).status==='READY'?'READY':equipmentStatus(e,minute).status}</td><td>${equipmentStatus(e,minute).status!=='READY'?'정비 해제 필요':role==='backup'?'승인 후 전환':'진행 가능'}</td></tr>`).join('')||'<tr><td>이 거점에는 처리 장비가 없습니다.</td></tr>';
    const group=(title,indices)=>{const rows=here.filter(s=>indices.includes(s.event[2]));return `<h3>${title} <span>${rows.length}</span></h3><div class="popup-lots">${rows.map(s=>`<div class="popup-lot"><button data-detail-lot="${s.lot.id}">${esc(s.lot.id)}<small>${esc(s.lot.code)} · FAB ${s.lot.fab} · ${statusNames[s.event[2]]}</small></button><label><input type="checkbox" data-compare="${s.lot.id}" ${compared.has(s.lot.id)?'checked':''}> 비교</label></div>`).join('')||'<p>해당 상태의 랏이 없습니다.</p>'}</div>`;};
    $('#detail').innerHTML=`<div class="detail-kicker">OPERATION / ${esc(processAreas[node.layer]?.label||node.area)}</div><h2>${esc(node.desc)}</h2><h3>${esc(node.operId)}</h3><div class="facts"><span>현재 공정 WIP</span><strong>${here.length}</strong><span>유입 중</span><strong>${states.filter(s=>s.nextNode===selected.id).length}</strong></div><h3>진행 가능 장비</h3><table class="equipment-table"><tbody>${tools('primary')}</tbody></table><h3>백업 가능 장비</h3><table class="equipment-table"><tbody>${tools('backup')}</tbody></table><p>샘플 적격 장비 매핑입니다. 백업 전환은 실행하지 않습니다.</p>${group('진행 대기',[0])}${group('진행 중',[1,2])}${group('홀드 / 작업 완료',[3,4])}`;
    $('#inspector').scrollTop=scroll;$('#detail').querySelectorAll('.popup-lots').forEach((el,i)=>{el.scrollTop=innerScroll[i]||0;});$('#detail').querySelectorAll('[data-detail-lot]').forEach(b=>b.onclick=()=>select({type:'lot',id:b.dataset.detailLot}));$('#detail').querySelectorAll('[data-compare]').forEach(b=>b.onchange=()=>toggleCompare(b.dataset.compare));return;
  }
  const lot=data.lots.find(l=>l.id===selected.id),s=stateAt(lot,minute),r=data.routes[lot.route];
  if(!s){$('#detail').innerHTML=`<div class="detail-kicker">LOT / NOT RELEASED</div><h2>${esc(lot.id)}</h2><p>${esc(lot.code)} · ${r.id}</p><p>이 시점에는 아직 투입되지 않았습니다.</p><button id="compare-add">${compared.has(lot.id)?'비교 제외':'비교에 추가'}</button>`;$('#compare-add').onclick=()=>toggleCompare(lot.id);return;}
  const node=data.nodes[s.node],events=s.lot.events.slice(Math.max(0,s.index-4),s.index+1).reverse();
  $('#detail').innerHTML=`<div class="detail-kicker">LOT INSPECTOR / FAB ${lot.fab}</div><h2>${esc(lot.id)}</h2><p>${esc(lot.code)} · ${r.id} / ${esc(r.name)}</p><span class="detail-status" style="--state-color:${colors[s.event[2]]}">${statusNames[s.event[2]]}</span><h3>${esc(node.desc)}</h3><div class="facts"><span>공정 ID</span><strong>${esc(node.operId)}</strong><span>라우트 진행</span><strong>${s.event[1]+1} / ${lot.path.length}</strong><span>상태 유지</span><strong>${Math.floor(minute-s.event[0])}분</strong><span>관측 시점</span><strong>${format(minute)}</strong></div><div class="detail-actions"><button id="focus-lot">위치로 이동</button><button id="focus-route">라우트만 보기</button></div><h3>최근 이벤트</h3>${events.map(e=>`<div class="history-entry">${statusNames[e[2]]}<small>${esc(data.nodes[lot.path[e[1]]].operId)} · ${format(e[0])}</small></div>`).join('')}`;
  $('#detail').insertAdjacentHTML('beforeend',`<div class="detail-actions"><button id="compare-add">${compared.has(lot.id)?'비교 제외':'비교에 추가'}</button><button id="open-operation">공정 / 장비 보기</button></div><p>진입: ${data.stages[r.entryStage]}<br>종료: ${data.stages[r.exitStage]}</p>`);
  if(s.nextNode!==null)$('#detail').insertAdjacentHTML('beforeend',`<p class="travel-detail">이동 중: ${esc(node.operId)} → ${esc(data.nodes[s.nextNode].operId)}<br>구간 진행 ${Math.round(s.fraction*100)}% · 도착까지 ${Math.max(0,Math.ceil(s.event[3]-minute))}분</p>`);
  $('#compare-add').onclick=()=>toggleCompare(lot.id);$('#open-operation').onclick=()=>select({type:'node',id:s.node});
  $('#focus-lot').onclick=()=>select(selected,true);$('#focus-route').onclick=()=>{route=lot.route;$('#search').value='';filter();fit();};
}
function animate(now){
  const delta=previousFrame?Math.min(.1,(now-previousFrame)/1000):0;previousFrame=now;
  if(playing&&data){minute=Math.min(FORECAST_END,minute+delta*Number($('#speed').value));$('#time').value=String(Math.floor(minute));updateStates();if(now-lastMetrics>300){updateMetrics();renderDetail();lastMetrics=now;}if(minute>=FORECAST_END){stop();updateMetrics();}dirty=true;}
  if(dirty)draw();requestAnimationFrame(animate);
}
canvas.addEventListener('wheel',e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);zoomAt(Math.exp(-Math.max(-250,Math.min(250,delta))*.002),e.clientX-rect.left,e.clientY-rect.top);$('#tooltip').hidden=true;},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.focus();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});wasDragged=false;drag={x:e.clientX,y:e.clientY,button:e.button,shift:e.shiftKey};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}canvas.classList.add('dragging');});
canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;if(pointers.has(e.pointerId)){const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;if(pinch){zoomAt(distance/Math.max(1,pinch.distance),cx-rect.left,cy-rect.top);camera.x+=cx-pinch.x;camera.y+=cy-pinch.y;}pinch={distance,x:cx,y:cy};wasDragged=true;}else if(drag){const dx=e.clientX-old.x,dy=e.clientY-old.y;if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>3)wasDragged=true;if(dragMode(camera.depth,drag.button,e.shiftKey)==='rotate'){camera.rotation=rotationForDrag(camera,dx,dy);}else{camera.x+=dx;camera.y+=dy;}}$('#tooltip').hidden=true;dirty=true;}else{const hover=pick(x,y);canvas.style.cursor=hover?'pointer':'grab';showTooltip(hover,x,y);}});
function endPointer(e){pointers.delete(e.pointerId);pinch=null;if(!pointers.size){canvas.classList.remove('dragging');if(!wasDragged&&e.type==='pointerup'&&e.button===0){const rect=canvas.getBoundingClientRect(),target=pick(e.clientX-rect.left,e.clientY-rect.top);if(target?.type==='lot'&&(multi||e.ctrlKey||e.metaKey))toggleCompare(target.id);else select(target);}drag=null;}}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('pointerleave',()=>{$('#tooltip').hidden=true;});
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='f'){e.preventDefault();fit();}if(e.key==='Escape')select(null);if(e.target===canvas){if(e.key==='+'||e.key==='=')zoomAt(1.2);if(e.key==='-')zoomAt(1/1.2);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();camera.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;camera.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;dirty=true;}}});
$('#fit').onclick=fit;$('#zoom-in').onclick=()=>zoomAt(1.3);$('#zoom-out').onclick=()=>zoomAt(1/1.3);$('#flat').onclick=()=>setDepth(false);$('#depth').onclick=()=>setDepth(true);$('#direction').onclick=()=>{camera.vertical=!camera.vertical;$('#direction').textContent=camera.vertical?'세로 ↓':'가로 →';fit();};$('#labels').onchange=()=>{dirty=true;};$('#reset-camera').onclick=()=>{camera.yaw=.24;camera.pitch=-.4;camera.rotation=null;fit();};$('#close-inspector').onclick=()=>select(null);
$('#sidebar-toggle').onclick=()=>{const app=$('#app');if(window.innerWidth<=700){app.classList.toggle('sidebar-open');$('#sidebar-toggle').setAttribute('aria-expanded',String(app.classList.contains('sidebar-open')));}else{app.classList.toggle('sidebar-hidden');$('#sidebar-toggle').setAttribute('aria-expanded',String(!app.classList.contains('sidebar-hidden')));}};
$('#search').oninput=()=>{if(!data)return;select(null);filter();fit();};$('.fab-filter').onclick=e=>{if(!e.target.dataset.fab||!data)return;fab=e.target.dataset.fab;$('.fab-filter').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.fab===fab);b.setAttribute('aria-pressed',String(b.dataset.fab===fab));});select(null);filter();fit();};$('#all-routes').onclick=()=>{if(!data)return;route=null;$('#search').value='';select(null);filter();fit();};
$('#multi').onclick=()=>{multi=!multi;$('#multi').setAttribute('aria-pressed',String(multi));$('#multi').classList.toggle('active',multi);};
$('#time').oninput=()=>{if(!data)return;stop();minute=Number($('#time').value);updateStates();updateMetrics();renderDetail();};$('#latest').onclick=()=>{if(!data)return;stop();minute=10080;$('#time').value='10080';updateStates();updateMetrics();renderDetail();};$('#play').onclick=()=>{if(!data)return;if(playing){stop();return;}if(minute>=FORECAST_END){minute=10080;$('#time').value='10080';updateStates();updateMetrics();}playing=true;$('#play').textContent='Ⅱ';$('#play').setAttribute('aria-label','타임라인 일시정지');};
new ResizeObserver(resize).observe(area);requestAnimationFrame(animate);
try{const response=await fetch('/data/graph_demo.json');if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();if(data.version!==3||!data.nodes.length||!data.lots.length)throw Error('지원되지 않는 그래프 데이터');$('#route-count').textContent=String(data.routes.length);$('#data-summary').textContent=`${data.routes.flatMap(r=>r.codes).length} codes / ${data.lots.length.toLocaleString()} lots / ${data.edges.length.toLocaleString()} links`;$('#start-label').textContent=format(0);$('#end-label').textContent=format(10080);$('#loading').hidden=true;filter();resize();}catch(error){$('#loading').textContent=`데이터를 불러오지 못했습니다: ${error.message}`;$('#loading').setAttribute('role','alert');console.error(error);}
