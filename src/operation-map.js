import {operationSnapshot} from './operation-drilldown.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function operationMapLayout(s){
 const width=Math.max(1000,s.tools.length*360),root={x:width/2,y:65},nodes=[],edges=[],lots=[];
 const link=(a,b,backup=false)=>edges.push({a,b,backup});
 let bottom=380;
 s.tools.forEach((t,i)=>{
  const center=(i+.5)*width/Math.max(1,s.tools.length),tool={x:center,y:170,label:t.id,sub:`${t.role} · ${t.status}`,kind:'tool',bad:t.status!=='READY'};nodes.push(tool);link(root,tool,t.role.includes('백업'));
  [...t.chambers,...t.ports].forEach((c,j)=>{
   const n={x:center+(j-2)*62,y:280,label:c.id,sub:t.status!=='READY'?'DOWN':c.lots.length?(j<3?'PROC':'LOAD'):(j<3?'IDLE':'EMPTY'),kind:'slot',bad:t.status!=='READY'};nodes.push(n);link(tool,n);
   c.lots.forEach((state,k)=>{lots.push({x:n.x+((k%4)-1.5)*10,y:329+Math.floor(k/4)*12,state});bottom=Math.max(bottom,355+Math.floor(k/4)*12);});
  });
 });
 const groups=[['WAIT',s.wait],['HOLD',s.hold],['END',s.end],['장비 미매핑',s.unassigned]].filter(([,rows],i)=>i<2||rows.length);
 const y=bottom+65,groupWidth=width/groups.length;let height=y+140;
 groups.forEach(([label,rows],i)=>{const x=(i+.5)*groupWidth;nodes.push({x,y,label,sub:`${rows.length} LOT`,kind:'queue'});rows.forEach((state,k)=>{const cols=Math.max(5,Math.floor((groupWidth-60)/13)),lx=x-(cols-1)*6.5+(k%cols)*13,ly=y+48+Math.floor(k/cols)*13;lots.push({x:lx,y:ly,state});height=Math.max(height,ly+55);});});
 return {width,height,root,nodes,edges,lots};
}
export function createOperationDrilldown(api){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/src/operation-map.css';document.head.append(style);
 const host=document.createElement('section');host.id='operation-map';host.hidden=true;host.setAttribute('aria-label','공정 장비 노드 맵');document.querySelector('#canvas-area').append(host);
 host.innerHTML='<nav><button data-back>← 공정 맵</button><strong></strong><span></span><button data-fit>전체 맞춤</button></nav><div class="operation-map-stage"><svg aria-label="장비, 챔버, 로드포트와 랏 노드" role="group" tabindex="0"><g></g></svg></div><p class="operation-map-note">휠: 확대·축소 · 드래그: 이동 · 원 클릭: 랏 상세 · PROC 초록 / LOAD 보라 / WAIT 노랑 / HOLD 빨강<br>CH·LP는 선택 공정 기준 가상 그룹(실제 점유 아님) · LOAD = JOB START</p><output hidden></output>';
 const svg=host.querySelector('svg'),group=host.querySelector('g'),stage=host.querySelector('.operation-map-stage'),tip=host.querySelector('output');
 let id=null,snapshot,layout,view,drag,closing=false,returnState,priorFocus,timer;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function setView(){svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);}
 function fit(){if(!layout)return;view={x:-30,y:-25,w:layout.width+60,h:layout.height+50};setView();}
 function update(){
  if(id===null||closing)return;const {data,states,minute}=api.context();if(!data)return;snapshot=operationSnapshot(data,states,id,minute);layout=operationMapLayout(snapshot);
  host.querySelector('strong').textContent=`${snapshot.node.fab} / ${snapshot.node.desc}`;host.querySelector('nav span').textContent=minute>10080?'SIMULATION':minute===10080?'LIVE':'PAST';
  const circle=n=>`<g class="op-node ${n.kind} ${n.bad?'bad':''}" transform="translate(${n.x} ${n.y})"><circle r="${n.kind==='tool'?15:n.kind==='slot'?8:5}"/><text y="-24">${esc(n.label)}</text><text class="op-sub" y="${n.kind==='tool'?34:24}">${esc(n.sub)}</text></g>`;
  group.innerHTML=layout.edges.map(e=>`<path class="op-edge ${e.backup?'backup':''}" d="M${e.a.x},${e.a.y} C${e.a.x},${(e.a.y+e.b.y)/2} ${e.b.x},${(e.a.y+e.b.y)/2} ${e.b.x},${e.b.y}"/>`).join('')+circle({...layout.root,label:snapshot.node.desc,sub:'OPERATION',kind:'root'})+layout.nodes.map(circle).join('')+layout.lots.map(p=>`<circle class="op-lot state-${p.state.event[2]}" cx="${p.x}" cy="${p.y}" r="3.4" tabindex="0" role="button" data-lot="${esc(p.state.lot.id)}" aria-label="${esc(p.state.lot.id)} ${['WAIT','LOAD','PROC','HOLD','END'][p.state.event[2]]}"><title>${esc(p.state.lot.id)} · ${esc(p.state.lot.code)} · ${p.state.lot.WF_QTY??'—'} WF · ${['WAIT','LOAD','PROC','HOLD','END'][p.state.event[2]]}${p.state.holdCode?' · '+esc(p.state.holdCode):''}</title></circle>`).join('');
  if(!view)fit();
 }
 function close(after){if(closing||id===null)return;closing=true;host.classList.remove('entered');host.classList.add('leaving');api.restore?.(returnState);clearTimeout(timer);timer=setTimeout(()=>{host.hidden=true;host.classList.remove('leaving');id=null;closing=false;priorFocus?.focus();after?.();},reduced()?0:500);}
 host.querySelector('[data-back]').onclick=()=>close();host.querySelector('[data-fit]').onclick=fit;
 function choose(e){const target=e.target.closest('[data-lot]');if(target&&!drag?.moved)close(()=>api.selectLot(target.dataset.lot));}
 svg.addEventListener('click',choose);host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}if(e.key==='Enter'&&e.target.matches('[data-lot]'))choose(e);});
 svg.addEventListener('wheel',e=>{e.preventDefault();if(!view)return;const matrix=svg.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()),factor=Math.exp(Math.max(-180,Math.min(180,e.deltaY))*.002),w=Math.max(100,Math.min(layout.width*5,view.w*factor)),r=w/view.w;view={x:p.x-(p.x-view.x)*r,y:p.y-(p.y-view.y)*r,w,h:view.h*r};setView();},{passive:false});
 svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;svg.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,moved:false};});
 svg.addEventListener('pointermove',e=>{if(!drag||!svg.hasPointerCapture(e.pointerId))return;const matrix=svg.getScreenCTM();if(!matrix)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;view.x-=dx/matrix.a;view.y-=dy/matrix.d;drag.x=e.clientX;drag.y=e.clientY;setView();});
 svg.addEventListener('pointerup',e=>{if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);});
 svg.addEventListener('pointercancel',()=>drag=null);
 return {open(nodeId){clearTimeout(timer);priorFocus=document.activeElement;returnState=api.capture?.();id=nodeId;view=null;closing=false;host.hidden=false;host.classList.remove('leaving','entered');const origin=api.origin?.(nodeId);stage.style.transformOrigin=origin?`${origin.x}px ${origin.y}px`:'50% 50%';update();requestAnimationFrame(()=>requestAnimationFrame(()=>host.classList.add('entered')));host.querySelector('[data-back]').focus();},close,update};
}
