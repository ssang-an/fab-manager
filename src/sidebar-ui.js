export function initSidebarUI(){
 const $=s=>document.querySelector(s),sidebar=$('#sidebar');
 const style=document.createElement('link');style.rel='stylesheet';style.href='/src/sidebar.css';document.head.append(style);
 const heading=sidebar.querySelector(':scope>.sidebar-heading');heading.innerHTML='<strong>탐색 · 필터</strong><button id="sidebar-fold" title="메뉴 전체 접기">모두 접기</button>';
 const groups=[
  {id:'filters',title:'검색 · 기본 필터',hint:'LOT / FAB / 장비',selectors:['label[for=search]','#search','#lot-code-options','.fab-filter','#research-label','.equipment-search']},
  {id:'routes',title:'라우트 선택',hint:'검색 · 다중 선택',selectors:['label[for=route-search]','#route-search','#route-selection','#all-routes','#route-list']},
  {id:'down',title:'장비 DOWN / PM',hint:'현재 다운 현황',selectors:['#down-dashboard']},
  {id:'ranking',title:'WIP 랭킹',hint:'공정 · 장비 · 홀드',selectors:['.wip-panel']}
 ];
 // Keep the route-count target used by dataset initialization.
 const count=document.createElement('span');count.id='route-count';count.hidden=true;heading.append(count);
 let saved={};try{const value=JSON.parse(localStorage.getItem('fab-sidebar-sections')||'{}');if(value&&typeof value==='object')saved=value;}catch{}
 for(const g of groups){
  const details=document.createElement('details');details.className='sidebar-section';details.id='sidebar-'+g.id;details.open=saved[g.id]??g.id==='filters';
  const summary=document.createElement('summary');summary.innerHTML='<span><strong>'+g.title+'</strong><small id="summary-'+g.id+'">'+g.hint+'</small></span><span class="section-chevron" aria-hidden="true">⌄</span>';
  const body=document.createElement('div');body.className='sidebar-section-body';details.append(summary,body);sidebar.insertBefore(details,sidebar.querySelector('footer'));
  for(const selector of g.selectors){const node=$(selector);if(node)body.append(node);}
  details.addEventListener('toggle',()=>{updateFold();try{const state=Object.fromEntries(groups.map(g=>[g.id,$('#sidebar-'+g.id).open]));localStorage.setItem('fab-sidebar-sections',JSON.stringify(state));}catch{}});
 }
 const eqLabel=document.createElement('label');eqLabel.textContent='장비 검색';eqLabel.htmlFor='equipment-search';$('.equipment-search').before(eqLabel);
 function updateFold(){const closed=groups.every(g=>!$('#sidebar-'+g.id).open),button=$('#sidebar-fold');button.textContent=closed?'모두 펼치기':'모두 접기';button.title=closed?'메뉴 전체 펼치기':'메뉴 전체 접기';}
 $('#sidebar-fold').onclick=()=>{const allClosed=groups.every(g=>!$('#sidebar-'+g.id).open);for(const g of groups)$('#sidebar-'+g.id).open=allClosed;updateFold();};
 updateFold();
 $('#search').addEventListener('input',()=>{if($('#search').value.trim())$('#sidebar-routes').open=true;update();});
 function text(id,value){const el=$(id);if(el.textContent!==value)el.textContent=value;}
 function update(){
  const fab=$('.fab-filter button[aria-pressed=true]')?.textContent||'전체',q=$('#search').value.trim(),eq=$('#equipment-search').value.trim();
  text('#summary-filters',[fab,q,eq,$('#research-only').checked?'R&D':''].filter(Boolean).join(' · '));
  text('#summary-routes',$('#route-selection>span')?.textContent||'검색 · 다중 선택');
  text('#summary-down',($('#down-count').textContent||'0')+'대 · 선택 AREA');
  text('#summary-ranking',($('.wip-panel>p')?.textContent||'공정 · 장비 · 홀드'));
 }
 const observer=new MutationObserver(update);for(const selector of ['#route-selection','#down-count','.wip-panel>p']){const target=$(selector);if(target)observer.observe(target,{childList:true,subtree:true,characterData:true});}
 sidebar.addEventListener('change',update);update();
}
