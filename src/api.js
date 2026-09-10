export async function request(path,method='GET',data){
  let res;
  try{res=await fetch(path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(35000)});}catch{throw new Error('אין חיבור לשרת. הפעולה לא אושרה — בדקו את החיבור ונסו שוב.');}
  const result=await res.json().catch(()=>({error:'השרת לא החזיר תשובה תקינה'}));
  if(!res.ok)throw new Error(result.error||'הפעולה נכשלה');return result;
}
export const remoteStore={
  async list(col,filter){const rows=await request('/api/records/'+col);return filter?rows.filter(filter):rows;},
  get(col,id){return id?request('/api/records/'+col+'/'+encodeURIComponent(id)):Promise.resolve(null);},
  add(col,data){return request('/api/records/'+col,'POST',data);},
  set(col,id,data){return request('/api/records/'+col+'/'+encodeURIComponent(id),'PATCH',data);},
  update(col,id,data){return this.set(col,id,data);},
  remove(col,id){return request('/api/records/'+col+'/'+encodeURIComponent(id),'DELETE',{});},
  watch(col,cb,filter){let stopped=false,timer,last='';const run=async()=>{try{const rows=await this.list(col,filter);const val=JSON.stringify(rows);if(!stopped&&val!==last){last=val;cb(rows);}}catch(e){if(!stopped)window.dispatchEvent(new CustomEvent('smai:connection-error',{detail:e.message}));}finally{if(!stopped)timer=setTimeout(run,10000);}};run();return()=>{stopped=true;clearTimeout(timer);};}
};
