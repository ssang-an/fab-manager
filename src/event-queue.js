// FCFS ready time, then lot index: same ordering as sorting and popping the old queue.
export class EventQueue{
 constructor(){this.items=[];}
 get length(){return this.items.length;}
 before(a,b){return a.ready<b.ready||(a.ready===b.ready&&a.i<b.i);}
 push(value){const a=this.items;a.push(value);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(!this.before(a[i],a[p]))break;[a[i],a[p]]=[a[p],a[i]];i=p;}}
 pop(){const a=this.items;if(!a.length)return undefined;const top=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;while(true){const l=i*2+1,r=l+1;let best=i;if(l<a.length&&this.before(a[l],a[best]))best=l;if(r<a.length&&this.before(a[r],a[best]))best=r;if(best===i)break;[a[i],a[best]]=[a[best],a[i]];i=best;}}return top;}
}
