export function initGuardianPoses(){
 const button=document.querySelector('#assistant-open'),bubble=document.querySelector('#copilot-bubble'),img=button.querySelector('img');
 const sources={idle:'/src/assets/fab-guardian.png',alert:'/src/assets/fab-guardian-alert.png',think:'/src/assets/fab-guardian-think.png'};
 Object.values(sources).forEach(src=>{const preload=new Image();preload.src=src;});
 const badge=document.createElement('span');badge.className='guardian-emote';badge.setAttribute('aria-hidden','true');button.append(badge);
 const mirrors=[];for(const selector of ['.assistant-heading','.whatif-chat-heading']){const heading=document.querySelector(selector);if(!heading)continue;const image=document.createElement('img');image.className='guardian-mini';image.alt='';heading.prepend(image);mirrors.push(image);}
 let hover=false;const controls=['#assistant-form button','#whatif-send','#release-run'].map(s=>document.querySelector(s)).filter(Boolean);
 function update(){const busy=document.querySelector('#assistant-form button').disabled&&!document.querySelector('#assistant-panel').classList.contains('llm-configuring');
  // Actual busy controls in What-if also work without an LLM connection.
  const calculating=document.querySelector('#whatif-send')?.disabled||document.querySelector('#release-run')?.disabled||busy;
  const pose=calculating?'think':!bubble.hidden?'alert':hover?'think':'idle';
  if(button.dataset.pose!==pose){button.dataset.pose=pose;img.src=sources[pose];}badge.textContent=pose==='alert'?'!':pose==='think'?'···':'';badge.hidden=pose==='idle';
  for(const image of mirrors)image.src=sources[calculating?'think':'idle'];
 }
 button.addEventListener('pointerenter',()=>{hover=true;update();});button.addEventListener('pointerleave',()=>{hover=false;update();});
 const observer=new MutationObserver(update);observer.observe(bubble,{attributes:true,attributeFilter:['hidden']});for(const c of controls)observer.observe(c,{attributes:true,attributeFilter:['disabled']});update();
}
