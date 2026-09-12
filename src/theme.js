export function themeColor(value,light=document.documentElement.dataset.theme==='light'){
  if(!light)return value;
  const surfaces={'#26333b':'#d1dce2','#162128':'#f8fafb','#1f3039':'#fff8e9'};
  if(surfaces[value])return surfaces[value];
  if(!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value))return value;
  return '#'+[1,3,5].map(i=>Math.round(parseInt(value.slice(i,i+2),16)*.58).toString(16).padStart(2,'0')).join('')+value.slice(7);
}
export function initTheme(onChange){
  const link=document.createElement('link');link.rel='stylesheet';link.href='/src/theme.css';document.head.append(link);
  const button=document.createElement('button');button.id='theme-toggle';button.type='button';button.setAttribute('aria-label','라이트 테마');
  document.querySelector('#navigator-toggle, #sidebar-toggle').before(button);
  let light=false;try{light=localStorage.getItem('fab-manager-theme')==='light';}catch{}
  const apply=()=>{document.documentElement.dataset.theme=light?'light':'dark';button.textContent=light?'☾ DARK':'☀ LIGHT';button.setAttribute('aria-pressed',String(light));button.title=light?'다크 테마로 전환':'라이트 테마로 전환';onChange(light);};
  button.onclick=()=>{light=!light;try{localStorage.setItem('fab-manager-theme',light?'light':'dark');}catch{}apply();};apply();
}
