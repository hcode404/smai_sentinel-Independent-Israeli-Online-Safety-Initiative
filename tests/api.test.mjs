import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from '../scripts/local-db.mjs';
import {api,database,renderEmail} from '../server/index.js';
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
 const resetLike=renderEmail('securityLogin',{name:'בדיקה',when:'עכשיו'});assert.match(resetLike.html,/\/account/);
 const purchase=renderEmail('purchase',{product:'חבילה',orderId:'A-1',amount:'₪10'});assert.match(purchase.html,/מספר הזמנה/);
});
test('emergency evidence requires senior access, is scoped and leaves an audit log',async()=>{
 const f=fixture();await f.call('session','GET',null,'alice');await f.call('session','GET',null,'owner');await f.call('session','GET',null,'bob');
 const bob=await f.db.get('users','bob');await f.db.put('users',{...bob,rank:'admin',rankLvl:60},bob);
 const scopedTicket=await f.call('records/tickets','POST',ticket,'alice');
 const request=await f.call('records/emergencyRequests','POST',{targetUserId:'alice',scopeType:'ticket',scopeId:scopedTicket.data.id,caseRef:'CASE-100',reason:'סכנה מיידית מתועדת המחייבת שימור ראיות מוגבל'},'owner');
 assert.equal(request.status,201);
 assert.equal((await f.call(`emergency/${request.data.id}/evidence`,'GET',null,'alice')).status,403);
 assert.equal((await f.call(`records/emergencyRequests/${request.data.id}`,'PATCH',{status:'approved',decisionNote:'אושר לאחר בדיקת אירוע'},'owner')).status,403);
 assert.equal((await f.call(`emergency/${request.data.id}/evidence`,'GET',null,'bob')).status,403);
 const evidence=await f.call(`emergency/${request.data.id}/evidence`,'GET',null,'owner');assert.equal(evidence.status,200);assert.equal(evidence.data.target.id,'alice');assert.equal(evidence.data.scope.ticket.id,scopedTicket.data.id);assert.ok(evidence.data.exclusions.includes('biometric images'));
 const logs=(await f.call('records/logs','GET',null,'owner')).data;assert.ok(logs.some(x=>x.type==='emergency_evidence_access'));
 const saved=await f.db.get('emergencyRequests',request.data.id);await f.db.put('emergencyRequests',{...saved,expiresAt:new Date(0).toISOString()},saved);
 assert.equal((await f.call(`emergency/${request.data.id}/evidence`,'GET',null,'owner')).status,403);f.DB.close();
});
test('real AI requests fail clearly when no provider key is configured',async()=>{
 const f=fixture();const result=await f.call('ai','POST',{prompt:'איך פותחים פנייה?',requireModel:true,consent:true});assert.equal(result.status,503);f.DB.close();
});
