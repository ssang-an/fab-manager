const formatter=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',weekday:'long',hour:'numeric',minute:'numeric',hourCycle:'h23'});
export function formatTimelineDate(timestamp){
 const p=Object.fromEntries(formatter.formatToParts(timestamp).map(p=>[p.type,p.value]));
 return `${p.year}년 ${Number(p.month)}월 ${Number(p.day)}일 ${p.weekday} ${Number(p.hour)}시 ${Number(p.minute)}분`;
}
