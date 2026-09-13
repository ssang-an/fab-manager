import {areaLoad,miniTransform} from './visual-model.js';
export function createVisualUI(api,areas){
  const style=document.createElement('link');style.rel='stylesheet';style.href='/src/visual.css';document.head.append(style);
  document.querySelector('#canvas-area').insertAdjacentHTML('beforeend',`<section id="area-load" aria-label="AREA별 재공"><div class="visual-heading">AREA LOAD <small>현재 필터 · LOT</small></div><div id="area-load-bars"></div></section><div id="visual-controls"><label>강조 <select id="visual-lens"><option value="all">전체 흐름</option><option value="hold">HOLD</option><option value="wait">WAIT</option><option value="move">이동 중</option></select></label><label><input id="heat-toggle" type="checkbox" checked> WIP 밀도</label><button id="visual-reset">강조 해제</button></div><section id="mini-panel"><div class="visual-heading">NAVIGATOR <button id="mini-fit" aria-label="미니맵 전체 맞춤">FIT ↗</button></div><canvas id="mini-map" width="180" height="100" tabindex="0" role="button" aria-label="미니맵 클릭으로 위치 이동, Enter로 전체 맞춤"></canvas></section>`);
  let layer=null,lens='all',heat=true,transform=null;const mini=document.querySelector('#mini-map'),ctx=mini.getContext('2d');
  const areaPanel=document.querySelector('#area-load'),areaBars=document.querySelector('#area-load-bars'),areaToggle=document.createElement('button');areaToggle.id='area-load-toggle';areaToggle.type='button';areaToggle.setAttribute('aria-controls','area-load-bars');areaPanel.querySelector('.visual-heading').replaceChildren(areaToggle);
  let areaShown=true;try{areaShown=localStorage.getItem('fab-area-load-visible')!=='false';}catch{}
  function syncAreaPanel(){areaBars.hidden=!areaShown;areaToggle.textContent=areaShown?'AREA LOAD · 접기 ▴':'AREA LOAD · 펼치기 ▾';areaToggle.setAttribute('aria-expanded',String(areaShown));}
  areaToggle.onclick=()=>{areaShown=!areaShown;syncAreaPanel();try{localStorage.setItem('fab-area-load-visible',String(areaShown));}catch{}};syncAreaPanel();
  const panel=document.querySelector('#mini-panel'),toggle=document.createElement('button');toggle.id='navigator-toggle';toggle.type='button';toggle.textContent='NAVIGATOR';toggle.setAttribute('aria-controls','mini-panel');
  const close=document.createElement('button');close.id='mini-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','Navigator 닫기');panel.querySelector('.visual-heading').append(close);
  let visible=true;try{visible=localStorage.getItem('fab-navigator-visible')!=='false';}catch{}
  const setVisible=value=>{visible=value;panel.hidden=!value;toggle.setAttribute('aria-expanded',String(value));toggle.setAttribute('aria-label',value?'Navigator 닫기':'Navigator 열기');toggle.title=value?'Navigator 닫기':'Navigator 열기';try{localStorage.setItem('fab-navigator-visible',String(value));}catch{}api.dirty();};
  toggle.onclick=()=>{setVisible(!visible);if(visible){const bubble=document.querySelector('#copilot-bubble');if(bubble)bubble.hidden=true;}};close.onclick=()=>{setVisible(false);toggle.focus();};setVisible(visible);
  document.querySelector('#visual-lens').onchange=e=>{lens=e.target.value;api.dirty();};
  document.querySelector('#heat-toggle').onchange=e=>{heat=e.target.checked;api.dirty();};
  document.querySelector('#visual-reset').onclick=()=>{layer=null;lens='all';document.querySelector('#visual-lens').value='all';api.refresh();};
  document.querySelector('#mini-fit').onclick=api.fit;mini.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();api.fit();}};
  mini.onclick=e=>{if(!transform)return;const r=mini.getBoundingClientRect(),x=(e.clientX-r.left)*180/r.width,y=(e.clientY-r.top)*100/r.height;api.pan((x-transform.x)/transform.scale,(y-transform.y)/transform.scale);};
  function update(states,nodes){document.querySelectorAll('[data-area-name]').forEach(b=>b.setAttribute('aria-pressed',String(areas[layer]?.label===b.dataset.areaName)));const loads=areaLoad(states,nodes),max=Math.max(1,...loads.map(r=>r.total));document.querySelector('#area-load-bars').innerHTML=loads.map((r,i)=>`<button data-layer="${i}" aria-pressed="${layer===i}" title="${areas[i].label}: 대기 ${r.wait} / 진행 ${r.proc} / 홀드 ${r.hold} / 이동 ${r.move}. 클릭하면 영역 강조" style="--area:${areas[i].color};--load:${r.total/max*100}%"><span>${areas[i].label}</span><strong>${r.total}</strong><i></i><small>W ${r.wait} · H ${r.hold}</small></button>`).join('');document.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{layer=layer===+b.dataset.layer?null:+b.dataset.layer;api.refresh();});}
  function active(state,node){return (layer===null||node.layer===layer)&&(lens==='all'||lens==='hold'&&state.event[2]===3||lens==='wait'&&state.event[2]===0||lens==='move'&&state.nextNode!=null);}
  function draw(projected,nodes,rankings,width,height){
    if(panel.hidden)return;
    ctx.clearRect(0,0,180,100);transform=miniTransform([...projected.values(),{x:0,y:0},{x:width,y:height}],180,100);if(!transform)return;
    const {scale,x,y}=transform;for(const [id,p] of projected){ctx.fillStyle=areas[nodes[id].layer]?.color||'#67838c';ctx.globalAlpha=.45;ctx.fillRect(p.x*scale+x,p.y*scale+y,1.3,1.3);}
    ctx.globalAlpha=1;for(const r of rankings.slice(0,5)){const p=projected.get(r.node);if(p){ctx.fillStyle='#efbb6b';ctx.fillRect(p.x*scale+x-2,p.y*scale+y-2,4,4);}}
    ctx.strokeStyle='#89d5c3';ctx.lineWidth=1;ctx.fillStyle='#8acfc810';ctx.fillRect(x,y,width*scale,height*scale);ctx.strokeRect(x,y,width*scale,height*scale);
  }
  return {update,active,draw,setArea(name){layer=name==='ALL'?null:areas.findIndex(a=>a.label===name);api.refresh();},get heat(){return heat;},get layer(){return layer;}};
}
