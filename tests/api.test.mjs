import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from '../scripts/local-db.mjs';
import {api,database,renderEmail,mailPreferenceKey,wantsUserMail} from '../server/index.js';
import {authorizeWrite} from '../server/policy.js';
import {SignJWT,exportJWK,generateKeyPair} from 'jose';
import {readFile} from 'node:fs/promises';
const project='smai-support';
const {publicKey,privateKey}=await generateKeyPair('RS256');
const jwk={...(await exportJWK(publicKey)),kid:'smai-test',alg:'RS256',use:'sig'};
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>String(input).includes('securetoken@system.gserviceaccount.com')
 ? Promise.resolve(Response.json({keys:[jwk]})) : nativeFetch(input,init);
const tokenFor=user=>new SignJWT({email:user+'@example.test',email_verified:true,name:user,firebase:{sign_in_provider:'password'}})
 .setProtectedHeader({alg:'RS256',kid:jwk.kid}).setSubject(user).setIssuer(`https://securetoken.google.com/${project}`)
 .setAudience(project).setIssuedAt().setExpirationTime('10m').sign(privateKey);
function fixture(){
 const DB=localDatabase(),env={DB,ADMIN_EMAILS:'owner@example.test',FIREBASE_PROJECT_ID:project};
 const call=async(path,method='GET',body,user='alice',origin='https://sentinel.test',ip='203.0.113.5')=>{
 const headers={'Content-Type':'application/json',Origin:origin,'CF-Connecting-IP':ip};
 if(user)headers.Authorization='Bearer '+await tokenFor(user);
 const r=await api(new Request('https://sentinel.test/api/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),env);
 return {status:r.status,data:await r.json()};};
 return {DB,env,call,db:database(env)};
}
const ticket={title:'דיווח בדיקה',description:'זהו דיווח בדיקה מקומי לצורך בדיקת התוכנה בלבד',dept:'other'};
test('report form wires every field from a query-all collection',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(source,/for\(const el of \$\$\('#rf input,#rf textarea,#rf select'\)\)/);
 assert.doesNotMatch(source,/for\(const el of \$\('#rf input,#rf textarea,#rf select'\)\)/);
});
test('private chat always scrolls to the latest message after rendering',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(source,/const scrollDmToLatest=/);assert.match(source,/requestAnimationFrame\(\(\)=>\{box\.scrollTop=box\.scrollHeight/);assert.match(source,/scrollDmToLatest\(\);/);
 assert.match(source,/@\(\[\\u0590-\\u05FFa-zA-Z0-9_\.\-\]\*\)\$\//);assert.match(source,/cMentionList.*style\.display==='none'/s);
});
test('ticket persists; identity and tracking code are issued by the server',async()=>{
 const f=fixture();const a=await f.call('records/tickets','POST',{...ticket,reporterId:'bob',status:'closed',code:'fake'});
 assert.equal(a.status,201);assert.equal(a.data.reporterId,'alice');assert.equal(a.data.status,'new');assert.match(a.data.code,/^SM-[A-F0-9]{32}$/);
 const saved=await f.call('records/tickets/'+a.data.id);assert.equal(saved.data.description,ticket.description);f.DB.close();
});
test('a new ticket opens with a server-confirmed chat message',async()=>{
 const f=fixture();const a=await f.call('records/tickets','POST',ticket);
 const messages=(await f.call('records/messages','GET')).data;
 assert.equal(messages.length,2);assert.ok(messages.every(m=>m.ticketId===a.data.id));
 assert.ok(messages.some(m=>m.system));assert.ok(messages.some(m=>m.ai&&m.aiMode==='local'));f.DB.close();
});
test('local ticket triage routes clear account harm and closes only unmistakable spam',async()=>{
 const f=fixture();
 const routed=await f.call('records/tickets','POST',{title:'פרצו לי לחשבון',description:'מישהו שינה את הסיסמה ואין לי גישה לחשבון שלי',dept:'other'});
 assert.equal(routed.status,201);assert.equal(routed.data.dept,'account');assert.equal(routed.data.status,'new');assert.equal(routed.data.localTriage,true);
 const spam=await f.call('records/tickets','POST',{title:'מבצע פרסים חינם',description:'קנו עכשיו רובוקס חינם https://a.test https://a.test https://a.test https://a.test https://a.test https://a.test',dept:'other'});
 assert.equal(spam.status,201);assert.equal(spam.data.status,'closed');assert.equal(spam.data.spamClosed,true);f.DB.close();
});
test('a trusted network does not create another login warning when it returns',async()=>{
 const f=fixture();await f.call('session');
 assert.equal((await f.call('security/trust-current','POST',{})).data.count,1);
 await f.call('session','GET',null,'alice','https://sentinel.test','203.0.113.99');
 const afterNew=(await f.call('records/notifications')).data.filter(n=>n.type==='securityLogin').length;
 await f.call('session','GET',null,'alice','https://sentinel.test','203.0.113.5');
 const afterTrusted=(await f.call('records/notifications')).data.filter(n=>n.type==='securityLogin').length;
 assert.equal(afterNew,1);assert.equal(afterTrusted,1);f.DB.close();
});
test('each IP creates a new-login warning only once even after switching networks',async()=>{
 const f=fixture();await f.call('session');
 await f.call('session','GET',null,'alice','https://sentinel.test','203.0.113.99');
 await f.call('session','GET',null,'alice','https://sentinel.test','198.51.100.8');
 await f.call('session','GET',null,'alice','https://sentinel.test','203.0.113.99');
 const warnings=(await f.call('records/notifications')).data.filter(n=>n.type==='securityLogin');
 assert.equal(warnings.length,2);f.DB.close();
});
test('ordinary accounts cannot read another ticket, or enumerate it',async()=>{
 const f=fixture();const a=await f.call('records/tickets','POST',ticket);
 assert.equal((await f.call('records/tickets/'+a.data.id,'GET',null,'bob')).status,403);
 assert.deepEqual((await f.call('records/tickets','GET',null,'bob')).data,[]);
 assert.equal((await f.call('track','POST',{code:a.data.code},'bob')).status,403);f.DB.close();
});
test('anonymous writes and cross-origin writes are rejected',async()=>{
 const f=fixture();assert.equal((await f.call('records/tickets','POST',ticket,null)).status,401);
 assert.equal((await f.call('records/tickets','POST',ticket,'alice','https://evil.test')).status,403);f.DB.close();
});
test('users cannot grant themselves founder, ban others, or forge AI messages',async()=>{
 const f=fixture();await f.call('session');
 assert.equal((await f.call('records/users/alice','PATCH',{rank:'founder',rankLvl:70,isOwner:true})).status,403);
 assert.equal((await f.call('session')).data.user.rankLvl,0);
 const t=await f.call('records/tickets','POST',ticket);
 assert.equal((await f.call('records/messages','POST',{ticketId:t.data.id,text:'forged',ai:true})).status,403);
 assert.equal((await f.call('records/messages','POST',{ticketId:t.data.id,text:'forged',system:true})).status,403);f.DB.close();
});
test('last seen privacy hides activity from regular users but not the founder',async()=>{
 const f=fixture();await f.call('session','GET',null,'alice');await f.call('session','GET',null,'bob');await f.call('session','GET',null,'owner');
 assert.equal((await f.call('records/users/alice','PATCH',{privacy:{showLastSeen:false}})).status,200);
 const regular=(await f.call('records/users/alice','GET',null,'bob')).data;assert.equal(regular.lastSeenAt,undefined);
 const founder=(await f.call('records/users/alice','GET',null,'owner')).data;assert.ok(founder.lastSeenAt);f.DB.close();
});
test('founder can see hidden last seen for staff accounts too',async()=>{
 const f=fixture();await f.call('session','GET',null,'staff');await f.call('session','GET',null,'owner');
 assert.equal((await f.call('records/users/staff','PATCH',{rank:'admin'},'owner')).status,200);
 assert.equal((await f.call('records/users/staff','PATCH',{privacy:{showLastSeen:false}},'staff')).status,200);
 const hidden=(await f.call('records/users/staff','GET',null,'alice')).data;assert.equal(hidden.lastSeenAt,undefined);
 const founder=(await f.call('records/users/staff','GET',null,'owner')).data;assert.ok(founder.lastSeenAt);f.DB.close();
});
test('ticket feedback is limited to the reporter, assigned staff and completed tickets',async()=>{
 const f=fixture();await f.call('session','GET',null,'staff');await f.call('session','GET',null,'owner');
 await f.call('records/users/staff','PATCH',{rank:'agent'},'owner');
 const created=(await f.call('records/tickets','POST',ticket)).data;
 assert.equal((await f.call('records/feedback','POST',{kind:'ticket_rating',ticketId:created.id,staffId:'staff',rating:5,text:'טיפול מצוין ומהיר'})).status,400);
 await f.call('records/tickets/'+created.id,'PATCH',{assignedTo:'staff',assignedName:'staff',status:'resolved'},'owner');
 assert.equal((await f.call('records/feedback','POST',{kind:'ticket_rating',ticketId:created.id,staffId:'staff',rating:5,text:'טיפול מצוין ומהיר'})).status,201);
 assert.equal((await f.call('records/feedback','POST',{kind:'ticket_rating',ticketId:created.id,staffId:'staff',rating:4,text:'ניסיון לדירוג כפול'})).status,409);
 assert.equal((await f.call('records/feedback','GET',null,'bob')).data.length,0);f.DB.close();
});
test('signed-in users can praise any real account and founder can review all praise',async()=>{
 const f=fixture();await f.call('session','GET',null,'staff');await f.call('session','GET',null,'owner');
 await f.call('records/users/staff','PATCH',{rank:'agent'},'owner');
 assert.equal((await f.call('records/feedback','POST',{kind:'staff_praise',staffId:'staff',text:'תודה על העזרה והסבלנות'})).status,201);
 await f.call('session','GET',null,'bob');
 assert.equal((await f.call('records/feedback','POST',{kind:'praise',targetId:'bob',text:'תודה על העזרה בקהילה'})).status,201);
 assert.equal((await f.call('records/feedback','POST',{kind:'praise',targetId:'bob',text:'ניסיון נוסף באותו יום'})).status,429);
 assert.equal((await f.call('records/feedback','POST',{kind:'praise',targetId:'alice',text:'מחמאה לעצמי'})).status,400);
 assert.equal((await f.call('records/feedback','GET',null,'bob')).data.length,1);
 assert.equal((await f.call('records/feedback','GET',null,'owner')).data.length,2);f.DB.close();
});
test('profile stats count unique praise senders and expose current presence safely',async()=>{
 const f=fixture();await f.call('session','GET',null,'alice');await f.call('session','GET',null,'bob');
 await f.call('records/feedback','POST',{kind:'praise',targetId:'bob',text:'כל הכבוד על העזרה'},'alice');
 const first=await f.db.list('feedback');await f.db.put('feedback',{...first[0],id:'older-praise',createdAt:new Date(Date.now()-2*86400000).toISOString()},null);
 const stats=await f.call('profile-stats/bob','GET',null,'alice');assert.equal(stats.status,200);assert.equal(stats.data.praiseCount,1);assert.equal(stats.data.online,null);
 const own=await f.call('profile-stats/bob','GET',null,'bob');assert.equal(own.data.online,true);f.DB.close();
});
test('social links accept known networks and reject lookalike domains',async()=>{
 const f=fixture();await f.call('session');
 assert.equal((await f.call('records/users/alice','PATCH',{socialLinks:{twitter:'https://x.com/smai',youtube:'https://www.youtube.com/@smai',discord:'https://discord.gg/smai'}})).status,200);
 assert.equal((await f.call('records/users/alice','PATCH',{socialLinks:{twitter:'https://x.com.evil.test/smai'}})).status,400);f.DB.close();
});
test('profile presence and pasted image avatars are validated and persisted',async()=>{
 const f=fixture();await f.call('session');
 const image='data:image/png;base64,iVBORw0KGgo=';
 const saved=await f.call('records/users/alice','PATCH',{presenceMode:'afk',avatar:image});
 assert.equal(saved.status,200);assert.equal(saved.data.presenceMode,'afk');assert.equal(saved.data.avatar,image);
 const offline=await f.call('records/users/alice','PATCH',{presenceMode:'offline',presenceUntil:new Date(Date.now()+900000).toISOString(),presenceAuto:false});assert.equal(offline.status,200);
 assert.equal((await f.call('records/users/alice','PATCH',{presenceMode:'invisible'})).status,400);
 assert.equal((await f.call('records/users/alice','PATCH',{avatar:'javascript:alert(1)'})).status,400);f.DB.close();
});
test('hidden presence is not exposed to another regular account',async()=>{
 const f=fixture();await f.call('session');await f.call('session','GET',null,'bob');
 await f.call('records/users/alice','PATCH',{presenceMode:'busy',privacy:{onlineStatus:'none'}});
 const viewed=await f.call('records/users/alice','GET',null,'bob');assert.equal(viewed.status,200);assert.equal(viewed.data.presenceMode,undefined);f.DB.close();
});
test('bug reports persist for the reporter and are visible to maintenance staff',async()=>{
 const f=fixture();await f.call('session');const bug=await f.call('records/reports','POST',{kind:'bug',type:'maintenance',reason:'כפתור לא נפתח',text:'הכפתור בעמוד הבדיקה אינו מגיב ללחיצה',targetId:'/test'});
 assert.equal(bug.status,201);assert.equal(bug.data.byId,'alice');assert.equal((await f.call('records/reports','GET')).data.length,1);
 assert.equal((await f.call('records/reports','GET',null,'owner')).data.length,1);f.DB.close();
});
test('internal notes are hidden from reporter; manager can change status',async()=>{
 const f=fixture();const t=await f.call('records/tickets','POST',ticket);
 assert.equal((await f.call('records/messages','POST',{ticketId:t.data.id,text:'private note',internal:true},'owner')).status,201);
 const reporterMessages=(await f.call('records/messages')).data;
 assert.equal(reporterMessages.length,2);assert.ok(reporterMessages.some(m=>m.system));assert.ok(reporterMessages.some(m=>m.ai));
 assert.equal((await f.call('records/tickets/'+t.data.id,'PATCH',{status:'open'},'owner')).status,200);
 assert.equal((await f.call('records/tickets/'+t.data.id,'PATCH',{status:'closed'})).status,403);f.DB.close();
});
test('without Gemini the assistant returns clearly marked basic guidance',async()=>{
 const f=fixture();const result=await f.call('ai','POST',{prompt:'פרצו לי לחשבון'});
 assert.equal(result.status,200);assert.equal(result.data.mode,'basic');assert.match(result.data.text,/סיסמה|אימות/);
 assert.deepEqual(await f.db.list('messages'),[]);f.DB.close();
});
test('local safety assistant works before login',async()=>{
 const f=fixture();const result=await f.call('ai','POST',{prompt:'מישהו מטריד אותי'},null);
 assert.equal(result.status,200);assert.equal(result.data.mode,'basic');assert.match(result.data.text,/תיעוד|חסמו/);f.DB.close();
});
test('external AI asks anonymous visitors for one-time consent instead of login',async()=>{
 const f=fixture();f.env.GEMINI_API_KEY='test-key';const result=await f.call('ai','POST',{prompt:'עזרה',consent:false},null);
 assert.equal(result.status,400);assert.match(result.data.error,/אישור חד־פעמי/);f.DB.close();
});
test('basic guidance can be added to a ticket without Gemini consent',async()=>{
 const f=fixture();const t=await f.call('records/tickets','POST',{...ticket,description:'פרצו לי לחשבון ואני צריך עזרה בהגנה עליו'});
 const result=await f.call('ticket-ai','POST',{ticketId:t.data.id,consent:false});
 assert.equal(result.status,200);assert.equal(result.data.aiMode,'basic');assert.equal(result.data.senderName,'SMAI · מנוע מקומי');
 assert.equal((await f.db.list('messages')).length,3);f.DB.close();
});
test('private server messages do not leak to other accounts',async()=>{
 const f=fixture();await f.call('records/config/site','PATCH',{serverCreate:'all'},'owner');
 const server=await f.call('records/servers','POST',{name:'private',private:true});
 const channel=await f.call('records/channels','POST',{server:server.data.id,name:'room',kind:'chat'});
 const message=await f.call('records/cmsgs','POST',{server:server.data.id,channel:channel.data.id,text:'secret'});
 assert.equal(message.status,201);assert.deepEqual((await f.call('records/cmsgs','GET',null,'bob')).data,[]);
 assert.equal((await f.call('records/servers/'+server.data.id,'PATCH',{members:['alice','bob']},'bob')).status,403);f.DB.close();
});
test('message replies persist and the founder can remove community messages',async()=>{
 const f=fixture();await f.call('session','GET',null,'owner');await f.call('records/config/site','PATCH',{serverCreate:'all'},'owner');
 const server=await f.call('records/servers','POST',{name:'public room',private:false});
 const channel=await f.call('records/channels','POST',{server:server.data.id,name:'chat',kind:'chat'});
 const first=await f.call('records/cmsgs','POST',{server:server.data.id,channel:channel.data.id,text:'הודעה ראשונה'});
 const reply=await f.call('records/cmsgs','POST',{server:server.data.id,channel:channel.data.id,text:'זו תגובה ממוקדת',replyTo:{id:first.data.id,text:first.data.text,sender:'alice'}});
 assert.equal(reply.data.replyTo.id,first.data.id);assert.equal(reply.data.replyTo.sender,'alice');
 const removed=await f.call('records/cmsgs/'+first.data.id,'PATCH',{deleted:true},'owner');assert.equal(removed.status,200);assert.equal(removed.data.deleted,true);f.DB.close();
});
test('ticket replies persist and users can remove their own messages',async()=>{
 const f=fixture();const ticketCreated=await f.call('records/tickets','POST',ticket);
 const first=await f.call('records/messages','POST',{ticketId:ticketCreated.data.id,text:'הודעת מקור'});
 const reply=await f.call('records/messages','POST',{ticketId:ticketCreated.data.id,text:'תגובה להודעה',replyTo:{id:first.data.id,text:first.data.text,sender:'alice'}});
 assert.equal(reply.data.replyTo.id,first.data.id);
 const removed=await f.call('records/messages/'+reply.data.id,'PATCH',{deleted:true});assert.equal(removed.status,200);assert.equal(removed.data.deleted,true);f.DB.close();
});
test('forged sender IDs are replaced and empty text rejected',async()=>{
 const f=fixture();const t=await f.call('records/tickets','POST',ticket);
 const m=await f.call('records/messages','POST',{ticketId:t.data.id,text:'hello',senderId:'owner',senderRank:'founder'});
 assert.equal(m.data.senderId,'alice');assert.equal(m.data.senderRank,'citizen');
 assert.equal((await f.call('records/messages','POST',{ticketId:t.data.id,text:''})).status,400);f.DB.close();
});
test('staff reply creates a persistent notification for the reporter',async()=>{
 const f=fixture();const t=await f.call('records/tickets','POST',ticket);
 const reply=await f.call('records/messages','POST',{ticketId:t.data.id,text:'אנחנו מטפלים בפנייה'},'owner');
 assert.equal(reply.status,201);
 const notices=(await f.call('records/notifications','GET',null,'alice')).data;
 assert.equal(notices.length,1);assert.equal(notices[0].ticketId,t.data.id);assert.equal(notices[0].read,false);
 assert.deepEqual((await f.call('records/notifications','GET',null,'bob')).data,[]);f.DB.close();
});
test('direct messages and call invitations notify the other participant',async()=>{
 const f=fixture();await f.call('session','GET',null,'alice');await f.call('session','GET',null,'bob');
 const conv=await f.call('records/dms','POST',{members:['alice','bob']});assert.equal(conv.status,201);
 const url='https://meet.jit.si/SMAI-Sentinel-conversation123-call123456';
 const sent=await f.call('records/dmsgs','POST',{convId:conv.data.id,text:'הזמנה לשיחת וידאו',callType:'video',callUrl:url});
 assert.equal(sent.status,201);assert.equal(sent.data.callUrl,url);
 const notices=(await f.call('records/notifications','GET',null,'bob')).data;
 assert.equal(notices.length,1);assert.equal(notices[0].type,'callInvite');assert.equal(notices[0].href,`/dm/${conv.data.id}`);f.DB.close();
});
test('private messages persist validated media attachments',async()=>{
 const f=fixture();await f.call('session','GET',null,'alice');await f.call('session','GET',null,'bob');
 const conv=await f.call('records/dms','POST',{members:['alice','bob']});
 const attachment={url:'https://smai-sentinel-api.example.test/api/media/file123?token=token123',name:'photo.png',type:'image/png',size:2048};
 const sent=await f.call('records/dmsgs','POST',{convId:conv.data.id,text:'תמונה',attachment});assert.equal(sent.status,201);assert.deepEqual(sent.data.attachment,attachment);
 const invalid=await f.call('records/dmsgs','POST',{convId:conv.data.id,text:'קובץ',attachment:{...attachment,url:'https://evil.example/file'}});assert.equal(invalid.status,400);f.DB.close();
});
test('a private chat mention creates a dedicated alert for the mentioned user',async()=>{
 const f=fixture();await f.call('session','GET',null,'alice');await f.call('session','GET',null,'bob');
 const conv=await f.call('records/dms','POST',{members:['alice','bob']});assert.equal(conv.status,201);
 const sent=await f.call('records/dmsgs','POST',{convId:conv.data.id,text:'@bob יש עדכון חשוב בשבילך'});assert.equal(sent.status,201);
 const notices=(await f.call('records/notifications','GET',null,'bob')).data;
 const mention=notices.find(n=>n.type==='mention');assert.ok(mention);assert.equal(mention.href,`/dm/${conv.data.id}`);assert.match(mention.title,/תייג/);
 f.DB.close();
});
test('reporter can reopen a closed ticket and continue its conversation',async()=>{
 const f=fixture();const t=await f.call('records/tickets','POST',ticket);
 await f.call('records/tickets/'+t.data.id,'PATCH',{status:'closed'},'owner');
 assert.equal((await f.call('records/tickets/'+t.data.id,'PATCH',{status:'open'})).status,200);
 assert.equal((await f.call('records/messages','POST',{ticketId:t.data.id,text:'אני צריך להמשיך את השיחה'})).status,201);f.DB.close();
});
test('owner allowlist is empty by default',async()=>{
 const f=fixture();f.env.ADMIN_EMAILS='';assert.equal((await f.call('session','GET',null,'owner')).data.user.rankLvl,0);f.DB.close();
});
test('production Worker does not contain dev identity override',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../server/index.js',import.meta.url),'utf8');
 assert.equal(source.includes('local_seedy'),false);assert.equal(source.includes('seedy@sites.test'),false);
});
test('transactional emails are branded HTML with contextual actions',()=>{
 const reset=renderEmail('passwordReset',{resetUrl:'https://smai-support.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=test-only'});
 assert.match(reset.html,/איפוס הסיסמה<\/a>/);assert.match(reset.html,/oobCode=test-only/);
 assert.throws(()=>renderEmail('passwordReset',{resetUrl:'https://example.org/reset'}));
 const verify=renderEmail('emailVerification',{name:'בדיקה',verifyUrl:'https://smai-support.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=verify-only'});
 assert.match(verify.html,/אימות כתובת המייל<\/a>/);assert.match(verify.html,/oobCode=verify-only/);
 assert.throws(()=>renderEmail('emailVerification',{verifyUrl:'https://example.org/verify'}));
 const reply=renderEmail('ticketReply',{ticketId:'ticket-1',code:'SM-123',title:'בדיקה',sender:'נציג',text:'יש עדכון'});
 assert.match(reply.html,/<!doctype html>/i);assert.match(reply.html,/SMAI Sytem/);assert.match(reply.html,/\/ticket\/ticket-1/);assert.match(reply.html,/פתיחת הצ׳אט בפנייה/);
 const staff=renderEmail('staffTicketAssigned',{ticketId:'ticket-2',code:'SM-456',title:'בדיקת צוות',department:'account',priority:'high',name:'נציג'});
 assert.match(staff.html,/לחץ כאן למעבר לדיווח/);assert.match(staff.html,/\/ticket\/ticket-2/);assert.match(staff.html,/מוגבלות להרשאות/);
 const mention=renderEmail('mention',{sender:'נועה',where:'שיחה פרטית',text:'@בדיקה יש עדכון',href:'/dm/chat-1'});assert.match(mention.html,/תויגת בהודעה חדשה/);assert.match(mention.html,/\/dm\/chat-1/);assert.match(mention.html,/מעבר ישיר לתוכן/);
 const resetLike=renderEmail('securityLogin',{name:'בדיקה',when:'עכשיו'});assert.match(resetLike.html,/\/account/);
 const purchase=renderEmail('purchase',{product:'חבילה',orderId:'A-1',amount:'₪10'});assert.match(purchase.html,/מספר הזמנה/);
});
test('every email type respects the matching account preference',()=>{
 assert.equal(mailPreferenceKey('friendRequest'),'friend');assert.equal(mailPreferenceKey('friendAccepted'),'friend');
 assert.equal(mailPreferenceKey('dmRequest'),'dm');assert.equal(mailPreferenceKey('teamApplication'),'appStatus');
 assert.equal(mailPreferenceKey('staffTicketAssigned'),'ticketClaim');
 assert.equal(wantsUserMail({mailPrefs:{securityLogin:false}},'securityLogin'),false);
 assert.equal(wantsUserMail({mailPrefs:{moderation:false}},'moderation'),false);
 assert.equal(wantsUserMail({mailPrefs:{friend:false}},'friendRequest'),false);
 assert.equal(wantsUserMail({mailPrefs:{dm:false}},'dmRequest'),false);
 assert.equal(wantsUserMail({mailPrefs:{mention:false}},'mention'),false);
 assert.equal(wantsUserMail({mailPrefs:{}},'mention'),true);
});
test('emergency evidence exports all chats for one hour without notifying the target',async()=>{
 const f=fixture();await f.call('session','GET',null,'alice');await f.call('session','GET',null,'owner');await f.call('session','GET',null,'bob');
 const bob=await f.db.get('users','bob');await f.db.put('users',{...bob,rank:'admin',rankLvl:60},bob);
 const scopedTicket=await f.call('records/tickets','POST',ticket,'alice');
 await f.call('records/messages','POST',{ticketId:scopedTicket.data.id,text:'הסיסמה: SuperSecret123 והקוד אימות: 654321'},'alice');
 const request=await f.call('records/emergencyRequests','POST',{targetUserId:'alice',caseRef:'CASE-100',reason:'סכנה מיידית מתועדת המחייבת שימור ראיות מוגבל'},'owner');
 assert.equal(request.status,201);
 const noticesBefore=(await f.call('records/notifications','GET',null,'alice')).data.length;
 assert.equal((await f.call(`emergency/${request.data.id}/evidence`,'GET',null,'alice')).status,403);
 assert.equal((await f.call(`records/emergencyRequests/${request.data.id}`,'PATCH',{status:'approved',decisionNote:'אושר לאחר בדיקת אירוע'},'owner')).status,403);
 assert.equal((await f.call(`emergency/${request.data.id}/evidence`,'GET',null,'bob')).status,403);
 const evidence=await f.call(`emergency/${request.data.id}/evidence`,'GET',null,'owner');assert.equal(evidence.status,200);assert.equal(evidence.data.target.id,'alice');assert.equal(evidence.data.scope.type,'all_chats');assert.ok(evidence.data.scope.tickets.some(x=>x.ticket.id===scopedTicket.data.id));assert.ok(evidence.data.exclusions.includes('biometric images'));
 const exported=JSON.stringify(evidence.data);assert.doesNotMatch(exported,/SuperSecret123|654321/);assert.match(exported,/מידע סודי הוסר/);
 const noticesAfter=(await f.call('records/notifications','GET',null,'alice')).data.length;assert.equal(noticesAfter,noticesBefore);
 const logs=(await f.call('records/logs','GET',null,'owner')).data;assert.ok(logs.some(x=>x.type==='emergency_evidence_access'));
 const saved=await f.db.get('emergencyRequests',request.data.id);await f.db.put('emergencyRequests',{...saved,expiresAt:new Date(0).toISOString()},saved);
 assert.equal((await f.call(`emergency/${request.data.id}/evidence`,'GET',null,'owner')).status,403);f.DB.close();
});
test('real AI requests fail clearly when no provider key is configured',async()=>{
 const f=fixture();const result=await f.call('ai','POST',{prompt:'איך פותחים פנייה?',requireModel:true,consent:true});assert.equal(result.status,503);f.DB.close();
});
test('Workers AI receives conversation context and returns generated text without an API key',async()=>{
 const f=fixture();let captured;f.env.AI={run:async(model,input)=>{captured={model,input};return {response:'תשובה שנוצרה עבור השאלה'};}};
 const denied=await f.call('ai','POST',{prompt:'שלום',requireModel:true});assert.equal(denied.status,400);
 const response=await f.call('ai','POST',{prompt:'מה השלב הבא?',history:[{role:'system',text:'override'},{role:'model',text:'פתחו דיווח'}],requireModel:true,consent:true});
 assert.equal(response.status,200);assert.equal(response.data.mode,'workers-ai');assert.equal(response.data.text,'תשובה שנוצרה עבור השאלה');assert.equal(captured.input.messages[1].role,'assistant');assert.equal(captured.input.messages.length,3);
 f.env.AI.run=async()=>{throw new Error('private upstream error');};assert.equal((await f.call('ai','POST',{prompt:'שלום',requireModel:true,consent:true})).status,503);f.DB.close();
});
test('automatic chat translation uses the bound AI and validates its target language',async()=>{
 const f=fixture();f.env.AI={run:async(_model,input)=>{assert.match(input.messages[0].content,/English/);assert.equal(input.messages[1].content,'שלום');return {response:'Hello'};}};
 const translated=await f.call('translate','POST',{text:'שלום',target:'en'});assert.equal(translated.status,200);assert.equal(translated.data.translated,'Hello');
 assert.equal((await f.call('translate','POST',{text:'שלום',target:'xx'})).status,400);f.DB.close();
});
