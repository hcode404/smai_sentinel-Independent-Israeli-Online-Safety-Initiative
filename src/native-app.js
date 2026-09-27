import {Capacitor} from '@capacitor/core';
import {LocalNotifications} from '@capacitor/local-notifications';

const native=Capacitor.isNativePlatform();
const deliveredKey='smai_native_notice_ids_v1';
let ready=false;

function delivered(){
  try{return new Set(JSON.parse(localStorage.getItem(deliveredKey)||'[]'));}
  catch{return new Set();}
}

function remember(ids){
  try{localStorage.setItem(deliveredKey,JSON.stringify([...ids].slice(-250)));}catch{}
}

export async function initNativeApp(){
  if(!native||ready)return false;
  ready=true;
  const permission=await LocalNotifications.checkPermissions();
  if(permission.display==='prompt')await LocalNotifications.requestPermissions();
  await LocalNotifications.addListener('localNotificationActionPerformed',event=>{
    const href=event.notification?.extra?.href;
    if(typeof href==='string'&&href.startsWith('/')){
      history.pushState(null,'',href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });
  document.documentElement.classList.add('native-app');
  return true;
}

export async function showNativeNotices(rows=[]){
  if(!native||!ready||document.visibilityState==='visible')return;
  const ids=delivered();
  const fresh=rows.filter(row=>!row.read&&row.id&&!ids.has(row.id)).slice(-5);
  if(!fresh.length)return;
  const permission=await LocalNotifications.checkPermissions();
  if(permission.display!=='granted')return;
  await LocalNotifications.schedule({notifications:fresh.map((row,index)=>({
    id:(Date.now()%2000000000)+index,
    title:String(row.title||'הודעה חדשה ב‑SMAI'),
    body:String(row.text||'קיבלת עדכון חדש').slice(0,220),
    schedule:{at:new Date(Date.now()+300+index*150)},
    extra:{href:row.href||'/dm'}
  }))});
  fresh.forEach(row=>ids.add(row.id));
  remember(ids);
}

