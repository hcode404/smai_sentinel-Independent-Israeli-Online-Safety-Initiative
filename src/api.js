import {getAuthToken} from './firebase-auth.js';
const API_ORIGIN=String(import.meta.env.VITE_API_ORIGIN||'').replace(/\/$/,'');
const apiUrl=path=>`${API_ORIGIN}${path}`;
export async function request(path,method='GET',data){
  let res;
  try{const token=await getAuthToken();const headers={...(method==='GET'?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})};res=await fetch(apiUrl(path),{method,credentials:'omit',headers,...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(35000)});}catch{throw new Error('אין חיבור לשרת. הפעולה לא אושרה — בדקו את החיבור ונסו שוב.');}
  const result=await res.json().catch(()=>({error:'השרת לא החזיר תשובה תקינה'}));
  if(!res.ok)throw new Error(result.error||'הפעולה נכשלה');return result;
}
export async function upload(path,formData){
  let res;try{const token=await getAuthToken();res=await fetch(apiUrl(path),{method:'POST',credentials:'omit',headers:{...(token?{Authorization:`Bearer ${token}`}:{})},body:formData,signal:AbortSignal.timeout(90000)});}catch{throw new Error('העלאת הקובץ נכשלה — בדקו את החיבור ונסו שוב.');}
  const result=await res.json().catch(()=>({error:'השרת לא החזיר תשובה תקינה'}));if(!res.ok)throw new Error(result.error||'העלאת הקובץ נכשלה');return result;
}
export const remoteStore={
  async list(col,filter){const rows=await request('/api/records/'+col);return filter?rows.filter(filter):rows;},
  get(col,id){return id?request('/api/records/'+col+'/'+encodeURIComponent(id)):Promise.resolve(null);},
  add(col,data){return request('/api/records/'+col,'POST',data);},
  set(col,id,data){return request('/api/records/'+col+'/'+encodeURIComponent(id),'PATCH',data);},
  update(col,id,data){return this.set(col,id,data);},
  remove(col,id){return request('/api/records/'+col+'/'+encodeURIComponent(id),'DELETE',{});},
  watch(col,cb,filter){let stopped=false,timer,last='';const interval=col==='dmsgs'?2500:col==='dms'?5000:10000;const run=async()=>{try{const rows=await this.list(col,filter);const val=JSON.stringify(rows);if(!stopped&&val!==last){last=val;cb(rows);}}catch(e){if(!stopped)window.dispatchEvent(new CustomEvent('smai:connection-error',{detail:e.message}));}finally{if(!stopped)timer=setTimeout(run,interval);}};run();return()=>{stopped=true;clearTimeout(timer);};}
};
