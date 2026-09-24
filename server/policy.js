export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export const requireThat=(condition,status=403,message='אין הרשאה לפעולה זו')=>{if(!condition)throw new HttpError(status,message);};
export const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(obj,k)).map(k=>[k,obj[k]]));
export const rank=u=>Number(u?.rankLvl)||0;
export const isFounder=u=>!!u&&(u.isOwner===true||u.rank==='founder'||rank(u)>=70);
export const publicUser=(u,viewer)=>({...pick(u,['id','name','avatar','bio','rank','rankLvl','verified','dept','socialLinks','createdAt']),...(isFounder(viewer)||u.privacy?.showLastSeen!==false?{lastSeenAt:u.lastSeenAt||u.lastLoginAt||u.createdAt}:{}),privacy:{showVerified:u.privacy?.showVerified!==false,showLastSeen:u.privacy?.showLastSeen!==false}});
export const banned=u=>!!(u?.isBanned&&(!u.banUntil||Date.parse(u.banUntil)>Date.now()));
export const muted=u=>Date.parse(u?.muteUntil)>Date.now();
export const ranks={citizen:0,trainee:10,agent:20,senior:30,lead:40,head:50,admin:60,founder:70};
export const collections=new Set('users tickets messages notifications reports feedback applications verifyApps trustedApps partnerApps appeals modlog logs mail servers channels threads tmsgs cmsgs friends followers dms dmsgs config updates articles campaigns emergencyRequests'.split(' '));
export const officialIds=new Set(['s-welcome','s-help','s-parents','s-teens','s-gaming','s-security']);
export async function canRead(col,r,u,get){
  if(!r)return false;
  const n=rank(u),id=u?.id;
  if(col==='users')return u?.id===r.id||n>=50||r.privacy?.profileVis!=='private';
  if(col==='config'||col==='updates'||col==='articles'||col==='campaigns')return true;
  if(col==='tickets')return n>=10||!!id&&r.reporterId===id;
  if(col==='messages')return (!r.internal||n>=20)&&await canRead('tickets',await get('tickets',r.ticketId),u,get);
  if(col==='notifications')return !!id&&r.userId===id;
  if(['applications','verifyApps','trustedApps','partnerApps','appeals'].includes(col))return n>=40||!!id&&r.userId===id;
  if(col==='reports')return n>=20||!!id&&r.byId===id;
  if(col==='feedback')return n>=20||!!id&&r.byId===id;
  if(col==='modlog')return n>=20;
  if(col==='logs'||col==='mail')return n>=60;
  if(col==='emergencyRequests')return n>=60;
  if(col==='servers')return !r.private||n>=40||!!id&&(r.ownerId===id||r.members?.includes(id)||r.admins?.includes(id));
  if(col==='channels')return (!r.staffOnly||n>=10)&&await canRead('servers',await get('servers',r.server),u,get);
  if(col==='threads'||col==='cmsgs')return await canRead('channels',await get('channels',r.channel||'gen:'+r.server),u,get);
  if(col==='tmsgs')return await canRead('threads',await get('threads',r.thread),u,get);
  if(col==='friends')return !!id&&[r.a,r.b,r.from,r.to].includes(id);
  if(col==='followers'){
    if(!id)return false;
    if(id===r.from||id===r.to)return true;
    const target=await get('users',r.to);return target?.privacy?.showFollowers!==false;
  }
  if(col==='dms')return !!id&&r.members?.includes(id);
  if(col==='dmsgs')return await canRead('dms',await get('dms',r.convId),u,get);
  return false;
}
export function safeRecord(col,r,u){
  if(col==='users'&&u?.id!==r.id&&rank(u)<50)return publicUser(r,u);
  const out={...r};delete out.pass;delete out.password;
  if(col==='users'){
    out.trustedNetworkCount=Array.isArray(r.trustedNetworkHashes)?r.trustedNetworkHashes.length:0;
    delete out.lastNetworkHash;delete out.trustedNetworkHashes;
  }
  if(col==='servers'){
    delete out.code;delete out.inviteCode;
    if(!(rank(u)>=40||r.ownerId===u?.id||r.admins?.includes(u?.id)))delete out.invite;
  }
  if(col==='config'){delete out.geminiKey;delete out.secret;delete out.endpoint;delete out.publicKey;}
  return out;
}
export async function authorizeWrite(col,old,input,u,get,method='PATCH'){
  requireThat(u,401,'יש להתחבר כדי להמשיך');
  requireThat(!banned(u)||col==='appeals');
  const n=rank(u),id=u.id,isNew=!old;
  const owns=old&&(old.senderId===id||old.authorId===id||old.ownerId===id);
  const manageServer=async sid=>{const s=await get('servers',sid);return s&&(n>=40||s.ownerId===id||s.admins?.includes(id));};
  if(method==='DELETE'){
    requireThat(old,404,'הפריט לא נמצא');
    if(['logs','emergencyRequests'].includes(col))throw new HttpError(403,'רישומי חירום וביקורת אינם ניתנים למחיקה');
    if(col==='friends'){requireThat(await canRead(col,old,u,get)&&(old.status!=='blocked'||old.by===id));return null;}
    if(col==='followers'){requireThat(old.from===id);return null;}
    if(col==='servers'){requireThat(n>=40||old.ownerId===id);return null;}
    if(['cmsgs','threads','tmsgs','dmsgs'].includes(col)){requireThat(await canRead(col,old,u,get)&&(owns||n>=20));return null;}
    requireThat(n>=60&&!['users','tickets','messages'].includes(col));return null;
  }
  if(col==='users'){
    requireThat(old,404,'המשתמש לא נמצא');
    const self=old.id===id;
    let p=self?pick(input,['name','bio','avatar','ageBand','mailPrefs','privacy','socialLinks','installedUpdates','sound','theme']):{};
    if(p.ageBand)requireThat(['under10','10to12','13to17','adult'].includes(p.ageBand),400,'קבוצת הגיל אינה תקינה');
    if(p.privacy){
      p.privacy=pick(p.privacy,['dmFrom','friendRequests','profileVis','onlineStatus','showFollowers','showVerified','showLastSeen','readReceipts']);
      requireThat(!p.privacy.dmFrom||['all','friends','staff','none'].includes(p.privacy.dmFrom),400,'הגדרת הודעות פרטיות אינה תקינה');
      requireThat(!p.privacy.friendRequests||['all','none'].includes(p.privacy.friendRequests),400,'הגדרת בקשות חברות אינה תקינה');
      requireThat(!p.privacy.profileVis||['public','private'].includes(p.privacy.profileVis),400,'הגדרת פרטיות הפרופיל אינה תקינה');
      requireThat(!p.privacy.onlineStatus||['all','friends','none'].includes(p.privacy.onlineStatus),400,'הגדרת נראות אינה תקינה');
    }
    if(p.socialLinks){
      p.socialLinks=pick(p.socialLinks,['instagram','tiktok','roblox','twitter','youtube','discord','facebook','linkedin','twitch']);
      const hosts={instagram:['instagram.com','www.instagram.com'],tiktok:['tiktok.com','www.tiktok.com'],roblox:['roblox.com','www.roblox.com'],twitter:['x.com','www.x.com','twitter.com','www.twitter.com'],youtube:['youtube.com','www.youtube.com','youtu.be'],discord:['discord.com','www.discord.com','discord.gg'],facebook:['facebook.com','www.facebook.com'],linkedin:['linkedin.com','www.linkedin.com'],twitch:['twitch.tv','www.twitch.tv']};
      for(const [network,value] of Object.entries(p.socialLinks)){if(!value)continue;let url;try{url=new URL(value);}catch{throw new HttpError(400,'קישור לרשת חברתית אינו תקין');}requireThat(url.protocol==='https:'&&hosts[network]?.includes(url.hostname),400,'קישור לרשת חברתית אינו תקין');p.socialLinks[network]=url.href.slice(0,500);}
    }
    if(n>=30&&n>rank(old))Object.assign(p,pick(input,['muteUntil']));
    if(n>=40&&n>rank(old)){const b=pick(input,['isBanned','banReason','banUntil','banNote','banItem','bannedAt']);requireThat(!b.isBanned||b.banUntil||n>=50);Object.assign(p,b);}
    if(n>=50&&n>rank(old)){
      Object.assign(p,pick(input,['dept','verified']));
      if(input.rank){requireThat(Object.hasOwn(ranks,input.rank)&&ranks[input.rank]<n);p.rank=input.rank;p.rankLvl=ranks[input.rank];}
    }
    if(n>=60&&n>rank(old))Object.assign(p,pick(input,['ageBand','ageVerificationStatus','ageReviewNote']));
    if(p.ageBand)requireThat(['under10','10to12','13to17','adult'].includes(p.ageBand),400,'קבוצת הגיל אינה תקינה');
    if(p.ageVerificationStatus)requireThat(['self_declared','staff_reviewed','reverify_required','reset'].includes(p.ageVerificationStatus),400,'מצב אימות הגיל אינו תקין');
    requireThat(Object.keys(p).length>0);return p;
  }
  if(col==='tickets'){
    if(isNew){
      requireThat(typeof input.title==='string'&&input.title.trim().length>=3&&typeof input.description==='string'&&input.description.trim().length>=20,400,'נא להזין כותרת ותיאור של לפחות 20 תווים');
      const p=pick(input,['title','description','dept','cat','catLabel','platformId','platform','targetName','minorInvolved','anonymous','reporterName','reporterContact']);
      requireThat(['harassment','sextortion','content','account','child','other'].includes(p.dept),400,'מחלקה לא תקינה');
      return {...p,reporterId:id,reporterEmail:u.email,status:'new',priority:input.critical?'critical':'normal',critical:!!input.critical,assignedTo:null,aiDone:false};
    }
    requireThat(await canRead(col,old,u,get));
    let p={};
    if(input.status==='escalated'&&old.reporterId===id)p.status='escalated';
    if(input.status==='open'&&old.reporterId===id&&['closed','resolved'].includes(old.status))p.status='open';
    if(n>=20)Object.assign(p,pick(input,['status','priority','dept','escalateReason']));
    if(n>=30||n>=10&&input.assignedTo===id&&!old.assignedTo)Object.assign(p,pick(input,['assignedTo','assignedName']));
    if(p.status)requireThat(['new','open','waiting','active','in_progress','escalated','resolved','closed'].includes(p.status),400,'סטטוס לא תקין');
    if(p.priority)requireThat(['low','normal','high','critical'].includes(p.priority),400,'עדיפות לא תקינה');
    requireThat(Object.keys(p).length>0);return p;
  }
  if(col==='messages'){
    requireThat(isNew&&await canRead('tickets',await get('tickets',input.ticketId),u,get));
    requireThat(!input.ai&&!input.system&&!muted(u));
    requireThat(!input.internal||n>=20);
    return {ticketId:input.ticketId,text:input.text,internal:!!input.internal,senderId:id,senderName:u.name,senderRank:u.rank,staffSide:n>=10};
  }
  if(col==='notifications'){
    requireThat(old&&old.userId===id&&!isNew,403,'אין הרשאה לעדכן התראה זו');
    return pick(input,['read']);
  }
  if(['applications','verifyApps','trustedApps','partnerApps','appeals'].includes(col)){
    if(isNew){const p={...input};for(const key of ['id','rank','rankLvl','isOwner'])delete p[key];return {...p,userId:id,status:'pending'};}
    requireThat(n>=40);return pick(input,['status','note','reviewNote','reviewedAt']);
  }
  if(col==='config'){requireThat(n>=60);return pick(input,['serverCreate','welcome','announcement','registrationOpen','maintenance','autoAI','replyHours','chatMaxLen','integrationPromptSeenAt']);}
  if(col==='updates'){requireThat(n>=60);return pick(input,['version','name','description','changelog','category','releasedAt']);}
  if(col==='articles'){requireThat(n>=60);return pick(input,['title','sum','body','dept','tags','read']);}
  if(col==='campaigns'){
    requireThat(n>=70,403,'ניהול קמפיינים זמין למייסד בלבד');
    const p=pick(input,['title','body','mediaType','mediaUrl','linkUrl','audience','placement','startAt','endAt','seconds','active','frequency','notifyUsers']);
    requireThat(['text','image','video'].includes(p.mediaType),400,'סוג המדיה אינו תקין');
    requireThat(p.mediaType==='text'||/^https:\/\//.test(p.mediaUrl||''),400,'נדרשת כתובת HTTPS לתמונה או לסרטון');
    requireThat(['all','members','staff'].includes(p.audience),400,'קהל היעד אינו תקין');
    return p;
  }
  if(col==='emergencyRequests'){
    requireThat(n>=60,403,'ניהול אירוע חירום דורש הרשאת מנהל בכיר');
    if(isNew){
      requireThat(input.targetUserId&&await get('users',input.targetUserId),400,'משתמש היעד לא נמצא');
      requireThat(String(input.caseRef||'').trim().length>=3&&String(input.reason||'').trim().length>=20,400,'נדרש מספר אירוע והסבר מפורט');
      requireThat(['ticket','dm'].includes(input.scopeType)&&String(input.scopeId||'').length>=8,400,'נדרש מזהה פנייה או שיחה מוגדר');
      const scoped=await get(input.scopeType==='ticket'?'tickets':'dms',input.scopeId);
      requireThat(scoped&&(input.scopeType==='ticket'?scoped.reporterId===input.targetUserId:scoped.members?.includes(input.targetUserId)),400,'הפריט המבוקש אינו משויך למשתמש');
      return {targetUserId:input.targetUserId,scopeType:input.scopeType,scopeId:input.scopeId,caseRef:String(input.caseRef).slice(0,80),reason:String(input.reason).slice(0,1000),requestedBy:id,requestedByName:u.name,status:'approved',approvedBy:id,approvedByName:u.name,approvedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60*60*1000).toISOString()};
    }
    requireThat(old.status==='pending',403,'הבקשה כבר טופלה');
    requireThat(['approved','rejected'].includes(input.status),400,'החלטה לא תקינה');
    return {status:input.status,approvedBy:id,approvedByName:u.name,decisionNote:String(input.decisionNote||'').slice(0,500),approvedAt:new Date().toISOString(),expiresAt:input.status==='approved'?new Date(Date.now()+60*60*1000).toISOString():''};
  }
  if(col==='servers'){
    if(isNew){
      requireThat(!input.official);const cfg=await get('config','site'),mode=cfg?.serverCreate||'staff';
      requireThat(n>=40||mode==='all'||mode==='verified'&&u.verified);
      return {...pick(input,['name','description','desc','ico','cat','color','private']),ownerId:id,ownerName:u.name,admins:[],members:[id],official:false};
    }
    const members=old.members||[];
    if(input.members&&Object.keys(input).every(k=>['members','updatedAt'].includes(k))){
      const next=[...new Set(input.members)];
      requireThat(next.filter(x=>x!==id).sort().join()===members.filter(x=>x!==id).sort().join());
      requireThat(!next.includes(id)||!old.private||members.includes(id));return {members:next};
    }
    requireThat(await manageServer(old.id));return pick(input,['name','description','desc','ico','cat','color','private','admins']);
  }
  if(col==='channels'){requireThat(await manageServer((old||input).server));return {...pick(input,['name','kind','staffOnly','description','desc','pos']),server:(old||input).server};}
  if(['threads','cmsgs','tmsgs'].includes(col)){
    const r=old||input;
    requireThat(await canRead(col,r,u,get)&&!muted(u));
    const ch=await get('channels',r.channel||'gen:'+r.server);
    requireThat(ch&&ch.server===r.server);
    if(col==='tmsgs'){const th=await get('threads',r.thread);requireThat(th&&th.server===r.server&&th.channel===r.channel&&!th.locked);}
    requireThat(!['announce','ann'].includes(ch.kind)||await manageServer(r.server));
    if(isNew)return {...pick(input,['server','channel','thread','title','body','text']),authorId:id,senderId:id,authorName:u.name,senderName:u.name,authorRank:u.rank,senderRank:u.rank};
    requireThat(owns||n>=20);
    return pick(input,[...(owns?['text','body','title']:[]),...(n>=20?['deleted','locked','pinned']:[])]);
  }
  if(col==='friends'){
    if(isNew){const to=input.to||input.b;requireThat(to&&to!==id&&await get('users',to),400,'משתמש לא תקין');return {a:id,b:to,from:id,to,by:id,key:[id,to].sort().join('|'),status:input.status==='blocked'?'blocked':'pending'};}
    requireThat(await canRead(col,old,u,get));requireThat(old.to===id&&input.status==='accepted'&&old.status==='pending'||input.status==='blocked'&&(old.status!=='blocked'||old.by===id));return {status:input.status,...(input.status==='blocked'?{by:id}:{})};
  }
  if(col==='followers'){
    requireThat(isNew,403,'אין הרשאה לעדכן מעקב');
    const to=input.to;requireThat(to&&to!==id&&await get('users',to),400,'משתמש לא תקין');
    return {from:id,to};
  }
  if(col==='dms'){
    if(isNew){const members=[...new Set(input.members||[])];requireThat(members.includes(id)&&members.length>=2&&members.length<=50);for(const member of members)requireThat(await get('users',member),400,'משתמש לא תקין');return {members,kind:members.length===2?'direct':'group',ownerId:id,name:String(input.name||'').slice(0,100)};}
    requireThat(await canRead(col,old,u,get));
    if(input.members){const next=[...new Set(input.members)];requireThat(next.length<=50&&(old.ownerId===id||next.sort().join()===old.members.filter(x=>x!==id).sort().join()));return {members:next};}
    if(input.dmAccepted===true){requireThat(old.kind==='direct'&&old.ownerId!==id&&old.members.includes(id));return {dmAccepted:true,acceptedAt:new Date().toISOString()};}
    requireThat(old.ownerId===id);return pick(input,['name']);
  }
  if(col==='dmsgs'){
    requireThat(await canRead(col,old||input,u,get)&&!muted(u));
    if(isNew){
      requireThat(!input.system);
      const p={convId:input.convId,text:input.text,senderId:id,senderName:u.name,senderRank:u.rank,deliveredAt:new Date().toISOString()};
      if(input.callUrl){requireThat(/^https:\/\/meet\.jit\.si\/SMAI-Sentinel-[A-Za-z0-9-]{12,160}(?:#.*)?$/.test(input.callUrl),400,'קישור השיחה אינו תקין');p.callUrl=input.callUrl;p.callType=input.callType==='video'?'video':'audio';}
      return p;
    }
    if(old.senderId!==id){requireThat(input.readAt&&!old.readAt);return {readAt:new Date().toISOString()};}
    return pick(input,['text']);
  }
  if(col==='reports'){
    if(isNew)return {...pick(input,['targetId','msgId','server','type','kind','reason','text']),byId:id,status:'pending'};
    requireThat(n>=20);return pick(input,['status','note']);
  }
  if(col==='feedback'){
    requireThat(isNew,403,'לא ניתן לשנות משוב לאחר השליחה');
    const kind=input.kind;
    requireThat(['ticket_rating','staff_praise'].includes(kind),400,'סוג המשוב אינו תקין');
    const target=await get('users',input.staffId);requireThat(target&&rank(target)>=10,400,'יש לבחור חבר צוות תקין');
    const text=String(input.text||'').trim();requireThat(text.length>=5&&text.length<=2000,400,'יש לכתוב משוב של 5 עד 2,000 תווים');
    if(kind==='ticket_rating'){
      const ticket=await get('tickets',input.ticketId);
      requireThat(ticket&&ticket.reporterId===id,403,'אפשר לדרג רק פנייה השייכת לך');
      requireThat(ticket.assignedTo===target.id&&['closed','resolved'].includes(ticket.status),400,'אפשר לדרג לאחר סיום הטיפול בפנייה');
      const rating=Number(input.rating);requireThat(Number.isInteger(rating)&&rating>=1&&rating<=5,400,'הדירוג חייב להיות בין 1 ל־5');
      return {kind,ticketId:ticket.id,ticketCode:ticket.code,staffId:target.id,staffName:target.name,rating,text,byId:id,status:'published'};
    }
    return {kind,staffId:target.id,staffName:target.name,text,byId:id,status:'published'};
  }
  throw new HttpError(403,'הפעולה זמינה לשרת בלבד');
}
