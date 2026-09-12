// Local, explainable demo rules. A seek/filter change is not a production incident.
export function createAlertDetector(){
 let previous=null,lastNotice=-Infinity;
 return function detect(snapshot,now=Date.now()){
  const reset=!previous||snapshot.scope!==previous.scope||snapshot.minute<previous.minute||snapshot.minute-previous.minute>30;
  const before=previous;previous=snapshot;
  if(reset){
   if(now-lastNotice<30000)return null;
   lastNotice=now;
   const top=snapshot.wip[0],down=snapshot.down[0];
   if(down)return {kind:'equipment',id:down.id,text:`현재 DOWN ${snapshot.down.length}대입니다. ${down.id}의 정비 이력과 영향 공정을 확인해 보세요.`};
   if(top&&top.total>=20)return {kind:'process',id:top.node,text:`${top.desc}에 ${top.total} LOT가 집중되어 있습니다. 대기 ${top.wait} LOT를 확인해 보세요.`};
   return null;
  }
  if(now-lastNotice<30000)return null;
  const newDown=snapshot.down.find(d=>!before.down.some(p=>p.key===d.key));
  const surge=snapshot.wip.find(w=>{const p=before.wip.find(p=>p.node===w.node);return w.total>=20&&(p?.total||0)<20;});
  if(newDown){lastNotice=now;return {kind:'equipment',id:newDown.id,text:`${newDown.id} DOWN이 감지됐습니다. 영향 재공과 정비 이력을 확인해 보세요.`};}
  if(surge){lastNotice=now;return {kind:'process',id:surge.node,text:`${surge.desc} WIP가 ${surge.total} LOT로 증가했습니다. 대기 ${surge.wait} LOT · 공정 상태를 확인해 보세요.`};}
  return null;
 };
}
