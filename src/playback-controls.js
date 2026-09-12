export function initPlaybackControls(){
 const button=document.querySelector('#play');
 const render=()=>{const paused=button.getAttribute('aria-label')==='타임라인 일시정지';button.dataset.playing=String(paused);button.innerHTML=paused?'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.8c0-1 1.1-1.6 1.9-1l11 7.2c.8.5.8 1.5 0 2l-11 7.2c-.8.6-1.9 0-1.9-1z" transform="translate(-2 0)"/></svg>';};
 new MutationObserver(render).observe(button,{attributes:true,attributeFilter:['aria-label']});render();
}
