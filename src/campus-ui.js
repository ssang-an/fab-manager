import {fabNames,fabSummary,sites} from './fab-campus.js';
export function createCampusUI(api){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/src/campus.css';document.head.append(style);
 const filter=document.querySelector('.fab-filter');filter.innerHTML=['all',...fabNames].map(f=>`<button data-fab="${f}" class="${f==='all'?'active':''}" aria-pressed="${f==='all'}">${f==='all'?'전체':f}</button>`).join('');
 filter.insertAdjacentHTML('afterend','<label id="research-label"><input type="checkbox" id="research-only"> R&D만 보기 <small>기본: 연구 + 양산</small></label>');
 document.querySelector('#research-only').onchange=e=>api.research(e.target.checked);
 document.querySelector('#canvas-area').insertAdjacentHTML('beforeend','<div id="campus-summary" aria-label="팹별 현재 재공"></div>');
 const box=document.querySelector('#campus-summary');
 const toggle=document.createElement('button');toggle.id='campus-summary-toggle';toggle.type='button';toggle.textContent='FAB WIP';toggle.setAttribute('aria-controls','campus-summary');document.querySelector('.toolbar').append(toggle);
 const shell=document.createElement('section');shell.id='campus-summary-shell';box.before(shell);const localToggle=document.createElement('button');localToggle.id='campus-summary-local-toggle';localToggle.type='button';localToggle.setAttribute('aria-controls','campus-summary');shell.append(localToggle,box);
 let shown=true;try{shown=localStorage.getItem('fab-campus-summary')!=='hidden';}catch{}
 function sync(){box.hidden=!shown;toggle.setAttribute('aria-expanded',String(shown));toggle.title=shown?'팹별 WIP 요약 숨기기':'팹별 WIP 요약 표시';localToggle.setAttribute('aria-expanded',String(shown));localToggle.textContent=shown?'FAB WIP · 접기 ▴':'FAB WIP · 펼치기 ▾';}
 toggle.onclick=()=>{shown=!shown;sync();try{localStorage.setItem('fab-campus-summary',shown?'visible':'hidden');}catch{}};sync();
 localToggle.onclick=()=>toggle.click();
 function update(states,nodes,rdOnly){const summary=fabSummary(states,nodes);box.innerHTML=sites.map(site=>`<section class="site-summary"><h3>${site.label} <small>${site.id}</small></h3><div>${site.fabs.map(fab=>{const r=summary.find(r=>r.fab===fab);return r?`<button data-campus="${fab}"><b>${fab}</b><span>${r.wip} WIP</span></button>`:`<div class="unmapped-fab"><b>${fab}</b><small>샘플 미배치</small></div>`;}).join('')}</div></section>`).join('')+'<p>사용자 지정 SITE · 개념 배치 / 실제 지리·축척 아님</p>';box.querySelectorAll('button').forEach(b=>b.onclick=()=>api.focus(b.dataset.campus));}
 function draw(ctx,nodes,project,light){
  if(!nodes.length)return;const start=Math.min(...nodes.map(n=>n.x))-70,end=Math.max(...nodes.map(n=>n.x))+80;
  for(const fab of fabNames){const local=nodes.filter(n=>n.fab===fab);if(!local.length)continue;const low=Math.min(...local.map(n=>n.y))-90,high=Math.max(...local.map(n=>n.y))+90;
   const corners=[{x:start,y:low,z:0},{x:end,y:low,z:0},{x:end,y:high,z:0},{x:start,y:high,z:0}].map(project);
   ctx.save();
   // Small hard offset shadow, no glow/blur to compete with WIP density.
   ctx.fillStyle=light?'#00000008':'#00000024';ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x+2,p.y+3):ctx.moveTo(p.x+2,p.y+3));ctx.closePath();ctx.fill();
   ctx.fillStyle=light?'#f2f3f4':'#222629';ctx.strokeStyle=light?'#b6bdc1':'#50585e';ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
   const p=project({x:start,y:(low+high)/2,z:0});ctx.font='bold 13px "Malgun Gothic",sans-serif';ctx.fillStyle=light?'#24534e':'#c3e3dc';ctx.fillText(`${fab}`,p.x+5,p.y-10);
  }
 }
 return {update,draw};
}
