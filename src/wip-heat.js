// Screen-space density overlay, independent of camera zoom and theme remapping.
export function wipHeat(total,hold,wait,light){
 const radius=Math.min(58,18+Math.sqrt(Math.max(0,total))*3.5);
 const rgb=hold>wait?(light?'215,42,42':'255,76,76'):(light?'210,190,0':'255,233,66');
 return {radius,stops:[[0,`rgba(${rgb},${light?.48:.42})`],[.35,`rgba(${rgb},${light?.30:.27})`],[.7,`rgba(${rgb},${light?.12:.11})`],[1,`rgba(${rgb},0)`]]};
}
const sprites=new Map();
export function drawWipHeat(ctx,x,y,total,hold,wait,light){
 const key=String(light)+':'+String(hold>wait),{radius,stops}=wipHeat(total,hold,wait,light);
 let sprite=sprites.get(key);
 if(!sprite){
  sprite=document.createElement('canvas');sprite.width=128;sprite.height=128;
  const c=sprite.getContext('2d'),gradient=c.createRadialGradient(64,64,0,64,64,64);
  for(const [position,color] of stops)gradient.addColorStop(position,color);
  c.fillStyle=gradient;c.fillRect(0,0,128,128);sprites.set(key,sprite);
 }
 ctx.drawImage(sprite,x-radius,y-radius,radius*2,radius*2);
}
