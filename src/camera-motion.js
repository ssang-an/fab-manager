export function fitCamera(bounds,width,height){
  const scale=Math.max(.025,Math.min(2,Math.max(50,width-110)/(bounds.maxX-bounds.minX+120),Math.max(50,height-160)/(bounds.maxY-bounds.minY+120)));
  return {scale,x:width/2-(bounds.minX+bounds.maxX)/2*scale,y:height/2-(bounds.minY+bounds.maxY)/2*scale};
}
export function cameraFrame(from,to,progress){
  const t=Math.max(0,Math.min(1,progress)),e=t*t*(3-2*t);
  const scale=Math.exp(Math.log(from.scale)*(1-e)+Math.log(to.scale)*e);
  return {scale,x:(from.x/from.scale*(1-e)+to.x/to.scale*e)*scale,y:(from.y/from.scale*(1-e)+to.y/to.scale*e)*scale};
}
export function followFrame(camera,target,seconds){
  const a=1-Math.exp(-Math.max(0,seconds)*12);
  return {x:camera.x+(target.x-camera.x)*a,y:camera.y+(target.y-camera.y)*a};
}
