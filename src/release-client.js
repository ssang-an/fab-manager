let busy=false;
export function releaseWhatIfAsync(dataset,input,onProgress=()=>{}){
 if(busy)return Promise.reject(Error('투입 시나리오를 계산 중입니다. 완료 후 다시 요청하세요.'));
 busy=true;
 return new Promise((resolve,reject)=>{
  let worker;try{worker=new Worker(new URL('./release-worker.js',import.meta.url),{type:'module'});}catch{busy=false;reject(Error('브라우저에서 백그라운드 계산을 시작할 수 없습니다.'));return;}
  const finish=(error,result)=>{clearTimeout(timer);worker.terminate();busy=false;error?reject(Error(error)):resolve(result);};
  const timer=setTimeout(()=>finish('계산 시간 초과. 투입 수를 줄여 다시 시도하세요.'),120000);
  worker.onmessage=({data})=>{if(data.progress)onProgress(data.progress);else finish(data.error,data.result);};
  worker.onerror=()=>finish('시나리오 계산 오류');
  try{worker.postMessage({dataset,input});}catch{finish('시나리오 입력 전달 실패');}
 });
}
