import {requireThat} from './policy.js';
export const catalog=[
  {id:'aurora',name:'זוהר צפוני',price:40,description:'מסגרת טורקיז וסגול עם נשימה עדינה'},
  {id:'sunset',name:'שקיעה',price:60,description:'מסגרת ורודה וכתומה עם אור נע'},
  {id:'cosmos',name:'קוסמוס',price:90,description:'פרופיל כחול־סגול עם הילה מסתובבת'},
  {id:'neon',name:'ניאון',price:120,description:'מסגרת מוארת בגווני ירוק וטורקיז'}
];
export async function rewards(env,db,u,body,method){
  const exists=async(col,where,values)=>Boolean(await env.DB.prepare(`SELECT id FROM records WHERE collection=? AND ${where} LIMIT 1`).bind(col,...values).first());
  const [message,friend,ticket]=await Promise.all([
    exists('dmsgs',"json_extract(data,'$.senderId')=? AND coalesce(json_extract(data,'$.deleted'),0)=0",[u.id]),
    exists('friends',"json_extract(data,'$.status')='accepted' AND (json_extract(data,'$.a')=? OR json_extract(data,'$.b')=? OR json_extract(data,'$.from')=? OR json_extract(data,'$.to')=?)",[u.id,u.id,u.id,u.id]),
    exists('tickets',"json_extract(data,'$.reporterId')=?",[u.id])
  ]);
  const missions=[
    {id:'hello',name:'הודעה ראשונה בצ׳אט פרטי',points:40,done:message,href:'/dm'},
    {id:'friend',name:'חברות ראשונה שאושרה',points:60,done:friend,href:'/friends'},
    {id:'ticket',name:'פנייה ראשונה',points:40,done:ticket,href:'/report'},
    {id:'bio',name:'כתיבת תיאור לפרופיל',points:30,done:String(u.bio||'').trim().length>=10,href:'/account'},
    {id:'avatar',name:'בחירת תמונת פרופיל',points:30,done:Boolean(u.avatar),href:'/account'}
  ];
  const old=await db.get('rewardWallets',u.id);
  const wallet=old||{id:u.id,claimed:[],owned:[],spent:0,history:[]};
  const earned=missions.filter(m=>wallet.claimed.includes(m.id)).reduce((sum,m)=>sum+m.points,0);
  let balance=earned-wallet.spent;
  if(method==='POST'){
    const action=body.action;
    if(action==='claim'){
      const mission=missions.find(m=>m.id===body.id);
      requireThat(mission?.done,400,'המשימה עדיין לא הושלמה');
      if(!wallet.claimed.includes(mission.id)){
        wallet.claimed=[...wallet.claimed,mission.id];balance+=mission.points;
        wallet.history=[{text:mission.name,points:mission.points,at:new Date().toISOString()},...wallet.history];
        await db.put('rewardWallets',wallet,old);
      }
    }else if(action==='buy'){
      const item=catalog.find(item=>item.id===body.id);requireThat(item,400,'העיצוב אינו קיים');
      if(!wallet.owned.includes(item.id)){
        requireThat(balance>=item.price,400,'אין מספיק נקודות לרכישה');
        wallet.owned=[...wallet.owned,item.id];wallet.spent+=item.price;balance-=item.price;
        wallet.history=[{text:item.name,points:-item.price,at:new Date().toISOString()},...wallet.history];
        await db.put('rewardWallets',wallet,old);
      }
    }else if(action==='equip'){
      requireThat(body.id===''||wallet.owned.includes(body.id),403,'יש לרכוש את העיצוב תחילה');
      await db.put('users',{...u,profileStyle:body.id},u);u.profileStyle=body.id;
    }else requireThat(false,400,'פעולה לא מוכרת');
  }
  return {balance,missions:missions.map(m=>({...m,claimed:wallet.claimed.includes(m.id)})),catalog,owned:wallet.owned,equipped:u.profileStyle||'',history:wallet.history};
}
