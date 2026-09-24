import {remoteStore,request} from './api.js';
import {initAssistant} from './assistant.js';
import {authReady,loginEmail,registerEmail,loginGoogle,resetPassword,requestEmailChange,logoutFirebase,firebaseUser,beginTotpEnrollment,finishTotpEnrollment} from './firebase-auth.js';
import { renderHome } from './home.js';
import './ticket-fix.css';
import './redesign.css';

/* =====================================================================
   SMAI — Single-file app.  הדבק כאן את פרטי הפרויקט שלך מ-Firebase.
   ===================================================================== */
const SITE = {name:'SMAI Sentinel',tagline:'הגנה וליווי ברשת',email:'minipro.7548@gmail.com',responseHours:12};
const FB_ON=true;

/* ===================== קבועים ===================== */
const DEPTS = [
  { id:'harassment', name:'הטרדות, איומים ובריונות רשת', short:'הטרדות ובריונות', cls:'dang',   ico:'shield-alert',
    desc:'הצקות חוזרות, איומים, נידוי חברתי וקבוצות שמכוונות נגד ילד או נער.' },
  { id:'sextortion', name:'סחיטה ופגיעה מינית מקוונת',   short:'סחיטה ופגיעה',   cls:'violet', ico:'lock',
    desc:'סחיטה בתמונות, שידול קטינים, גרומינג ופניות מיניות מבוגרים לקטינים.' },
  { id:'content',    name:'תוכן פוגעני והפצת תמונות',    short:'תוכן והפצה',     cls:'warn',   ico:'image',
    desc:'הפצת תמונות או סרטונים ללא הסכמה, דיפ-פייק, ובקשות הסרת תוכן.' },
  { id:'account',    name:'פריצה, התחזות וגניבת חשבון',  short:'חשבון והתחזות',  cls:'info',   ico:'user-x',
    desc:'חשבונות שנפרצו, פרופילים מזויפים, פישינג והונאות ברשתות ובמשחקים.' },
  { id:'child',      name:'בטיחות ילדים וליווי הורים',   short:'בטיחות ומשפחה',  cls:'ok',     ico:'heart',
    desc:'ייעוץ להורים, הגדרות בקרה, זמן מסך וליווי משפחתי במצבי סיכון.' },
  { id:'other',      name:'כללי, טכני ואחר',              short:'כללי',           cls:'gray',   ico:'help',
    desc:'כל פנייה אחרת — נשייך אותה למחלקה הנכונה אחרי בדיקה.' }
];
const DEPT_BY = Object.fromEntries(DEPTS.map(d=>[d.id,d]));

const STATUS = {
  new:      { l:'חדש',       b:'b-info',   c:'#2563eb' },
  open:     { l:'בטיפול',    b:'b-warn',   c:'#b8760b' },
  waiting:  { l:'ממתין לך',  b:'b-violet', c:'#7c5cff' },
  escalated:{ l:'הוסלם',     b:'b-dang',   c:'#c62f42' },
  resolved: { l:'נפתר',      b:'b-ok',     c:'#12876f' },
  closed:   { l:'סגור',      b:'b-gray',   c:'#6b7f92' }
};
const PRIO = {
  low:      { l:'נמוכה',  b:'b-gray',  r:1 },
  normal:   { l:'רגילה',  b:'b-info',  r:2 },
  high:     { l:'גבוהה',  b:'b-warn',  r:3 },
  critical: { l:'קריטית', b:'b-crit',  r:4 }
};

/* דרגות צוות — היררכיה מלאה */
const RANKS = {
  citizen: { l:'משתמש',        cls:'rk-citizen', lvl:0,  staff:false, ico:'user' },
  trainee: { l:'מתמחה',        cls:'rk-trainee', lvl:10, staff:true,  ico:'seedling' },
  agent:   { l:'נציג',          cls:'rk-agent',   lvl:20, staff:true,  ico:'headset' },
  senior:  { l:'נציג בכיר',     cls:'rk-senior',  lvl:30, staff:true,  ico:'star' },
  lead:    { l:'ראש צוות',      cls:'rk-lead',    lvl:40, staff:true,  ico:'users' },
  head:    { l:'ראש מחלקה',     cls:'rk-head',    lvl:50, staff:true,  ico:'building' },
  admin:   { l:'מנהל מערכת',    cls:'rk-admin',   lvl:60, staff:true,  ico:'shield' },
  founder: { l:'מייסד',         cls:'rk-founder', lvl:70, staff:true,  ico:'crown' }
};
const RANK_ORDER = ['citizen','trainee','agent','senior','lead','head','admin','founder'];
/* יכולות לפי רמה */
const CAP = {
  viewPanel:      10,  // גישה לפאנל צוות
  replyTicket:    10,  // מענה לפניות
  changeStatus:   20,  // שינוי סטטוס
  assign:         30,  // הקצאת פניות
  internalNote:   20,  // הערות פנימיות
  moderateChat:   20,  // מחיקת הודעות בקהילה
  mute:           30,  // השתקה
  ban:            40,  // הרחקה
  banPermanent:   50,  // הרחקה לצמיתות
  manageServers:  40,  // ניהול שרתים
  reviewApps:     40,  // מועמדויות
  manageUsers:    50,  // שינוי דרגות
  setRankAdmin:   70,  // מינוי מנהלים
  siteConfig:     60
};

/* קטגוריות שרתים בקהילה */
const SRV_CATS = [
  { id:'support',  l:'תמיכה וליווי',  ico:'💙' },
  { id:'parents',  l:'הורים ומשפחה', ico:'👨‍👩‍👧' },
  { id:'teens',    l:'נוער',          ico:'🎧' },
  { id:'gaming',   l:'גיימינג ומשחקים', ico:'🎮' },
  { id:'tech',     l:'טכנולוגיה ואבטחה', ico:'🛡️' },
  { id:'staff',    l:'צוות בלבד',     ico:'🔒' }
];
/* סיבות דיווח על הודעה */
const MSG_REPORTS = [
  { id:'spam',       l:'ספאם והצפה',            d:'פרסום חוזר, פרסומות או הצפת הצ׳אט', sev:1 },
  { id:'profanity',  l:'שפה פוגענית וקללות',    d:'קללות, גזענות, השפלה או שפה בוטה',  sev:2 },
  { id:'harassment', l:'הטרדה ואיומים',          d:'הצקה אישית, איומים או בריונות',      sev:3 },
  { id:'privacy',    l:'חשיפת פרטים ופישינג',    d:'פרטים אישיים, קישורים חשודים, הונאה', sev:3 },
  { id:'sexual',     l:'תוכן מיני / פנייה לקטין', d:'תוכן מיני, שידול או פנייה לא הולמת',  sev:4 },
  { id:'danger',     l:'סכנה ופגיעה עצמית',      d:'חשש לאובדנות או סכנת חיים — נוהל חירום', sev:4 },
  { id:'other',      l:'אחר',                     d:'הפרה אחרת שדורשת בדיקה',            sev:1 }
];
/* סיבות הרחקה */
const BAN_REASONS = [
  'הטרדה, איומים או בריונות כלפי משתמשים',
  'תוכן מיני או פנייה לא הולמת לקטינים',
  'שפה פוגענית, גזענות או הסתה',
  'ספאם, פרסום או הצפה חוזרת',
  'פישינג, הונאה או ניסיון גניבת חשבון',
  'חשיפת פרטים אישיים של אחר (Doxxing)',
  'התחזות לצוות SMAI או לגורם רשמי',
  'עקיפת הרחקה קודמת או ריבוי חשבונות'
];
const BAN_UNITS = { minutes:'דקות', hours:'שעות', days:'ימים', months:'חודשים', permanent:'לצמיתות' };
const PLATFORMS = ['WhatsApp','Instagram','TikTok','Discord','Roblox','Snapchat','Telegram','Fortnite','YouTube','Facebook','Minecraft','אחר'];
const AVATAR_COLORS = ['#0f6f8c','#7c5cff','#12876f','#b8760b','#c62f42','#2563eb','#0891b2','#9333ea','#e0670b','#0d9488'];

/* ===================== בעלות ומנהל-על ===================== */
/* החשבון הזה מקבל דרגת "מייסד" אוטומטית בכל התחברות, ויכול למנות צוות. */
const OWNER_EMAILS = []; // Ownership is determined by the server.
const normEmail = e => String(e||'').trim().toLowerCase();
const isOwnerEmail = e => !!Auth.user?.isOwner && normEmail(Auth.user.email)===normEmail(e);

/* ===================== פלטפורמות דיווח ===================== */
/* partner = שיתוף פעולה פעיל עם הפלטפורמה (ערוץ דיווח מהיר) */
const REPORT_PLATFORMS = [
  { id:'roblox',   l:'Roblox',       he:'רובלוקס',    em:'🟥', partner:false,
    d:'צ׳אט בתוך המשחק, שרתים פרטיים, מסחר בפריטים, התחזות ובקשות מוזרות.' },
  { id:'discord',  l:'Discord',      he:'דיסקורד',    em:'🟣', partner:false,
    d:'שרתים, קבוצות, הודעות פרטיות והפצת תוכן.' },
  { id:'smai',     l:'קהילת SMAI',   he:'קהילת SMAI', em:'🛡️', partner:false, community:true,
    d:'משתמשים, הודעות ופרופילים בתוך הקהילה שלנו — כולל בקשת תג מאומת.' },
  { id:'whatsapp', l:'WhatsApp',     he:'וואטסאפ',    em:'🟩', d:'קבוצות כיתה, הודעות והפצת תמונות.' },
  { id:'instagram',l:'Instagram',    he:'אינסטגרם',   em:'🟠', d:'סטוריז, דיירקט, תגובות ופרופילים מזויפים.' },
  { id:'tiktok',   l:'TikTok',       he:'טיקטוק',     em:'⬛', d:'סרטונים, תגובות והודעות פרטיות.' },
  { id:'snapchat', l:'Snapchat',     he:'סנאפצ׳ט',    em:'🟡', d:'סנאפים, צילומי מסך ותוכן שנעלם.' },
  { id:'telegram', l:'Telegram',     he:'טלגרם',      em:'🔵', d:'קבוצות, ערוצים ובוטים.' },
  { id:'fortnite', l:'Fortnite',     he:'פורטנייט',   em:'🎮', d:'לובי, צ׳אט קולי ומסחר בחשבונות.' },
  { id:'minecraft',l:'Minecraft',    he:'מיינקראפט',  em:'🟫', d:'שרתים, צ׳אט ופריטים.' },
  { id:'youtube',  l:'YouTube',      he:'יוטיוב',     em:'🔴', d:'תגובות, סרטונים וערוצים.' },
  { id:'school',   l:'בית ספר / כיתה', he:'בית ספר',  em:'🏫', d:'קבוצות כיתה, מערכות למידה ואירועים שהתחילו בבית הספר.' },
  { id:'other',    l:'מקום אחר',     he:'אחר',        em:'❔', d:'כל אפליקציה, אתר או משחק אחר.' }
];
const PLAT_BY = Object.fromEntries(REPORT_PLATFORMS.map(p=>[p.id,p]));

function platLogo(id){
  const d={roblox:'roblox',discord:'discord',whatsapp:'whatsapp',instagram:'instagram',tiktok:'tiktok',snapchat:'snapchat',telegram:'telegram',fortnite:'epicgames',youtube:'youtube',minecraft:'minecraft',steam:'steam',robloxstudio:'roblox'};
  if(!d[id])return '';
  const label=REPORT_PLATFORMS.find(p=>p.id===id)?.l||id;
  return '<img class="plat-logo" src="https://cdn.simpleicons.org/'+d[id]+'" alt="לוגו '+label+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' ;
}
/* ===================== סוגי דיווח (תפריט לפני ההסבר) ===================== */
const REPORT_CATS = [
  { id:'harass',   l:'הטרדה, איומים או בריונות',            dept:'harassment', sev:3, ico:'shield-alert',
    d:'מישהו מציק, מאיים, מקלל או מארגן אחרים נגדי.' },
  { id:'sextort',  l:'סחיטה בתמונות או בתוכן אינטימי',      dept:'sextortion', sev:4, ico:'lock',
    d:'מישהו דורש כסף, תמונות או משהו אחר ומאיים לפרסם.' },
  { id:'groom',    l:'מבוגר שפונה אליי בצורה לא נעימה',     dept:'sextortion', sev:4, ico:'user-x',
    d:'שיחות אישיות מדי, בקשות לתמונות או ניסיון להיפגש.' },
  { id:'spread',   l:'הפצת תמונות או סרטונים ללא רשות',     dept:'content',    sev:3, ico:'image',
    d:'כולל צילומי מסך, דיפ-פייק ותמונות ערוכות.' },
  { id:'fake',     l:'התחזות או פרופיל מזויף',              dept:'account',    sev:2, ico:'user-x',
    d:'מישהו פתח פרופיל בשמי או מתחזה לגורם רשמי.' },
  { id:'hack',     l:'פריצה או גניבת חשבון',                dept:'account',    sev:3, ico:'lock',
    d:'איבדתי גישה, מישהו נכנס לחשבון או שינה סיסמה.' },
  { id:'scam',     l:'הונאה, פישינג או גניבת פריטים',       dept:'account',    sev:2, ico:'alert',
    d:'קישור מזויף, "מתנה" שלא הגיעה, גניבת פריטים במשחק.' },
  { id:'hate',     l:'שנאה, גזענות או הסתה',                dept:'harassment', sev:3, ico:'alert',
    d:'תוכן פוגעני נגד קבוצה, גזענות או קריאה לפגיעה.' },
  { id:'selfharm', l:'חשש לפגיעה עצמית או סכנת חיים',       dept:'child',      sev:4, ico:'heart',
    d:'מישהו מדבר על לפגוע בעצמו, או שאני מרגיש/ה כך.' },
  { id:'parent',   l:'ייעוץ להורים ובטיחות במשפחה',        dept:'child',      sev:0, ico:'heart',
    d:'הגדרות בקרה, זמן מסך, ליווי ילד אחרי אירוע.' },
  { id:'trusted-reporter', l:'בקשת מעמד מדווח מהימן',   dept:'other', sev:0, ico:'award',
    d:'הגישו מועמדות לתוכנית המדווחים המהימנים של SMAI — צרפו קישורים לדיווחים הקיימים שלכם.' },
  { id:'partnership',      l:'שיתוף פעולה עם SMAI',         dept:'other', sev:0, ico:'users',
    d:'קהילות, יוצרי תוכן ומומחים שמעוניינים לשתף פעולה — ספרו לנו עליכם.' },
  { id:'other',    l:'משהו אחר',                            dept:'other',      sev:1, ico:'help',
    d:'נשמע הכל — גם אם זה לא מתאים לאף קטגוריה.' }
];
const RCAT_BY = Object.fromEntries(REPORT_CATS.map(c=>[c.id,c]));

/* ===================== דיווח על פרופיל משתמש ===================== */
const PROFILE_REPORTS = [
  { id:'pic',      l:'תמונת פרופיל פוגענית',           sev:3, d:'תוכן מיני, אלים, מפחיד או לא הולם לקטינים.' },
  { id:'name',     l:'שם משתמש פוגעני או מטעה',        sev:2, d:'קללות, שנאה, או שם שנועד לבלבל.' },
  { id:'behavior', l:'התנהגות כללית פוגענית',          sev:3, d:'דפוס חוזר של הצקה, זלזול או הטרדה.' },
  { id:'imperson', l:'התחזות לצוות SMAI או לאדם אחר',  sev:3, d:'מציג את עצמו כנציג, מנהל או משתמש אחר.' },
  { id:'bio',      l:'תיאור פרופיל לא הולם',           sev:2, d:'קישורים חשודים, תוכן מיני או פרסום.' },
  { id:'minor',    l:'פנייה לא הולמת לקטינים',         sev:4, d:'ניסיון ליצור קשר אישי עם ילדים או נוער.' },
  { id:'other',    l:'סיבה אחרת',                       sev:1, d:'נסבירו במילים שלכם ונבדוק.' }
];

/* ===================== העדפות עדכוני מייל ===================== */
const MAIL_PREFS = [
  { id:'securityLogin', l:'כניסה חדשה לחשבון', d:'התראה על כניסה ממכשיר או מרשת שלא זוהו בעבר.', def:true },
  { id:'securityAccount', l:'פעולות אבטחה בחשבון', d:'שינוי סיסמה, מייל או הגדרות אבטחה.', def:true },
  { id:'accountDeletion', l:'מחיקה ושחזור החשבון', d:'אישור בקשת מחיקה ועדכונים חשובים על התהליך.', def:true },
  { id:'purchase', l:'רכישות ואישורי תשלום', d:'אישור רכישה, מספר הזמנה ופרטי העסקה.', def:true },
  { id:'friend', l:'בקשות חברות', d:'כשמישהו שולח או מאשר בקשת חברות.', def:true },

  { id:'ticketReply',  l:'תשובה חדשה בפנייה שלי',        d:'נציג אנושי או הסוכן החכם הגיבו בשרשור.', def:true },
  { id:'ticketClaim',  l:'נציג קיבל את הפנייה לטיפול',   d:'ברגע שנציג לוחץ "קבלת פנייה" — תדעו מי מטפל.', def:true },
  { id:'ticketStatus', l:'שינוי סטטוס או סגירת פנייה',   d:'הועבר לטיפול, הוסלם, נפתר או נסגר.', def:true },
  { id:'aiSteps',      l:'סיכום פעולות הסוכן החכם',      d:'מה הוא בדק, מה הוא מצא ומה הוא ממליץ.', def:false },
  { id:'mention',      l:'איזכור שלי בצ׳אט הקהילתי',     d:'כשמישהו כותב @השם שלכם בשרת או בפורום.', def:true },
  { id:'dm',           l:'הודעה פרטית חדשה',              d:'צ׳אט אישי שנפתח איתכם בקהילה.', def:true },
  { id:'moderation',   l:'החלטות מודרציה שנוגעות לי',    d:'אזהרה, השתקה, הרחקה או הסרת הודעה.', def:true },
  { id:'appStatus',    l:'מועמדות לצוות או לתג מאומת',   d:'התקבלה, נבדקת, אושרה או נדחתה.', def:true },
  { id:'news',         l:'מדריכים ועדכוני מערכת',        d:'עדכונים כלליים — לכל היותר פעם בחודש.', def:false }
];
const mailPrefDefaults = ()=>Object.fromEntries(MAIL_PREFS.map(p=>[p.id,p.def]));

/* ===================== חידון נגד בוטים ===================== */
const BOT_QUIZ = [
  { q:'מה התוצאה של שבע ועוד חמש?', a:['12','11','13','17'], c:0 },
  { q:'איזו מילה מהרשימה היא צבע?', a:['שולחן','כחול','מהר','שלוש'], c:1 },
  { q:'אם היום יום שלישי — מה יהיה מחר?', a:['יום שני','יום רביעי','יום שישי','שבת'], c:1 },
  { q:'כמה ימים יש בשבוע?', a:['5','6','7','10'], c:2 },
  { q:'איזה מהבאים הוא בעל חיים?', a:['מחשב','כיסא','חתול','עיפרון'], c:2 },
  { q:'השלימו: אחת, שתיים, שלוש, ____', a:['חמש','ארבע','שבע','עשר'], c:1 },
  { q:'מה גדול יותר: 19 או 91?', a:['19','91','שווים','אי אפשר לדעת'], c:1 },
  { q:'איזו מילה היא ההיפך מ"גדול"?', a:['רחב','קטן','ארוך','כבד'], c:1 },
  { q:'כמה אותיות יש במילה "שלום"?', a:['3','4','5','6'], c:1 },
  { q:'מה מכל אלה נמצא בשמיים ביום?', a:['ירח מלא','שמש','פנס רחוב','נר'], c:1 },
  { q:'אם יש לכם 3 תפוחים ואוכלים אחד — כמה נשארו?', a:['1','2','3','4'], c:1 },
  { q:'איזה מהבאים הוא אפליקציית הודעות?', a:['וואטסאפ','מקרר','אופניים','מחברת'], c:0 }
];


/* ===================== אייקונים ===================== */
const ICONS = {
  'shield':'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'shield-alert':'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z|M12 8v4|M12 16h.01',
  'shield-check':'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z|M9 12l2 2 4-4',
  'lock':'M5 11h14v10H5z|M8 11V7a4 4 0 018 0v4',
  'image':'M3 3h18v18H3z|M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z|M21 15l-5-5L5 21',
  'user':'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2|M12 11a4 4 0 100-8 4 4 0 000 8z',
  'user-x':'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2|M9 11a4 4 0 100-8 4 4 0 000 8z|M17 8l5 5|M22 8l-5 5',
  'users':'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2|M9 11a4 4 0 100-8 4 4 0 000 8z|M23 21v-2a4 4 0 00-3-3.87|M16 3.13a4 4 0 010 7.75',
  'heart':'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z',
  'help':'M12 22a10 10 0 100-20 10 10 0 000 20z|M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3|M12 17h.01',
  'message':'M21 11.5a8.4 8.4 0 01-9 8.4 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 013.5 11a8.4 8.4 0 018.5-8.5 8.4 8.4 0 019 8.5z',
  'send':'M22 2L11 13|M22 2l-7 20-4-9-9-4 20-7z',
  'plus':'M12 5v14|M5 12h14',
  'search':'M11 19a8 8 0 100-16 8 8 0 000 16z|M21 21l-4.3-4.3',
  'check':'M20 6L9 17l-5-5',
  'x':'M18 6L6 18|M6 6l12 12',
  'alert':'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z|M12 9v4|M12 17h.01',
  'info':'M12 22a10 10 0 100-20 10 10 0 000 20z|M12 16v-4|M12 8h.01',
  'clock':'M12 22a10 10 0 100-20 10 10 0 000 20z|M12 6v6l4 2',
  'file':'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z|M14 2v6h6',
  'book':'M4 19.5A2.5 2.5 0 016.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
  'settings':'M12 15a3 3 0 100-6 3 3 0 000 6z|M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.6 1.6 0 008 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H2a2 2 0 110-4h.1A1.6 1.6 0 003.6 8a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H8a1.6 1.6 0 001-1.5V2a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V8a1.6 1.6 0 001.5 1H22a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  'logout':'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4|M16 17l5-5-5-5|M21 12H9',
  'login':'M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4|M10 17l5-5-5-5|M15 12H3',
  'home':'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z|M9 22V12h6v10',
  'chart':'M18 20V10|M12 20V4|M6 20v-6',
  'sparkle':'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z',
  'copy':'M9 9h10v12H9z|M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1',
  'ban':'M12 22a10 10 0 100-20 10 10 0 000 20z|M4.9 4.9l14.2 14.2',
  'flag':'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z|M4 22v-7',
  'hash':'M4 9h16|M4 15h16|M10 3L8 21|M16 3l-2 18',
  'trash':'M3 6h18|M8 6V4h8v2|M19 6l-1 14H6L5 6',
  'sun':'M12 17a5 5 0 100-10 5 5 0 000 10z|M12 1v2|M12 21v2|M4.2 4.2l1.4 1.4|M18.4 18.4l1.4 1.4|M1 12h2|M21 12h2|M4.2 19.8l1.4-1.4|M18.4 5.6l1.4-1.4',
  'moon':'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  'bell':'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9|M13.7 21a2 2 0 01-3.4 0',
  'star':'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  'crown':'M2 18h20|M3 6l4.5 5L12 4l4.5 7L21 6l-2 10H5z',
  'building':'M4 22V4a2 2 0 012-2h8a2 2 0 012 2v18|M16 8h2a2 2 0 012 2v12|M8 6h.01|M8 10h.01|M8 14h.01|M12 6h.01|M12 10h.01|M12 14h.01',
  'headset':'M3 14v-3a9 9 0 0118 0v3|M3 14a2 2 0 012-2h1v6H5a2 2 0 01-2-2z|M21 14a2 2 0 00-2-2h-1v6h1a2 2 0 002-2z',
  'seedling':'M12 22V10|M12 10C12 6 9 4 5 4c0 4 3 6 7 6z|M12 12c0-3 3-5 7-5 0 3-3 5-7 5z',
  'link':'M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7|M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7',
  'globe':'M12 22a10 10 0 100-20 10 10 0 000 20z|M2 12h20|M12 2a15 15 0 010 20 15 15 0 010-20z',
  'eye':'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z|M12 15a3 3 0 100-6 3 3 0 000 6z',
  'arrow':'M19 12H5|M12 19l-7-7 7-7',
  'chevron':'M15 18l-6-6 6-6',
  'phone':'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6A19.8 19.8 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1 1 .3 1.8.6 2.7a2 2 0 01-.5 2.1L8 9.6a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.7 2z',
  'mail':'M4 4h16v16H4z|M22 6l-10 7L2 6',
  'volume':'M11 5L6 9H2v6h4l5 4V5z|M15.5 8.5a5 5 0 010 7|M18.5 5.5a9 9 0 010 13',
  'volume-x':'M11 5L6 9H2v6h4l5 4V5z|M23 9l-6 6|M17 9l6 6',
  'list':'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01',
  'camera':'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z|M12 17a4 4 0 100-8 4 4 0 000 8z',
  'shuffle':'M16 3h5v5|M4 20L21 3|M21 16v5h-5|M15 15l6 6|M4 4l5 5',
  'refresh':'M23 4v6h-6|M1 20v-6h6|M3.5 9a9 9 0 0114.9-3.4L23 10|M1 14l4.6 4.4A9 9 0 0020.5 15',
  'bot':'M9 2h6v3H9z|M4 8h16v12H4z|M9 13h.01|M15 13h.01|M9 17h6|M2 12h2|M20 12h2',
  'zap':'M13 2L3 14h9l-1 8 10-12h-9l1-8z'
};
function ic(name, size=18, sw=2){
  const d = ICONS[name] || ICONS['info'];
  const paths = d.split('|').map(p=>`<path d="${p}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/* ===================== כלי עזר ===================== */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
/* מחרוזת בטוחה לשילוב בתוך '...' בקוד JS שבתוך תכונת HTML */
const jsq = s => String(s ?? '').replace(/[\\'"<>&\r\n]/g, '').slice(0,120);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const sanitize = (html) => {
  if(typeof DOMPurify==='undefined') return esc(html);
  const _c=DOMPurify.sanitize(html,{ALLOWED_TAGS:['b','i','em','strong','a','br','span','p'],ALLOWED_ATTR:['href','class'],FORCE_BODY:true});
  const _t=document.createElement('div');_t.innerHTML=_c;
  _t.querySelectorAll('a[href]').forEach(a=>{if(/^javascript:/i.test((a.getAttribute('href')||'').trim()))a.removeAttribute('href');});
  return _t.innerHTML;
};
const _rateLimits = {};
function rateLimit(key, ms=30000) {
  const now = Date.now();
  if (_rateLimits[key] && now - _rateLimits[key] < ms) return false;
  _rateLimits[key] = now;
  return true;
}
const uid = () => { const _a=new Uint32Array(2);crypto.getRandomValues(_a);return Date.now().toString(36)+_a[0].toString(36)+_a[1].toString(36); };
const nowISO = () => new Date().toISOString();

/* ===== Ban Screen ===== */
function showBanScreen(banInfo){
  const el = document.getElementById('banScreen');
  if(!el) return;
  const titleEl = document.getElementById('banTitle');
  if(titleEl){
    if(banInfo.perm) titleEl.textContent = 'חשבונך חסום לצמיתות';
    else {
      try{
        const d = new Date(banInfo.until);
        titleEl.textContent = 'חשבונך חסום עד ' + d.toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'});
      }catch(_){ titleEl.textContent = 'חשבונך הוגבל'; }
    }
  }
  const noteEl = document.getElementById('banNote');
  if(noteEl && banInfo.note) noteEl.textContent = banInfo.note;
  const tagsEl = document.getElementById('banTags');
  if(tagsEl){
    const tags = [banInfo.reason, banInfo.item].filter(Boolean);
    tagsEl.innerHTML = sanitize(tags.map(t=>'<span class="ban-tag">'+esc(t)+'</span>').join(''));
  }
  el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function showBanAppeal(){
  document.getElementById('banAppealModal')?.classList.add('open');
}
async function submitBanAppeal(){
  const txt = document.getElementById('banAppealText')?.value?.trim();
  if(!txt){ alert('אנא כתוב את הערעור שלך.'); return; }
  const btn = document.querySelector('.ban-appeal-submit');
  if(btn){ btn.disabled=true; btn.textContent='שולח...'; }
  try{
    const u = Auth.user;
    if (!rateLimit('appeal_' + (Auth.user?.id||'anon'), 300000)) return toast('ממתין 5 דקות בין ערעורים','warn');
    await Store.add('appeals',{
      userId:u?.id||null, userName:u?.name||u?.email||'',
      text:txt, banReason:u?.banReason||'',
      createdAt:nowISO(), status:'pending'
    });
    document.getElementById('banAppealModal').classList.remove('open');
    document.getElementById('banAppealText').value='';
    const n = document.createElement('div');
    n.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#102040;color:#6af;padding:12px 24px;border-radius:10px;z-index:100001;font-weight:700;font-size:.9rem;border:1px solid #1a4080';
    n.textContent='הערעור נשלח לצוות SMAI 👍';
    document.body.appendChild(n); setTimeout(()=>n.remove(),4000);
  }catch(e){
    alert('שגיאה בשליחת הערעור: '+e.message);
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='שלח ערעור'; }
  }
}

async function callAI(prompt){return (await request('/api/ai','POST',{prompt})).text;}
async function smaiAIReply(ticketId){
  try{
    await request('/api/ticket-ai','POST',{ticketId,localOnly:true});
    toast('הכוונה מהמנוע המקומי נוספה לפנייה');await render();
  }catch(e){toast(e.message,'warn');}
}
async function smaiAutoReply(){ /* AI is explicitly requested, never silently sent. */ }

const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
function debounce(fn,ms=320){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
function ticketCode(){
  const d = new Date(), y = String(d.getFullYear()).slice(2), m = String(d.getMonth()+1).padStart(2,'0');
  return `SM-${y}${m}-${String((1000+crypto.getRandomValues(new Uint16Array(1))[0]%9000))}`;
}
function fmtDate(iso){
  if(!iso) return '—';
  try{ return new Date(iso).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}); }catch(e){ return '—'; }
}
function fmtTime(iso){
  if(!iso) return '';
  try{ return new Date(iso).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; }
}
function ago(iso){
  if(!iso) return '';
  const s = (Date.now() - new Date(iso).getTime())/1000;
  if(s < 60) return 'הרגע';
  if(s < 3600) return `לפני ${Math.floor(s/60)} דק׳`;
  if(s < 86400) return `לפני ${Math.floor(s/3600)} שע׳`;
  if(s < 604800) return `לפני ${Math.floor(s/86400)} ימים`;
  return fmtDate(iso);
}
function initials(name){
  const p = String(name||'?').trim().split(/\s+/);
  return ((p[0]?.[0]||'') + (p[1]?.[0]||'')).toUpperCase() || '?';
}
function colorFor(seed){
  let h = 0; const s = String(seed||'x');
  for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const AVATAR_EMOJI = ['\u{1F642}','\u{1F60E}','\u{1F913}','\u{1F984}','\u{1F98A}','\u{1F431}','\u{1F436}','\u{1F43C}','\u{1F438}','\u{1F419}','\u{1F680}','\u{1F3AE}','\u{1F3B8}','\u{26BD}','\u{1F3C0}','\u{1F3A8}','\u{1F4DA}','\u{1F30D}','\u{2B50}','\u{1F31F}','\u{1F525}','\u{1F308}','\u{1F3AF}','\u{1F6E1}\u{FE0F}'];
function avatar(user, size='m'){
  const n = user?.name || user?.email || '?';
  const pres = user?.presence ? `<i class="pres ${user.presence}"></i>` : '';
  const bg = `linear-gradient(135deg,${colorFor(user?.id||n)},${colorFor((user?.id||n)+'2')})`;
  const av = user?.avatar || '';
  let inner = esc(initials(n));
  if(av.startsWith('e:')) inner = `<span style="font-size:1.25em;line-height:1">${esc(av.slice(2))}</span>`;
  else if(/^(https?:|data:image)/.test(av)) inner = `<img src="${esc(av)}" alt="">`;
  return `<span class="av ${size}" style="background:${bg}" title="${esc(n)}">${inner}${pres}</span>`;
}
function rankBadge(rank){
  const r = RANKS[rank] || RANKS.citizen;
  if(rank==='citizen' || !rank) return '';
  return `<span class="rank ${r.cls}">${ic(r.ico,11,2.4)}${esc(r.l)}</span>`;
}
const lvl = u => (RANKS[u?.rank] || RANKS.citizen).lvl;
const can = (u,capKey) => lvl(u) >= (CAP[capKey] ?? 999);
const isStaffUser = u => !!(RANKS[u?.rank]?.staff);

function toast(msg, kind='ok', ms=4200, silent=false){
  if(!silent){ try{ Sfx.play(kind==='err' ? 'error' : kind==='warn' ? 'warn' : 'success'); }catch(e){} }
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  const icon = kind==='err' ? 'alert' : kind==='warn' ? 'alert' : 'check';
  t.innerHTML = `<span style="flex:none;margin-top:1px">${ic(icon,16)}</span><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .3s,transform .3s'; t.style.opacity='0'; t.style.transform='translateX(-16px)';
    setTimeout(()=>t.remove(),320); }, ms);
}
let modalResolve=null,modalFocus=null;
function openModal(html, wide=false){
  modalFocus=document.activeElement;
  const m = $('#modal'); m.className = wide ? 'wide' : '';
  m.innerHTML = html; $('#modalBg').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>{ const f = m.querySelector('input,textarea,select,button'); f?.focus(); }, 60);
}
function closeModal(){ $('#modalBg').classList.remove('open'); $('#modal').innerHTML=''; document.body.style.overflow='';if(modalResolve){modalResolve(false);modalResolve=null;}modalFocus?.focus?.(); }
window.closeModal = closeModal;
$('#modalBg').addEventListener('click', e => { if(e.target.id==='modalBg') closeModal(); });
document.addEventListener('keydown', e => { if(e.key==='Escape' && $('#modalBg').classList.contains('open')) closeModal(); });

function confirmBox(title, body, okLabel='אישור', danger=false){
  return new Promise(res=>{
    openModal(`
      <div class="m-h"><span class="ico-tile ${danger?'i-dang':'i-brand'}">${ic(danger?'alert':'info',20)}</span><h3>${esc(title)}</h3></div>
      <div class="m-b"><p style="margin:0">${body}</p></div>
      <div class="m-f"><button class="btn btn-g" id="cNo">ביטול</button><button class="btn ${danger?'btn-d':'btn-p'}" id="cYes">${esc(okLabel)}</button></div>`);
    modalResolve=res;
    $('#cNo').onclick = ()=>closeModal();
    $('#cYes').onclick = ()=>{modalResolve=null;closeModal();res(true);};
  });
}
function copyText(txt){
  navigator.clipboard?.writeText(txt).then(()=>toast('הועתק ללוח','ok',2200)).catch(()=>{
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta);
    ta.select(); try{ document.execCommand('copy'); toast('הועתק ללוח','ok',2200); }catch(e){ toast('לא הצלחתי להעתיק','err'); }
    ta.remove();
  });
}
window.copyText = copyText;

/* ===================== מנוע סאונד + רטט ===================== */
const Sfx = (()=>{
  let ctx = null, master = null;
  const KEY = 'smai_sfx', VKEY = 'smai_vib';
  const isOn  = ()=> localStorage.getItem(KEY)  !== 'off';
  const vibOn = ()=> localStorage.getItem(VKEY) !== 'off';
  const isMobile = ()=> matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');

  function boot(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    try{
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    }catch(e){ ctx = null; }
    return ctx;
  }
  /* מפעילים את ההקשר רק אחרי מגע ראשון של המשתמש — דרישת הדפדפנים */
  ['pointerdown','keydown','touchstart'].forEach(ev=>{
    document.addEventListener(ev, ()=>{ const c = boot(); if(c && c.state==='suspended') c.resume().catch(()=>{}); }, { once:true, passive:true });
  });

  /* צליל בודד: תדר התחלה→סוף, אורך, צורת גל, עוצמה, השהיה */
  function tone(f0, f1, dur, type='sine', vol=1, at=0){
    const c = boot(); if(!c) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if(f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1,f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + Math.min(0.02, dur*0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  /* כל צליל = רצף תווים. אין קבצים חיצוניים, הכל מיוצר בקוד */
  const BANK = {
    msgIn:   { v:[15],     n:[[660,880,.11,'sine',.8],[880,990,.09,'sine',.5,.07]] },
    msgOut:  { v:[],       n:[[520,700,.07,'triangle',.5]] },
    notify:  { v:[18,60,18],n:[[784,784,.09,'sine',.9],[1046,1046,.13,'sine',.7,.09]] },
    success: { v:[12],     n:[[587,587,.08,'sine',.7],[880,880,.14,'sine',.6,.08]] },
    error:   { v:[30,50,30],n:[[300,180,.20,'sawtooth',.35]] },
    warn:    { v:[20],     n:[[440,392,.16,'triangle',.45]] },
    join:    { v:[10],     n:[[392,523,.10,'sine',.5],[523,784,.12,'sine',.45,.09]] },
    leave:   { v:[],       n:[[523,330,.16,'sine',.4]] },
    pop:     { v:[8],      n:[[420,620,.05,'triangle',.4]] },
    tick:    { v:[],       n:[[900,900,.03,'square',.14]] },
    call:    { v:[25,120,25],n:[[880,880,.15,'sine',.8],[660,660,.15,'sine',.8,.2],[880,880,.2,'sine',.8,.4]] }
  };

  function play(name){
    if(!isOn()) return;
    const b = BANK[name]; if(!b) return;
    try{ b.n.forEach(a=>tone(...a)); }catch(e){}
    if(b.v.length && vibOn() && isMobile() && navigator.vibrate){ try{ navigator.vibrate(b.v); }catch(e){} }
  }
  function vibrate(pat){ if(vibOn() && isMobile() && navigator.vibrate){ try{ navigator.vibrate(pat); }catch(e){} } }
  function setOn(v){ localStorage.setItem(KEY, v?'on':'off'); if(v) play('pop'); paintBtn(); }
  function setVib(v){ localStorage.setItem(VKEY, v?'on':'off'); if(v) vibrate(20); }
  function paintBtn(){
    const b = document.getElementById('sfxBtn'); if(!b) return;
    const on = isOn();
    b.innerHTML = ic(on?'volume':'volume-x',18);
    b.classList.toggle('off', !on);
    b.title = on ? 'צלילים פועלים — לחצו להשתקה' : 'צלילים מושתקים — לחצו להפעלה';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  return { play, vibrate, isOn, vibOn, setOn, setVib, paintBtn, isMobile };
})();
window.Sfx = Sfx;

/* ===================== זיהוי מכשיר ===================== */
const Device = {
  get mobile(){ return innerWidth <= 780 || Sfx.isMobile(); },
  get touch(){ return matchMedia('(pointer:coarse)').matches; },
  get narrow(){ return innerWidth <= 980; },
  apply(){
    const h = document.documentElement;
    h.classList.toggle('is-mobile', this.mobile);
    h.classList.toggle('is-touch', this.touch);
    h.classList.toggle('is-narrow', this.narrow);
  }
};
window.Device = Device;
try{ Device.apply(); addEventListener('resize', ()=>Device.apply(), { passive:true }); }catch(e){}

/* חשיפת מספר לוגי בטוח ל-inline handlers */
const REG = {};
function bind(fn){ const k = 'h'+uid(); REG[k]=fn; return `window.__h('${k}',event,this)`; }
window.__h = (k,e,el)=>{ Promise.resolve().then(()=>REG[k]?.(e,el)).catch(err=>toast(err.message,'err')); };

/* ===================== שכבת נתונים ===================== */
const LS_KEY = 'smai_db_v2';
const subs = new Set();

const Local = {col(){return [];}};
const Store=remoteStore;
async function ensureOwner(u){return u;}
const Auth={user:null,_cbs:[],onChange(f){this._cbs.push(f);f(this.user);},_emit(){this._cbs.forEach(f=>f(this.user));},
  async refresh(){await authReady();this.user=(await request('/api/session')).user;this._emit();},
  async signIn(){location.hash='#/login';},
  async signUp(){location.hash='#/login';},
  async signOut(){await logoutFirebase();this.user=null;this._emit();},
  isStaff(){return isStaffUser(this.user);},can(c){return can(this.user,c);},
  banInfo(){const u=this.user;if(!u?.isBanned||u.banUntil&&Date.parse(u.banUntil)<Date.now())return null;return {until:u.banUntil,reason:u.banReason,note:u.banNote,perm:!u.banUntil};},
  muted(){return Date.parse(this.user?.muteUntil)>Date.now();},
  async changePassword(){if(!firebaseUser()?.email)throw new Error('לא נמצא אימייל בחשבון');await resetPassword(firebaseUser().email);},
  async changeEmail(){throw new Error('שינוי אימייל דורש אימות מחדש ויתווסף בהמשך')}
};
window.smaiLogout=async()=>{await Auth.signOut();location.hash='#/login';await render();};

/* =====================================================================
   מנוע SMAI AI — ניתוח פניות, ניתוב, דירוג דחיפות ומודרציה.
   פועל 100% בדפדפן, ללא API חיצוני. מבוסס ניקוד משוקלל על שורשי מילים
   בעברית + הקשר (מכפילי חומרה, שלילה, פלטפורמה, גיל).
   ===================================================================== */
const ROUTE_RULES = [
  { dept:'sextortion', w:1.25, k:['סחיט','סוחט','סוחטת','עירום','עירומה','אינטימי','נודס','סקסטורשן','גרומינג','שידול',
      'מיני','מינית','מיניות','פדופיל','ביקש תמונות','דורש תמונות','דרש תמונות','איים לפרסם','תמונות עירום',
      'הצעה מינית','ביקש שאשלח','לשלוח תמונ','וידאו קול עירום','בן 40','מבוגר פנה','שלח לי תמונה שלו'] },
  { dept:'account',    w:1.2,  k:['פרצו','נפרץ','נפרצה','פריצה','סיסמה','סיסמא','התחזות','מתחזה','מתחזים','פרופיל מזויף',
      'חשבון מזויף','גנבו','גניבת חשבון','פישינג','הונאה','רימו','השתלטו','בשמי','גישה לחשבון','שחזור חשבון',
      'לינק מוזר','קוד אימות','2fa','אימות דו','נכנסו לחשבון','שינו לי את'] },
  { dept:'content',    w:1.12, k:['הפיצ','הופץ','הופצה','הפיצו','פרסמו תמונ','פרסמו סרטון','פורסמה תמונ','סרטון שלי',
      'תמונה שלי','דיפ פייק','deepfake','פורנו','תוכן פוגעני','הפצה','ללא רשות','בלי רשות','להסיר תוכן','להסיר תמונה',
      'צילום מסך שלי','קבוצה עם תמונות','סטורי עלי'] },
  { dept:'harassment', w:1.05, k:['הטרד','מטריד','מטרידה','מטרידים','מציק','מציקים','בריונות','בריון','איום','איימ',
      'מאיים','מאיימים','קלל','מקלל','מקללים','אלימ','נידוי','חרם','השפל','משפילים','הצק','לעג','לועגים','שנא',
      'טרול','קבוצה נגדי','צוחקים עלי','מכנים אותי','שולחים לי הודעות',
      'יהרוג','אהרוג','להרוג','ירצח','ידקור','אשבור לך','ישבור לך','מכות','להרביץ','הרביצו','סטירה',
      'סטוקר','עוקב אחריי','עוקב אחרי','לא מפסיק לכתוב','חוסם והוא חוזר','פותח פרופילים חדשים'] },
  { dept:'child',      w:0.62, k:['ילד','ילדה','ילדי','קטין','קטינה','הורה','הורים','אמא','אבא','בית ספר','כיתה',
      'זמן מסך','בקרת הורים','סינון','אפליקציה מסוכנת','גיל','חינוכי','מה מותר','איך אני מגן'] }
];
/* ביטויים שמעלים לקריטי מיידית */
const CRITICAL_K = ['אובדנ','להתאבד','התאבד','לשים סוף','לפגוע בעצמ','חתכתי','חותכת את עצמ','ברצח','לרצוח','סכנת חיים',
  'סכנה מיידית','חטיפה','לפגוע פיזי','פגיעה פיזי','איום פיזי','נשק','אקדח','סכין','נפגש איתו','נפגשת איתו',
  'לפגוש אותו','אונס','תקף אותי','הוא בדרך אלי','יודע איפה אני גר','מגיע אלי הביתה',
  'יהרוג','אהרוג','להרוג','הורג אות','ירצח','ידקור','לדקור','אשבור לך','ישבור לך','אשבור אות',
  'לא רוצה לחיות','נמאס לי לחיות','אין לי סיבה לחיות','לגמור עם החיים','למות'];
/* מגברי דחיפות */
const URGENT_K = ['עכשיו','דחוף','מיד','הרגע','היום','בוער','לא יודע מה לעשות','בבקשה עזרה','חייב עזרה','מפחד','מפחדת','בהלה'];
/* מרככים */
const SOFT_K = ['שאלה','התייעצות','רוצה לדעת','מתעניין','איך אפשר','כללי','לא דחוף'];

function detectPlatform(text){
  const t = text.toLowerCase();
  const map = { 'whatsapp':'WhatsApp','ווצאפ':'WhatsApp','וואטסאפ':'WhatsApp','instagram':'Instagram','אינסטגרם':'Instagram',
    'אינסטה':'Instagram','tiktok':'TikTok','טיקטוק':'TikTok','discord':'Discord','דיסקורד':'Discord',
    'roblox':'Roblox','רובלוקס':'Roblox','snapchat':'Snapchat','סנאפ':'Snapchat','telegram':'Telegram','טלגרם':'Telegram',
    'fortnite':'Fortnite','פורטנייט':'Fortnite','youtube':'YouTube','יוטיוב':'YouTube','facebook':'Facebook',
    'פייסבוק':'Facebook','minecraft':'Minecraft','מיינקראפט':'Minecraft' };
  for(const k in map) if(t.includes(k)) return map[k];
  return null;
}
function detectMinor(text){
  const t = text.toLowerCase();
  /* גבולות מילה של JS לא חלים על עברית, ולכן בודקים לפי רווח או פיסוק */
  if(/(^|[\s,.;:!?()"'\-])(בן|בת|גיל|גילי|גילה|בגיל)\s{0,2}(9|1[0-7])(?![0-9])/.test(t)) return true;
  if(/(^|[\s,.;:!?()"'\-])(כיתה)\s{0,2}([אבגדהוזחט]|[1-9]|1[0-2])(?![0-9])/.test(t)) return true;
  return ['הילד שלי','הילדה שלי','הבן שלי','הבת שלי','קטין','קטינה','תלמיד','תלמידה','כיתה ',
          'בית ספר','בית הספר','חטיבה','תיכון','יסודי','בן נוער','בת נוער'].some(k=>t.includes(k));
}
function scoreHits(text, words){
  const t = text.toLowerCase();
  const hit = [];
  for(const w of words){ if(t.includes(w.toLowerCase())) hit.push(w); }
  return hit;
}
/* הניתוח המרכזי */
function analyze(text){
  const raw = String(text||''); const t = raw.toLowerCase();
  const scores = {}, matched = {};
  for(const r of ROUTE_RULES){
    const hits = scoreHits(t, r.k);
    matched[r.dept] = hits;
    /* ניקוד: פגיעות ייחודיות, עם תשואה פוחתת כדי שמילה חוזרת לא תשתלט */
    scores[r.dept] = +(hits.length ? (hits.length ** 0.85) * r.w : 0).toFixed(3);
  }
  const ranked = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const best = ranked[0] || ['other',0];
  const dept = best[1] > 0 ? best[0] : 'other';
  const gap  = best[1] - (ranked[1]?.[1] || 0);

  const critHits = scoreHits(t, CRITICAL_K);
  const urgHits  = scoreHits(t, URGENT_K);
  const softHits = scoreHits(t, SOFT_K);
  const critical = critHits.length > 0;

  let prio = 'normal';
  if(critical) prio = 'critical';
  else if(dept === 'sextortion') prio = 'high';
  else if(dept === 'content' && best[1] >= 1.1) prio = 'high';
  else if(best[1] >= 2.6) prio = 'high';
  else if(softHits.length && !urgHits.length && best[1] < 1.2) prio = 'low';
  if(!critical && urgHits.length >= 2 && prio === 'normal') prio = 'high';

  /* מדד דחיפות 0-100 */
  let urgency = 22 + best[1]*11 + urgHits.length*9 + (critical ? 55 : 0) - softHits.length*8;
  urgency = clamp(Math.round(urgency), 5, 100);

  const confidence = best[1] > 0
    ? clamp(Math.round(44 + best[1]*10 + gap*7), 40, 96)
    : 34;

  const platform = detectPlatform(t);
  const minor = detectMinor(t);
  const len = raw.trim().length;

  const actions = [];
  if(critical) actions.push('יצירת קשר מיידי עם הפונה + הנחיה להתקשר ל-100');
  if(dept==='sextortion'){ actions.push('לא לשלם ולא לשלוח עוד תוכן'); actions.push('שמירת ראיות לפני חסימה'); }
  if(dept==='content') actions.push('פתיחת בקשת הסרה מול הפלטפורמה');
  if(dept==='account'){ actions.push('שחזור סיסמה ואימות דו-שלבי'); actions.push('בדיקת מכשירים מחוברים'); }
  if(dept==='harassment') actions.push('תיעוד ההודעות + חסימת המשתמש');
  if(minor) actions.push('שיתוף הורה או איש חינוך');
  if(len < 60) actions.push('לבקש מהפונה פירוט נוסף');

  return { dept, prio, critical, confidence, urgency, platform, minor,
           matched: matched[dept] || [], critHits, urgHits, scores, actions,
           depth: len < 60 ? 'short' : len < 320 ? 'medium' : 'detailed' };
}
async function analyzeWithAI(text){return analyze(text);}

/* ---------- מודרציית קהילה ---------- */
const MOD_RULES = [
  { cat:'danger',     sev:4, k:['אתאבד','להתאבד','אובדנ','לפגוע בעצמי','לחתוך את עצמי','לא רוצה לחיות','לשים סוף לחיים'] },
  { cat:'sexual',     sev:4, k:['תשלחי תמונה','שלחי תמונת','עירום','נודס','סקס','זיון','בת כמה את','כמה את בת','נפגש לבד','תמונה בלי בגדים'] },
  { cat:'harassment', sev:3, k:['אני אהרוג אותך','אמצא אותך','אני יודע איפה אתה גר','תמות','שתמות','אכסח אותך','אני אפגע בך','תזהר ממני'] },
  { cat:'privacy',    sev:3, k:['הכתובת שלו','מספר הטלפון שלו','ת.ז','תעודת זהות','הסיסמה שלי היא','bit.ly/','free-robux','חינם רובוקס','פרסים חינם','לחץ כאן וקבל'] },
  { cat:'profanity',  sev:2, k:['בן זונה','בת זונה','זונה','מפגר','מפגרת','חרא','זבל','אידיוט','דביל','שרמוטה','כוס אמא','נאצי','ערבוש','מסריח'] },
  { cat:'spam',       sev:1, k:['הצטרפו לקבוצה','שרת שלי','discord.gg/','t.me/','קנו עכשיו','הנחה מיוחדת','עקבו אחריי','follow me'] }
];
function moderate(text){
  const raw = String(text||''); const t = raw.toLowerCase();
  let best = null, all = [];
  for(const r of MOD_RULES){
    const hits = scoreHits(t, r.k);
    if(hits.length){ all.push({ cat:r.cat, sev:r.sev, hits }); if(!best || r.sev > best.sev) best = { cat:r.cat, sev:r.sev, hits }; }
  }
  /* היוריסטיקות נוספות */
  const caps = raw.replace(/[^א-תa-zA-Z]/g,'');
  const shouty = caps.length > 24 && (raw.match(/!/g)||[]).length >= 4;
  const flood  = /(.)\1{9,}/.test(raw);
  if(!best && (shouty || flood)) best = { cat:'spam', sev:1, hits:[shouty?'צעקות':'הצפת תווים'] };

  if(!best) return { violation:false, severity:0, cat:null, hits:[], action:'none',
                     label:'תקין', explain:'לא נמצאו סימנים להפרת כללי הקהילה.' };

  const meta = MSG_REPORTS.find(m=>m.id===best.cat) || MSG_REPORTS[6];
  const action = best.sev >= 4 ? 'escalate' : best.sev === 3 ? 'delete_mute' : best.sev === 2 ? 'delete_warn' : 'warn';
  const explain = {
    escalate:  'ההודעה מכילה תוכן חמור המחייב טיפול מיידי של צוות אנושי. נפתחה פנייה דחופה והודעה הוסתרה.',
    delete_mute:'ההודעה מפרה את כללי הקהילה בצורה משמעותית. ההודעה תוסר והמשתמש יושתק זמנית.',
    delete_warn:'ההודעה מכילה שפה פוגענית. ההודעה תוסר והמשתמש יקבל אזהרה.',
    warn:      'זוהתה הפרה קלה. ההודעה תסומן לבדיקת מודרטור.'
  }[action];
  return { violation:true, severity:best.sev, cat:best.cat, catLabel:meta.l, hits:best.hits, action, explain,
           label:['','קלה','בינונית','חמורה','קריטית'][best.sev],
           muteMinutes: best.sev>=3 ? (best.sev===4 ? 1440 : 180) : 0 };
}

/* =====================================================================
   שכבת מייל — SMAI Mail
   הדפדפן לא יכול לשלוח SMTP, ואסור להטמיע סיסמת-אפליקציה בקובץ ציבורי.
   לכן השכבה הזו עובדת עם "ספק מתחלף": EmailJS (מפתח ציבורי, בטוח),
   או Worker / Cloud Function משלכם (הסוד נשאר בצד השרת).
   בלי ספק מוגדר — כל מייל נשמר בתיבת יוצא במערכת ומוצג בפאנל הניהול,
   כך שהאתר עובד במלואו גם לפני שמחברים ספק.
   ===================================================================== */

const Mail={cfg(){return {provider:'none'};},ready(){return false;},wants(){return false;},async send(){return {ok:false,why:'שירות המייל לא מחובר; ניתן לעקוב באתר'};},save(){throw new Error('הגדרות שירות נשמרות בשרת בלבד');}};

/* תבניות מייל — טקסט נקי, קריא בכל לקוח דואר */
const MAIL_TPL_RAW = {
  threadReply: (who, title, txt)=>({ subject:'תגובה חדשה בשרשור שלך',
    body:`<p><b>${esc(who)}</b> הגיב/ה בשרשור «${esc(title)}»:</p>
          <blockquote style="border-inline-start:3px solid #4f46e5;padding-inline-start:12px;color:#444">${esc(txt)}</blockquote>` }),

  groupAdd: (who, name)=>({ subject:'צורפת לקבוצה פרטית ב-SMAI',
    body:`<p><b>${esc(who)}</b> צירף/ה אותך לקבוצה <b>${esc(name||'קבוצה')}</b>.</p><p>אפשר לפתוח אותה בעמוד «הודעות פרטיות».</p>` }),

  friendReq: (who)=>({ subject:'בקשת חברות חדשה ב-SMAI',
    body:`<p><b>${esc(who)}</b> שלח/ה לך בקשת חברות בקהילת SMAI.</p><p>אפשר לאשר או לדחות דרך עמוד «חברים» באתר.</p>` }),
  friendOk: (who)=>({ subject:'בקשת החברות אושרה',
    body:`<p><b>${esc(who)}</b> אישר/ה את בקשת החברות שלך. עכשיו אפשר להתכתב בהודעות פרטיות.</p>` }),

  verify:(name, code)=>({ subject:`קוד האימות שלך ל-SMAI: ${code}`, body:
`שלום ${name||''},

קוד האימות שלך הוא: ${code}

הקוד תקף ל-3 דקות בלבד. אל תעבירו אותו לאף אחד — צוות SMAI לעולם לא יבקש ממכם את הקוד.
אם לא ביקשתם להירשם, אפשר פשוט להתעלם מהמייל הזה.

צוות SMAI` }),
  ticketReply:(t, who, txt)=>({ subject:`תשובה חדשה בפנייה ${t.code} — ${t.title}`, body:
`התקבלה תשובה חדשה בפנייה שלך.

פנייה: ${t.code} — ${t.title}
משיב/ה: ${who}

${txt}

לצפייה ולמענה היכנסו לאתר בעמוד "מעקב פנייה" עם הקוד ${t.code}.
במצב סכנה מיידית יש להתקשר למשטרה — 100.

צוות SMAI` }),
  ticketClaim:(t, who)=>({ subject:`הפנייה ${t.code} התקבלה לטיפול`, body:
`נציג אנושי קיבל את הפנייה שלך לטיפול.

פנייה: ${t.code} — ${t.title}
נציג מטפל: ${who}

מכאן והלאה יש לך כתובת אישית. אפשר להשיב ישירות בשרשור הפנייה באתר.
במצב סכנה מיידית יש להתקשר למשטרה — 100.

צוות SMAI` }),
  ticketStatus:(t, st)=>({ subject:`עדכון סטטוס בפנייה ${t.code}`, body:
`הסטטוס של הפנייה שלך התעדכן ל: ${st}

פנייה: ${t.code} — ${t.title}

לצפייה מלאה היכנסו לאתר בעמוד "מעקב פנייה" עם הקוד ${t.code}.

צוות SMAI` }),
  aiSteps:(t, stages)=>({ subject:`הסוכן החכם בדק את הפנייה ${t.code}`, body:
`הסוכן החכם של SMAI סיים לבדוק את הפנייה שלך.

פנייה: ${t.code} — ${t.title}

שלבי הבדיקה:
${stages.map((x,i)=>`${i+1}. ${x.label} — ${x.detail}`).join('\n')}

התשובה המלאה מחכה לך בשרשור הפנייה באתר.

צוות SMAI` }),
  mention:(who, where, txt)=>({ subject:`${who} הזכיר/ה אותך בקהילת SMAI`, body:
`${who} הזכיר/ה אותך ב"${where}":

"${txt}"

להמשך השיחה היכנסו לקהילה באתר.

צוות SMAI` }),
  dm:(who, txt)=>({ subject:`הודעה פרטית חדשה מ-${who}`, body:
`קיבלת הודעה פרטית חדשה בקהילת SMAI מ-${who}:

"${txt}"

למענה היכנסו לצ׳אטים הפרטיים באתר.
אם ההודעה מטרידה — אפשר לדווח עליה בלחיצה אחת.

צוות SMAI` }),
  moderation:(title, detail)=>({ subject:`עדכון מודרציה: ${title}`, body:
`${title}

${detail}

אם לדעתך נפלה טעות, אפשר להגיש ערעור מהאתר.

צוות SMAI` }),
  appStatus:(title, detail)=>({ subject:`עדכון מועמדות — ${title}`, body:
`${title}

${detail}

צוות SMAI` })
,

  welcomeEmail: (name) => ({
    subject: 'ברוכים ל-SMAI!',
    body: `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#0a0a1a;margin:0;padding:0}
.wrap{max-width:560px;margin:40px auto;background:linear-gradient(135deg,#12122a,#1a1a35);border-radius:16px;overflow:hidden;border:1px solid #2a2a5a}
.header{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 32px;text-align:center}
.logo{font-size:36px;font-weight:900;color:#fff;letter-spacing:2px;margin-bottom:8px}
.tagline{color:rgba(255,255,255,.85);font-size:14px}
.body{padding:32px;color:#c8c8e8}
.title{font-size:22px;font-weight:700;color:#fff;margin-bottom:16px}
.text{font-size:15px;line-height:1.7;margin-bottom:20px;color:#a0a0c0}
.btn{display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin:12px 0}
.footer{text-align:center;padding:20px;color:#555;font-size:12px;border-top:1px solid #1e1e3a}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">SMAI</div><div class="tagline">Security Management AI</div></div>
  <div class="body">
    <div class="title">שלום ${esc(name)}, ברוכים ל-SMAI! 🎉</div>
    <p class="text">אנחנו שמחים שהצטרפת לקהילת SMAI. החשבון שלך נוצר בהצלחה ואתה מוכן להתחיל.</p>
    <p class="text">אם יש לך שאלות או זקוק לעזרה — הצוות שלנו פתוח בשבילך.</p>
    <a class="btn" href="https://hcode404.github.io/smaiSentinel/">כנסו ל-SMAI &rarr;</a>
  </div>
  <div class="footer">ניום SMAI &bull; אנא אל תשיב למייל זה</div>
</div></body></html>`
  }),

  mentionNotif: (mentionedBy, channelName, msgText) => ({
    subject: `הוזכרת על ידי ${esc(mentionedBy)} ב-SMAI`,
    body: `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#0a0a1a;margin:0;padding:0}
.wrap{max-width:560px;margin:40px auto;background:linear-gradient(135deg,#12122a,#1a1a35);border-radius:16px;overflow:hidden;border:1px solid #2a2a5a}
.header{background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px;text-align:center}
.logo{font-size:28px;font-weight:900;color:#fff;letter-spacing:2px}
.body{padding:32px;color:#c8c8e8}
.title{font-size:20px;font-weight:700;color:#fff;margin-bottom:16px}
.mention-box{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.4);border-radius:10px;padding:16px;margin:16px 0;font-size:15px;color:#e8c96a;line-height:1.6}
.meta{font-size:13px;color:#666;margin-bottom:8px}
.btn{display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin:12px 0}
.footer{text-align:center;padding:20px;color:#555;font-size:12px;border-top:1px solid #1e1e3a}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">🔔 SMAI</div></div>
  <div class="body">
    <div class="title">תרוכית נשל</div>
    <p>הוזכרת על ידי <strong>${esc(mentionedBy)}</strong> סיחה <strong>${esc(channelName)}</strong>:</p>
    <div class="mention-box"><div class="meta">@${esc(mentionedBy)}:</div>${esc(msgText)}</div>
    <a class="btn" href="https://hcode404.github.io/smaiSentinel/">צמייל סיחה &rarr;</a>
  </div>
  <div class="footer">נשלח על ידי SMAI</div>
</div></body></html>`
  }),

  passwordChanged: (name) => ({
    subject: 'הסיסמה שונתה בהצלחה',
    body: `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#0a0a1a;margin:0;padding:0}
.wrap{max-width:560px;margin:40px auto;background:linear-gradient(135deg,#12122a,#1a1a35);border-radius:16px;overflow:hidden;border:1px solid #2a2a5a}
.header{background:linear-gradient(135deg,#10b981,#059669);padding:32px;text-align:center}
.logo{font-size:28px;font-weight:900;color:#fff}
.body{padding:32px;color:#c8c8e8}
.title{font-size:20px;font-weight:700;color:#fff;margin-bottom:16px}
.info-box{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:10px;padding:16px;margin:16px 0;font-size:14px;color:#6ee7b7}
.warn{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:14px;margin-top:16px;font-size:13px;color:#fca5a5}
.footer{text-align:center;padding:20px;color:#555;font-size:12px;border-top:1px solid #1e1e3a}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">🔒 SMAI</div></div>
  <div class="body">
    <div class="title">שלום ${esc(name)},</div>
    <p>הסיסמה לחשבון SMAI שלך שונתה בהצלחה.</p>
    <div class="info-box">✅ הסיסמה שונתה: ${new Date().toLocaleString('he-IL')}</div>
    <div class="warn">⚠️ אם לא אתה ביצעת פעולה זו, צור קשר עם התמיכה בהקדם.</div>
  </div>
  <div class="footer">נשלח על ידי SMAI</div>
</div></body></html>`
  }),

  ticketAccepted: (name, ticketTitle) => ({
    subject: `הפנייתך נלקחה לטיפול`,
    body: `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#0a0a1a;margin:0;padding:0}
.wrap{max-width:560px;margin:40px auto;background:linear-gradient(135deg,#12122a,#1a1a35);border-radius:16px;overflow:hidden;border:1px solid #2a2a5a}
.header{background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:32px;text-align:center}
.logo{font-size:28px;font-weight:900;color:#fff}
.body{padding:32px;color:#c8c8e8}
.title{font-size:20px;font-weight:700;color:#fff;margin-bottom:12px}
.status-box{background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.4);border-radius:10px;padding:16px;margin:16px 0}
.status-val{font-size:16px;font-weight:700;color:#60a5fa}
.ticket-title{background:rgba(255,255,255,.05);border-radius:8px;padding:12px;margin:12px 0;font-size:15px;color:#d1d5db}
.btn{display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin:12px 0}
.footer{text-align:center;padding:20px;color:#555;font-size:12px;border-top:1px solid #1e1e3a}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">🎫 SMAI</div></div>
  <div class="body">
    <div class="title">שלום ${esc(name)},</div>
    <p>צוות התמיכה קיבל את הפנייה שלך לטיפול:</p>
    <div class="ticket-title">📌 ${esc(ticketTitle)}</div>
    <div class="status-box"><div class="status-val">🔄 בטיפול</div></div>
    <p>נחזור אליך בהקדם האפשרי.</p>
    <a class="btn" href="https://hcode404.github.io/smaiSentinel/">צפייה בפנייה &rarr;</a>
  </div>
  <div class="footer">נשלח על ידי SMAI</div>
</div></body></html>`
  })
};

function emailShell(title,content){
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
  <body style="margin:0;background:#07111f;font-family:Arial,sans-serif;color:#e8f3ff"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07111f;padding:28px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#0d1b2d;border:1px solid #1e4666;border-radius:20px;overflow:hidden"><tr><td style="padding:28px;background:linear-gradient(135deg,#075985,#0e7490)"><div style="font-size:12px;letter-spacing:2px;color:#a5f3fc">SMAI SENTINEL</div><h1 style="margin:8px 0 0;font-size:25px;color:#fff">${esc(title)}</h1></td></tr>
  <tr><td style="padding:30px;font-size:16px;line-height:1.75;color:#cfe3f5">${content}<p style="margin:28px 0 0"><a href="https://smai-sentinel.smai-sentinel.chatgpt.site/" style="display:inline-block;background:#22d3ee;color:#05202b;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">מעבר ל‑SMAI Sentinel</a></p></td></tr>
  <tr><td style="padding:18px 30px;border-top:1px solid #19344d;color:#7894aa;font-size:12px">הודעה אוטומטית ומאובטחת. צוות SMAI לעולם לא יבקש סיסמה או קוד אימות.</td></tr></table></td></tr></table></body></html>`;
}
const MAIL_TPL=Object.fromEntries(Object.entries(MAIL_TPL_RAW).map(([key,make])=>[key,(...args)=>{const out=make(...args);return {...out,body:/^\s*<!doctype html/i.test(out.body)?out.body:emailShell(out.subject,out.body)};} ]));
async function mailUser(){return Mail.send();}
async function notifyTicket(){return Mail.send();}


/* ---------- ציר השלבים של הסוכן ---------- */
function aiStagesHTML(stages){
  if(!stages?.length) return '';
  return `<div class="ai-steps"><h5>${ic('bot',15)} כך בדקתי את הפנייה — שלב אחר שלב</h5>
    ${stages.map(st=>`<div class="aist ${st.pending?'wait':st.ok?'':'warn'}">
      <span class="dt">${st.pending?'…':st.ok?'✓':'!'}</span>
      <span class="tx"><b>${esc(st.label)}</b><span>${esc(st.detail)}</span></span></div>`).join('')}</div>`;
}

/* ===================== תוכן ראשוני ===================== */
const SEED_ARTICLES = [
  { id:'a-sextortion', dept:'sextortion', title:'סחיטה מינית ברשת — מה עושים ב-10 הדקות הראשונות',
    sum:'המדריך המלא לתגובה נכונה כשמישהו מאיים לפרסם תמונות. מה לעשות, ומה בשום אופן לא.',
    read:6, tags:['סחיטה','חירום','נוער'],
    body:`הדבר הראשון והחשוב ביותר: **זו לא אשמתך**. סחטנים מקצועיים מפעילים לחץ ובושה בדיוק כדי שלא תספר לאף אחד. ברגע שמישהו נוסף יודע — הכוח שלהם נשבר.

**מה לעשות עכשיו**
לעצור כל תקשורת עם הסוחט. אל תענה, אל תתווכח, אל תתחנן. כל תגובה מוכיחה לו שהלחץ עובד.
לא לשלם. בפועל, בכל המקרים כמעט, תשלום מוביל לדרישה נוספת ולא לסיום.
לצלם ולשמור הכל לפני שחוסמים — שם משתמש, קישור לפרופיל, כל ההודעות, מספרי חשבון שנתבקשת להעביר אליהם.
לחסום ולדווח בתוך האפליקציה עצמה, אחרי שהראיות שמורות.
לספר למבוגר אחד לפחות. אם אי אפשר להורה — יועצת, מורה, אח בוגר, או אלינו.

**ומה אם התמונות כבר פורסמו**
גם אז יש מה לעשות. לרוב הפלטפורמות יש נוהל הסרה מזורז לתוכן אינטימי של קטינים, ואפשר לפנות במקביל דרך שירות NCMEC Take It Down שמונע העלאה חוזרת. אנחנו מלווים בתהליך הזה מול הפלטפורמות.

**מתי מתקשרים למשטרה**
תמיד, כשמדובר בקטין. במצב של סכנה מיידית מתקשרים למשטרה — 100.` },

  { id:'a-bully', dept:'harassment', title:'בריונות רשת: איך לזהות, לתעד ולהפסיק',
    sum:'ההבדל בין ריב לבריונות, איך אוספים תיעוד שמתקבל בבית ספר ובמשטרה, ומה באמת עוזר.',
    read:5, tags:['בריונות','בית ספר','הורים'],
    body:`בריונות רשת אינה אירוע חד-פעמי. שלושת הסימנים המבדילים הם חזרתיות, כוונה לפגוע, ופער כוחות — קבוצה מול יחיד, או מישהו שמחזיק בתוכן מביך.

**סימנים שילד נמצא במצוקה**
הימנעות פתאומית מהטלפון או להפך — בדיקה כפייתית שלו; שינוי במצב הרוח אחרי שימוש ברשת; סירוב ללכת לבית ספר; ירידה בשינה ובתיאבון; נטישת חברויות ותחביבים.

**תיעוד שעובד**
צילום מסך שכולל את שם המשתמש, התאריך והשעה. תיעוד רציף ולא רק ההודעה הקשה ביותר. שמירה בתיקייה אחת עם שמות קבצים לפי תאריך. אל תמחקו כלום, גם אם זה מכאיב.

**מה עוזר בפועל**
לא להגיב לבריון — תגובה היא דלק. לחסום אחרי התיעוד. לפנות לפלטפורמה עם דיווח מסודר. במקביל לערב את בית הספר בכתב, כי חובת הדיווח שלהם מתחילה ברגע שהמידע הגיע אליהם בכתב.

**מה לא עוזר**
לקחת לילד את הטלפון כעונש. זה מלמד אותו שסיפור על בעיה מוביל לעונש, והוא לא יספר בפעם הבאה.` },

  { id:'a-images', dept:'content', title:'תמונה שלי הופצה בלי רשות — מדריך הסרה',
    sum:'הצעדים המדויקים להסרת תוכן מכל פלטפורמה, כולל מה לכתוב בפנייה.',
    read:7, tags:['הסרת תוכן','פרטיות'],
    body:`הפצת תמונה אינטימית ללא הסכמה היא עבירה פלילית בישראל לפי חוק מניעת הטרדה מינית, גם כשהמפיץ קטין.

**סדר פעולות**
ראשית, תיעוד: קישור ישיר לפוסט, שם המשתמש שהעלה, צילום מסך של הכל. אחר כך דיווח בתוך הפלטפורמה בקטגוריית "תוכן אינטימי ללא הסכמה" — לא בקטגוריה כללית, כי זו קטגוריה עם טיפול מזורז.

**מה לכתוב בפנייה**
לציין במפורש שמדובר בתמונה של עצמך, שפורסמה ללא הסכמתך, ואם רלוונטי — שאתה קטין. שתי העובדות האלה מעבירות את הפנייה למסלול מהיר.

**מניעת העלאה חוזרת**
StopNCII.org לבגירים ו-Take It Down של NCMEC לקטינים יוצרים חתימה דיגיטלית של התמונה מהמכשיר שלך, בלי להעלות אותה לשום מקום, ומונעים העלאה שלה מחדש בפלטפורמות הגדולות.

**דיפ פייק**
תמונה מזויפת שנוצרה ב-AI מקבלת אותו יחס משפטי. אל תתביישו לדווח רק כי "זה לא באמת אני".` },

  { id:'a-hacked', dept:'account', title:'החשבון נפרץ — 15 הדקות הראשונות',
    sum:'שחזור מהיר, נעילת התוקף בחוץ, ובדיקה מה הוא הספיק לעשות.',
    read:4, tags:['אבטחה','פריצה'],
    body:`**מיד**
לשנות סיסמה מהמכשיר הבטוח ביותר שיש לך, לא מזה שאולי נגוע. הסיסמה החדשה חייבת להיות ייחודית לשירות הזה בלבד.
להפעיל אימות דו-שלבי. עדיף אפליקציית אימות על פני SMS, כי החלפת SIM היא וקטור תקיפה נפוץ.
לנתק את כל המכשירים המחוברים דרך הגדרות האבטחה — זה מוציא את התוקף גם אם הוא מחובר כרגע.

**לבדוק מה השתנה**
כתובת מייל ומספר טלפון לשחזור (התוקף מחליף אותם ראשונים), כללי העברה אוטומטית במייל, אפליקציות מחוברות והרשאות, וכן הודעות שנשלחו בשמך.

**להזהיר**
פרסמו לחברים שהחשבון נפרץ. תוקפים משתמשים בחשבון גנוב כדי לבקש כסף מאנשי הקשר.

**איך זה קרה, בדרך כלל**
קישור פישינג שנראה כמו דף התחברות אמיתי, סיסמה משותפת שדלפה מאתר אחר, או "מתנה חינם" במשחק שדרשה להתחבר.` },

  { id:'a-parents', dept:'child', title:'הגדרות בטיחות להורים — לפי גיל, בלי מלחמות',
    sum:'מה להגדיר בגילאי 6-9, 10-13 ו-14+, ואיך לדבר על זה בלי לאבד אמון.',
    read:8, tags:['הורים','בקרת הורים'],
    body:`בקרת הורים היא כלי, לא תחליף לשיחה. המחקר עקבי: מה שמגן על ילדים הוא בעיקר הידיעה שאפשר לספר להורה בלי להיענש.

**גילאי 6-9**
שימוש במרחב משותף בבית. חשבונות ילדים ייעודיים (Family Link, Screen Time). ללא צ׳אט פתוח עם זרים. אישור הורה לכל הורדה.

**גילאי 10-13**
חשבונות פרטיים ברשתות. כיבוי מיקום בכל האפליקציות. הגבלת הודעות פרטיות לחברים בלבד. שיחה מפורשת: "אם מישהו יבקש ממך תמונה — תבוא אליי, לא תסתדר לבד, ולא תיענש".

**גיל 14+**
פחות בקרה, יותר שקיפות הדדית. הסכם משפחתי כתוב על מה שקורה במקרה חירום. לימוד זיהוי פישינג, סחיטה וגרומינג — הם צריכים את הכלים, לא רק את החסימות.

**המשפט שהכי חשוב שילד ישמע**
"לא משנה מה עשית, אני איתך. לא תיענש על זה שסיפרת לי."` },

  { id:'a-evidence', dept:'other', title:'איך אוספים ראיות דיגיטליות נכון',
    sum:'צילומי מסך שמתקבלים, שמירת מטא-דאטה, ומה לא לעשות לפני שמתעדים.',
    read:5, tags:['ראיות','משטרה'],
    body:`**הכלל הראשון: לתעד לפני שחוסמים.** חסימה מסתירה לרוב את ההיסטוריה, ולפעמים מוחקת אותה.

**צילום מסך תקין כולל**
שם המשתמש המלא והמזהה, תאריך ושעה גלויים על המסך, את ההודעה בהקשר ולא מקוטעת, וקישור ישיר לפרופיל.

**מה לא לעשות**
לא לערוך את התמונה, לא לחתוך אזורים, לא להוסיף סימונים על הקובץ המקורי. אם רוצים לסמן — לעשות עותק ולסמן עליו.

**איפה לשמור**
תיקייה אחת בענן ובמכשיר, שמות קבצים בפורמט תאריך-שעה-פלטפורמה. גיבוי כפול.

**ייצוא היסטוריית שיחה**
בוואטסאפ אפשר "ייצוא צ׳אט" מתוך תפריט השיחה, וזה מפיק קובץ טקסט עם חותמות זמן — ראיה חזקה בהרבה מצילום מסך בודד.

**מתי מגישים תלונה**
כשיש איום, סחיטה, תוכן מיני של קטין או פגיעה חוזרת. פונים לתחנת משטרה, ובמצב סכנה מיידית מתקשרים ל-100. הביאו את התיעוד מסודר מראש — זה מקצר את התהליך משמעותית.` },
  { id:'a-partnership', dept:'other', sum:'SMAI פתוחה לשיתופי פעולה עם קהילות, יוצרי תוכן ומומחים. פרטים על התוכנית וכיצד להצטרף.', read:3, tags:['שיתוף פעולה','SMAI','קהילה'], title:'שיתופי פעולה עם SMAI', date:'2025-01-01', author:'צוות SMAI', body:`SMAI פתוחה לשיתופי פעולה עם קהילות, יוצרי תוכן ואנשי מקצוע בתחום ה-AI.

**מה אנחנו מחפשים?**
- קהילות פעילות בתחום הבינה המלאכותית
- יוצרי תוכן עם קהל רלוונטי
- מומחים שרוצים לשתף ידע

**מה אנחנו מציעים?**
- אזכור בפלטפורמה ובערוצי הקהילה
- גישה לכלים וחומרים בלעדיים
- תמיכה מלאה מצוות SMAI

לפרטים ויצירת קשר, פתחו פנייה ובחרו בנושא 'שיתוף פעולה'.` },
  { id:'a-trusted-reporter', dept:'other', sum:'תג מיוחד לחברי קהילה שמדווחים בצורה עקבית ואחראית. יתרונות התוכנית, קריטריונים ואיך מגישים מועמדות.', read:4, tags:['מדווח מהימן','SMAI','קהילה'], title:'מדווח מהימן — מה זה ואיך מגישים', date:'2025-01-01', author:'צוות SMAI', body:`## מה זה מדווח מהימן?

תוכנית **מדווח מהימן** של SMAI היא מסגרת מיוחדת לחברי קהילה שמדווחים על תכנים פוגעניים ברשת בצורה עקבית, מדויקת ואחראית. המטרה היא לבנות שכבת הגנה אנושית נוספת לצד הצוות המקצועי שלנו.

---

## למה להצטרף לתוכנית?

מדווחים מהימנים הם שותפים אמיתיים של SMAI — לא רק משתמשים.

**מה מקבלים:**
- **עדיפות בטיפול** — הדיווחים שלכם עולים ראשונים לתור הצוות
- **תג ✓ מדווח מהימן** לצד שמכם בכל אינטראקציה בקהילה
- **עדכוני סטטוס מהירים** — תקבלו עדכון ישיר על כל דיווח שהגשתם
- **גישה לסקירות חודשיות** — סיכומי מגמות ואיומים ברשת ישירות מהצוות
- **השפעה אמיתית** — הדיווחים שלכם עוזרים לגבש מדיניות ולשפר את הפלטפורמה

---

## מי יכול להגיש מועמדות?

אנחנו מחפשים אנשים שמאמינים בהגנה על ילדים ובני נוער ברשת.

**הקריטריונים:**
- **5 דיווחים מאושרים** לפחות שנסגרו כ"תקין" או "טופל"
- **היסטוריה נקייה** — אין דיווחי שווא או פניות שנסגרו ללא טיפול
- **חשבון פעיל** של לפחות חודש אחד
- **מחויבות** לשמור על סודיות ורגישות המידע

לא צריך להיות מומחה טכנולוגי — מספיק שאתם ערניים, אכפתיים ואחראיים.

---

## איך מגישים מועמדות?

1. **פתחו פנייה חדשה** דרך הכפתור "פתיחת פנייה" בראש האתר
2. **בחרו בנושא** "בקשת מעמד — מדווח מהימן"
3. **צרפו בגוף הפנייה:**
   - קישורים לדיווחים הקיימים שלכם (מספרי פנייה)
   - קצת על עצמכם — למה אתם מתעניינים בתחום?
   - כיצד שמעתם על SMAI?
4. **שלחו** — הצוות יחזור אליכם תוך **7 ימי עסקים**

---

## שאלות נפוצות

**האם יש עלות?**
לא. התוכנית חינמית לחלוטין.

**האם התג קבוע?**
התג ניתן לביטול במקרה של שימוש לרעה או חוסר פעילות ממושך.

**אני פחות מ-18 — אפשר להגיש?**
כן, אבל נדרש אישור הורה/אפוטרופוס בכתב כחלק מהתהליך.

**כמה זמן עד שמקבלים תשובה?**
בדרך כלל 7-5 ימי עסקים. בעונות עמוסות — עד 14 יום.

---

יש שאלות נוספות? פתחו פנייה ונשמח לענות 💙` }
];

const SEED_SERVERS = [
  { id:'s-welcome', name:'ברוכים הבאים', ico:'👋', cat:'support', desc:'נקודת הכניסה לקהילה. כאן מציגים את עצמכם ושואלים כל שאלה.', official:true },
  { id:'s-help',    name:'עזרה ראשונה',  ico:'🆘', cat:'support', desc:'שאלות דחופות שמקבלות מענה מהיר מהצוות ומהקהילה.', official:true },
  { id:'s-parents', name:'פינת ההורים',  ico:'👨‍👩‍👧', cat:'parents', desc:'הורים משתפים, שואלים ומקבלים ליווי מקצועי.', official:true },
  { id:'s-teens',   name:'נוער מדבר',    ico:'🎧', cat:'teens', desc:'מרחב לבני נוער — בלי שיפוט, עם מודרציה צמודה.', official:true },
  { id:'s-gaming',  name:'גיימינג בטוח', ico:'🎮', cat:'gaming', desc:'רובלוקס, פורטנייט, דיסקורד — מה מסוכן ואיך מגנים.', official:true },
  { id:'s-security',name:'סייבר ואבטחה', ico:'🛡️', cat:'tech', desc:'סיסמאות, פישינג, אימות דו-שלבי והגדרות פרטיות.', official:true }
];
const SEED_MSGS = [
  { server:'s-welcome', name:'צוות SMAI', rank:'head', text:'ברוכים הבאים לקהילת SMAI 💙\nכאן אנחנו נעזרים אחד בשני. שלושה כללים בלבד: מכבדים, לא חושפים פרטים אישיים, ולא שופטים אף אחד על מה שקרה לו.' },
  { server:'s-welcome', name:'מאיה', rank:'citizen', text:'היי לכולם! הגעתי לכאן אחרי שהבת שלי סיפרה לי על קבוצה בוואטסאפ. שמחה למצוא מקום כזה.' },
  { server:'s-help',    name:'צוות SMAI', rank:'agent', text:'תזכורת חשובה: אם אתם במצב דחוף — אל תחכו לתשובה בצ׳אט, פתחו דיווח דרך הכפתור למעלה. ובמצב סכנה מיידית מתקשרים למשטרה, 100.' },
  { server:'s-gaming',  name:'יונתן', rank:'citizen', text:'שאלה — הבן שלי בן 11 משחק רובלוקס. יש הגדרה שמכבה צ׳אט עם זרים לגמרי?' },
  { server:'s-gaming',  name:'רוני',  rank:'senior', text:'בהחלט. בהגדרות החשבון ← Privacy, מגדירים את "Who can chat with me" ל-No one או Friends. בנוסף כדאי להפעיל חשבון עם פיקוח הורי (Account PIN) כדי שלא ישנה את זה בחזרה.' },
  { server:'s-security',name:'צוות SMAI', rank:'lead', text:'הטיפ הכי משתלם השבוע: מנהל סיסמאות + אימות דו-שלבי באפליקציה (לא SMS). שתי פעולות שלוקחות 10 דקות ומונעות את רוב הפריצות שאנחנו רואים.' }
];

/* ===================== רכיבים משותפים ===================== */
const NAV = [
  { p:'/',          l:'ראשי',        ico:'home' },
  { p:'/report',    l:'פתיחת דיווח', ico:'shield-alert' },
  { p:'/my',        l:'הפניות שלי',  ico:'file' },
  { p:'/track',     l:'מעקב פנייה',  ico:'search' },
  { p:'/articles',  l:'מדריכים ומאמרים', ico:'book' },
  { p:'/press',     l:'עובדות',      ico:'info' },
  { p:'/dm',        l:'הודעות פרטיות', ico:'send' },
  { p:'/friends',   l:'חברים',       ico:'users' },
  { p:'/community', l:'קהילה',       ico:'message' },
  { p:'/team-praise', l:'מילה טובה', ico:'heart' },
  { p:'/partners', l:'שיתופי פעולה', ico:'link' },
  { p:'/improve',   l:'באגים והצעות', ico:'sparkle' },
  { p:'/join',      l:'הצטרפות לצוות', ico:'users' }
];
const NAV_EN={'/':'Home','/report':'New report','/my':'My cases','/track':'Track case','/articles':'Guides & articles','/press':'Facts','/dm':'Direct messages','/friends':'Friends','/community':'Community','/team-praise':'Kind words','/join':'Join the team','/partners':'Partners & resources','/improve':'Bugs & suggestions'};
const currentLang=()=>localStorage.getItem('smai_lang')==='en'?'en':'he';
function renderNav(){
  const cur = location.pathname.split('/')[1] || '';
  const items = NAV.map(n=>{
    const on = ('/'+cur) === n.p || (n.p==='/' && !cur);
    const label=currentLang()==='en'?(NAV_EN[n.p]||n.l):n.l;return `<a href="${n.p}" class="${on?'on':''}" title="${label}" ${on?'aria-current="page"':''}>${ic(n.ico,18)}<span>${label}</span></a>`;
  });
  if(Auth.isStaff()) items.push(`<a href="/admin" class="${cur==='admin'?'on':''}">${ic('shield',14)} פאנל צוות</a>`);
  $('#nav').innerHTML = `<form id="userQuickSearch" class="nav-user-search" role="search"><input id="userQuickName" aria-label="חיפוש משתמש לפי שם מדויק" placeholder="חיפוש שם משתמש מדויק"><button class="iconbtn" aria-label="חיפוש">${ic('search',15)}</button></form>`+items.join('');
  $('#userQuickSearch').onsubmit=async e=>{e.preventDefault();const q=$('#userQuickName').value.trim().toLocaleLowerCase('he');if(!q)return;const users=await Store.list('users');const found=users.find(x=>String(x.name||'').trim().toLocaleLowerCase('he')===q);if(!found)return toast('לא נמצא משתמש בשם המדויק הזה','warn');openProfile(found.id);};
  const u = Auth.user;
  $('#authSlot').innerHTML = u
    ? `<button class="iconbtn" id="meBtn" title="${esc(u.name||u.email)}" style="width:auto;padding:0 6px;gap:7px;display:flex">
         ${avatar(u,'s')}<span class="hide-sm" style="font-size:.84rem;font-weight:700;padding-inline-end:4px">${esc((u.name||u.email).split(' ')[0])}</span>
       </button>`
    : `<a class="btn btn-p btn-sm" href="/login">${ic('login',15)} כניסה</a>`;
  const topAccount=$('#topAccount');
  if(topAccount){topAccount.href=u?'/account':'/login';topAccount.textContent=currentLang()==='en'?(u?'My account':'Sign in'):(u?'החשבון שלי':'כניסה');}
  const mb = $('#meBtn'); if(mb) mb.onclick = userMenu;
  const notifications=$('#notifBtn');
  if(notifications)notifications.classList.toggle('hide',!u);
  syncNotificationBadge();
}
function userMenu(){
  const u = Auth.user; if(!u) return;
  const r = RANKS[u.rank]||RANKS.citizen;
  openModal(`
    <div class="m-h">${avatar(u,'l')}<div style="flex:1"><h3 style="margin:0">${esc(u.name||'משתמש')}</h3>
      <div class="small mute">${esc(u.email||'')}</div>
      <div style="margin-top:5px">${rankBadge(u.rank)} ${u.dept?`<span class="b b-gray">${esc(DEPT_BY[u.dept]?.short||u.dept)}</span>`:''}</div></div></div>
    <div class="m-b" style="padding:12px">
      <div class="stack" style="gap:4px">
        <a class="ch" href="/account" onclick="closeModal()">${ic('user',17)}<span class="nm">החשבון שלי</span></a>
        <a class="ch" href="/my" onclick="closeModal()">${ic('file',17)}<span class="nm">הפניות שלי</span></a>
        ${Auth.isStaff()?`<a class="ch" href="/admin" onclick="closeModal()">${ic('shield',17)}<span class="nm">פאנל צוות</span></a>`:''}
        ${Auth.can('siteConfig')?`<a class="ch" href="/setup" onclick="closeModal()">${ic('settings',17)}<span class="nm">הגדרות מערכת</span></a>`:''}
        <button class="ch" id="loBtn" style="width:100%;text-align:start;border:0;background:none;font:inherit;color:var(--danger)">${ic('logout',17)}<span class="nm">התנתקות</span></button>
      </div>
    </div>`);
  $('#loBtn').onclick = async ()=>{ await Auth.signOut(); closeModal(); toast('התנתקת מהמערכת'); location.hash = '#/'; render(); };
}
function renderFooter(){
  $('#footer').innerHTML = `<div class="wrap">
    <div class="emerg">
      <div class="row" style="gap:9px;font-weight:800">${ic('phone',17)} במצב סכנה מיידית אל תחכו לתשובה כאן — התקשרו למשטרה</div>
      <div class="nums">
        <span class="big">משטרת ישראל <a href="tel:100">100</a></span>
        <span class="small mute" style="font-weight:600">SMAI אינו גוף חירום ואינו תחליף למשטרה</span>
      </div>
    </div>
    <div class="fgrid">
      <div>
        <div class="logo" style="margin-bottom:11px"><span class="mark">${ic('shield',20)}</span><span>SMAI<small>הגנה על ילדים ברשת</small></span></div>
        <p class="small mute" style="max-width:42ch">${esc(SITE.tagline)}. אנחנו לא גוף ממשלתי ולא מחליפים משטרה או טיפול מקצועי — אנחנו הצעד הראשון, ומלווים משם הלאה.</p>
      </div>
      <div><h4>דיווח</h4><ul>
        <li><a href="/report">פתיחת דיווח חדש</a></li><li><a href="/track">מעקב לפי קוד</a></li>
        <li><a href="/my">הפניות שלי</a></li></ul></div>
      <div><h4>ידע</h4><ul>
        <li><a href="/articles">מדריכים ומאמרים</a></li><li><a href="/community">קהילה</a></li>
        <li><a href="/join">הצטרפות לצוות</a></li></ul></div>
      <div><h4>מידע</h4><ul>
        <li><a href="/about-smai.html">מה זה SMAI Sentinel?</a></li>
        <li><a href="/terms">תנאי שימוש</a></li><li><a href="/privacy">מדיניות פרטיות</a></li>
        <li><a href="/report">יצירת קשר</a></li>
        </ul></div>
    </div>
    <div class="fbot"><span>© ${new Date().getFullYear()} SMAI. כל הזכויות שמורות.</span>
      <span>SENTINEL / 02 · נבנה בישראל</span></div>
  </div>`;
}
/* גילוי בגלילה */
let IO = null;
function initReveal(){
  IO?.disconnect();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){$$('.reveal').forEach(el=>el.classList.add('seen'));return;}
  $$('main .btn, main .card, main .srv-card').forEach(el=>{if(el.getBoundingClientRect().top>innerHeight)el.classList.add('scroll-reveal');});
  IO = new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('seen'); IO.unobserve(e.target); } }),
    { threshold:.08, rootMargin:'0px 0px -40px' });
  $$('.reveal,.scroll-reveal').forEach(el=>IO.observe(el));
}
/* קיצורי UI */
function statusBadge(s){ const x = STATUS[s]||STATUS.new; return `<span class="b ${x.b}">${x.l}</span>`; }
function prioBadge(p){ const x = PRIO[p]||PRIO.normal; return `<span class="b ${x.b}">${p==='critical'?'⚠ ':''}${x.l}</span>`; }
function deptBadge(d){ const x = DEPT_BY[d]||DEPT_BY.other; return `<span class="b b-${x.cls}">${x.short}</span>`; }
function emptyState(icon, title, sub, cta){
  return `<div class="empty"><div class="ico">${ic(icon,30)}</div><h3 style="margin-bottom:5px">${esc(title)}</h3>
    <p style="max-width:44ch;margin:0 auto 16px">${esc(sub)}</p>${cta||''}</div>`;
}
function loader(txt='טוען'){ return `<div class="stack" style="gap:12px">
  <div class="skel" style="height:22px;width:40%"></div>
  <div class="skel" style="height:80px"></div><div class="skel" style="height:80px"></div><div class="skel" style="height:80px"></div></div>`; }
function requireLogin(msg='צריך להתחבר כדי להמשיך'){
  return `<div class="card center" style="max-width:460px;margin:50px auto">
    <div class="ico-tile i-brand" style="margin:0 auto 14px;width:56px;height:56px">${ic('lock',24)}</div>
    <h2 style="font-size:1.35rem">${esc(msg)}</h2>
    <p class="mute">ההתחברות מאפשרת לעקוב אחרי הפניות שלך, להשתתף בקהילה ולקבל עדכונים.</p>
    <a class="btn btn-p btn-block" href="/login">${ic('login',17)} כניסה או הרשמה</a></div>`;
}

/* ===================== ראוטר ===================== */
const ROUTES = {};


/* ===================== חברים ===================== */
route('/friends', async (app)=>{
  if(!Auth.user) return app.innerHTML = requireLogin('צריך להתחבר כדי לנהל חברים');
  if(Auth.banInfo()) return renderBanned(app);
  const me = Auth.user;

  app.innerHTML = `
  <div class="page-h anim-up"><div class="eyebrow">${ic('users',13)} קהילה</div><h1>החברים שלי</h1>
    <p>בקשות חברות, רשימת חברים וחסימות. חברים יכולים לפתוח איתכם צ׳אט פרטי ולהוסיף אתכם לקבוצות.</p></div>
  <div class="tabs anim-up d1" id="frTabs">
    <button data-t="all" class="on">${ic('users',15)} חברים <span class="pill" id="cFr">0</span></button>
    <button data-t="in">${ic('bell',15)} בקשות שהתקבלו <span class="pill" id="cIn">0</span></button>
    <button data-t="out">${ic('send',15)} בקשות שנשלחו <span class="pill" id="cOut">0</span></button>
    <button data-t="find">${ic('search',15)} חיפוש אנשים</button>
    <button data-t="block">${ic('ban',15)} חסומים</button>
  </div>
  <div id="frBody" class="anim-up d2">${loader()}</div>`;

  let users = [], rels = [];
  let tab = 'all';

  const nameOf = uid => (users.find(u=>u.id===uid)||{}).name || 'משתמש';
  const userOf = uid => users.find(u=>u.id===uid) || { id:uid, name:'משתמש' };

  async function load(){
    [users, rels] = await Promise.all([Store.list('users'), Friends.mine(me.id)]);
    const fr  = rels.filter(r=>r.status==='accepted');
    const inc = rels.filter(r=>r.status==='pending' && r.to===me.id);
    const out = rels.filter(r=>r.status==='pending' && r.from===me.id);
    const set = (id,v)=>{ const e=$(id); if(e) e.textContent = String(v); };
    set('#cFr', fr.length); set('#cIn', inc.length); set('#cOut', out.length);
    return { fr, inc, out, blk: rels.filter(r=>r.status==='blocked') };
  }

  function card(u, extra){
    return `<div class="fr-card">
      <span class="fr-av" onclick="openProfile('${jsq(u.id)}')">${avatar(u,'m')}</span>
      <div class="fr-mid">
        <div class="row" style="gap:6px"><b>${esc(u.name||'משתמש')}</b>
          ${u.verified&&u.privacy?.showVerified!==false?`<span class="verified">${ic('check',9,3)}</span>`:''}${rankBadge(u.rank)}</div>
        <div class="tiny mute">${esc(String(u.bio||'').slice(0,70) || 'חבר/ת קהילה')}</div>
      </div>
      <div class="fr-act">${extra}</div>
    </div>`;
  }

  async function paint(){
    const d = await load();
    const b = $('#frBody'); if(!b) return;

    if(tab==='all'){
      b.innerHTML = d.fr.length ? `<div class="fr-grid">${d.fr.map(r=>{
        const other = r.a===me.id ? r.b : r.a;
        return card(userOf(other), `
          <button class="btn btn-p btn-xs" data-a="dm" data-i="${other}">${ic('message',13)} צ׳אט</button>
          <button class="btn btn-g btn-xs" data-a="rm" data-i="${r.id}" title="הסרת חבר">${ic('user-x',13)}</button>`);
      }).join('')}</div>` : emptyState('users','עדיין אין חברים','חפשו אנשים בלשונית «חיפוש אנשים» ושלחו בקשה.');
    }
    else if(tab==='in'){
      b.innerHTML = d.inc.length ? `<div class="fr-grid">${d.inc.map(r=>card(userOf(r.from), `
          <button class="btn btn-p btn-xs" data-a="ok" data-i="${r.id}">${ic('check',13)} אישור</button>
          <button class="btn btn-g btn-xs" data-a="no" data-i="${r.id}">${ic('x',13)} דחייה</button>`)).join('')}</div>`
        : emptyState('bell','אין בקשות ממתינות','כשמישהו ישלח בקשת חברות היא תופיע כאן.');
    }
    else if(tab==='out'){
      b.innerHTML = d.out.length ? `<div class="fr-grid">${d.out.map(r=>card(userOf(r.to), `
          <span class="b b-gray">${ic('clock',11)} ממתין</span>
          <button class="btn btn-g btn-xs" data-a="no" data-i="${r.id}">ביטול</button>`)).join('')}</div>`
        : emptyState('send','לא שלחתם בקשות','');
    }
    else if(tab==='block'){
      const mine = d.blk.filter(r=>r.by===me.id);
      b.innerHTML = mine.length ? `<div class="fr-grid">${mine.map(r=>{
        const other = r.a===me.id ? r.b : r.a;
        return card(userOf(other), `<button class="btn btn-g btn-xs" data-a="unb" data-i="${r.id}">הסרת חסימה</button>`);
      }).join('')}</div>` : emptyState('ban','אין משתמשים חסומים','');
    }
    else {
      b.innerHTML = `<div class="card">
        <div class="field" style="margin:0"><label class="fl">${ic('search',14)} חיפוש לפי שם או תיאור</label>
          <input type="text" id="frQ" placeholder="הקלידו שם..." autocomplete="off"></div>
        <div id="frRes" style="margin-top:14px"></div></div>`;
      const res = ()=>{
        const q = String($('#frQ')?.value||'').trim().toLowerCase();
        const pool = users.filter(u=>u.id!==me.id && !u.banned)
          .filter(u=>!q || String(u.name||'').toLowerCase().includes(q) || String(u.bio||'').toLowerCase().includes(q))
          .slice(0,24);
        $('#frRes').innerHTML = pool.length ? `<div class="fr-grid">${pool.map(u=>{
          const st = Friends.status(rels, me.id, u.id);
          const btn = st==='friends' ? `<span class="b b-ok">${ic('check',11)} חברים</span>`
            : st==='sent' ? `<span class="b b-gray">בקשה נשלחה</span>`
            : st==='incoming' ? `<button class="btn btn-p btn-xs" data-a="okp" data-i="${u.id}">${ic('check',13)} אישור הבקשה</button>`
            : st==='blocked-by-me' ? `<span class="b b-dang">חסום</span>`
            : st==='blocked-me' ? `<span class="b b-gray">לא זמין</span>`
            : `<button class="btn btn-p btn-xs" data-a="add" data-i="${u.id}">${ic('plus',13)} הוספה</button>`;
          return card(u, btn + `<button class="btn btn-g btn-xs" data-a="prof" data-i="${u.id}">פרופיל</button>`);
        }).join('')}</div>` : `<p class="mute small" style="margin:0">לא נמצאו משתמשים.</p>`;
        wire();
      };
      const qi = $('#frQ'); if(qi){ qi.oninput = debounce(res, 220); }
      res();
    }
    wire();
  }

  function wire(){
    $$('#frBody [data-a]').forEach(btn=>{
      btn.onclick = async ()=>{
        const a = btn.dataset.a, i = btn.dataset.i;
        btn.disabled = true;
        try{
          if(a==='dm'){ const c = await openDM(i, nameOf(i)); if(c) location.hash = '#/dm/'+c.id; return; }
          if(a==='prof'){ openProfile(i); btn.disabled=false; return; }
          if(a==='add'){ await Friends.request(i, nameOf(i)); toast('בקשת חברות נשלחה'); }
          if(a==='okp'){ const r = Friends.rel(rels, me.id, i); if(r) await Friends.accept(r.id); toast('הבקשה אושרה'); }
          if(a==='ok'){ await Friends.accept(i); toast('הבקשה אושרה'); }
          if(a==='no'){ await Friends.decline(i); toast('הבקשה הוסרה','ok',1800,true); }
          if(a==='rm'){ if(!(await confirmBox('הסרת חבר','להסיר את המשתמש מרשימת החברים?','הסרה',true))){ btn.disabled=false; return; } await Friends.remove(i); }
          if(a==='unb'){ await Friends.unblock(i); }
        }catch(e){ toast(e.message || 'הפעולה נכשלה','err'); }
        paint();
      };
    });
  }

  $$('#frTabs button').forEach(t=>{
    t.onclick = ()=>{ $$('#frTabs button').forEach(x=>x.classList.remove('on')); t.classList.add('on');
      tab = t.dataset.t; Sfx.play('tick'); paint(); };
  });
  onCleanup(Store.watch('friends', ()=>paint()));
  paint();
});




/* קישורים בטוחים בתוך טקסט: מסננים קודם, מקשרים אחר כך */
function linkify(txt){
  const safe = esc(String(txt==null?'':txt));
  if(Auth.user?.ageBand==='under10'&&Auth.user?.rank!=='founder')return safe.replace(/https?:\/\/[^\s<]{4,300}/g,'[קישור מוסתר בחשבון מוגן]');
  return safe.replace(/(https?:\/\/[^\s<]{4,300})/g, (u)=>{
    const clean = u.replace(/[.,;:!?)]+$/,'');
    const tail = u.slice(clean.length);
    return `<a href="${clean}" target="_blank" rel="noopener noreferrer nofollow" class="msg-link">${clean}</a>${tail}`;
  }).replace(/@([֐-׿a-zA-Z0-9_.\-]{2,30})/g, '<span class="mention">@$1</span>');
}
window.linkify = linkify;
function campaignRichText(txt){return esc(String(txt||'')).replace(/\[([^\]]{1,80})\]\((https:\/\/[^\s)]+)\)/g,(_,label,url)=>`<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`).replace(/\n/g,'<br>');}

/* ===================== ניהול ערוצים ===================== */
function channelModal(srv, existing){
  const e = existing || {};
  openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('hash',20)}</span>
    <div style="flex:1"><h3 style="margin:0">${existing?'עריכת ערוץ':'ערוץ חדש'}</h3>
    <div class="tiny mute">בשרת ${esc(srv.name)}</div></div></div>
  <div class="m-b">
    <div class="field"><label class="fl">שם הערוץ</label>
      <input id="cnName" maxlength="40" value="${esc(e.name||'')}" placeholder="לדוגמה: שאלות-הורים"></div>
    <div class="field"><label class="fl">סוג הערוץ</label>
      <div class="stack" style="gap:8px">
        ${CH_KINDS.map((k,i)=>`<label class="opt ${((e.kind||'text')===k.id)?'on':''}" data-k="${k.id}">
          <div class="row between"><b style="font-size:.92rem">${ic(k.ico,14)} ${esc(k.l)}</b>
            <input type="radio" name="cnk" value="${k.id}" ${((e.kind||'text')===k.id)?'checked':''} style="accent-color:var(--brand)"></div>
          <div class="tiny mute">${esc(k.d)}</div></label>`).join('')}
      </div></div>
    <div class="field"><label class="fl">תיאור קצר (לא חובה)</label>
      <input id="cnDesc" maxlength="120" value="${esc(e.desc||'')}"></div>
    <label class="check"><input type="checkbox" id="cnStaff" ${e.staffOnly?'checked':''}>
      <span><span class="t">ערוץ לצוות בלבד</span><span class="d">רק אנשי צוות יראו אותו ברשימה.</span></span></label>
    <div id="cnErr"></div>
  </div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
    <button class="btn btn-p" id="cnGo">${ic('check',15)} שמירה</button></div>`);

  $$('#modal .opt').forEach(o=>o.onclick = ()=>{
    $$('#modal .opt').forEach(x=>x.classList.remove('on')); o.classList.add('on');
    o.querySelector('input').checked = true;
  });
  $('#cnGo').onclick = async ()=>{
    const name = $('#cnName').value.trim();
    if(name.length < 2) return $('#cnErr').innerHTML = '<div class="err">שם הערוץ קצר מדי</div>';
    const rec = { server:srv.id, name, kind: $('#modal input[name=cnk]:checked')?.value || 'text',
      desc: $('#cnDesc').value.trim(), staffOnly: $('#cnStaff').checked, pos: 50 };
    $('#cnGo').disabled = true;
    try{
      if(existing) await Store.update('channels', existing.id, rec);
      else await Store.add('channels', { ...rec, ownerId:Auth.user?.id, createdAt:nowISO() });
      closeModal(); Sfx.play('success'); toast('הערוץ נשמר'); render();
    }catch(err){ $('#cnErr').innerHTML = `<div class="err">${esc(err.message||'שגיאה')}</div>`; $('#cnGo').disabled = false; }
  };
}

/* ===================== שרשור חדש בפורום ===================== */
function threadModal(srv, ch){
  openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('book',20)}</span>
    <div style="flex:1"><h3 style="margin:0">שרשור חדש</h3>
    <div class="tiny mute">${esc(srv.name)} / ${esc(ch.name)}</div></div></div>
  <div class="m-b">
    <div class="field"><label class="fl">נושא השרשור</label>
      <input id="thT" maxlength="120" placeholder="על מה רוצים לדבר?"></div>
    <div class="field"><label class="fl">תוכן</label>
      <textarea id="thB" maxlength="${CFG.get('threadMaxLen')}" style="min-height:150px" placeholder="פרטו את השאלה או הנושא..."></textarea></div>
    <div class="tiny mute">${ic('shield-check',11)} התוכן נסרק אוטומטית. אל תשתפו פרטים מזהים של קטינים.</div>
    <div id="thErr"></div>
  </div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
    <button class="btn btn-p" id="thGo">${ic('send',15)} פרסום</button></div>`);

  $('#thGo').onclick = async ()=>{
    const me = Auth.user; if(!me) return;
    const title = $('#thT').value.trim(), body = $('#thB').value.trim();
    if(title.length < 4) return $('#thErr').innerHTML = '<div class="err">נושא קצר מדי</div>';
    if(body.length < 10) return $('#thErr').innerHTML = '<div class="err">כתבו קצת יותר כדי שנוכל לעזור</div>';
    const mod = moderate(title + ' ' + body);
    if(mod.violation && mod.severity >= 3){
      Sfx.play('error');
      return $('#thErr').innerHTML = '<div class="err">התוכן נחסם — הוא מפר את כללי הקהילה. אם אתם במצוקה, פתחו דיווח.</div>';
    }
    $('#thGo').disabled = true;
    try{
      const t = await Store.add('threads', { server:srv.id, channel:ch.id, title, body,
        authorId:me.id, authorName:me.name||me.email, authorRank:me.rank,
        flagged:mod.violation, replies:0, pinned:false, locked:false,
        lastAt:nowISO(), createdAt:nowISO() });
      closeModal(); Sfx.play('success'); toast('השרשור פורסם');
      location.hash = `#/server/${srv.id}/${encodeURIComponent(ch.id)}/${t.id}`;
    }catch(e){ $('#thErr').innerHTML = `<div class="err">${esc(e.message||'שגיאה')}</div>`; $('#thGo').disabled = false; }
  };
}

/* ===================== חברי שרת והזמנות ===================== */
function serverMembersModal(srv, users){
  const mem = srv.seed ? users.slice(0,40) : (srv.members||[]).map(i=>users.find(u=>u.id===i)||{id:i,name:'משתמש'});
  const manage = Servers.canManage(srv, Auth.user);
  openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('users',20)}</span>
    <div style="flex:1"><h3 style="margin:0">חברי ${esc(srv.name)}</h3>
    <div class="tiny mute">${mem.length} משתתפים${srv.seed?' · שרת רשמי פתוח לכולם':''}</div></div></div>
  <div class="m-b">
    ${!srv.seed && srv.invite ? `<div class="callout c-info" style="margin-bottom:14px"><span class="ic">${ic('link',18)}</span>
      <div>קוד הזמנה לשרת: <b class="mono">${esc(srv.invite)}</b>
      <button class="btn btn-ghost btn-xs" onclick="copyText('${jsq(srv.invite)}')">${ic('copy',12)} העתקה</button></div></div>`:''}
    <div class="stack" style="gap:7px;max-height:340px;overflow:auto">
      ${mem.map(u=>`<div class="fr-card" style="padding:9px 11px">
        ${avatar(u,'s')}<div class="fr-mid"><b>${esc(u.name||'משתמש')}</b>
        <div class="tiny mute">${srv.ownerId===u.id?'בעל/ת השרת':(srv.admins||[]).includes(u.id)?'מנהל/ת':'חבר/ה'}</div></div>
        <div class="fr-act">
          <button class="btn btn-g btn-xs" data-p="${u.id}">פרופיל</button>
          ${manage && u.id!==srv.ownerId && !srv.seed ? `<button class="btn btn-g btn-xs" data-k="${u.id}">הרחקה</button>`:''}
        </div></div>`).join('') || '<p class="tiny mute">אין עדיין חברים בשרת.</p>'}
    </div>
  </div>
  <div class="m-f"><button class="btn btn-p" onclick="closeModal()">סגירה</button></div>`);
  $$('#modal [data-p]').forEach(b=>b.onclick = ()=>{ closeModal(); openProfile(b.dataset.p); });
  $$('#modal [data-k]').forEach(b=>b.onclick = async ()=>{
    if(!(await confirmBox('הרחקה מהשרת','המשתמש לא יוכל לכתוב בשרת עד שיצטרף מחדש.','הרחקה',true))) return;
    await Store.update('servers', srv.id, { members:(srv.members||[]).filter(x=>x!==b.dataset.k) });
    closeModal(); toast('המשתמש הורחק'); render();
  });
}

function serverSettingsModal(srv){
  openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('settings',20)}</span><h3>הגדרות ${esc(srv.name)}</h3></div>
  <div class="m-b">
    <div class="grid g2" style="gap:12px">
      <div class="field" style="margin:0"><label class="fl">שם השרת</label>
        <input id="ssName" maxlength="50" value="${esc(srv.name||'')}"></div>
      <div class="field" style="margin:0"><label class="fl">אימוג׳י</label>
        <input id="ssIco" maxlength="4" value="${esc(srv.ico||'💬')}"></div>
    </div>
    <div class="field"><label class="fl">תיאור</label>
      <textarea id="ssDesc" maxlength="200" style="min-height:70px">${esc(srv.desc||'')}</textarea></div>
    <label class="check"><input type="checkbox" id="ssPriv" ${srv.private?'checked':''}>
      <span><span class="t">שרת פרטי</span><span class="d">נדרש קוד כניסה. השרת לא יופיע לזרים.</span></span></label>
    <div class="field" style="margin-top:10px"><label class="fl">קוד כניסה</label>
      <input id="ssCode" class="mono" maxlength="12" value="${esc(srv.code||'')}"></div>
    <div class="field"><label class="fl">קוד הזמנה</label>
      <div class="row" style="gap:6px"><input id="ssInv" class="mono" readonly value="${esc(srv.invite||'')}">
        <button class="btn btn-g btn-sm" id="ssNewInv">${ic('refresh',14)} חדש</button></div></div>
    <div id="ssErr"></div>
  </div>
  <div class="m-f">
    ${!srv.seed && (srv.ownerId===Auth.user?.id || Auth.can('manageServers'))
      ? `<button class="btn btn-d" id="ssDel">${ic('trash',15)} מחיקת השרת</button>`:''}
    <button class="btn btn-g" onclick="closeModal()">ביטול</button>
    <button class="btn btn-p" id="ssGo">${ic('check',15)} שמירה</button></div>`);

  $('#ssNewInv').onclick = ()=>{ $('#ssInv').value = Servers.newInvite(); };
  $('#ssGo').onclick = async ()=>{
    if(srv.seed) return $('#ssErr').innerHTML = '<div class="err">שרתים רשמיים לא ניתנים לעריכה</div>';
    $('#ssGo').disabled = true;
    try{
      await Store.update('servers', srv.id, { name:$('#ssName').value.trim()||srv.name,
        ico:$('#ssIco').value.trim()||'💬', desc:$('#ssDesc').value.trim(),
        private:$('#ssPriv').checked, code:$('#ssCode').value.trim(), invite:$('#ssInv').value.trim() });
      closeModal(); Sfx.play('success'); toast('ההגדרות נשמרו'); render();
    }catch(e){ $('#ssErr').innerHTML = `<div class="err">${esc(e.message||'שגיאה')}</div>`; $('#ssGo').disabled = false; }
  };
  const d = $('#ssDel'); if(d) d.onclick = async ()=>{
    if(!(await confirmBox('מחיקת השרת', `למחוק את <b>${esc(srv.name)}</b>? ההודעות נשמרות בארכיון אבל השרת ייעלם.`,'מחיקה',true))) return;
    await Store.remove('servers', srv.id); closeModal(); toast('השרת נמחק'); location.hash = '#/community';
  };
}


/* ===================== גיבוי ושמירת נתונים ===================== */
/* כל האוספים של האתר. משמש לייצוא, לגיבוי אוטומטי ולשחזור. */
const ALL_COLS = ['tickets','messages','reports','applications','users','appeals','modlog',
  'verifyApps','mail','servers','channels','threads','tmsgs','cmsgs','dms','dmsgs','friends','config'];

const Backup = {
  KEY: 'smai_backup_last',
  async snapshot(){
    const out = { version: 3, at: nowISO(), site: location.origin + location.pathname, cols: {} };
    for(const c of ALL_COLS){
      out.cols[c] = await Store.list(c);
    }
    /* לא מוציאים סיסמאות או קודי אימות החוצה */
    out.cols.users = (out.cols.users||[]).map(u=>({ ...u, pass:undefined, passHash:undefined, otp:undefined, otpAt:undefined }));
    out.counts = Object.fromEntries(Object.entries(out.cols).map(([k,v])=>[k, v.length]));
    return out;
  },
  async download(){
    const snap = await this.snapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `smai-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 6000);
    localStorage.setItem(this.KEY, nowISO());
    Sfx.play('success');
    return snap;
  },
  /* גיבוי אוטומטי שקט לאחסון המקומי — רשת ביטחון אם המסד לא זמין */
  async auto(){
    if(CFG.get('autoBackup') === false) return;
    const last = localStorage.getItem(this.KEY+'_auto');
    if(last && (Date.now() - new Date(last).getTime()) < 6*3600*1000) return;
    try{
      const snap = await this.snapshot();
      const json = JSON.stringify(snap);
      if(json.length < 4_000_000) localStorage.setItem('smai_backup_auto', json);
      localStorage.setItem(this.KEY+'_auto', nowISO());
    }catch(e){}
  },
  lastAuto(){ return localStorage.getItem(this.KEY+'_auto'); },
  hasAuto(){ return !!localStorage.getItem('smai_backup_auto'); },
  downloadAuto(){
    const j = localStorage.getItem('smai_backup_auto');
    if(!j) return toast('אין גיבוי אוטומטי שמור','warn');
    const blob = new Blob([j], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'smai-backup-auto.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 6000);
  },
  /* שחזור: מוסיף רשומות חסרות בלבד, אף פעם לא מוחק */
  async restore(json, cols){
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if(!data || !data.cols) throw new Error('קובץ גיבוי לא תקין');
    let added = 0;
    for(const c of (cols || Object.keys(data.cols))){
      const rows = data.cols[c] || [];
      if(!rows.length) continue;
      const cur = await Store.list(c).catch(()=>[]);
      const have = new Set(cur.map(x=>x.id));
      for(const r of rows){
        if(!r.id || have.has(r.id)) continue;
        const { id, ...rest } = r;
        await Store.set(c, id, rest);
        added++;
      }
    }
    return added;
  }
};
window.Backup = Backup;

/* ארכיון הודעות: כל מחיקה היא הסתרה בלבד, הטקסט נשמר */
async function archiveCount(){
  const [c, t] = await Promise.all([Store.list('cmsgs').catch(()=>[]), Store.list('tmsgs').catch(()=>[])]);
  return c.filter(x=>x.deleted).length + t.filter(x=>x.deleted).length;
}

/* ===================== הגדרות אתר משותפות ===================== */
/* נשמרות במסד (כדי שכל המשתמשים יראו אותן) עם מטמון מקומי לטעינה מהירה */
const CFG_DEFAULT = {
  serverCreate: 'staff',   // מי רשאי לפתוח שרת: staff | verified | all
  chatMaxLen: 2000,
  threadMaxLen: 4000,
  autoBackup: true
};
const CFG = {
  _v: null,
  cache(){
    if(this._v) return this._v;
    try{ this._v = { ...CFG_DEFAULT, ...JSON.parse(localStorage.getItem('smai_cfg')||'{}') }; }
    catch(e){ this._v = { ...CFG_DEFAULT }; }
    return this._v;
  },
  get(k){ return this.cache()[k]; },
  async load(){
    try{
      const rows = await Store.list('config');
      const row = rows.find(r=>r.id==='site');
      if(row){ this._v = { ...CFG_DEFAULT, ...row }; localStorage.setItem('smai_cfg', JSON.stringify(this._v)); }
    }catch(e){}
    return this.cache();
  },
  async set(patch){
    await Store.set('config','site',patch);
    this._v={...this.cache(),...patch};
    return this._v;
  }
};
window.CFG = CFG;

/* ===================== ערוצים, פורומים וחברות בשרת ===================== */
const CH_KINDS = [
  { id:'text',  l:'ערוץ טקסט',  ico:'hash',    d:'שיחה רציפה בזמן אמת.' },
  { id:'forum', l:'ערוץ פורום', ico:'book',    d:'שרשורים עם נושא, כל אחד עם דיון משלו.' },
  { id:'ann',   l:'ערוץ הכרזות', ico:'bell',   d:'רק בעלי הרשאה כותבים. כולם קוראים.' }
];
const CH_KIND_BY = Object.fromEntries(CH_KINDS.map(k=>[k.id,k]));

/* לכל שרת יש ערוץ ברירת מחדל וירטואלי, כדי שהודעות ישנות לא ילכו לאיבוד */
const DEFAULT_CH = sid => ({ id:'gen:'+sid, server:sid, name:'כללי', kind:'text',
  desc:'ערוץ ברירת המחדל של השרת', virtual:true, pos:0 });

const Servers = {
  async all(){
    const custom = await Store.list('servers').catch(()=>[]);
    return [...SEED_SERVERS.map(x=>({ ...x,...custom.find(c=>c.id===x.id), members:custom.find(c=>c.id===x.id)?.members||[], seed:true })), ...custom.filter(c=>!SEED_SERVERS.some(s=>s.id===c.id))];
  },
  async channels(sid){
    const list = (await Store.list('channels').catch(()=>[])).filter(c=>c.server===sid);
    const arr = [DEFAULT_CH(sid), ...list];
    return arr.sort((a,b)=>(a.pos??50)-(b.pos??50) || String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  },
  isMember(srv, uid){ return !!uid && (srv.official || (srv.members||[]).includes(uid) || srv.ownerId === uid); },
  roleOf(srv, u){
    if(!u) return 'guest';
    if(srv.ownerId === u.id) return 'owner';
    if((srv.admins||[]).includes(u.id)) return 'admin';
    if(isStaffUser(u)) return 'staff';
    return this.isMember(srv, u.id) ? 'member' : 'guest';
  },
  canManage(srv, u){
    const r = this.roleOf(srv, u);
    return r === 'owner' || r === 'admin' || (isStaffUser(u) && can(u,'manageServers'));
  },
  canPost(srv, ch, u){
    if(!u) return false;
    if(ch?.kind === 'ann') return this.canManage(srv, u);
    if(ch?.staffOnly) return isStaffUser(u);
    return true;
  },
  newInvite(){ return Array.from({length:6}, ()=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[crypto.getRandomValues(new Uint8Array(1))[0]%31]).join(''); },
  async join(srv){
    const me = Auth.user; if(!me) throw new Error('צריך להתחבר');
    if(srv.seed) return true;
    if((srv.members||[]).includes(me.id)) return true;
    await Store.update('servers', srv.id, { members: [...(srv.members||[]), me.id] });
    Sfx.play('join');
    return true;
  },
  async leave(srv){
    const me = Auth.user; if(!me || srv.seed) return;
    await Store.update('servers', srv.id, { members: (srv.members||[]).filter(x=>x!==me.id) });
    Sfx.play('leave');
  }
};
window.Servers = Servers;

/* מי רשאי לפתוח שרת — נשלט מהגדרות האתר */
function canCreateServer(u){
  if(!u) return false;
  const mode = (CFG.get('serverCreate') || 'staff');
  if(mode === 'all') return true;
  if(mode === 'verified') return !!u.verified || isStaffUser(u);
  return isStaffUser(u) && can(u, 'manageServers');
}

/* ===================== שכבה חברתית: חברים, בקשות, חסימות ===================== */
/* מפתח יציב לזוג משתמשים — לא תלוי בסדר */
function pairKey(a, b){ return [String(a||''), String(b||'')].sort().join('|'); }

const Friends = {
  /* כל הקשרים שנוגעים למשתמש */
  async mine(uid){
    const all = await Store.list('friends').catch(()=>[]);
    return all.filter(f => f.a === uid || f.b === uid);
  },
  rel(list, uid, other){
    const k = pairKey(uid, other);
    return list.find(f => f.key === k) || null;
  },
  status(list, uid, other){
    const r = this.rel(list, uid, other);
    if(!r) return 'none';
    if(r.status === 'blocked') return r.by === uid ? 'blocked-by-me' : 'blocked-me';
    if(r.status === 'accepted') return 'friends';
    return r.from === uid ? 'sent' : 'incoming';
  },
  ids(list, uid){
    return list.filter(f=>f.status==='accepted').map(f => f.a === uid ? f.b : f.a);
  },
  async request(other, otherName){
    const me = Auth.user; if(!me) throw new Error('אין משתמש');
    if(other === me.id) throw new Error('אי אפשר להוסיף את עצמך');
    const list = await this.mine(me.id);
    const st = this.status(list, me.id, other);
    if(st === 'blocked-me') throw new Error('לא ניתן לשלוח בקשה למשתמש הזה');
    if(st === 'friends') throw new Error('אתם כבר חברים');
    if(st === 'sent') throw new Error('כבר נשלחה בקשה');
    if(st === 'incoming'){ return this.accept(this.rel(list, me.id, other).id); }
    const rec = {
      key: pairKey(me.id, other), a: pairKey(me.id, other).split('|')[0], b: pairKey(me.id, other).split('|')[1],
      from: me.id, fromName: me.name || me.email, to: other, toName: otherName || '',
      status: 'pending', createdAt: nowISO()
    };
    const id = await Store.add('friends', rec);
    Sfx.play('pop');
    mailUser(other, 'friend', MAIL_TPL.friendReq(me.name || me.email)).catch(()=>{});
    return id;
  },
  async accept(relId){
    await Store.update('friends', relId, { status:'accepted', acceptedAt: nowISO() });
    Sfx.play('join');
    const all = await Store.list('friends').catch(()=>[]);
    const r = all.find(x=>x.id===relId);
    if(r && r.from) mailUser(r.from, 'friend', MAIL_TPL.friendOk(Auth.user?.name || 'משתמש')).catch(()=>{});
    return true;
  },
  async decline(relId){ await Store.remove('friends', relId); Sfx.play('leave'); },
  async remove(relId){ await Store.remove('friends', relId); Sfx.play('leave'); },
  async block(other){
    const me = Auth.user; if(!me) return;
    const list = await this.mine(me.id);
    const r = this.rel(list, me.id, other);
    const patch = { status:'blocked', by: me.id, blockedAt: nowISO() };
    if(r) await Store.update('friends', r.id, patch);
    else await Store.add('friends', { key: pairKey(me.id, other),
      a: pairKey(me.id, other).split('|')[0], b: pairKey(me.id, other).split('|')[1],
      from: me.id, to: other, createdAt: nowISO(), ...patch });
    toast('המשתמש נחסם. הוא לא יוכל לשלוח לכם הודעות פרטיות.');
  },
  async unblock(relId){ await Store.remove('friends', relId); toast('החסימה הוסרה'); }
};
window.Friends = Friends;

/* האם מותר לשני משתמשים להתכתב */
function dmAllowed(list, uid, other){
  const st = Friends.status(list, uid, other);
  return st !== 'blocked-by-me' && st !== 'blocked-me';
}

function route(path, fn){ ROUTES[path] = fn; }
let CLEANUP = [];
function onCleanup(f){ CLEANUP.push(f); }
function runCleanup(){ CLEANUP.forEach(f=>{ try{ f(); }catch(e){} }); CLEANUP = []; }

/* ===================== דף הבית ===================== */
route('/', async app => renderHome(app, {ic,esc,Auth,DEPTS}));

route('/press', async app => {
  app.innerHTML = `<div class="page-h anim-up"><div class="eyebrow">Press / Facts</div>
    <h1>SMAI Sentinel</h1>
    <p>SMAI Sentinel is an Independent Israeli Online Safety Initiative helping children, teens and parents respond to online harassment, scams, hacked accounts, threats and digital risks.</p></div>
    <div class="grid g2">
      <section class="card anim-up d1"><div class="card-h"><span class="ico-tile i-brand">${ic('shield-check',20)}</span><div><h2>Entity Facts</h2><span class="small mute">Canonical public description</span></div></div>
        <dl class="facts-list">
          <dt>Name</dt><dd>SMAI Sentinel</dd>
          <dt>Entity type</dt><dd>Independent Israeli Online Safety Initiative</dd>
          <dt>Disambiguation</dt><dd>Not SiMa.ai Sentinel, not a Modalix DevKit monitoring tool and not Microsoft Sentinel</dd>
          <dt>Primary audience</dt><dd>Children, teens and parents in Israel</dd>
          <dt>Focus areas</dt><dd>Online harassment, scams, hacked or stolen accounts, threats, impersonation and harmful content</dd>
          <dt>Website</dt><dd><a href="https://smai-support.jo3.org/">https://smai-support.jo3.org/</a></dd>
          <dt>Support/reporting</dt><dd><a href="mailto:smai-support@proton.me">smai-support@proton.me</a></dd>
          <dt>General contact</dt><dd><a href="mailto:minipro.7548@gmail.com">minipro.7548@gmail.com</a></dd>
        </dl>
      </section>
      <section class="card anim-up d2"><div class="card-h"><span class="ico-tile i-warn">${ic('info',20)}</span><div><h2>Important Limits</h2><span class="small mute">No inflated claims</span></div></div>
        <p>SMAI Sentinel is not SiMa.ai Sentinel, not a SiMa.ai Modalix DevKit metrics or monitoring tool and not Microsoft Sentinel.</p>
        <p>SMAI Sentinel is not a government body, law enforcement agency, emergency service or registered nonprofit.</p>
        <p>In urgent danger, people should contact local emergency services. In Israel, police emergency number is <a href="tel:100">100</a>.</p>
        <p>In serious cases, SMAI Sentinel helps organize information and direct people toward the appropriate official or platform safety channels.</p>
      </section>
    </div>
    <section class="card anim-up d3" style="margin-top:18px"><div class="card-h"><span class="ico-tile i-info">${ic('globe',20)}</span><div><h2>Official Public Profiles</h2><span class="small mute">Used for public identity verification</span></div></div>
      <div class="profile-links">
        <a href="https://x.com/smai_sentinel" rel="me noopener">X / @smai_sentinel</a>
        <a href="https://www.facebook.com/profile.php?id=61594140369939" rel="me noopener">Facebook / SMAI Sentinel Online Safety</a>
        <a href="https://www.reddit.com/r/SMAISentinelOfficial/" rel="me noopener">Reddit / r/SMAISentinelOfficial</a>
        <a href="https://www.instagram.com/smai_creator/" rel="me noopener">Instagram / @smai_creator</a>
        <a href="https://www.tiktok.com/@smai_sentinel" rel="me noopener">TikTok / @smai_sentinel</a>
      </div>
    </section>
    <section class="card anim-up d4" style="margin-top:18px"><div class="card-h"><span class="ico-tile i-ok">${ic('book',20)}</span><div><h2>About SMAI Sentinel</h2><span class="small mute">Reusable short description</span></div></div>
      <p>SMAI Sentinel helps families respond calmly and practically when a child or teen faces a digital safety problem. The initiative focuses on preserving evidence, reducing immediate risk, understanding platform reporting options and preparing serious cases for the right official or platform safety channels.</p>
      <p>The initiative should be described as “SMAI Sentinel, an Independent Israeli Online Safety Initiative.” It should not be described as a registered nonprofit, government body, police unit, emergency service or verified official partner unless that status is publicly verifiable.</p>
    </section>`;
});

/* כרטיס תוצאת AI */
function aiCard(a, compact=false){
  const d = DEPT_BY[a.dept] || DEPT_BY.other;
  return `<div class="ai-box">
    ${compact?'':`<div class="ai-h">${ic('sparkle',16)} מנוע מקומי · בדיקה וניתוב ראשוניים</div>`}
    <div class="row" style="gap:7px;margin-bottom:11px">
      <span class="b b-${d.cls}">${ic(d.ico,12)} ${esc(d.short)}</span>
      ${prioBadge(a.prio)}
      ${a.platform?`<span class="b b-gray">${ic('globe',11)} ${esc(a.platform)}</span>`:''}
      ${a.minor?`<span class="b b-violet">מעורב קטין</span>`:''}
    </div>
    ${a.critical?`<div class="callout c-dang" style="margin-bottom:11px;padding:11px 13px;font-size:.85rem">
      <span class="ic">${ic('alert',17)}</span><div><b>זוהו סימני סכנה מיידית.</b>
      אם קיימת סכנה מיידית — התקשרו עכשיו למשטרה, 100. הפנייה סומנה כקריטית ותטופל ראשונה.</div></div>`:''}
    <div class="grid g2" style="gap:12px">
      <div><div class="tiny mute">ביטחון בניתוב</div><div style="font-weight:800">${a.confidence}%</div>
        <div class="meter"><i style="width:${a.confidence}%"></i></div></div>
      <div><div class="tiny mute">מדד דחיפות</div><div style="font-weight:800">${a.urgency}/100</div>
        <div class="meter"><i style="width:${a.urgency}%;background:linear-gradient(90deg,${a.urgency>70?'var(--danger)':a.urgency>45?'var(--warn)':'var(--ok)'},var(--brand3))"></i></div></div>
    </div>
    ${a.matched?.length?`<div style="margin-top:10px"><div class="tiny mute" style="margin-bottom:3px">סימנים שזוהו</div>
      ${a.matched.slice(0,6).map(k=>`<span class="kw">${esc(k)}</span>`).join('')}</div>`:''}
    ${a.actions?.length?`<div style="margin-top:11px"><div class="tiny mute" style="margin-bottom:4px">צעדים מומלצים</div>
      <div class="stack" style="gap:4px">${a.actions.slice(0,3).map(x=>`<div class="row" style="gap:7px">
        <span style="color:var(--brand2);flex:none">${ic('check',13,3)}</span><span class="small">${esc(x)}</span></div>`).join('')}</div></div>`:''}
  </div>`;
}

/* ===================== דיווח חדש ===================== */
route('/report', (app)=>{
  if(!Auth.user){app.innerHTML=requireLogin('התחברו כדי לשלוח פנייה ולעקוב אחריה');return;}
  const W = { plat:'', cat:'', step:1 };const draft={};
  app.innerHTML = `
  <div class="page-h anim-up">
    <div class="eyebrow">דיווח חדש</div>
    <h1>ספרו לנו מה קרה</h1>
    <p>שלושה שלבים קצרים. אין תשובה נכונה או לא נכונה, ואין שאלה קטנה מדי — המידע נגיש לכם ולצוות המורשה.</p>
  </div>
  <div class="callout c-dang anim-up d1" style="margin-bottom:20px">
    <span class="ic">${ic('alert',20)}</span>
    <div><b>במצב סכנה מיידית אל תשתמשו בטופס — התקשרו למשטרה, 100.</b>
      SMAI אינו גוף חירום ואינו תחליף למשטרה. אחרי שדיברתם איתם, אנחנו כאן כדי ללוות אתכם הלאה.</div>
  </div>
  <div class="wiz anim-up d1" id="wizBar"></div>
  <div class="split">
    <div id="wizBody" class="anim-up d2"></div>
    <aside class="stack anim-up d3">
      <div class="card sticky">
        <div class="card-h"><span class="ico-tile i-violet">${ic('sparkle',20)}</span><h4>מה קורה אחרי השליחה</h4></div>
        <div class="steps">
          ${[['הפנייה נשמרת בשרת','קוד מעקב מתקבל רק לאחר שהשמירה אושרה.'],
             ['ניתוב אוטומטי למחלקה','המערכת קובעת את המחלקה ואת רמת הדחיפות. אין צורך לבחור.'],
             ['בדיקה של הצוות','ניתן לעקוב ולהוסיף פרטים באתר. אין זמן תגובה מובטח.'],
             ['ליווי עד לפתרון','צ׳אט אישי, צעדים מעשיים וסיוע מול הפלטפורמות.']]
            .map(([t,d],i)=>`<div class="step ${i===0?'done':''}"><h4>${t}</h4><p>${d}</p></div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="row" style="gap:9px;font-weight:800;margin-bottom:8px">${ic('lock',17)} מה קורה עם המידע</div>
        <p class="small mute" style="margin:0">הפנייה נגישה לכם ולצוות המורשה. אין פרסום, אין שיתוף עם בית הספר,
          ואין פנייה להורים בלי לדבר איתכם — למעט מצב של סכנת חיים.</p>
      </div>
    </aside>
  </div>`;

  const bar = $('#wizBar'), body = $('#wizBody');
  const STEPS = ['איפה זה קרה','מה קרה','פרטים ושליחה'];
  const paintBar = ()=>{
    bar.innerHTML = STEPS.map((t,i)=>{
      const n=i+1, cls = W.step===n ? 'on' : W.step>n ? 'ok' : '';
      return `<button type="button" class="wiz-s ${cls}" ${W.step>n?`onclick="${bind(()=>{ W.step=n; paint(); })}"`:'disabled style="cursor:default"'}>
        <span class="n">${W.step>n?'✓':n}</span>${t}</button>`;
    }).join('');
  };

  /* ---------- שלב 1: פלטפורמה ---------- */
  const step1 = ()=>`
    <div class="card">
      <div class="card-h"><span class="ico-tile i-brand">${ic('globe',20)}</span>
        <div><h3 style="margin:0">איפה זה קרה?</h3><p class="small mute" style="margin:2px 0 0">בחרו את האפליקציה, המשחק או האתר. זה עוזר לנו לתת הנחיות מדויקות.</p></div></div>
      <div class="pgrid">
        ${REPORT_PLATFORMS.map(pl=>`
          <button type="button" class="ptile ${W.plat===pl.id?'on':''}" onclick="${bind(()=>{ W.plat=pl.id; W.cat=''; W.step=2; paint(); })}">
            ${pl.partner?'<span class="pt">שיתוף פעולה</span>':''}
            ${platLogo(pl.id)}<span class="em">${pl.em}</span>
            <span class="nm">${esc(pl.l)}</span>
            <span class="ds">${esc(pl.d)}</span>
          </button>`).join('')}
      </div>
      <p class="tiny mute" style="margin:16px 0 0">${ic('info',13)} פלטפורמות מסומנות ב"שיתוף פעולה" מקבלות אצלנו ערוץ דיווח מהיר. אנחנו מרחיבים את הרשימה כל הזמן.</p>
    </div>`;

  /* ---------- שלב 2: סוג הדיווח ---------- */
  const cats = ()=>{
    const base = REPORT_CATS.slice();
    if(W.plat === 'smai'){
      base.unshift({ id:'smai_staff', l:'דיווח על התנהלות של חבר צוות', dept:'other', sev:3, ico:'flag',
        d:'יחס לא מכבד, ניצול הרשאה או טיפול שאינו מקצועי מצד חבר צוות.' });
      base.unshift({ id:'smai_user', l:'דיווח על משתמש בקהילת SMAI', dept:'harassment', sev:3, ico:'user-x',
        d:'הודעות, פרופיל או התנהגות של משתמש בקהילה שלנו.' });
      base.unshift({ id:'smai_verify', l:'בקשת תג מאומת בקהילה', dept:'other', sev:0, ico:'check',
        d:'הגשת מועמדות לתג ✓ — למי שפעיל, עוזר ומוכר בקהילה.' });
    }
    return base;
  };
  const step2 = ()=>{
    const pl = PLAT_BY[W.plat];
    return `
    <div class="card">
      <div class="card-h"><span class="ico-tile i-warn">${ic('list',20)}</span>
        <div><h3 style="margin:0">מה קרה ב${esc(pl?.he||pl?.l||'פלטפורמה')}?</h3>
          <p class="small mute" style="margin:2px 0 0">בחרו את מה שהכי קרוב. אם שום דבר לא מתאים בדיוק — "משהו אחר" עובד מצוין.</p></div></div>
      <div class="cgrid">
        ${cats().map(c=>`
          <button type="button" class="copt ${W.cat===c.id?'on':''}" onclick="${bind(()=>{ W.cat=c.id; W.step=3; paint(); })}">
            <span class="ci">${ic(c.ico,19)}</span>
            <span><span class="cl">${esc(c.l)}</span><span class="cd">${esc(c.d)}</span></span>
          </button>`).join('')}
      </div>
      <div class="row" style="margin-top:16px">
        <button type="button" class="btn btn-g btn-sm" onclick="${bind(()=>{ W.step=1; paint(); })}">${ic('chevron',14)} חזרה לבחירת פלטפורמה</button>
      </div>
    </div>`;
  };

  /* ---------- שלב 3א: בקשת תג מאומת ---------- */
  const stepVerify = ()=>`
    <form id="vf" class="card" novalidate>
      <div class="card-h"><span class="ico-tile i-ok">${ic('check',20)}</span>
        <div><h3 style="margin:0">בקשת תג מאומת</h3><p class="small mute" style="margin:2px 0 0">התג ✓ ניתן למשתמשים פעילים ואמינים בקהילה, ומקשה על התחזות אליכם.</p></div></div>
      ${Auth.user ? '' : '<div class="callout c-warn" style="margin-bottom:16px"><span class="ic">'+ic('info',18)+'</span><div>כדי לבקש תג מאומת צריך חשבון. <a href="/login">התחברות או הרשמה</a>.</div></div>'}
      <div class="field"><label class="fl" for="v_why">למה מגיע לכם תג? <span class="req">*</span></label>
        <textarea id="v_why" required style="min-height:130px" placeholder="ספרו על הפעילות שלכם בקהילה — עזרה למשתמשים, השתתפות בפורומים, תוכן שיצרתם."></textarea></div>
      <div class="field"><label class="fl" for="v_links">קישורים תומכים (לא חובה)</label>
        <input type="text" id="v_links" placeholder="פרופיל, ערוץ, שרת — כל דבר שמעיד עליכם"></div>
      <div id="vErr"></div>
      <div class="row" style="gap:10px">
        <button type="button" class="btn btn-g" onclick="${bind(()=>{ W.step=2; paint(); })}">${ic('chevron',14)} חזרה</button>
        <button type="submit" class="btn btn-p" style="flex:1" ${Auth.user?'':'disabled'}>${ic('send',17)} שליחת הבקשה</button>
      </div>
    </form>`;

  /* ---------- שלב 3: תיאור ושליחה ---------- */
  const step3 = ()=>{
    const c = cats().find(x=>x.id===W.cat) || REPORT_CATS[REPORT_CATS.length-1];
    const pl = PLAT_BY[W.plat];
    const isUser = W.cat === 'smai_user' || W.cat === 'smai_staff';
    return `
    <form id="rf" class="card" novalidate>
      <div class="card-h"><span class="ico-tile i-brand">${ic(c.ico||'message',20)}</span>
        <div><h3 style="margin:0">${esc(c.l)}</h3>
          <p class="small mute" style="margin:2px 0 0">${pl?.em||''} ${esc(pl?.l||'')} · המחלקה והדחיפות נקבעות אוטומטית לפי מה שתכתבו.</p></div></div>

      <div class="field">
        <label class="fl" for="f_title">כותרת קצרה <span class="req">*</span></label>
        <input type="text" id="f_title" maxlength="110" required placeholder="במשפט אחד — מה הדבר המרכזי שקרה">
      </div>
      ${isUser ? `<div class="field"><label class="fl" for="f_target">${W.cat==='smai_staff'?'שם חבר הצוות':'שם המשתמש שעליו מדווחים'} <span class="req">*</span></label>
        <input type="text" id="f_target" placeholder="השם המדויק כפי שהוא מופיע באתר"></div>` : ''}
      <div class="field">
        <label class="fl" for="f_desc">ספרו במילים שלכם מה קרה <span class="req">*</span></label>
        <textarea id="f_desc" required minlength="20" style="min-height:190px"
          placeholder="מתי זה התחיל, מי מעורב, מה נאמר או פורסם, ומה הכי מטריד אתכם עכשיו. ככל שתפרטו — כך נוכל לעזור מהר יותר."></textarea>
        <div class="hint">אל תכתבו סיסמאות. אפשר לצרף קישורים או צילומי מסך אחרי פתיחת הפנייה.</div>
      </div>

      <div id="aiBox" style="margin-bottom:18px"></div>

      <hr class="divider">
      <h4>איך ליצור איתך קשר</h4>
      <div class="stack" style="gap:10px;margin-bottom:16px">
        <label class="check"><input type="checkbox" id="f_anon">
          <span><span class="t">דיווח אנונימי</span><span class="d">לא נשמור שם או טלפון. תקבלו קוד מעקב ותוכלו לשוחח עם הנציג דרך האתר.</span></span></label>
        <label class="check"><input type="checkbox" id="f_minor">
          <span><span class="t">מעורב ילד או נער מתחת לגיל 18</span><span class="d">מקבל טיפול בעדיפות ובנוהל ייעודי.</span></span></label>
      </div>
      <div id="contactFields" class="grid g2" style="gap:14px">
        <div class="field"><label class="fl" for="f_name">שם (או כינוי)</label>
          <input type="text" id="f_name" placeholder="איך לפנות אליכם"></div>
        <div class="field"><label class="fl" for="f_contact">אימייל לעדכונים</label>
          <input type="email" id="f_contact" placeholder="נשלח עדכון על כל תשובה בפנייה"></div>
      </div>
      <div id="rfErr"></div>
      <div class="row" style="gap:10px">
        <button type="button" class="btn btn-g" onclick="${bind(()=>{ W.step=2; paint(); })}">${ic('chevron',14)} חזרה</button>
        <button type="submit" class="btn btn-p btn-lg" style="flex:1" id="rfBtn">${ic('send',18)} שליחת הדיווח</button>
      </div>
      <p class="tiny mute center" style="margin:12px 0 0">בשליחה אתם מאשרים את <a href="/terms">תנאי השימוש</a> ואת <a href="/privacy">מדיניות הפרטיות</a>.</p>
    </form>`;
  };

  let last = null;
  const wireStep3 = ()=>{
    for(const el of $$('#rf input,#rf textarea,#rf select')){if(Object.hasOwn(draft,el.id)){if(el.type==='checkbox')el.checked=draft[el.id];else el.value=draft[el.id];}el.addEventListener('input',()=>{draft[el.id]=el.type==='checkbox'?el.checked:el.value;});}
    if(!draft.f_desc)$('#f_desc').value=sessionStorage.getItem('smai_report_draft')||'';
    const dsc = $('#f_desc'), ttl = $('#f_title'), box = $('#aiBox');
    const runAI = ()=>{
      const txt = (ttl.value + ' ' + dsc.value).trim();
      if(txt.length < 12){ box.innerHTML=''; last=null; return; }
      box.innerHTML = `<div class="ai-box"><div class="ai-h">${ic('sparkle',16)} בדיקה מקומית ראשונית · המידע נשאר במכשיר</div>
        <div class="ai-scan">מנתח ומנתב את הפנייה</div></div>`;
      setTimeout(()=>{ if(!$('#aiBox')) return; last = analyze(txt); $('#aiBox').innerHTML = aiCard(last);
        if(last.minor && $('#f_minor')) $('#f_minor').checked = true; }, 420);
    };
    const deb = debounce(runAI, 480);
    ttl.addEventListener('input', deb); dsc.addEventListener('input', deb);
    $('#f_anon').addEventListener('change', e=>{ $('#contactFields').classList.toggle('hide', e.target.checked); });
    if(Auth.user){ $('#f_name').value = Auth.user.name||''; $('#f_contact').value = Auth.user.email||''; }
    $('#rf').addEventListener('submit', submitReport);
  };

  async function submitReport(e){
    e.preventDefault();
    const c = cats().find(x=>x.id===W.cat) || REPORT_CATS[REPORT_CATS.length-1];
    const title = $('#f_title').value.trim(), desc = $('#f_desc').value.trim();
    const errEl = $('#rfErr'); errEl.innerHTML = '';
    if(title.length < 4) return errEl.innerHTML = '<div class="err">כותרת קצרה מדי</div>';
    if(desc.length < 20) return errEl.innerHTML = '<div class="err">נשמח לעוד כמה מילים — לפחות 20 תווים</div>';
    const tgt = $('#f_target');
    if(tgt && !tgt.value.trim()) return errEl.innerHTML = '<div class="err">צריך את שם המשתמש שעליו מדווחים</div>';
    const btn = $('#rfBtn'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> שולח...';
    try{
      const a = last || analyze(title + ' ' + desc);
      const anon = $('#f_anon').checked;
      /* המחלקה והדחיפות נקבעות אך ורק על ידי המערכת — אין בחירה ידנית */
      const dept = c.sev >= 3 ? (c.dept || a.dept) : (a.dept !== 'other' ? a.dept : (c.dept || 'other'));
      const critical = a.critical || c.sev === 4;
      const prio = critical ? 'critical' : (c.sev >= 3 && a.prio === 'normal' ? 'high' : a.prio);
      const contact = anon ? '' : $('#f_contact').value.trim();
      let code;
      const t = await Store.add('tickets', {
        code, title, description: desc, dept, status:'new',
        cat: W.cat, catLabel: c.l, platformId: W.plat, platform: PLAT_BY[W.plat]?.l || '',
        targetName: tgt ? tgt.value.trim() : '',
        priority: prio, critical, confidence: a.confidence, urgency: a.urgency,
        minorInvolved: $('#f_minor').checked,
        anonymous: anon, reporterName: anon ? '' : $('#f_name').value.trim(),
        reporterContact: contact, reporterEmail: contact.includes('@') ? normEmail(contact) : '',
        reporterId: Auth.user?.id || null, assignedTo: null, assignedName: '',
        aiMatched: (a.matched||[]).slice(0,8), aiActions: (a.actions||[]).slice(0,4),
        updatedAt: nowISO(), createdAt: nowISO()
      });
      code=t.code;
      /* Initial description is part of the ticket, already saved atomically. */

      const saved = JSON.parse(localStorage.getItem('smai_codes')||'[]').filter(x=>x.id!==t.id);
      saved.unshift({ code, id:t.id, title, at:nowISO() });
      localStorage.setItem('smai_codes', JSON.stringify(saved.slice(0,40)));

      sessionStorage.removeItem('smai_report_draft');
      toast(`הפנייה ${code} נפתחה והועברה ל${DEPT_BY[dept]?.name||'צוות המתאים'}`);
      history.pushState(null,'',`/ticket/${encodeURIComponent(t.id)}`);
      window.scrollTo({top:0});
      await render();
    }catch(err){
      console.error(err);
      $('#rfErr').innerHTML = `<div class="err">שגיאה בשליחה: ${esc(err.message||'נסו שוב')}</div>`;
      const b2 = $('#rfBtn'); if(b2){ b2.disabled=false; b2.innerHTML = ic('send',18)+' שליחת הדיווח'; }
    }
  }

  const wireVerify = ()=>{
    $('#vf').addEventListener('submit', async e=>{
      e.preventDefault();
      if(!Auth.user) return;
      const why = $('#v_why').value.trim();
      if(why.length < 25) return $('#vErr').innerHTML = '<div class="err">נשמח לקצת יותר — לפחות 25 תווים</div>';
      await Store.add('verifyApps', { userId:Auth.user.id, name:Auth.user.name, email:Auth.user.email,
        why, links:$('#v_links').value.trim(), status:'pending', createdAt:nowISO() });
      await mailUser(Auth.user.id, 'appStatus', MAIL_TPL.appStatus('בקשת תג מאומת התקבלה',
        'הבקשה שלך לתג מאומת בקהילת SMAI נקלטה ותיבדק על ידי הצוות. נעדכן אותך בהחלטה.'));
      toast('הבקשה נשלחה. נעדכן אותך בהחלטה.');
      location.hash = '#/community';
    });
  };

  /* ---------- שלב 3ב: בקשת מדווח מהימן ---------- */
  const stepTrustedReporter = ()=>`
    <form id="trf" class="card" novalidate>
      <div class="card-h"><span class="ico-tile i-brand">${ic('award',20)}</span>
        <div><h3 style="margin:0">בקשת מעמד מדווח מהימן</h3>
          <p class="small mute" style="margin:2px 0 0">מלאו את הפרטים — הצוות יבדוק תוך 7 ימי עסקים.</p></div></div>
      ${Auth.user ? '' : '<div class="callout c-warn" style="margin-bottom:16px"><span class="ic">'+ic('info',18)+'</span><div>כדי להגיש בקשה צריך חשבון. <a href="/login">התחברות או הרשמה</a>.</div></div>'}
      <div class="grid g2" style="gap:12px">
        <div class="field"><label class="fl" for="tr_name">שם מלא <span class="req">*</span></label>
          <input type="text" id="tr_name" required placeholder="השם שלכם" value="${Auth.user?.name||''}"></div>
        <div class="field"><label class="fl" for="tr_email">אימייל <span class="req">*</span></label>
          <input type="email" id="tr_email" required placeholder="your@email.com" value="${Auth.user?.email||''}"></div>
      </div>
      <div class="grid g2" style="gap:12px;margin-top:12px">
        <div class="field"><label class="fl" for="tr_tenure">ותק בקהילה <span class="req">*</span></label>
          <select id="tr_tenure" required>
            <option value="">בחרו...</option>
            <option value="1m">פחות מחודש</option>
            <option value="3m">1–3 חודשים</option>
            <option value="12m">3–12 חודשים</option>
            <option value="1y+">יותר משנה</option>
          </select></div>
        <div class="field"><label class="fl" for="tr_count">מספר דיווחים מאושרים (בערך) <span class="req">*</span></label>
          <input type="number" id="tr_count" required min="5" placeholder="לפחות 5"></div>
      </div>
      <div class="field" style="margin-top:12px"><label class="fl" for="tr_links">קישורים לדיווחים קיימים <span class="req">*</span></label>
        <textarea id="tr_links" required style="min-height:100px" placeholder="מספרי פנייה או קישורים — אחד בכל שורה. לפחות 3."></textarea></div>
      <div class="field"><label class="fl" for="tr_why">למה אתם מתעניינים בתחום? <span class="req">*</span></label>
        <textarea id="tr_why" required style="min-height:110px" placeholder="ספרו מה מניע אתכם להגיש מועמדות ולהיות חלק מהצוות."></textarea></div>
      <div class="field"><label class="fl" for="tr_exp">ניסיון קודם בהגנת ילדים ברשת</label>
        <textarea id="tr_exp" style="min-height:80px" placeholder="ניסיון מקצועי, התנדבות, לימודים — אם רלוונטי (לא חובה)."></textarea></div>
      <label class="check" style="margin-bottom:16px"><input type="checkbox" id="tr_agree" required>
        <span><span class="t">אני מתחייב/ת לשמור על סודיות המידע ולדווח בצורה אחראית ומדויקת.</span></span></label>
      <div id="trErr"></div>
      <div class="row" style="gap:10px">
        <button type="button" class="btn btn-g" onclick="${bind(()=>{ W.step=2; paint(); })}">${ic('chevron',14)} חזרה</button>
        <button type="submit" class="btn btn-p" style="flex:1" ${Auth.user?'':'disabled'}>${ic('award',17)} שליחת הבקשה</button>
      </div>
    </form>`;

  const wireTrustedReporter = ()=>{
    $('#trf').addEventListener('submit', async e=>{
      e.preventDefault();
      if(!Auth.user) return;
      const name=$('#tr_name').value.trim(), email=$('#tr_email').value.trim(),
        tenure=$('#tr_tenure').value, count=parseInt($('#tr_count').value)||0,
        links=$('#tr_links').value.trim(), why=$('#tr_why').value.trim(),
        exp=$('#tr_exp').value.trim(), agree=$('#tr_agree').checked;
      if(!name||!email||!tenure||count<5||links.length<5||why.length<25||!agree)
        return $('#trErr').innerHTML='<div class="err">יש למלא את כל השדות החובה. דרושים לפחות 5 דיווחים ו-25 תווים בהסבר.</div>';
      await Store.add('trustedApps', { userId:Auth.user.id, name, email, tenure, count, links, why, exp, status:'pending', createdAt:nowISO() });
      await mailUser(Auth.user.id, 'appStatus', MAIL_TPL.appStatus('בקשת מדווח מהימן התקבלה',
        'הבקשה שלך למעמד מדווח מהימן נקלטה ותיבדק על ידי הצוות תוך 7 ימי עסקים. נעדכן אותך בהחלטה.'));
      toast('הבקשה נשלחה בהצלחה. נחזור אליך תוך 7 ימי עסקים 💙');
      location.hash='#/';
    });
  };

  /* ---------- שלב 3ג: שיתוף פעולה ---------- */
  const stepPartnership = ()=>`
    <form id="prf" class="card" novalidate>
      <div class="card-h"><span class="ico-tile i-info">${ic('users',20)}</span>
        <div><h3 style="margin:0">שיתוף פעולה עם SMAI</h3>
          <p class="small mute" style="margin:2px 0 0">ספרו לנו עליכם — נחזור תוך 14 ימי עסקים.</p></div></div>
      <div class="grid g2" style="gap:12px">
        <div class="field"><label class="fl" for="pr_org">שם / ארגון <span class="req">*</span></label>
          <input type="text" id="pr_org" required placeholder="שם אישי או שם הארגון"></div>
        <div class="field"><label class="fl" for="pr_email">אימייל ליצירת קשר <span class="req">*</span></label>
          <input type="email" id="pr_email" required placeholder="your@email.com" value="${Auth.user?.email||''}"></div>
      </div>
      <div class="grid g2" style="gap:12px;margin-top:12px">
        <div class="field"><label class="fl" for="pr_type">סוג שיתוף פעולה <span class="req">*</span></label>
          <select id="pr_type" required>
            <option value="">בחרו...</option>
            <option value="community">קהילה / פורום</option>
            <option value="creator">יוצר תוכן</option>
            <option value="expert">מומחה מקצועי</option>
            <option value="edu">גורם חינוכי</option>
            <option value="org">ארגון / עמותה</option>
            <option value="other">אחר</option>
          </select></div>
        <div class="field"><label class="fl" for="pr_size">גודל קהל / קהילה <span class="req">*</span></label>
          <select id="pr_size" required>
            <option value="">בחרו...</option>
            <option value="<1k">פחות מ-1,000</option>
            <option value="1k-10k">1,000 – 10,000</option>
            <option value="10k-100k">10,000 – 100,000</option>
            <option value="100k+">מעל 100,000</option>
          </select></div>
      </div>
      <div class="field" style="margin-top:12px"><label class="fl" for="pr_link">קישור לאתר / ערוץ / פרופיל <span class="req">*</span></label>
        <input type="url" id="pr_link" required placeholder="https://..."></div>
      <div class="field"><label class="fl" for="pr_desc">תיאור הפלטפורמה / הקהילה שלכם <span class="req">*</span></label>
        <textarea id="pr_desc" required style="min-height:100px" placeholder="על מה הקהילה שלכם, מי הקהל, ובמה אתם עוסקים."></textarea></div>
      <div class="field"><label class="fl" for="pr_offer">מה אתם מציעים לשיתוף הפעולה? <span class="req">*</span></label>
        <textarea id="pr_offer" required style="min-height:100px" placeholder="למשל: חשיפה לקהל, ידע מקצועי, כלים, תוכן, התנדבות..."></textarea></div>
      <div id="prErr"></div>
      <div class="row" style="gap:10px">
        <button type="button" class="btn btn-g" onclick="${bind(()=>{ W.step=2; paint(); })}">${ic('chevron',14)} חזרה</button>
        <button type="submit" class="btn btn-p" style="flex:1">${ic('users',17)} שליחת הבקשה</button>
      </div>
    </form>`;

  const wirePartnership = ()=>{
    $('#prf').addEventListener('submit', async e=>{
      e.preventDefault();
      const org=$('#pr_org').value.trim(), email=$('#pr_email').value.trim(),
        type=$('#pr_type').value, size=$('#pr_size').value,
        link=$('#pr_link').value.trim(), desc=$('#pr_desc').value.trim(),
        offer=$('#pr_offer').value.trim();
      if(!org||!email||!type||!size||!link||desc.length<20||offer.length<20)
        return $('#prErr').innerHTML='<div class="err">יש למלא את כל השדות החובה.</div>';
      await Store.add('partnerApps', { userId:Auth.user?.id||null, org, email, type, size, link, desc, offer, status:'pending', createdAt:nowISO() });
      toast('הבקשה נשלחה! נחזור אליכם תוך 14 ימי עסקים 🤝');
      location.hash='#/';
    });
  };

  function paint(){
    paintBar();
    if(W.step === 1) body.innerHTML = step1();
    else if(W.step === 2) body.innerHTML = step2();
    else if(W.cat === 'smai_verify'){ body.innerHTML = stepVerify(); wireVerify(); }
    else if(W.cat === 'trusted-reporter'){ body.innerHTML = stepTrustedReporter(); wireTrustedReporter(); }
    else if(W.cat === 'partnership'){ body.innerHTML = stepPartnership(); wirePartnership(); }
    else { body.innerHTML = step3(); wireStep3(); }
    body.classList.remove('anim-up'); void body.offsetWidth; body.classList.add('anim-up');
  }
  paint();
});

/* ===================== הפניות שלי ===================== */
route('/my', async (app)=>{
  app.innerHTML = `<div class="page-h anim-up"><div class="eyebrow">מעקב</div><h1>הפניות שלי</h1>
    <p>כל הפניות שפתחתם מהדפדפן הזה, ומהחשבון שלכם אם התחברתם.</p></div>${loader()}`;
  const local = JSON.parse(localStorage.getItem('smai_codes')||'[]');
  const all = await Store.list('tickets');
  const mine = all.filter(t => (Auth.user && t.reporterId === Auth.user.id) || local.some(c=>c.id===t.id));
  const TWO_DAYS_MS = 2*24*60*60*1000, TWO_YEARS_MS = 2*365*24*60*60*1000, _now = Date.now();
  const _isClosed = t => t.status==='closed'||t.status==='resolved';
  const _closedTs = t => t.closedAt ? new Date(t.closedAt).getTime() : new Date(t.updatedAt||t.createdAt||0).getTime();
  const activeTickets = mine.filter(t => !_isClosed(t) || (_now - _closedTs(t)) < TWO_DAYS_MS);
  const closedTickets = mine.filter(t => _isClosed(t) && (_now - _closedTs(t)) < TWO_YEARS_MS);
  const body = `<div id="myTabs" style="display:flex;gap:8px;margin-bottom:16px"><button class="btn on" data-tab="active">פתוחות (${activeTickets.length})</button><button class="btn" data-tab="closed">נסגרו (${closedTickets.length})</button></div><div id="myActive">${activeTickets.length ? '<div class="stack">'+activeTickets.map((t,i)=>ticketRow(t,i)).join('')+'</div>' : emptyState('file','אין פניות פתוחות','כשתפתחו דיווח הוא יופיע כאן.',`<a class="btn btn-p" href="/report">${ic('plus',16)} פתיחת דיווח</a>`)}</div><div id="myClosed" style="display:none">${closedTickets.length ? '<div class="stack">'+closedTickets.map((t,i)=>ticketRow(t,i)).join('')+'</div>' : emptyState('file','אין פניות סגורות','פניות סגורות יופיעו כאן עד שנתיים.','')}</div>`;
  app.innerHTML = `<div class="page-h anim-up"><div class="eyebrow">מעקב</div><h1>הפניות שלי</h1>
    <p>כל הפניות שפתחתם מהדפדפן הזה, ומהחשבון שלכם אם התחברתם.</p></div>
    ${!Auth.user?`<div class="callout c-info" style="margin-bottom:20px"><span class="ic">${ic('info',18)}</span>
      <div>לא מחוברים. <a href="/login">התחברו</a> כדי לראות את הפניות שלכם מכל מכשיר.</div></div>`:''}
    ${body}`;
  // tab switching
  $$('#myTabs button').forEach(btn => {
    btn.onclick = () => {
      $$('#myTabs button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const tb = btn.dataset.tab;
      if($('#myActive')) $('#myActive').style.display = tb==='active' ? '' : 'none';
      if($('#myClosed')) $('#myClosed').style.display = tb==='closed' ? '' : 'none';
    };
  });
});
function ticketRow(t, i=0){
  return `<a class="tk p-${t.priority||'normal'} anim-up" style="animation-delay:${Math.min(i*45,400)}ms" href="/ticket/${t.id}">
    <div class="row between" style="align-items:flex-start;gap:12px">
      <div style="min-width:0;flex:1">
        <div class="tk-t">${esc(t.title)}</div>
        <div class="tk-m">
          <span class="mono">${esc(t.code||'—')}</span><span>·</span>
          <span>${ago(t.updatedAt||t.createdAt)}</span>
          ${t.platform?`<span>·</span><span>${esc(t.platform)}</span>`:''}
          ${t.assignedName?`<span>·</span><span>${ic('user',11)} ${esc(t.assignedName)}</span>`:''}
        </div>
      </div>
      <div class="row" style="gap:6px;flex:none">${t.critical?'<span class="b b-crit">קריטי</span>':''}${prioBadge(t.priority)}${deptBadge(t.dept)}${statusBadge(t.status)}</div>
    </div></a>`;
}

/* ===================== מעקב לפי קוד ===================== */
route('/track', (app)=>{
  const saved = JSON.parse(localStorage.getItem('smai_codes')||'[]');
  app.innerHTML = `
  <div class="page-h anim-up"><div class="eyebrow">מעקב</div><h1>מעקב אחרי פנייה</h1>
    <p>הזינו את קוד המעקב שקיבלתם בסיום הדיווח. התחברו לחשבון שממנו שלחתם את הפנייה.</p></div>
  <div class="card anim-up d1" style="max-width:520px">
    <div class="field"><label class="fl" for="tcode">קוד מעקב</label>
      <input type="text" id="tcode" class="mono" placeholder="SM-…" style="font-size:1.15rem;letter-spacing:.08em"></div>
    <button class="btn btn-p btn-block" id="tgo">${ic('search',17)} חיפוש</button>
    <div id="tres" style="margin-top:14px"></div>
  </div>
  ${saved.length?`<div class="sec"><h3>קודים שנשמרו בדפדפן הזה</h3>
    <div class="stack">${saved.map(c=>`<a class="tk" href="/ticket/${c.id}">
      <div class="row between"><div><div class="tk-t">${esc(c.title)}</div>
      <div class="tk-m"><span class="mono">${esc(c.code)}</span> · ${ago(c.at)}</div></div>
      <span style="color:var(--ink3)">${ic('chevron',18)}</span></div></a>`).join('')}</div></div>`:''}`;

  const go = async ()=>{
    const code = $('#tcode').value.trim().toUpperCase();
    if(!code) return;
    $('#tres').innerHTML = '<div class="skel" style="height:52px"></div>';
    let list=[];try{list=[await request('/api/track','POST',{code})];}catch(e){$('#tres').textContent=e.message;return;}
    $('#tres').innerHTML = list.length
      ? ticketRow(list[0])
      : `<div class="callout c-warn"><span class="ic">${ic('alert',18)}</span>
         <div>לא נמצאה פנייה עם הקוד הזה. בדקו שהקוד הועתק במלואו, כולל המקפים.</div></div>`;
  };
  $('#tgo').onclick = go;
  $('#tcode').addEventListener('keydown', e=>{ if(e.key==='Enter') go(); });
});

/* ===================== פנייה בודדת ===================== */
route('/ticket', async (app, id)=>{
  app.innerHTML = loader();
  const t = await Store.get('tickets', id);
  if(!t){ app.innerHTML = emptyState('alert','הפנייה לא נמצאה','ייתכן שהקישור שגוי או שהפנייה נמחקה.',
    `<a class="btn btn-g" href="/track">חזרה למעקב</a>`); return; }
  const staff = Auth.isStaff();
  const d = DEPT_BY[t.dept] || DEPT_BY.other;
  const users = staff ? await Store.list('users') : [];
  const agents = users.filter(u=>isStaffUser(u));
  const ticketFeedback = Auth.user ? (await Store.list('feedback').catch(()=>[])).find(x=>x.kind==='ticket_rating'&&x.ticketId===t.id&&x.byId===Auth.user.id) : null;

  app.innerHTML = `
  <div class="crumb anim-in"><a href="${staff?'/admin':'/my'}">${staff?'פאנל צוות':'הפניות שלי'}</a> ← פנייה ${esc(t.code||'')}</div>
  <div class="split">
    <div class="stack anim-up">
      <div class="card">
        <div class="row between" style="align-items:flex-start;gap:14px;margin-bottom:12px">
          <div style="min-width:0">
            <div class="row" style="gap:6px;margin-bottom:7px">
              ${t.critical?'<span class="b b-crit">⚠ קריטי</span>':''}${statusBadge(t.status)}${prioBadge(t.priority)}${deptBadge(t.dept)}
              ${t.minorInvolved?'<span class="b b-violet">מעורב קטין</span>':''}
              ${t.anonymous?'<span class="b b-gray">אנונימי</span>':''}
            </div>
            <h1 style="font-size:1.5rem;margin-bottom:6px">${esc(t.title)}</h1>
            <div class="small mute">
              <span class="mono">${esc(t.code||'')}</span> · נפתח ${fmtDate(t.createdAt)} ${fmtTime(t.createdAt)}
              ${t.platform?` · ${esc(t.platform)}`:''}${t.assignedName?` · מטופל ע"י ${esc(t.assignedName)}`:''}
            </div>
          </div>
          <button class="btn btn-g btn-sm" onclick="copyText('${jsq(t.code||'')}')">${ic('copy',14)} קוד</button>
        </div>
        <div class="card pad-sm" style="background:var(--surface2);white-space:pre-wrap;line-height:1.75">${esc(t.description)}</div>
        ${t.aiActions?.length?`<div style="margin-top:14px"><div class="row" style="gap:7px;font-weight:800;font-size:.85rem;color:var(--accent);margin-bottom:7px">
          ${ic('sparkle',15)} המלצות המערכת</div>
          <div class="stack" style="gap:5px">${t.aiActions.map(a=>`<div class="row" style="gap:8px">
            <span style="color:var(--brand2);flex:none">${ic('check',14,3)}</span><span class="small">${esc(a)}</span></div>`).join('')}</div></div>`:''}
      </div>

      <div class="card">
        <div class="card-h"><span class="ico-tile i-brand">${ic('message',19)}</span>
          <div style="flex:1"><h3 style="margin:0">התכתבות</h3>
          <div class="tiny mute">${staff?'הודעות פנימיות מסומנות ולא נראות למדווח':'הצוות יראה את ההודעות שלכם כאן'}</div></div></div>
        <button class="btn btn-g" onclick="${bind(()=>smaiAIReply(id))}">${ic('sparkle',16)} בקשת עזרה מ-AI</button><div class="chat" id="chat">${loader()}</div>
        ${(t.status==='closed'||t.status==='resolved')
          ? `<div class="callout c-info" style="margin-top:12px"><span class="ic">${ic('message',17)}</span><div>הפנייה נסגרה${t.closedBy?' על ידי <strong>'+esc(t.closedBy)+'</strong>':''}. כתיבת הודעה חדשה תפתח אותה מחדש ותעדכן את הצוות.</div></div>`
          : ''}
        ${(!staff||!['closed','resolved'].includes(t.status))?`<div class="composer" style="position:relative">
          <div id="mentionList" class="mention-list"></div>
          <textarea id="msgIn" placeholder="כתיבת הודעה... (Enter לשליחה)"></textarea>
          <button class="btn btn-p" id="msgBtn" style="height:48px">${ic('send',17)}</button>
        </div>
        ${staff?`<label class="check" style="margin-top:10px"><input type="checkbox" id="msgInt">
          <span><span class="t">הערה פנימית</span><span class="d">נראית לצוות בלבד — לא למדווח.</span></span></label>`:''}`:''}
      </div>
    </div>

    <aside class="stack anim-up d2">
      ${staff?`
      <div class="card sticky">
        <div class="card-h"><span class="ico-tile i-violet">${ic('settings',19)}</span><h4>ניהול הפנייה</h4></div>
        <div class="field"><label class="fl">סטטוס</label>
          <select id="sSt" ${Auth.can('changeStatus')?'':'disabled'}>${Object.entries(STATUS).map(([k,v])=>
            `<option value="${k}" ${t.status===k?'selected':''}>${v.l}</option>`).join('')}</select></div>
        <div class="field"><label class="fl">עדיפות</label>
          <select id="sPr" ${Auth.can('changeStatus')?'':'disabled'}>${Object.entries(PRIO).map(([k,v])=>
            `<option value="${k}" ${t.priority===k?'selected':''}>${v.l}</option>`).join('')}</select></div>
        <div class="field"><label class="fl">מחלקה</label>
          <select id="sDp" ${Auth.can('assign')?'':'disabled'}>${DEPTS.map(x=>
            `<option value="${x.id}" ${t.dept===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="fl">נציג מטפל</label>
          <select id="sAs" ${Auth.can('assign')?'':'disabled'}><option value="">לא הוקצה</option>
            ${agents.map(u=>`<option value="${u.id}" ${t.assignedTo===u.id?'selected':''}>${esc(u.name||u.email)} — ${RANKS[u.rank]?.l||''}</option>`).join('')}</select></div>
        <button class="btn btn-p btn-block" id="sSave">${ic('check',16)} שמירת שינויים</button>
        <button class="btn btn-ok btn-block" id="sClaim" style="margin-top:8px">${ic('headset',16)} ${t.assignedTo ? 'העבר אליי' : 'קבלת פנייה'}</button>
      </div>
      <div class="card">
        <div class="card-h"><span class="ico-tile i-gray">${ic('user',19)}</span><h4>פרטי המדווח</h4></div>
        <dl class="kv small">
          <dt>שם</dt><dd>${t.anonymous?'<span class="mute">אנונימי</span>':esc(t.reporterName||'—')}</dd>
          <dt>יצירת קשר</dt><dd>${t.anonymous?'<span class="mute">דרך האתר בלבד</span>':esc(t.reporterContact||'—')}</dd>
          <dt>מעורב קטין</dt><dd>${t.minorInvolved?'כן':'לא צוין'}</dd>
          <dt>פלטפורמה</dt><dd>${esc(t.platform||'—')}</dd>
          <dt>ביטחון AI</dt><dd>${t.confidence||'—'}%</dd>
          <dt>דחיפות AI</dt><dd>${t.urgency||'—'}/100</dd>
        </dl>
        ${t.aiMatched?.length?`<div style="margin-top:10px"><div class="tiny mute">סימנים שזוהו</div>
          ${t.aiMatched.map(k=>`<span class="kw">${esc(k)}</span>`).join('')}</div>`:''}
      </div>`
      : `<div class="card sticky">
        <div class="card-h"><span class="ico-tile i-${d.cls}">${ic(d.ico,19)}</span>
          <div><h4 style="margin:0">${esc(d.short)}</h4><div class="tiny mute">המחלקה המטפלת</div></div></div>
        <p class="small mute">${esc(d.desc)}</p>
        <hr class="divider">
        <div class="stack" style="gap:9px">
          <div class="row between"><span class="small mute">סטטוס</span>${statusBadge(t.status)}</div>
          <div class="row between"><span class="small mute">עדיפות</span>${prioBadge(t.priority)}</div>
          <div class="row between"><span class="small mute">עודכן</span><span class="small">${ago(t.updatedAt||t.createdAt)}</span></div>
        </div>
      </div>
      ${t.assignedTo&&['closed','resolved'].includes(t.status)?`<div class="card team-rating-card">
        <div class="card-h"><span class="ico-tile i-warn">${ic('star',19)}</span><div><h4 style="margin:0">דירוג הטיפול</h4><div class="tiny mute">המשוב מגיע לצוות ומשמש לשיפור השירות</div></div></div>
        ${ticketFeedback?`<div class="rating-result"><div class="rating-stars" aria-label="דירוג ${ticketFeedback.rating} מתוך 5">${[1,2,3,4,5].map(n=>`<span class="${n<=ticketFeedback.rating?'on':''}">★</span>`).join('')}</div><p class="small mute">תודה, הדירוג שלך נשמר.</p></div>`:`<form id="ticketRatingForm"><div class="rating-picker" role="radiogroup" aria-label="דירוג הטיפול">${[1,2,3,4,5].map(n=>`<button type="button" data-rating="${n}" aria-label="${n} כוכבים">★</button>`).join('')}</div><div class="field"><label for="ratingText">מה היה טוב ומה אפשר לשפר?</label><textarea id="ratingText" minlength="5" maxlength="2000" required placeholder="כתבו כמה מילים על הטיפול שקיבלתם"></textarea></div><button class="btn btn-p btn-block" type="submit">שליחת הדירוג</button><p id="ratingStatus" class="small" role="status"></p></form>`}
      </div>`:''}
      ${t.aiHandled?`<div class="card">
        <div class="row" style="gap:9px;font-weight:800;margin-bottom:7px">${ic('bot',17)} הסוכן החכם</div>
        <p class="small mute" style="margin:0 0 10px">${t.aiEscalated
          ? 'הסוכן קבע שהמקרה שלך מחייב אדם, והעביר אותך לנציג אנושי.'
          : 'הסוכן נתן מענה ראשוני. אם זה לא מספיק — לחצו כאן ונציג אנושי ייכנס לשרשור.'}</p>
        ${t.aiEscalated?'':`<button class="btn btn-g btn-sm btn-block" id="toHuman">${ic('headset',15)} רוצה נציג אנושי</button>`}
      </div>`:''}
      <div class="card"><div class="row" style="gap:9px;font-weight:800;margin-bottom:7px">${ic('phone',16)} מצב דחוף?</div>
        <p class="small mute" style="margin:0">אם המצב הידרדר או שיש סכנה מיידית — התקשרו עכשיו למשטרה, 100,
        ועדכנו כאן בצ׳אט כדי שנקפיץ את הפנייה.</p></div>`}
    </aside>
  </div>`;

  const ratingForm=$('#ticketRatingForm');
  if(ratingForm){
    let rating=0;const buttons=$$('.rating-picker button');
    buttons.forEach(b=>b.onclick=()=>{rating=Number(b.dataset.rating);buttons.forEach(x=>x.classList.toggle('on',Number(x.dataset.rating)<=rating));});
    ratingForm.onsubmit=async e=>{e.preventDefault();const status=$('#ratingStatus'),submit=ratingForm.querySelector('[type=submit]');if(!rating)return status.textContent='בחרו דירוג בין כוכב אחד לחמישה.';submit.disabled=true;try{await Store.add('feedback',{kind:'ticket_rating',ticketId:t.id,staffId:t.assignedTo,rating,text:$('#ratingText').value.trim()});toast('תודה — הדירוג נשמר');render();}catch(err){status.textContent=err.message;submit.disabled=false;}};
  }

  /* ---- צ'אט חי ---- */
  const chatEl = $('#chat');
  const paint = (list)=>{
    if(!chatEl || $('#chat') !== chatEl) return;
    const msgs = list.filter(m=>m.ticketId===id && (staff || !m.internal))
                     .sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    chatEl.innerHTML = msgs.length ? msgs.map(m=>{
      const mine = (Auth.user && m.senderId===Auth.user.id) || (!Auth.user && !m.senderId && !m.staffSide);
      if(m.system) return `<div class="msg sys"><div class="bub">${esc(m.text)}</div></div>`;
      if(m.ai) return `<div class="msg">
        <span class="av s" style="background:linear-gradient(135deg,var(--brand2),var(--accent));color:#fff">${ic('bot',16)}</span>
        <div class="bub" style="border-color:color-mix(in srgb,var(--accent) 34%,transparent)">
          <div class="who">SMAI AI <span class="b b-violet">${ic('sparkle',11)} סוכן חכם</span>
            ${m.escalated?'<span class="b b-dang">הועבר לנציג אנושי</span>':''}</div>
          ${aiStagesHTML(m.stages)}
          ${m.replyTo?'<div class="reply-quote">↩ '+esc(m.replyTo.sender||'')+': '+esc((m.replyTo.text||'').substring(0,60))+'</div>':''}<div class="txt">${esc(m.text)}</div>
          ${m.article?`<a class="btn btn-g btn-sm" style="margin-top:9px" href="/article/${m.article}">${ic('book',14)} למדריך המלא</a>`:''}
          <div class="tm">${fmtTime(m.createdAt)} · ${fmtDate(m.createdAt)}</div><button class="reply-btn" data-mid="${m.id}" data-mtxt="${esc((m.text||'').substring(0,80))}" data-mname="${esc(m.senderName||'')}">↩</button></div></div>`;
      return `<div class="msg ${mine?'mine':''} ${m.internal?'int':''}">
        ${avatar({id:m.senderId,name:m.senderName},'s')}
        <div class="bub"><div class="who">${esc(m.senderName||'משתמש')} ${rankBadge(m.senderRank)}${m.verified ? '<span class="b b-ok" style="font-size:10px">✓ מאומת</span>' : ''}
          ${m.internal?'<span class="b b-warn">פנימי</span>':''}</div>
          <div class="txt">${esc(m.text)}</div>
          <div class="tm">${fmtTime(m.createdAt)} · ${fmtDate(m.createdAt)}</div></div></div>`;
    }).join('') : `<div class="empty" style="padding:26px"><p class="small">אין עדיין הודעות. כתבו משהו כדי להתחיל.</p></div>`;
    chatEl.scrollTop = chatEl.scrollHeight;
  };
  onCleanup(Store.watch('messages', paint));

  const send = async ()=>{
    const inp = $('#msgIn'); const txt = inp.value.trim(); if(!txt) return;
    const internal = staff && $('#msgInt')?.checked;
    inp.disabled = true;
    try{
      if(!staff&&['closed','resolved'].includes(t.status)){
        await Store.update('tickets',id,{status:'open'});
        t.status='open';
      }
      await Store.add('messages', { ticketId:id, senderId:Auth.user?.id||null,
        senderName: Auth.user?.name || (t.anonymous?'מדווח אנונימי':(t.reporterName||'מדווח')),
        senderRank: Auth.user?.rank || 'citizen', verified: Auth.user?.verified||false, staffSide: staff, text:txt, internal:!!internal, createdAt:nowISO(), ...(window._replyTo?{replyTo:window._replyTo}:{}) });
      if(staff && /[@@](ai\b|smai\s+sentinel\s+ai)/i.test(txt)) smaiAIReply(id).catch(e=>toast(e.message,'warn'));
      
      if(!staff && !internal) Store.add('logs',{ticketId:id,userId:Auth.user?.id||null,text:txt,createdAt:nowISO()}).catch(()=>{});
      if(!internal){
        if(staff) await notifyTicket(t, 'ticketReply', MAIL_TPL.ticketReply(t, Auth.user?.name||'נציג SMAI', txt));
        else if(t.assignedTo) await mailUser(t.assignedTo, 'ticketReply', MAIL_TPL.ticketReply(t, 'המדווח', txt));
      }
      const patch = { updatedAt: nowISO() };
      if(!internal){
        if(staff && t.status==='new') patch.status = 'open';
        if(staff && t.status==='waiting') patch.status = 'open';
        if(!staff && t.status==='waiting') patch.status = 'open';
        if(staff && !internal) patch.status = patch.status || (t.status==='resolved'?'open':t.status);
      }
      if(staff&&Object.keys(patch).some(k=>k!=='updatedAt'))await Store.update('tickets', id, patch);
      inp.value='';
    }catch(e){
      const c = String(e?.code||e?.message||'');
      if(c.includes('permission-denied')||c.includes('PERMISSION_DENIED'))
        toast('שגיאת הרשאות — יש להגדיר כללי Firestore. עברו ל-#/setup','err');
      else toast('שליחת ההודעה נכשלה: '+(e?.message||c||'שגיאה לא ידועה'),'err');
    }
    finally{ inp.disabled = false; inp.focus(); }
  };
  const _mb=$('#msgBtn'); if(_mb) _mb.onclick=send;
  const _mi=$('#msgIn'); if(_mi) _mi.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} });
  // ===== Reply handler =====
  window._replyTo = null;
  (() => {
    const _replyBar = document.createElement('div');
    _replyBar.className='reply-bar'; _replyBar.style.display='none';
    _replyBar.innerHTML='<span class="cancel-reply" title="' + 'בטל">✕</span><span id="replyPreview"></span>';
    const _msgInEl = document.getElementById('msgIn');
    if(_msgInEl?.parentNode) _msgInEl.parentNode.insertBefore(_replyBar, _msgInEl);
    _replyBar.querySelector('.cancel-reply').onclick=()=>{ window._replyTo=null; _replyBar.style.display='none'; };
    chatEl.addEventListener('click', e=>{ const rb=e.target.closest('.reply-btn'); if(!rb) return; e.stopPropagation(); window._replyTo={id:rb.dataset.mid,text:rb.dataset.mtxt,sender:rb.dataset.mname}; document.getElementById('replyPreview').textContent='↩ '+rb.dataset.mname+': '+(rb.dataset.mtxt||'').substring(0,50); _replyBar.style.display='flex'; _msgInEl?.focus(); });
  })();
  // ===== @mention autocomplete =====
  (()=>{
    const mInp = $('#msgIn'), mList = $('#mentionList');
    if(!mInp || !mList) return;
    let mActive=false, mStart=0, mQuery='', mIdx=0, mItems=[];
    let _users=[];
    Store.list('users').then(u=>{ _users=u||[]; }).catch(()=>{});
    function _items(q){
      const ai={id:'__ai__',name:'smai sentinel ai',email:''};
      return [...(staff?[ai]:[]),..._users].filter(u=> !q || (u.name||'').toLowerCase().startsWith(q.toLowerCase()) || (u.email||'').toLowerCase().startsWith(q.toLowerCase()) || (u.id==='__ai__'&&'smai sentinel ai'.startsWith(q.toLowerCase())) ).slice(0,8);
    }
    function _render(){
      if(!mItems.length){ mList.classList.remove('open'); return; }
      mList.innerHTML=mItems.map((u,i)=>{
        const isAI=u.id==='__ai__';
        const av=isAI?'🤖':(u.name||'?')[0].toUpperCase();
        const label=isAI?'AI':(u.name||u.email||u.id);
        const sub=isAI?'עוזר AI חכם':(u.email||'');
        return '<div class="mention-item'+(i===mIdx?' sel':'')+'" data-n="'+label+'"><div class="mav">'+av+'</div><div><div class="mnm">@'+label+'</div><div class="mrk">'+sub+'</div></div></div>';
      }).join('');
      mList.classList.add('open');
      mList.querySelectorAll('.mention-item').forEach(el=>{ el.addEventListener('mousedown', ev=>{ ev.preventDefault(); _pick(el.dataset.n); }); });
    }
    function _pick(name){
      const v=mInp.value;
      mInp.value=v.substring(0,mStart)+'@'+name+' '+v.substring(mInp.selectionEnd);
      mList.classList.remove('open'); mActive=false;
      const pos=mStart+name.length+2; mInp.focus(); mInp.setSelectionRange(pos,pos);
    }
    mInp.addEventListener('input',()=>{
      const v=mInp.value, pos=mInp.selectionStart;
      const m=v.substring(0,pos).match(/@(\w*)$/);
      if(m){ mActive=true; mStart=v.substring(0,pos).lastIndexOf('@'); mQuery=m[1]; mIdx=0; mItems=_items(mQuery); _render(); }
      else{ mActive=false; mList.classList.remove('open'); }
    });
    mInp.addEventListener('keydown',e=>{
      if(!mActive||!mList.classList.contains('open')) return;
      if(e.key==='ArrowDown'){ e.preventDefault(); mIdx=Math.min(mIdx+1,mItems.length-1); _render(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); mIdx=Math.max(mIdx-1,0); _render(); }
      else if(e.key==='Tab'||(e.key==='Enter'&&mActive)){ e.preventDefault(); e.stopPropagation(); if(mItems[mIdx]) _pick(mItems[mIdx].id==='__ai__'?'AI':(mItems[mIdx].name||mItems[mIdx].email||mItems[mIdx].id)); }
      else if(e.key==='Escape'){ mList.classList.remove('open'); mActive=false; }
    });
    document.addEventListener('click',e=>{ if(!e.target.closest('#mentionList')&&e.target!==mInp) mList.classList.remove('open'); });
  })();

  const th = $('#toHuman');
  if(th) th.onclick = async ()=>{
    th.disabled = true;
    await Store.update('tickets', id, { status:'escalated', aiEscalated:true,
      escalateReason:'הפונה ביקש נציג אנושי', updatedAt:nowISO() });
    await serverNotice({ ticketId:id, system:true, senderId:null,
      text:'הפנייה הועברה לנציג אנושי לבקשת הפונה. אין צורך להסביר למה.', createdAt: nowISO() });
    toast('הועבר לנציג אנושי'); render();
  };

  if(staff){
    $('#sSave').onclick = async ()=>{
      const as = $('#sAs').value;
      const u = agents.find(x=>x.id===as);
      const _nSt = $('#sSt').value;
        const _clf = (['closed','resolved'].includes(_nSt)) ? {closedBy: Auth.user?.name||Auth.user?.email||'צוות', closedAt: nowISO()} : {};
        await Store.update('tickets', id, { status:_nSt, priority:$('#sPr').value,
        dept:$('#sDp').value, assignedTo: as||null, assignedName: u? (u.name||u.email):'', updatedAt: nowISO(), ..._clf });
      await serverNotice({ ticketId:id, system:true, senderId:null,
        text:`${Auth.user.name} עדכן את הפנייה: סטטוס ${STATUS[$('#sSt').value].l}, עדיפות ${PRIO[$('#sPr').value].l}${u?`, שויך ל${u.name||u.email}`:''}`,
        createdAt: nowISO() });
      if($('#sSt').value !== t.status)
        await notifyTicket(t, 'ticketStatus', MAIL_TPL.ticketStatus(t, STATUS[$('#sSt').value].l));
      toast('הפנייה עודכנה'); render();
    };
    const claim = $('#sClaim');
    if(claim) claim.onclick = async ()=>{
      const who = Auth.user.name || Auth.user.email;
      await Store.update('tickets', id, { assignedTo:Auth.user.id, assignedName:who,
        status:'open', claimedAt:nowISO(), updatedAt:nowISO() });
      await serverNotice({ ticketId:id, system:true, senderId:null,
        text:`${who} קיבל/ה את הפנייה לטיפול. מכאן והלאה יש לך כתובת אישית.`, createdAt: nowISO() });
      await notifyTicket(t, 'ticketClaim', MAIL_TPL.ticketClaim(t, who));
      toast('הפנייה שויכה אליך'); render();
    };
  }
});

/* ===================== מדריכים ===================== */
route('/articles', async (app)=>{
  const extra = await Store.list('articles');
  const all = [...SEED_ARTICLES, ...extra];
  app.innerHTML = `
  <div class="page-h anim-up"><div class="eyebrow">מרכז הידע</div><h1>מדריכים ומאמרים</h1>
    <p>מדריכים מעשיים מתוך תרחישים נפוצים, ומאמרים על SMAI, שיתופי פעולה ותוכנית המדווחים שלנו.</p></div>
  <div class="row anim-up d1" style="margin-bottom:22px" id="aFilters">
    <button class="chip on" data-d="">הכל</button>
    ${DEPTS.map(d=>`<button class="chip" data-d="${d.id}">${esc(d.short)}</button>`).join('')}
  </div>
  <div class="grid g3" id="aGrid"></div>`;

  const paint = (dep)=>{
    const list = dep ? all.filter(a=>a.dept===dep) : all;
    $('#aGrid').innerHTML = list.length ? list.map((a,i)=>{
      const d = DEPT_BY[a.dept]||DEPT_BY.other;
      return `<a class="card hov anim-up" style="animation-delay:${i*55}ms" href="/article/${a.id}">
        <div class="row" style="gap:7px;margin-bottom:11px"><span class="b b-${d.cls}">${esc(d.short)}</span>
          <span class="tiny mute">${a.read} דק׳ קריאה</span></div>
        <h3 style="font-size:1.08rem">${esc(a.title)}</h3>
        <p class="small mute" style="margin-bottom:12px">${esc(a.sum)}</p>
        <div class="row" style="gap:5px">${(a.tags||[]).map(t=>`<span class="kw">${esc(t)}</span>`).join('')}</div>
      </a>`; }).join('') : emptyState('book','אין מדריכים בקטגוריה','נשמח להצעות לנושאים — כתבו לנו.');
  };
  paint('');
  $$('#aFilters .chip').forEach(b=>b.onclick = ()=>{
    $$('#aFilters .chip').forEach(x=>x.classList.remove('on')); b.classList.add('on'); paint(b.dataset.d);
  });
});
route('/article', async (app, id)=>{
  const extra = await Store.list('articles');
  const a = [...SEED_ARTICLES, ...extra].find(x=>x.id===id);
  if(!a){ app.innerHTML = emptyState('book','המדריך לא נמצא','',`<a class="btn btn-g" href="/articles">לכל המדריכים</a>`); return; }
  const d = DEPT_BY[a.dept]||DEPT_BY.other;
  const html = String(a.body||'').split('\n\n').map(p=>{
    const t = p.trim();
    if(t.startsWith('**') && t.endsWith('**')) return `<h3 style="margin-top:26px">${esc(t.replace(/\*\*/g,''))}</h3>`;
    return `<p>${esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>')}</p>`;
  }).join('');
  app.innerHTML = `
  <div class="crumb anim-in"><a href="/articles">מדריכים</a> ← ${esc(a.title)}</div>
  <div class="split">
    <article class="card anim-up">
      <div class="row" style="gap:8px;margin-bottom:14px"><span class="b b-${d.cls}">${esc(d.short)}</span>
        <span class="tiny mute">${a.read} דק׳ קריאה</span></div>
      <h1 style="font-size:1.85rem">${esc(a.title)}</h1>
      <p class="lede mute" style="font-size:1.05rem">${esc(a.sum)}</p>
      <hr class="divider">
      <div style="line-height:1.85">${html}</div>
      <hr class="divider">
      <div class="callout c-info"><span class="ic">${ic('info',18)}</span>
        <div>המדריך לא מחליף ליווי אישי. אם המצב נוגע אליכם — <a href="/report">פתחו דיווח</a> ונציג יחזור אליכם.</div></div>
    </article>
    <aside class="stack anim-up d2">
      <div class="card sticky"><h4>מדריכים נוספים</h4>
        <div class="stack" style="gap:8px">${SEED_ARTICLES.filter(x=>x.id!==a.id).slice(0,5).map(x=>
          `<a href="/article/${x.id}" class="small" style="display:block;padding:9px 11px;border-radius:var(--r);background:var(--surface2);color:var(--ink2);font-weight:600">${esc(x.title)}</a>`).join('')}</div>
        <a class="btn btn-p btn-block" href="/report" style="margin-top:14px">${ic('shield-alert',16)} פתיחת דיווח</a></div>
    </aside>
  </div>`;
});

/* ===================== קהילה — שרתים ===================== */
route('/community', async (app)=>{
  if(Auth.banInfo()) return renderBanned(app);
  const custom = await Store.list('servers');
  const servers = [...SEED_SERVERS.map(s=>({...s})), ...custom];
  const msgs = await Store.list('cmsgs');
  const counts = {}; msgs.forEach(m=>counts[m.server] = (counts[m.server]||0)+1);

  app.innerHTML = `
  <div class="page-h anim-up"><div class="eyebrow">קהילה</div><h1>שרתי הקהילה</h1>
    <p>מרחבים מנוהלים עם מודרציה אנושית ואוטומטית. אפשר לקרוא בלי חשבון — כדי לכתוב צריך להתחבר.</p></div>

  <div class="callout c-ok anim-up d1" style="margin-bottom:22px"><span class="ic">${ic('shield-check',19)}</span>
    <div><b>הקהילה מוגנת.</b> כל הודעה נסרקת אוטומטית על ידי מנוע SMAI, וניתן לדווח על כל הודעה בלחיצה אחת.
      פרטים אישיים, פנייה מינית לקטין או איומים מטופלים מיידית.</div></div>

  <div class="row between anim-up d2" style="margin-bottom:18px">
    <div class="row" id="cFilters">
      <button class="chip on" data-c="">הכל</button>
      ${SRV_CATS.map(c=>`<button class="chip" data-c="${c.id}">${c.ico} ${esc(c.l)}</button>`).join('')}
    </div>
    <div class="row" style="gap:7px;flex:none">
      ${Auth.user?`<a class="btn btn-ghost btn-sm" href="/friends">${ic('users',15)} חברים</a>`:''}
      ${Auth.user?`<button class="btn btn-ghost btn-sm" id="joinInv">${ic('link',15)} הצטרפות בקוד</button>`:''}
      ${canCreateServer(Auth.user)?`<button class="btn btn-g btn-sm" id="newSrv">${ic('plus',15)} שרת חדש</button>`:''}
    </div>
  </div>
  <div class="community-workspace"><section class="community-conversations" aria-label="שיחות הקהילה"><div class="community-list-title">השיחות שלכם</div><div id="srvGrid"></div></section><section class="community-welcome"><div class="community-symbol">${ic('message',48)}</div><h2>מקום לשיחה טובה</h2><p>בחרו קהילה מהרשימה כדי לפתוח את השיחה, לקרוא ולהשתתף.</p><span class="small mute">שמרו על הפרטיות שלכם וכבדו את המשתתפים</span></section></div>

  <div class="sec">
    <div class="sec-h"><div><h2>כללי הקהילה</h2><p>ארבעה כללים. הפרה מובילה להסרת ההודעה, ובמקרים חמורים — להרחקה.</p></div></div>
    <div class="grid g4">
      ${[['heart','מכבדים תמיד','בלי עלבונות, בלי לעג ובלי גזענות. אנשים מגיעים לכאן אחרי פגיעה.'],
         ['lock','לא חושפים פרטים','לא שמות מלאים, לא כתובות, לא טלפונים — לא שלכם ולא של אחרים.'],
         ['ban','אפס סובלנות לפגיעה','פנייה מינית לקטין, איום או סחיטה = הרחקה מיידית ודיווח לרשויות.'],
         ['flag','מדווחים, לא מתעמתים','נתקלתם במשהו? כפתור הדגל על ההודעה. אנחנו נטפל.']]
        .map(([i,t,d],n)=>`<div class="card hov reveal" style="transition-delay:${n*60}ms">
          <div class="ico-tile i-brand" style="margin-bottom:11px">${ic(i,19)}</div>
          <h4>${t}</h4><p class="small mute" style="margin:0">${d}</p></div>`).join('')}
    </div>
  </div>`;

  const paint = (cat)=>{
    const list = cat ? servers.filter(s=>s.cat===cat) : servers;
    const vis = list.filter(s => s.cat!=='staff' || Auth.isStaff());
    $('#srvGrid').innerHTML = vis.length ? vis.map((s,i)=>`
      <a class="srv-card anim-up" style="animation-delay:${i*50}ms" href="/server/${s.id}">
        <span class="srv-ico">${s.ico||'💬'}</span>
        <div style="min-width:0;flex:1">
          <div class="row" style="gap:6px;margin-bottom:3px">
            <b style="font-size:1.02rem">${esc(s.name)}</b>
            ${s.official?`<span class="b b-brand" style="font-size:.65rem">${ic('check',10,3)} רשמי</span>`:''}
            ${s.private?`<span class="b b-gray">${ic('lock',10)} פרטי</span>`:''}
          </div>
          <div class="small mute" style="margin-bottom:7px">${esc(s.desc||'')}</div>
          <div class="tiny mute row" style="gap:10px">
            <span>${ic('message',11)} ${counts[s.id]||0} הודעות</span>
            <span>${SRV_CATS.find(c=>c.id===s.cat)?.l||''}</span>
          </div>
        </div>
      </a>`).join('') : emptyState('message','אין שרתים בקטגוריה','אפשר ליצור שרת חדש ולהזמין אליו.');
  };
  paint('');
  $$('#cFilters .chip').forEach(b=>b.onclick=()=>{
    $$('#cFilters .chip').forEach(x=>x.classList.remove('on')); b.classList.add('on'); paint(b.dataset.c);
  });
  initReveal();
  const ns = $('#newSrv'); if(ns) ns.onclick = newServerModal;
  const ji = $('#joinInv'); if(ji) ji.onclick = ()=>{
    openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('link',20)}</span><h3>הצטרפות לשרת בקוד הזמנה</h3></div>
    <div class="m-b"><div class="field" style="margin:0"><label class="fl">קוד ההזמנה</label>
      <input id="invC" class="mono center" maxlength="12" placeholder="ABC123" style="text-transform:uppercase"></div>
      <div id="invE"></div></div>
    <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
      <button class="btn btn-p" id="invGo">${ic('login',15)} הצטרפות</button></div>`);
    $('#invGo').onclick = async ()=>{
      const code = String($('#invC').value||'').trim().toUpperCase();
      let t;try{t=await request('/api/server-join','POST',{code});}catch(e){$('#invE').textContent=e.message;return;}
      if(!t){ Sfx.play('error'); return $('#invE').innerHTML = '<div class="err">קוד לא נמצא</div>'; }
      await Servers.join(t);
      sessionStorage.setItem('srvok_'+t.id,'1');
      closeModal(); toast('הצטרפתם ל'+t.name); location.hash = '#/server/'+t.id;
    };
  };
});

function newServerModal(){
  if(!canCreateServer(Auth.user)){
    return openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('info',20)}</span><h3>פתיחת שרת</h3></div>
      <div class="m-b"><p class="small">כרגע רק ${CFG.get('serverCreate')==='verified'?'משתמשים מאומתים':'אנשי צוות'} יכולים לפתוח שרתים חדשים בקהילה.
      אפשר להגיש בקשה לתג מאומת מעמוד הקהילה, או לפתוח קבוצה פרטית בהודעות הפרטיות.</p></div>
      <div class="m-f"><a class="btn btn-g" href="/dm" onclick="closeModal()">קבוצה פרטית</a>
      <button class="btn btn-p" onclick="closeModal()">הבנתי</button></div>`);
  }
  openModal(`
  <div class="m-h"><span class="ico-tile i-brand">${ic('plus',20)}</span><h3>יצירת שרת חדש</h3></div>
  <div class="m-b">
    <div class="grid g2" style="gap:14px">
      <div class="field"><label class="fl">שם השרת <span class="req">*</span></label>
        <input type="text" id="nsName" maxlength="40" placeholder="לדוגמה: הורים לילדי יסודי"></div>
      <div class="field"><label class="fl">אימוג׳י</label><input type="text" id="nsIco" maxlength="4" value="💬"></div>
    </div>
    <div class="field"><label class="fl">תיאור</label>
      <input type="text" id="nsDesc" maxlength="120" placeholder="על מה מדברים כאן"></div>
    <div class="field"><label class="fl">קטגוריה</label>
      <select id="nsCat">${SRV_CATS.filter(c=>c.id!=='staff'||Auth.isStaff()).map(c=>`<option value="${c.id}">${c.ico} ${esc(c.l)}</option>`).join('')}</select></div>
    <label class="check"><input type="checkbox" id="nsPriv">
      <span><span class="t">שרת פרטי</span><span class="d">הכניסה רק עם קוד שתגדירו.</span></span></label>
    <div class="field hide" id="nsCodeF" style="margin-top:12px"><label class="fl">קוד כניסה</label>
      <input type="text" id="nsCode" class="mono" maxlength="12" placeholder="למשל 4821"></div>
    <div id="nsErr"></div>
  </div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
    <button class="btn btn-p" id="nsGo">${ic('check',16)} יצירה</button></div>`);
  $('#nsPriv').onchange = e => $('#nsCodeF').classList.toggle('hide', !e.target.checked);
  $('#nsGo').onclick = async ()=>{
    const name = $('#nsName').value.trim();
    if(name.length < 2) return $('#nsErr').innerHTML = '<div class="err">צריך שם לשרת</div>';
    const s = await Store.add('servers', { name, ico:$('#nsIco').value||'💬', desc:$('#nsDesc').value.trim(),
      cat:$('#nsCat').value, private:$('#nsPriv').checked, code:$('#nsCode').value.trim(),
      invite: Servers.newInvite(), members:[Auth.user.id], admins:[],
      ownerId:Auth.user.id, ownerName:Auth.user.name, official:false, createdAt:nowISO() });
    await Store.add('channels', { server:s.id, name:'כללי-2', kind:'text', desc:'שיחה חופשית', pos:1, createdAt:nowISO() });
    await Store.add('channels', { server:s.id, name:'פורום', kind:'forum', desc:'שרשורי דיון', pos:2, createdAt:nowISO() });
    await Store.add('channels', { server:s.id, name:'הכרזות', kind:'ann', desc:'עדכונים מהנהלת השרת', pos:0, createdAt:nowISO() });
    closeModal(); Sfx.play('success'); toast('השרת נוצר עם שלושה ערוצים'); location.hash = '#/server/'+s.id;
  };
}

/* ===================== שרת בודד ===================== */
route('/server', async (app, id, chArg, threadArg)=>{
  if(Auth.banInfo()) return renderBanned(app);
  const servers = await Servers.all();
  const s = servers.find(x=>x.id===id);
  if(!s){ app.innerHTML = emptyState('message','השרת לא נמצא','',`<a class="btn btn-g" href="/community">לכל השרתים</a>`); return; }

  // Private membership is authorized by the server.
  const [users, channels] = await Promise.all([Store.list('users'), Servers.channels(id)]);
  const me = Auth.user;
  const staff = Auth.isStaff();
  const role = Servers.roleOf(s, me);
  const manage = Servers.canManage(s, me);
  const member = Servers.isMember(s, me?.id);
  const ch = channels.find(c=>c.id===chArg) || channels[0];
  const canPost = Servers.canPost(s, ch, me) && member;

  const sideList = servers.filter(x=>(x.cat!=='staff'||staff) && (!x.private || staff || x.ownerId===me?.id || (x.members||[]).includes(me?.id)));
  const grouped = {};
  sideList.forEach(x=>{ (grouped[x.cat] = grouped[x.cat]||[]).push(x); });

  app.innerHTML = `
  <div class="crumb anim-in"><a href="/community">קהילה</a> ← ${esc(s.name)} ← ${esc(ch?.name||'')}</div>
  <button class="hub-toggle" id="hubTog" aria-label="פתיחת רשימת הערוצים">${ic('list',18)} ערוצים</button>
  <div class="hub hub3 anim-up" id="hubRoot">
    <div class="hub-side" id="hubSide">
      <div class="hs-h"><span>${ic('globe',16)} שרתים</span>
        ${canCreateServer(me)?`<button class="iconbtn" id="sNew" style="width:30px;height:30px" title="שרת חדש">${ic('plus',15)}</button>`:''}</div>
      <div class="hs-b">
        ${SRV_CATS.filter(c=>grouped[c.id]?.length).map(c=>`
          <div class="cat-lbl">${c.ico} ${esc(c.l)}</div>
          ${grouped[c.id].map(x=>`<a class="ch ${x.id===id?'on':''}" href="/server/${x.id}">
            <span class="em">${x.ico||'💬'}</span><span class="nm">${esc(x.name)}</span>
            ${x.private?ic('lock',12):''}</a>`).join('')}`).join('')}
      </div>
      <div class="hs-ch">
        <div class="hs-h" style="border-top:1px solid var(--line)"><span>${ic('hash',15)} ערוצים</span>
          ${manage?`<button class="iconbtn" id="chNew" style="width:28px;height:28px" title="ערוץ חדש">${ic('plus',14)}</button>`:''}</div>
        <div style="padding:6px 8px 12px">
          ${channels.filter(c=>!c.staffOnly||staff).map(c=>{
            const k = CH_KIND_BY[c.kind]||CH_KIND_BY.text;
            return `<a class="ch ${c.id===ch?.id?'on':''}" href="/server/${id}/${encodeURIComponent(c.id)}">
              <span class="em">${ic(k.ico,14)}</span><span class="nm">${esc(c.name)}</span>
              ${c.staffOnly?ic('lock',11):''}
              ${manage && !c.virtual?`<button class="ch-x" data-chdel="${c.id}" title="מחיקת הערוץ">${ic('trash',11)}</button>`:''}</a>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="hub-main">
      <div class="hm-h">
        <span class="srv-ico" style="width:40px;height:40px;font-size:1.2rem;border-radius:13px">${s.ico||'💬'}</span>
        <div style="flex:1;min-width:0">
          <div class="row" style="gap:6px"><b>${esc(s.name)}</b>
            ${s.official?`<span class="b b-brand" style="font-size:.65rem">רשמי</span>`:''}
            ${s.private?`<span class="b b-gray">${ic('lock',10)} פרטי</span>`:''}
            <span class="b b-gray" title="ערוץ נוכחי">${ic((CH_KIND_BY[ch?.kind]||CH_KIND_BY.text).ico,10)} ${esc(ch?.name||'')}</span></div>
          <div class="tiny mute" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ch?.desc || s.desc || '')}</div>
        </div>
        <div class="row" style="gap:6px;flex:none">
          ${me && !s.seed ? (member
            ? `<button class="btn btn-ghost btn-xs" id="srvLeave">${ic('logout',13)} יציאה</button>`
            : `<button class="btn btn-p btn-xs" id="srvJoin">${ic('plus',13)} הצטרפות</button>`) : ''}
          <button class="btn btn-ghost btn-xs" id="srvInfo">${ic('users',13)} <span>${(s.members||[]).length + (s.seed?users.length:0)}</span></button>
          ${manage?`<button class="btn btn-ghost btn-xs" id="srvSet">${ic('settings',13)}</button>`:''}
        </div>
      </div>
      <div class="hm-body-slot" id="chSlot">${loader()}</div>
    </div>
  </div>`;

  /* --- ניווט צד בנייד --- */
  const tog = $('#hubTog'); if(tog) tog.onclick = ()=>{ $('#hubRoot').classList.toggle('side-open'); Sfx.play('tick'); };
  $$('#hubSide .ch').forEach(a=>a.addEventListener('click', ()=>$('#hubRoot').classList.remove('side-open')));

  const sn = $('#sNew'); if(sn) sn.onclick = newServerModal;
  const cn = $('#chNew'); if(cn) cn.onclick = ()=>channelModal(s);
  const si = $('#srvInfo'); if(si) si.onclick = ()=>serverMembersModal(s, users);
  const ss = $('#srvSet'); if(ss) ss.onclick = ()=>serverSettingsModal(s);
  const sj = $('#srvJoin'); if(sj) sj.onclick = async ()=>{ await Servers.join(s); toast('הצטרפתם לשרת'); render(); };
  const sl = $('#srvLeave'); if(sl) sl.onclick = async ()=>{
    if(await confirmBox('יציאה מהשרת','אפשר לחזור בכל רגע.','יציאה')){ await Servers.leave(s); render(); } };
  $$('[data-chdel]').forEach(b=>b.onclick = async (e)=>{
    e.preventDefault(); e.stopPropagation();
    if(!(await confirmBox('מחיקת ערוץ','ההודעות בערוץ יישמרו בארכיון אבל הערוץ ייעלם מהרשימה.','מחיקה',true))) return;
    await Store.remove('channels', b.dataset.chdel); toast('הערוץ נמחק'); location.hash = '#/server/'+id;
  });

  if(!ch) return;
  /* --- גוף הערוץ --- */
  if(ch.kind === 'forum') return renderForum(s, ch, users, threadArg, { manage, canPost });
  return renderTextChannel(s, ch, users, { manage, canPost, member });
});

/* ===================== ערוץ טקסט ===================== */
function renderTextChannel(s, ch, users, o){
  const me = Auth.user;
  const staff = Auth.isStaff();
  const slot = $('#chSlot');
  slot.innerHTML = `
    <div class="hm-b chat" id="cchat" style="max-height:none">${loader()}</div>
    <div class="hm-f">
      ${me ? (Auth.muted()
        ? `<div class="callout c-warn" style="padding:11px 13px;font-size:.86rem"><span class="ic">${ic('volume-x',17)}</span>
           <div>אתם מושתקים עד ${fmtTime(me.muteUntil)} ${fmtDate(me.muteUntil)}. אפשר לקרוא אבל לא לכתוב.</div></div>`
        : (o.canPost
          ? `<div class="composer" style="border:0;padding:0;margin:0">
              <textarea id="cin" maxlength="${CFG.get('chatMaxLen')}" placeholder="כתיבת הודעה ב־${esc(ch.name)}... (Enter לשליחה)" style="min-height:46px"></textarea>
<div id="cMentionList" class="mention-list" style="display:none;position:absolute;bottom:100%;left:0;right:0"></div>
              <button class="btn btn-p" id="cbtn" style="height:46px">${ic('send',17)}</button></div>
             <div class="row between" style="margin-top:7px">
               <span class="tiny mute">${ic('shield-check',11)} ההודעה נסרקת אוטומטית לפני הפרסום.</span>
               <span class="tiny mute" id="cCount">0 / ${CFG.get('chatMaxLen')}</span></div>`
          : `<div class="callout c-info" style="padding:11px 13px;font-size:.86rem"><span class="ic">${ic('info',17)}</span>
             <div>${ch.kind==='ann' ? 'ערוץ הכרזות — רק מנהלי השרת כותבים בו.'
                   : !o.member ? 'הצטרפו לשרת כדי לכתוב בערוצים שלו.' : 'אין לכם הרשאת כתיבה בערוץ הזה.'}</div></div>`))
        : `<div class="row between"><span class="small mute">כדי לכתוב בקהילה צריך חשבון.</span>
           <a class="btn btn-p btn-sm" href="/login">${ic('login',15)} כניסה</a></div>`}
    </div>`;

  const box = $('#cchat');
  let lastSeen = null, first = true;
  const paint = (list)=>{
    if(!box || $('#cchat') !== box) return;
    const msgs = list.filter(m => m.server===s.id && (m.channel||('gen:'+s.id))===ch.id && !m.deleted)
                     .sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    box.innerHTML = msgs.length ? msgs.map(m=>{
      const mine = me && m.senderId===me.id;
      const canMod = staff && Auth.can('moderateChat');
      const su = users.find(x=>x.id===m.senderId);
      return `<div class="msg ${mine?'mine':''} anim-msg" data-mid="${m.id}">
        <span style="cursor:pointer" onclick="openProfile('${jsq(m.senderId||'')}')">${avatar({id:m.senderId,name:m.senderName,avatar:su?.avatar},'s')}</span>
        <div class="bub"><div class="who"><span style="cursor:pointer" onclick="openProfile('${jsq(m.senderId||'')}')">${esc(m.senderName||'משתמש')}</span> ${rankBadge(m.senderRank)}
          ${su?.verified&&su.privacy?.showVerified!==false?`<span class="verified">${ic('check',9,3)}</span>`:''}
          ${m.flagged?`<span class="b b-warn" title="סומן ע״י המערכת">${ic('flag',10)} נבדק</span>`:''}</div>
          ${m.replyTo?'<div class="reply-quote">↩ '+esc(m.replyTo.sender||'')+': '+esc((m.replyTo.text||'').substring(0,60))+'</div>':''}<div class="txt">${linkify(m.text)}</div>
          <div class="tm">${fmtTime(m.createdAt)}${m.edited?' · נערך':''}</div></div>
        <div class="acts">
          ${me && !mine ? `<button title="דיווח על ההודעה" data-act="report" data-id="${m.id}">${ic('flag',13)}</button>`:''}
          ${me && !mine && m.senderId ? `<button title="הודעה פרטית" data-act="dm" data-id="${m.senderId}">${ic('message',13)}</button>`:''}
          ${me && !mine && m.senderId ? `<button title="הוספה כחבר" data-act="fr" data-id="${m.senderId}">${ic('plus',13)}</button>`:''}
          ${canMod || mine ? `<button title="מחיקת ההודעה" data-act="del" data-id="${m.id}">${ic('trash',13)}</button>`:''}
          ${canMod && !mine && m.senderId ? `<button title="פעולות משתמש" data-act="user" data-id="${m.senderId}">${ic('user',13)}</button>`:''}
        <button class="reply-btn" data-chat="c" data-mid="${m.id}" data-mtxt="${esc((m.text||'').substring(0,80))}" data-mname="${esc(m.senderName||'')}">↩</button></div></div>`;
    }).join('') : `<div class="empty"><div class="ico">${ic('message',26)}</div>
        <p class="small">עדיין שקט ב־${esc(ch.name)}. תהיו הראשונים שכותבים.</p></div>`;
    box.scrollTop = box.scrollHeight;
    const last = msgs[msgs.length-1];
    if(last && !first && last.id !== lastSeen && last.senderId !== me?.id) Sfx.play('msgIn');
    if(last) lastSeen = last.id;
    first = false;
    box.querySelectorAll('.acts button').forEach(b=>{
      b.onclick = async ()=>{
        const act = b.dataset.act, mid = b.dataset.id;
        if(act==='report') reportMessageModal(msgs.find(x=>x.id===mid), s.id);
        if(act==='dm') openDM(mid, (users.find(x=>x.id===mid)||{}).name).then(c=>{ location.hash='#/dm/'+c.id; });
        if(act==='fr'){ try{ await Friends.request(mid, (users.find(x=>x.id===mid)||{}).name); toast('בקשת חברות נשלחה'); }
                        catch(e){ toast(e.message,'warn'); } }
        if(act==='del') deleteMessage(mid);
        if(act==='user') userActionsModal(mid, users);
      };
    });
  };
  onCleanup(Store.watch('cmsgs', paint));

  const inp = $('#cin');
  if(inp) inp.oninput = ()=>{ const c = $('#cCount'); if(c) c.textContent = `${inp.value.length} / ${CFG.get('chatMaxLen')}`; };

  const sendC = async ()=>{
    if(!inp) return;
    const txt = inp.value.trim(); if(!txt || !me) return;
    if(txt.length > CFG.get('chatMaxLen')) return toast('ההודעה ארוכה מדי','warn');
    const mod = moderate(txt);
    if(mod.violation && mod.severity >= 3){
      Sfx.play('error');
      openModal(`<div class="m-h"><span class="ico-tile i-dang">${ic('shield-alert',20)}</span><h3>ההודעה נחסמה</h3></div>
        <div class="m-b"><div class="callout c-dang" style="margin-bottom:14px"><span class="ic">${ic('alert',18)}</span>
          <div>מנוע SMAI זיהה בהודעה תוכן שמפר את כללי הקהילה (${esc(mod.catLabel)}, חומרה ${esc(mod.label)}).
          ההודעה לא פורסמה.</div></div>
          <p class="small mute">אם מדובר בטעות — נסחו מחדש. אם אתם במצוקה, <a href="/report">פתחו דיווח</a> ונציג ילווה אתכם באופן פרטי.</p></div>
        <div class="m-f"><button class="btn btn-p" onclick="closeModal()">הבנתי</button></div>`);
      return;
    }
    inp.value = ''; inp.disabled = true;
    const cc = $('#cCount'); if(cc) cc.textContent = `0 / ${CFG.get('chatMaxLen')}`;
    try{
      await Store.add('cmsgs', { server:s.id, channel:ch.id, channelName:ch.name,
        senderId:me.id, senderName:me.name||me.email, senderRank:me.rank,
        text:txt, flagged: mod.violation, modCat: mod.cat||null, ...(window._replyTo2?{replyTo:window._replyTo2}:{}),createdAt:nowISO() });
      if(window._replyTo2){window._replyTo2=null;const _br2=document.getElementById('_rBar2');if(_br2)_br2.style.display='none';}
      Sfx.play('msgOut');
      notifyMentions(txt, s.name+' / '+ch.name, users).catch(()=>{});
      if(mod.violation) toast('ההודעה פורסמה וסומנה לבדיקת מודרטור','warn');
    }catch(e){
      const c = String(e?.code||e?.message||'');
      if(c.includes('permission-denied')||c.includes('PERMISSION_DENIED'))
        toast('שגיאת הרשאות Firestore — עברו ל-#/setup להגדרת הכללים','err');
      else toast('שליחה נכשלה: '+(e?.message||c||'שגיאה לא ידועה'),'err');
      inp.value = txt;
    }
    finally{ inp.disabled=false; inp.focus(); }
  };
  const cb = $('#cbtn'); if(cb) cb.onclick = sendC;
  if(inp) inp.addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendC(); } });
  // ===== @mention autocomplete (server chat) =====
  (()=>{
    const mInp2 = document.getElementById('cin'), mList2 = document.getElementById('cMentionList');
    if(!mInp2 || !mList2) return;
    let mA2=false, mS2=0, mI2=0, mIt2=[];
    let _cu=[];
    Store.list('users').then(u=>{ _cu=u||[]; }).catch(()=>{});
    const _ci=(q)=>_cu.filter(u=> !q||(u.name||''). toLowerCase().startsWith(q.toLowerCase())||(u.email||'').toLowerCase().startsWith(q.toLowerCase())).slice(0,8);
    const _cr=()=>{ mList2.innerHTML=''; mIt2.forEach((u,i)=>{ const d=document.createElement('div'); d.className='mention-item'+(i===mI2?' active':'')+' cmenitem'; d.textContent=(u.name||u.email||u.id); d.onmousedown=e=>{e.preventDefault();_cp2(i);}; mList2.appendChild(d); }); mList2.style.display=mIt2.length?'block':'none'; };
    const _cs=()=>{ const txt=mInp2.value; const at=txt.lastIndexOf('@',mInp2.selectionStart-1); if(at===-1){mList2.style.display='none';mA2=false;return;} const q=txt.substring(at+1,mInp2.selectionStart); if(/\s/.test(q)){mList2.style.display='none';mA2=false;return;} mS2=at; mIt2=_ci(q); mI2=0; mA2=true; _cr(); };
    const _cp2=(i)=>{ const u=mIt2[i]; if(!u) return; const txt=mInp2.value; const b=txt.substring(0,mS2); const a=txt.substring(mInp2.selectionStart); const m='@'+(u.name||u.email||u.id)+' '; mInp2.value=b+m+a; mInp2.selectionStart=mInp2.selectionEnd=b.length+m.length; mList2.style.display='none'; mA2=false; mInp2.dispatchEvent(new Event('input')); };
    mInp2.addEventListener('input', _cs);
    mInp2.addEventListener('keydown', e=>{ if(!mA2||!mIt2.length) return; if(e.key==='ArrowDown'){e.preventDefault();mI2=(mI2+1)%mIt2.length;_cr();} else if(e.key==='ArrowUp'){e.preventDefault();mI2=(mI2-1+mIt2.length)%mIt2.length;_cr();} else if(e.key==='Enter'&&mA2){e.preventDefault();_cp2(mI2);} else if(e.key==='Escape'){mList2.style.display='none';mA2=false;} });
    document.addEventListener('click', e=>{if(!mList2.contains(e.target)&&e.target!==mInp2){mList2.style.display='none';mA2=false;}});
  })();
}
window._replyTo2=null;
(()=>{
  document.addEventListener('click',e=>{
    const rb=e.target.closest('.reply-btn[data-chat="c"]');
    if(!rb)return;
    e.stopPropagation();
    const cinEl=document.getElementById('cin');
    if(!cinEl)return;
    let bar=document.getElementById('_rBar2');
    if(!bar){
      bar=document.createElement('div');
      bar.id='_rBar2';bar.className='reply-bar';
      bar.innerHTML='<span class="cancel-reply" title="X">✕</span><span id="replyPreview2"></span>';
      cinEl.parentNode.insertBefore(bar,cinEl);
      bar.querySelector('.cancel-reply').onclick=()=>{window._replyTo2=null;bar.style.display='none';};
    }
    window._replyTo2={id:rb.dataset.mid,text:rb.dataset.mtxt,sender:rb.dataset.mname};
    const p2=document.getElementById('replyPreview2');
    if(p2)p2.textContent='↩ '+rb.dataset.mname+': '+(rb.dataset.mtxt||'').substring(0,50);
    bar.style.display='flex';cinEl.focus();
  });
})();
window._replyTo3=null;
(()=>{
  document.addEventListener('click',e=>{
    const rb=e.target.closest('.reply-btn[data-chat="d"]');
    if(!rb)return;
    e.stopPropagation();
    const dinEl=document.getElementById('din');
    if(!dinEl)return;
    let bar=document.getElementById('_rBar3');
    if(!bar){
      bar=document.createElement('div');
      bar.id='_rBar3';bar.className='reply-bar';
      bar.innerHTML='<span class="cancel-reply" title="X">✕</span><span id="replyPreview3"></span>';
      dinEl.parentNode.insertBefore(bar,dinEl);
      bar.querySelector('.cancel-reply').onclick=()=>{window._replyTo3=null;bar.style.display='none';};
    }
    window._replyTo3={id:rb.dataset.mid,text:rb.dataset.mtxt,sender:rb.dataset.mname};
    const p3=document.getElementById('replyPreview3');
    if(p3)p3.textContent='↩ '+rb.dataset.mname+': '+(rb.dataset.mtxt||'').substring(0,50);
    bar.style.display='flex';dinEl.focus();
  });
})();

/* ===================== ערוץ פורום ===================== */
async function renderForum(s, ch, users, threadId, o){
  const me = Auth.user;
  const staff = Auth.isStaff();
  const slot = $('#chSlot');
  const all = await Store.list('threads').catch(()=>[]);
  const threads = all.filter(t=>t.channel===ch.id && !t.deleted)
    .sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0) || String(b.lastAt||b.createdAt).localeCompare(String(a.lastAt||a.createdAt)));
  const cur = threadId ? threads.find(t=>t.id===threadId) : null;

  if(!cur){
    slot.innerHTML = `
      <div class="hm-b" style="max-height:none;padding:16px">
        <div class="row between" style="margin-bottom:14px">
          <div><b style="font-size:1.02rem">${esc(ch.name)}</b>
            <div class="tiny mute">${threads.length} שרשורים · ${esc(ch.desc||'דיון בנושאים')}</div></div>
          ${o.canPost?`<button class="btn btn-p btn-sm" id="thNew">${ic('plus',15)} שרשור חדש</button>`:''}
        </div>
        <div class="th-list">
          ${threads.length ? threads.map(t=>`
            <a class="th-row" href="/server/${s.id}/${encodeURIComponent(ch.id)}/${t.id}">
              ${avatar({id:t.authorId,name:t.authorName,avatar:(users.find(u=>u.id===t.authorId)||{}).avatar},'s')}
              <div style="min-width:0;flex:1">
                <div class="row" style="gap:6px">
                  ${t.pinned?`<span class="b b-brand" style="font-size:.6rem">${ic('star',9)} נעוץ</span>`:''}
                  ${t.locked?`<span class="b b-gray" style="font-size:.6rem">${ic('lock',9)} נעול</span>`:''}
                  <b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</b></div>
                <div class="tiny mute" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  ${esc(t.authorName||'משתמש')} · ${fmtDate(t.createdAt)} · ${esc(String(t.body||'').slice(0,80))}</div>
              </div>
              <span class="th-count">${ic('message',12)} ${t.replies||0}</span>
            </a>`).join('')
            : emptyState('book','אין עדיין שרשורים','פתחו את הדיון הראשון בערוץ הזה.')}
        </div>
      </div>`;
    const tn = $('#thNew'); if(tn) tn.onclick = ()=>threadModal(s, ch);
    return;
  }

  /* --- תצוגת שרשור --- */
  slot.innerHTML = `
    <div class="hm-b" id="thBox" style="max-height:none;padding:16px">${loader()}</div>
    <div class="hm-f">
      ${cur.locked ? `<div class="callout c-info" style="padding:11px 13px;font-size:.86rem"><span class="ic">${ic('lock',17)}</span>
        <div>השרשור נעול. אי אפשר להוסיף תגובות.</div></div>`
      : (me && o.canPost && !Auth.muted() ? `<div class="composer" style="border:0;padding:0;margin:0">
          <textarea id="tin" maxlength="${CFG.get('threadMaxLen')}" placeholder="תגובה לשרשור... (Enter לשליחה)" style="min-height:46px"></textarea>
          <button class="btn btn-p" id="tbtn" style="height:46px">${ic('send',17)}</button></div>`
      : `<div class="row between"><span class="small mute">כדי להגיב צריך חשבון פעיל בשרת.</span>
         <a class="btn btn-p btn-sm" href="/login">${ic('login',15)} כניסה</a></div>`)}
    </div>`;

  const box = $('#thBox');
  let first = true, lastSeen = null;
  const canModT = staff && Auth.can('moderateChat');
  const paint = (list)=>{
    if(!box || $('#thBox') !== box) return;
    const reps = list.filter(m=>m.thread===cur.id && !m.deleted)
      .sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    const au = users.find(u=>u.id===cur.authorId) || {};
    box.innerHTML = `
      <a class="btn btn-ghost btn-xs" href="/server/${s.id}/${encodeURIComponent(ch.id)}" style="margin-bottom:12px">${ic('arrow',13)} חזרה לשרשורים</a>
      <div class="th-head">
        <div class="row between" style="align-items:flex-start">
          <h2 style="font-size:1.2rem;margin:0 0 6px">${esc(cur.title)}</h2>
          <div class="row" style="gap:5px;flex:none">
            ${canModT?`<button class="btn btn-g btn-xs" id="thPin">${ic('star',12)} ${cur.pinned?'ביטול נעיצה':'נעיצה'}</button>
              <button class="btn btn-g btn-xs" id="thLock">${ic('lock',12)} ${cur.locked?'פתיחה':'נעילה'}</button>`:''}
            ${canModT || cur.authorId===me?.id ? `<button class="btn btn-g btn-xs" id="thDel">${ic('trash',12)}</button>`:''}
          </div>
        </div>
        <div class="row" style="gap:8px">${avatar({...au,id:cur.authorId,name:cur.authorName},'s')}
          <div><b class="small">${esc(cur.authorName||'משתמש')}</b> ${rankBadge(au.rank)}
            <div class="tiny mute">${fmtDate(cur.createdAt)} ${fmtTime(cur.createdAt)}</div></div></div>
        <div class="th-body">${linkify(cur.body)}</div>
      </div>
      <div class="tiny mute" style="margin:16px 0 8px">${reps.length} תגובות</div>
      <div class="chat" style="max-height:none;padding:0">
        ${reps.length ? reps.map(m=>{
          const mine = me && m.senderId===me.id;
          const su = users.find(x=>x.id===m.senderId) || {};
          return `<div class="msg ${mine?'mine':''} anim-msg">
            <span style="cursor:pointer" onclick="openProfile('${jsq(m.senderId||'')}')">${avatar({id:m.senderId,name:m.senderName,avatar:su.avatar},'s')}</span>
            <div class="bub"><div class="who">${esc(m.senderName||'משתמש')} ${rankBadge(m.senderRank)}
              ${su.verified&&su.privacy?.showVerified!==false?`<span class="verified">${ic('check',9,3)}</span>`:''}</div>
              ${m.replyTo?'<div class="reply-quote">↩ '+esc(m.replyTo.sender||'')+': '+esc((m.replyTo.text||'').substring(0,60))+'</div>':''}<div class="txt">${linkify(m.text)}</div><div class="tm">${fmtTime(m.createdAt)}</div></div>
            <div class="acts">
              ${me && !mine ? `<button title="דיווח" data-act="report" data-id="${m.id}">${ic('flag',13)}</button>`:''}
              ${canModT || mine ? `<button title="מחיקה" data-act="del" data-id="${m.id}">${ic('trash',13)}</button>`:''}
            <button class="reply-btn" data-chat="c" data-mid="${m.id}" data-mtxt="${esc((m.text||'').substring(0,80))}" data-mname="${esc(m.senderName||'')}">↩</button></div></div>`;
        }).join('') : `<p class="tiny mute">אין עדיין תגובות. תהיו הראשונים.</p>`}
      </div>`;
    const last = reps[reps.length-1];
    if(last && !first && last.id !== lastSeen && last.senderId !== me?.id) Sfx.play('msgIn');
    if(last) lastSeen = last.id;
    first = false;

    box.querySelectorAll('.acts button').forEach(b=>{
      b.onclick = async ()=>{
        const act = b.dataset.act, mid = b.dataset.id;
        if(act==='report') reportMessageModal(reps.find(x=>x.id===mid), s.id);
        if(act==='del'){
          if(!(await confirmBox('מחיקת תגובה','התגובה תוסתר ותישמר ביומן.','מחיקה',true))) return;
          await Store.update('tmsgs', mid, { deleted:true, deletedBy:me.name, deletedAt:nowISO() });
          await serverAudit( { type:'delete_thread_reply', msgId:mid, byId:me.id, byName:me.name, createdAt:nowISO() });
          toast('התגובה הוסרה');
        }
      };
    });
    const pin = $('#thPin'); if(pin) pin.onclick = async ()=>{ await Store.update('threads', cur.id, { pinned: !cur.pinned }); render(); };
    const lk  = $('#thLock'); if(lk) lk.onclick = async ()=>{ await Store.update('threads', cur.id, { locked: !cur.locked }); render(); };
    const dl  = $('#thDel'); if(dl) dl.onclick = async ()=>{
      if(!(await confirmBox('מחיקת שרשור','השרשור והתגובות יוסתרו. הנתונים נשמרים בארכיון.','מחיקה',true))) return;
      await Store.update('threads', cur.id, { deleted:true, deletedBy:me.name, deletedAt:nowISO() });
      toast('השרשור נמחק'); location.hash = `#/server/${s.id}/${encodeURIComponent(ch.id)}`;
    };
  };
  onCleanup(Store.watch('tmsgs', paint));

  const sendT = async ()=>{
    const inp = $('#tin'); if(!inp) return;
    const txt = inp.value.trim(); if(!txt || !me) return;
    const mod = moderate(txt);
    if(mod.violation && mod.severity >= 3){ Sfx.play('error'); return toast('התגובה נחסמה — היא מפרה את כללי הקהילה','err'); }
    inp.disabled = true;
    try{
      await Store.add('tmsgs', { thread:cur.id, server:s.id, channel:ch.id,
        senderId:me.id, senderName:me.name||me.email, senderRank:me.rank,
        text:txt, flagged:mod.violation, createdAt:nowISO() });
      // Reply counters are maintained by the server.
      Sfx.play('msgOut');
      if(cur.authorId && cur.authorId !== me.id)
        mailUser(cur.authorId, 'mention', MAIL_TPL.threadReply(me.name||me.email, cur.title, txt.slice(0,180))).catch(()=>{});
      notifyMentions(txt, s.name+' / '+cur.title, users).catch(()=>{});
    }catch(e){
      const c = String(e?.code||e?.message||'');
      if(c.includes('permission-denied')||c.includes('PERMISSION_DENIED'))
        toast('שגיאת הרשאות Firestore — עברו ל-#/setup להגדרת הכללים','err');
      else toast('שליחה נכשלה: '+(e?.message||c||'שגיאה לא ידועה'),'err');
      inp.value = txt;
    }
    finally{ inp.disabled=false; inp.focus(); }
  };
  const tb = $('#tbtn'); if(tb) tb.onclick = sendT;
  const ti = $('#tin'); if(ti) ti.addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey) sendT(); });
}

/* איתור @אזכורים ושליחת התראה במייל */
async function notifyMentions(text, where, users){
  const tags = (String(text).match(/@([\u0590-\u05FFa-zA-Z0-9_.\-]{2,30})/g) || []).map(t=>t.slice(1).toLowerCase());
  if(!tags.length) return;
  const me = Auth.user;
  const hit = (users||[]).filter(u=>{
    if(!u.id || u.id === me?.id) return false;
    const n = String(u.name||'').toLowerCase().replace(/\s+/g,'');
    return tags.some(t=>n && (n === t || n.startsWith(t) || t.startsWith(n)));
  });
  for(const u of hit.slice(0,8))
    await mailUser(u.id, 'mention', MAIL_TPL.mention(me?.name||'משתמש', where, text.slice(0,200)));
}

async function deleteMessage(mid){
  if(!(await confirmBox('מחיקת הודעה','ההודעה תוסתר מכל המשתמשים ותישמר ביומן המודרציה.','מחיקה',true))) return;
  await Store.update('cmsgs', mid, { deleted:true, deletedBy:Auth.user.name, deletedAt:nowISO() });
  await serverAudit( { type:'delete_message', msgId:mid, byId:Auth.user.id, byName:Auth.user.name, createdAt:nowISO() });
  toast('ההודעה הוסרה');
}

/* ===================== דיווח על הודעה ===================== */
function reportMessageModal(msg, serverId){
  if(!msg) return;
  openModal(`
  <div class="m-h"><span class="ico-tile i-dang">${ic('flag',20)}</span>
    <div style="flex:1"><h3 style="margin:0">דיווח על הודעה</h3>
    <div class="tiny mute">הדיווח נבדק אוטומטית ומועבר לצוות המודרציה</div></div></div>
  <div class="m-b">
    <div class="card pad-sm" style="background:var(--surface2);margin-bottom:16px">
      <div class="tiny mute" style="margin-bottom:4px">${esc(msg.senderName||'')} · ${fmtTime(msg.createdAt)}</div>
      <div class="small" style="white-space:pre-wrap">${esc(String(msg.text||'').slice(0,340))}</div>
    </div>
    <div class="field"><label class="fl">מה הבעיה בהודעה?</label>
      <div class="stack" style="gap:8px">
        ${MSG_REPORTS.map((r,i)=>`<label class="opt ${i===1?'on':''}" data-r="${r.id}">
          <div class="row between"><b style="font-size:.92rem">${esc(r.l)}</b>
            <input type="radio" name="rcat" value="${r.id}" ${i===1?'checked':''} style="accent-color:var(--brand)"></div>
          <div class="tiny mute">${esc(r.d)}</div></label>`).join('')}
      </div></div>
    <div class="field"><label class="fl">פרטים נוספים (לא חובה)</label>
      <textarea id="rdet" style="min-height:80px" placeholder="הקשר שיעזור לנו להבין"></textarea></div>
    <div id="rout"></div>
  </div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
    <button class="btn btn-d" id="rgo">${ic('flag',15)} שליחת דיווח</button></div>`);

  $$('#modal .opt').forEach(o=>o.onclick = ()=>{
    $$('#modal .opt').forEach(x=>x.classList.remove('on')); o.classList.add('on');
    o.querySelector('input').checked = true;
  });

  $('#rgo').onclick = async ()=>{
    const cat = $('#modal input[name=rcat]:checked')?.value || 'other';
    const meta = MSG_REPORTS.find(m=>m.id===cat);
    const det = $('#rdet').value.trim();
    const out = $('#rout'); $('#rgo').disabled = true;
    /* אנימציית סריקה */
    const steps = ['קורא את ההודעה','משווה מול כללי הקהילה','בודק היסטוריית משתמש','מגבש המלצה'];
    out.innerHTML = `<div class="ai-box"><div class="ai-h">${ic('sparkle',16)} מנוע SMAI בודק</div>
      <div class="ai-scan" id="sstep">${steps[0]}</div><div class="meter" style="margin-top:9px"><i id="sbar" style="width:12%"></i></div></div>`;
    for(let i=1;i<steps.length;i++){
      await new Promise(r=>setTimeout(r,430));
      $('#sstep').textContent = steps[i]; $('#sbar').style.width = ((i+1)/steps.length*100)+'%';
    }
    await new Promise(r=>setTimeout(r,380));

    const auto = moderate(msg.text);
    const sev = Math.max(auto.severity, meta.sev - 1);
    const violation = auto.violation || meta.sev >= 3;
    const action = !violation ? 'none' : sev>=4 ? 'escalate' : sev===3 ? 'delete_mute' : sev===2 ? 'delete_warn' : 'review';

    if (!rateLimit('report_' + (Auth.user?.id||'anon'), 60000)) return toast('המתן דקה לפני שליחה נוספת','warn');
    await Store.add('reports', { type:'message', msgId:msg.id, server:serverId,
      targetId:msg.senderId, targetName:msg.senderName, text:String(msg.text||'').slice(0,500),
      cat, catLabel:meta.l, details:det, byId:Auth.user?.id||null, byName:Auth.user?.name||'אנונימי',
      aiViolation:violation, aiSeverity:sev, aiAction:action, aiHits:(auto.hits||[]).slice(0,6),
      status:'pending', createdAt:nowISO() });

    if(action==='delete_mute' || action==='delete_warn' || action==='escalate'){
      await Store.update('cmsgs', msg.id, { deleted:true, deletedBy:'SMAI AI', deletedAt:nowISO() });
    }
    if(action==='escalate'){
      await Store.add('tickets', { code:ticketCode(), title:`דיווח חמור בקהילה — ${meta.l}`,
        description:`הודעה שדווחה בשרת: "${String(msg.text||'').slice(0,300)}"\n\nפרטי המדווח: ${det||'—'}`,
        dept: cat==='sexual' ? 'sextortion' : cat==='danger' ? 'child' : 'harassment',
        status:'new', priority:'critical', critical:true, confidence:88, urgency:95,
        anonymous:false, reporterName:Auth.user?.name||'', reporterId:Auth.user?.id||null,
        assignedTo:null, assignedName:'', source:'community', updatedAt:nowISO(), createdAt:nowISO() });
    }

    const box = { none:['c-info','check','לא נמצאה הפרה'], review:['c-warn','flag','הועבר לבדיקת מודרטור'],
      delete_warn:['c-warn','trash','ההודעה הוסרה'], delete_mute:['c-dang','volume-x','ההודעה הוסרה והמשתמש יושתק'],
      escalate:['c-dang','alert','טופל כאירוע חירום'] }[action];
    out.innerHTML = `<div class="callout ${box[0]}" style="animation:pop .4s var(--ease2)">
      <span class="ic">${ic(box[1],19)}</span>
      <div><b>${box[2]}.</b> ${esc(violation? (auto.explain||'הדיווח נבדק והועבר לצוות.') : 'לא זוהתה הפרה אוטומטית, אבל מודרטור אנושי יעבור על הדיווח.')}
      ${action==='escalate'?'<br><b>נפתחה פנייה דחופה</b> וצוות אנושי יטפל בה מיידית.':''}</div></div>`;
    $('#rgo').outerHTML = `<button class="btn btn-p" onclick="closeModal()">סיום</button>`;
    toast('הדיווח נשלח. תודה שעזרת לשמור על הקהילה');
  };
}

/* ===================== פעולות על משתמש ===================== */
async function userActionsModal(userId, usersCache){
  const users = usersCache || await Store.list('users');
  const u = users.find(x=>x.id===userId) || await Store.get('users', userId);
  if(!u) return toast('המשתמש לא נמצא','err');
  const me = Auth.user;
  const higher = lvl(u) >= lvl(me);
  const banned = u.isBanned && (!u.banUntil || new Date(u.banUntil) > new Date());
  const muted  = u.muteUntil && new Date(u.muteUntil) > new Date();

  openModal(`
  <div class="m-h">${avatar(u,'l')}<div style="flex:1"><h3 style="margin:0">${esc(u.name||u.email)}</h3>
    <div class="small mute">${esc(u.email||'')}</div>
    <div style="margin-top:5px">${rankBadge(u.rank)}
      ${banned?'<span class="b b-dang">מורחק</span>':''}${muted?'<span class="b b-warn">מושתק</span>':''}</div></div></div>
  <div class="m-b">
    <dl class="kv small" style="margin-bottom:18px">
      <dt>הצטרף</dt><dd>${fmtDate(u.createdAt)}</dd>
      <dt>דרגה</dt><dd>${RANKS[u.rank]?.l||'משתמש'}</dd>
      <dt>מחלקה</dt><dd>${u.dept?esc(DEPT_BY[u.dept]?.name||u.dept):'—'}</dd>
      <dt>אזהרות</dt><dd>${u.warnings||0}</dd>
      ${banned?`<dt>סיבת הרחקה</dt><dd>${esc(u.banReason||'—')}</dd>
        <dt>עד</dt><dd>${u.banUntil?fmtDate(u.banUntil)+' '+fmtTime(u.banUntil):'לצמיתות'}</dd>`:''}
    </dl>
    ${higher?`<div class="callout c-warn"><span class="ic">${ic('alert',18)}</span>
      <div>אין לך הרשאה לבצע פעולות על משתמש בדרגה זהה או גבוהה משלך.</div></div>`:`
    <div class="stack" style="gap:8px">
      ${Auth.can('mute') && !muted ? `<button class="btn btn-g btn-block" id="uaMute">${ic('volume-x',16)} השתקה זמנית</button>`:''}
      ${muted ? `<button class="btn btn-g btn-block" id="uaUnmute">${ic('check',16)} ביטול השתקה</button>`:''}
      ${Auth.can('ban') && !banned ? `<button class="btn btn-d btn-block" id="uaBan">${ic('ban',16)} הרחקה מהמערכת</button>`:''}
      ${banned && Auth.can('ban') ? `<button class="btn btn-ok btn-block" id="uaUnban">${ic('check',16)} ביטול הרחקה</button>`:''}
      ${Auth.can('manageUsers') ? `<button class="btn btn-g btn-block" id="uaRank">${ic('star',16)} שינוי דרגה ומחלקה</button>`:''}
      ${['admin','founder'].includes(Auth.user?.rank) ? `<button class="btn btn-g btn-block" id="uaAge">${ic('shield',16)} בדיקת והגדרת גיל</button>`:''}
      <button class="btn btn-ghost btn-block" id="uaWarn">${ic('alert',16)} רישום אזהרה</button>
    </div>`}
  </div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">סגירה</button></div>`);

  const el = s => $('#'+s);
  el('uaMute') && (el('uaMute').onclick = ()=>muteModal(u));
  el('uaUnmute') && (el('uaUnmute').onclick = async ()=>{ await Store.update('users',u.id,{muteUntil:null}); closeModal(); toast('ההשתקה בוטלה'); });
  el('uaBan') && (el('uaBan').onclick = ()=>banModal(u));
  el('uaUnban') && (el('uaUnban').onclick = async ()=>{
    await Store.update('users',u.id,{isBanned:false,banUntil:null,banReason:'',banNote:''});
    await serverAudit({type:'unban',targetId:u.id,targetName:u.name,byName:Auth.user.name,createdAt:nowISO()});
    closeModal(); toast('ההרחקה בוטלה'); render();
  });
  el('uaRank') && (el('uaRank').onclick = ()=>rankModal(u));
  el('uaAge') && (el('uaAge').onclick = ()=>ageReviewModal(u));
  el('uaWarn') && (el('uaWarn').onclick = async ()=>{
    await Store.update('users',u.id,{ warnings:(u.warnings||0)+1 });
    await serverAudit({type:'warn',targetId:u.id,targetName:u.name,byName:Auth.user.name,createdAt:nowISO()});
    closeModal(); toast('נרשמה אזהרה למשתמש');
  });
}

function ageReviewModal(u){
  openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('shield',20)}</span><h3>בדיקת גיל — ${esc(u.name||'משתמש')}</h3></div><div class="m-b"><p class="small mute">אין שימוש בצילום פנים. השינוי נשמר עם שם המנהל והסיבה.</p><div class="field"><label>פעולה</label><select id="ageReviewAction"><option value="staff_reviewed">קביעת קבוצת גיל</option><option value="reverify_required">דרישת אימות חוזר</option><option value="reset">איפוס הגדרת הגיל</option></select></div><div class="field"><label>קבוצת גיל</label><select id="ageReviewBand"><option value="under10">מתחת לגיל 10</option><option value="10to12">10–12</option><option value="13to17">13–17</option><option value="adult">18 ומעלה</option></select></div><div class="field"><label>סיבה</label><textarea id="ageReviewNote" minlength="10" maxlength="500" placeholder="מדוע נדרש השינוי?"></textarea></div><p id="ageReviewStatus" class="small"></p></div><div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button><button class="btn btn-p" id="ageReviewSave">שמירה ותיעוד</button></div>`);
  $('#ageReviewBand').value=u.ageBand||'13to17';$('#ageReviewAction').onchange=e=>$('#ageReviewBand').disabled=e.target.value!=='staff_reviewed';
  $('#ageReviewSave').onclick=async()=>{const note=$('#ageReviewNote').value.trim(),status=$('#ageReviewAction').value;if(note.length<10)return $('#ageReviewStatus').textContent='נדרש הסבר של לפחות 10 תווים.';const b=$('#ageReviewSave');b.disabled=true;try{const patch={ageVerificationStatus:status,ageReviewNote:`${Auth.user.name}: ${note}`};if(status==='staff_reviewed')patch.ageBand=$('#ageReviewBand').value;else if(status==='reset')patch.ageBand=null;await Store.update('users',u.id,patch);await serverAudit({type:'age_review',targetId:u.id,targetName:u.name,reason:note,byName:Auth.user.name,createdAt:nowISO()});closeModal();toast(status==='reverify_required'?'נדרש אימות גיל חוזר':'הגדרת הגיל עודכנה');}catch(err){$('#ageReviewStatus').textContent=err.message;b.disabled=false;}};
}

function muteModal(u){
  openModal(`<div class="m-h"><span class="ico-tile i-warn">${ic('volume-x',20)}</span><h3>השתקת ${esc(u.name||'')}</h3></div>
  <div class="m-b"><p class="small mute">המשתמש יוכל לקרוא בקהילה אבל לא לכתוב, עד תום התקופה.</p>
    <div class="grid g2" style="gap:12px">
      <div class="field"><label class="fl">משך</label><input type="number" id="mV" value="60" min="1"></div>
      <div class="field"><label class="fl">יחידה</label><select id="mU">
        <option value="minutes">דקות</option><option value="hours">שעות</option><option value="days">ימים</option></select></div>
    </div>
    <div class="field"><label class="fl">סיבה</label><input type="text" id="mR" value="שפה פוגענית בקהילה"></div></div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
    <button class="btn btn-p" id="mGo">${ic('check',15)} השתקה</button></div>`);
  $('#mGo').onclick = async ()=>{
    const v = +$('#mV').value||60, unit = $('#mU').value;
    const ms = { minutes:60e3, hours:3600e3, days:864e5 }[unit] * v;
    const until = new Date(Date.now()+ms).toISOString();
    await Store.update('users', u.id, { muteUntil:until, muteReason:$('#mR').value });
    await serverAudit( { type:'mute', targetId:u.id, targetName:u.name, until, reason:$('#mR').value,
      byName:Auth.user.name, createdAt:nowISO() });
    closeModal(); toast(`${u.name} הושתק עד ${fmtDate(until)} ${fmtTime(until)}`);
  };
}

function banModal(u){
  openModal(`
  <div class="m-h"><span class="ico-tile i-dang">${ic('ban',20)}</span>
    <div style="flex:1"><h3 style="margin:0">הרחקת ${esc(u.name||u.email)}</h3>
    <div class="tiny mute">הפעולה נרשמת ביומן המודרציה ותוצג למשתמש</div></div></div>
  <div class="m-b">
    <div class="grid g2" style="gap:12px">
      <div class="field"><label class="fl">משך ההרחקה</label><input type="number" id="bV" value="7" min="1"></div>
      <div class="field"><label class="fl">יחידה</label><select id="bU">
        ${Object.entries(BAN_UNITS).map(([k,v])=>`<option value="${k}" ${k==='days'?'selected':''} ${k==='permanent'&&!Auth.can('banPermanent')?'disabled':''}>${v}</option>`).join('')}
      </select>${!Auth.can('banPermanent')?'<div class="hint">הרחקה לצמיתות דורשת דרגת ראש מחלקה ומעלה.</div>':''}</div>
    </div>
    <div class="field"><label class="fl">סיבה <span class="req">*</span></label>
      <select id="bR">${BAN_REASONS.map(r=>`<option>${esc(r)}</option>`).join('')}</select></div>
    <div class="field"><label class="fl">התוכן המפר (יוצג למשתמש)</label>
      <input type="text" id="bI" placeholder="ההודעה או הפעולה שהובילה להרחקה"></div>
    <div class="field"><label class="fl">הערת מודרטור</label>
      <textarea id="bN" style="min-height:80px">הורחק בעקבות הפרה של כללי הקהילה ותנאי השימוש.</textarea></div>
    <div class="callout c-warn"><span class="ic">${ic('alert',18)}</span>
      <div>המשתמש יראה מסך הרחקה עם הסיבה, המשך ואפשרות להגיש ערעור.</div></div>
  </div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
    <button class="btn btn-d" id="bGo">${ic('ban',15)} אישור הרחקה</button></div>`);
  $('#bGo').onclick = async ()=>{
    const unit = $('#bU').value, v = +$('#bV').value||1;
    let until = null;
    if(unit !== 'permanent'){
      const ms = { minutes:60e3, hours:3600e3, days:864e5, months:2592e6 }[unit] * v;
      until = new Date(Date.now()+ms).toISOString();
    }
    await Store.update('users', u.id, { isBanned:true, banUntil:until, banReason:$('#bR').value,
      banItem:$('#bI').value, banNote:$('#bN').value, bannedAt:nowISO(), bannedBy:Auth.user.name, banAppeal:null });
    await serverAudit( { type:'ban', targetId:u.id, targetName:u.name||u.email, until,
      reason:$('#bR').value, byId:Auth.user.id, byName:Auth.user.name, createdAt:nowISO() });
    closeModal(); toast(`${u.name||u.email} הורחק ${until?`עד ${fmtDate(until)}`:'לצמיתות'}`,'warn'); render();
  };
}

function rankModal(u){
  const myLvl = lvl(Auth.user);
  openModal(`<div class="m-h"><span class="ico-tile i-violet">${ic('star',20)}</span><h3>דרגה ומחלקה — ${esc(u.name||'')}</h3></div>
  <div class="m-b">
    <div class="field"><label class="fl">דרגה</label>
      <select id="rkR">${RANK_ORDER.map(k=>{
        const r = RANKS[k];
        const blocked = r.lvl >= myLvl && !Auth.can('setRankAdmin');
        return `<option value="${k}" ${u.rank===k?'selected':''} ${blocked?'disabled':''}>${r.l}${blocked?' — מעל הדרגה שלך':''}</option>`;
      }).join('')}</select></div>
    <div class="field"><label class="fl">מחלקה</label>
      <select id="rkD"><option value="">ללא שיוך</option>
        ${DEPTS.map(d=>`<option value="${d.id}" ${u.dept===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></div>
    <div class="card pad-sm" style="background:var(--surface2)">
      <div class="tiny mute" style="margin-bottom:6px">היררכיית הדרגות</div>
      <div class="row" style="gap:5px">${RANK_ORDER.map(k=>`<span class="rank ${RANKS[k].cls}">${RANKS[k].l}</span>`).join('')}</div>
    </div>
  </div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
    <button class="btn btn-p" id="rkGo">${ic('check',15)} שמירה</button></div>`);
  $('#rkGo').onclick = async ()=>{
    const nr = $('#rkR').value;
    await Store.update('users', u.id, { rank:nr, rankLvl:(RANKS[nr]||RANKS.citizen).lvl, dept:$('#rkD').value||null });
    await serverAudit( { type:'rank', targetId:u.id, targetName:u.name, reason:`דרגה: ${RANKS[nr].l}`,
      byName:Auth.user.name, createdAt:nowISO() });
    closeModal(); toast('הדרגה עודכנה'); render();
  };
}

/* ===================== מסך הרחקה ===================== */
function renderBanned(app){
  const b = Auth.banInfo(); if(!b) return false;
  app.innerHTML = `
  <div class="ban-screen">
    <div class="ban-head">
      <div style="width:64px;height:64px;border-radius:22px;background:rgba(255,255,255,.16);display:grid;place-items:center;margin:0 auto 16px">${ic('ban',30)}</div>
      <h1 style="font-size:1.8rem">החשבון שלך הורחק</h1>
      <p style="color:rgba(255,255,255,.9);margin:0">${b.perm?'הרחקה לצמיתות':`עד ${fmtDate(b.until)} ${fmtTime(b.until)}`}</p>
    </div>
    <div class="ban-body">
      <dl class="kv" style="margin-bottom:20px">
        <dt>סיבה</dt><dd>${esc(b.reason)}</dd>
        ${b.item?`<dt>התוכן המפר</dt><dd>${esc(b.item)}</dd>`:''}
        <dt>תאריך</dt><dd>${fmtDate(b.at)} ${fmtTime(b.at)}</dd>
        <dt>משך</dt><dd>${b.perm?'לצמיתות':`עד ${fmtDate(b.until)}`}</dd>
      </dl>
      ${b.note?`<div class="callout c-warn" style="margin-bottom:18px"><span class="ic">${ic('info',18)}</span>
        <div><b>הערת מודרטור:</b> ${esc(b.note)}</div></div>`:''}
      <p class="small mute">בזמן ההרחקה אין אפשרות לכתוב בקהילה. פניות דיווח קיימות ממשיכות להיות מטופלות כרגיל,
        ובמצב סכנה מיידית אפשר תמיד להתקשר למשטרה, 100.</p>
      <div class="row" style="margin-top:18px">
        <button class="btn btn-p" id="apBtn">${ic('message',16)} הגשת ערעור</button>
        <a class="btn btn-g" href="/">חזרה לדף הבית</a>
      </div>
      <div id="apOut" style="margin-top:14px"></div>
    </div>
  </div>`;
  $('#apBtn').onclick = ()=>{
    if(Auth.user?.banAppeal) return toast('כבר הגשת ערעור. הצוות בודק אותו.','warn');
    openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('message',20)}</span><h3>הגשת ערעור</h3></div>
    <div class="m-b"><p class="small mute">הסבירו בכמה משפטים למה לדעתכם ההרחקה שגויה או לא פרופורציונלית.
      הערעור נבדק על ידי מודרטור אנושי.</p>
      <div class="field"><textarea id="apTxt" style="min-height:130px" placeholder="הערעור שלי..."></textarea></div></div>
    <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
      <button class="btn btn-p" id="apGo">${ic('send',15)} שליחה</button></div>`);
    $('#apGo').onclick = async ()=>{
      const txt = $('#apTxt').value.trim();
      if(txt.length < 12) return toast('נשמח לעוד כמה מילים','warn');
      await Store.update('users', Auth.user.id, { banAppeal:txt, banAppealAt:nowISO(), banAppealStatus:'pending' });
      await Store.add('appeals', { userId:Auth.user.id, userName:Auth.user.name, text:txt,
        banReason:Auth.user.banReason||'', status:'pending', createdAt:nowISO() });
      closeModal(); toast('הערעור נשלח. נעדכן אותך בהקדם.');
      $('#apOut').innerHTML = `<div class="callout c-ok"><span class="ic">${ic('check',18)}</span>
        <div>הערעור התקבל וממתין לבדיקה.</div></div>`;
    };
  };
  return true;
}

/* =====================================================================
   פרופיל משתמש, דיווח על פרופיל, וצ׳אטים פרטיים
   ===================================================================== */
async function openProfile(userId){
  if(!userId) return;
  const [u,follows,rels,profileStats] = await Promise.all([Store.get('users', userId),Store.list('followers').catch(()=>[]),Auth.user?Friends.mine(Auth.user.id):[],Auth.user?request('/api/profile-stats/'+encodeURIComponent(userId)).catch(()=>({praiseCount:0,online:null})):Promise.resolve({praiseCount:0,online:null})]);
  if(!u){ toast('המשתמש לא נמצא','warn'); return; }
  const me = Auth.user;
  const r = RANKS[u.rank] || RANKS.citizen;
  const followers=follows.filter(f=>f.to===userId),following=follows.filter(f=>f.from===userId),myFollow=me&&followers.find(f=>f.from===me.id),friendState=me?Friends.status(rels,me.id,userId):'none';
  const socials=(me?.ageBand==='under10'&&u.rank!=='founder'?[]:[['instagram','Instagram'],['tiktok','TikTok'],['roblox','Roblox'],['twitter','X / Twitter'],['youtube','YouTube'],['discord','Discord'],['facebook','Facebook'],['linkedin','LinkedIn'],['twitch','Twitch']]).filter(([k])=>u.socialLinks?.[k]);
  openModal(`
  <div class="m-h"><span>${avatar({ ...u, id:userId },'l')}</span>
    <div style="flex:1"><h3 style="margin:0">${esc(u.name||'משתמש')}
      ${u.verified&&u.privacy?.showVerified!==false?`<span class="verified" title="חשבון מאומת">${ic('check',11,3)}</span>`:''}</h3>
      <div class="row" style="gap:6px;margin-top:5px">${rankBadge(u.rank)}
        ${u.isOwner?'<span class="b b-brand">בעל האתר</span>':''}
        ${u.isBanned?'<span class="b b-dang">מורחק</span>':''}
        <span class="b b-gray">${ic('clock',11)} מאז ${fmtDate(u.createdAt)}</span>
        <span class="b ${profileStats.online===true?'b-ok':profileStats.online===false?'b-gray':'b-violet'}"><i class="presence-dot"></i>${profileStats.online===true?'אונליין':profileStats.online===false?'אופליין':'מצב מוסתר'}</span></div><div class="tiny mute" style="margin-top:6px">${u.lastSeenAt?'נראה לאחרונה '+fmtDate(u.lastSeenAt)+' בשעה '+fmtTime(u.lastSeenAt):'מצב פעילות מוסתר'}</div></div></div>
  <div class="m-b">
    ${u.bio?`<div class="card pad-sm" style="background:var(--surface2);margin-bottom:14px">
      <div class="tiny mute" style="margin-bottom:4px">קצת עליי</div>
      <div class="small" style="white-space:pre-wrap">${esc(u.bio)}</div></div>`:
      '<p class="small mute">המשתמש לא הוסיף תיאור לפרופיל.</p>'}
    <dl class="kv small"><dt>דרגה</dt><dd>${esc(r.l)}</dd>
      ${u.dept?`<dt>מחלקה</dt><dd>${esc((DEPT_BY[u.dept]||DEPT_BY.other).short)}</dd>`:''}
    </dl>
    ${u.privacy?.showFollowers===false&&me?.id!==userId?`<div class="profile-stats"><div class="profile-stat"><b>${profileStats.praiseCount}</b><small>מילים טובות משולחים שונים</small></div></div><p class="small mute">המשתמש הסתיר את רשימות העוקבים.</p>`:`<div class="profile-stats profile-stats-three"><div class="profile-stat"><b>${followers.length}</b><small>עוקבים</small></div><div class="profile-stat"><b>${following.length}</b><small>נעקבים</small></div><div class="profile-stat"><b>${profileStats.praiseCount}</b><small>מילים טובות משולחים שונים</small></div></div>`}
    ${socials.length?`<div class="row" style="margin-top:13px">${socials.map(([k,l])=>`<a class="btn btn-g btn-sm" href="${esc(u.socialLinks[k])}" target="_blank" rel="noopener noreferrer nofollow">${esc(l)}</a>`).join('')}</div>`:''}
  </div>
  <div class="m-f">
    <button class="btn btn-g" onclick="closeModal()">סגירה</button>
    ${me && me.id!==userId ? `<button class="btn btn-ghost" id="pfReport">${ic('flag',15)} דיווח על הפרופיל</button>
      <button class="btn btn-g" id="pfFollow">${myFollow?'הפסקת מעקב':'מעקב'}</button>
      ${friendState==='none'?`<button class="btn btn-g" id="pfFriend">${ic('plus',15)} בקשת חברות</button>`:''}
      <button class="btn btn-p" id="pfDm">${ic('message',15)} הודעה פרטית</button>`:''}
  </div>`);
  const rp = $('#pfReport'); if(rp) rp.onclick = ()=>reportProfileModal({ ...u, id:userId });
  const dm = $('#pfDm'); if(dm) dm.onclick = async ()=>{ closeModal(); const c = await openDM(userId, u.name||u.email); location.hash = '#/dm/'+c.id; };
  const follow=$('#pfFollow');if(follow)follow.onclick=async()=>{follow.disabled=true;try{if(myFollow)await Store.remove('followers',myFollow.id);else await Store.add('followers',{to:userId});closeModal();toast(myFollow?'המעקב הופסק':'התחלת לעקוב');openProfile(userId);}catch(e){toast(e.message||'הפעולה נכשלה','err');follow.disabled=false;}};
  const friend=$('#pfFriend');if(friend)friend.onclick=async()=>{friend.disabled=true;try{await Friends.request(userId,u.name);friend.textContent='הבקשה נשלחה';toast('בקשת החברות נשלחה');}catch(e){toast(e.message||'הפעולה נכשלה','err');friend.disabled=false;}};
}
window.openProfile = openProfile;

/* ---------- דיווח על פרופיל ---------- */
function reportProfileModal(u){
  openModal(`
  <div class="m-h"><span class="ico-tile i-dang">${ic('flag',20)}</span>
    <div style="flex:1"><h3 style="margin:0">דיווח על הפרופיל של ${esc(u.name||'משתמש')}</h3>
      <div class="tiny mute">בחרו את הסיבה, ואז ספרו לנו בקצרה מה קרה</div></div></div>
  <div class="m-b">
    <div class="field"><label class="fl">מה הבעיה בפרופיל?</label>
      <div class="stack" style="gap:8px">
        ${PROFILE_REPORTS.map((r,i)=>`<label class="opt ${i===2?'on':''}" data-r="${r.id}">
          <div class="row between"><b style="font-size:.92rem">${esc(r.l)}</b>
            <input type="radio" name="pcat" value="${r.id}" ${i===2?'checked':''} style="accent-color:var(--brand)"></div>
          <div class="tiny mute">${esc(r.d)}</div></label>`).join('')}
      </div></div>
    <div class="field"><label class="fl">הסבר <span class="req">*</span></label>
      <textarea id="pdet" style="min-height:100px" placeholder="מה בדיוק פוגעני, מתי זה קרה, והאם זה חוזר על עצמו"></textarea>
      <div class="hint">הסבר טוב מקצר את זמן הטיפול. הדיווח אנונימי כלפי המשתמש המדווח עליו.</div></div>
    <div id="prout"></div>
  </div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
    <button class="btn btn-d" id="prgo">${ic('flag',15)} שליחת דיווח</button></div>`);

  $$('#modal .opt').forEach(o=>o.onclick = ()=>{
    $$('#modal .opt').forEach(x=>x.classList.remove('on')); o.classList.add('on');
    o.querySelector('input').checked = true;
  });
  $('#prgo').onclick = async ()=>{
    const cat = $('#modal input[name=pcat]:checked')?.value || 'other';
    const meta = PROFILE_REPORTS.find(x=>x.id===cat) || PROFILE_REPORTS[6];
    const det = $('#pdet').value.trim();
    if(det.length < 10) return $('#prout').innerHTML = '<div class="err">נשמח לכמה מילים של הסבר — לפחות 10 תווים</div>';
    $('#prgo').disabled = true;
    const out = $('#prout');
    const steps = ['קורא את הדיווח','בודק את הפרופיל','משווה מול כללי הקהילה','בודק היסטוריית מודרציה','מגבש המלצה'];
    out.innerHTML = `<div class="ai-box"><div class="ai-h">${ic('bot',16)} מנוע SMAI בודק</div>
      <div class="ai-scan" id="pstep">${steps[0]}</div><div class="meter" style="margin-top:9px"><i id="pbar" style="width:12%"></i></div></div>`;
    for(let i=1;i<steps.length;i++){
      await new Promise(r=>setTimeout(r,380));
      const st=$('#pstep'), bar=$('#pbar'); if(!st) return;
      st.textContent = steps[i]; bar.style.width = Math.round(((i+1)/steps.length)*100)+'%';
    }
    const mod = moderate(det + ' ' + (u.bio||'') + ' ' + (u.name||''));
    const sev = Math.max(meta.sev, mod.severity||0);
    await Store.add('reports', { kind:'profile', targetId:u.id, targetName:u.name||u.email,
      cat, catLabel: meta.l, details: det, severity: sev,
      byId: Auth.user?.id||null, byName: Auth.user?.name||'אנונימי',
      status:'pending', autoAction: sev>=4?'escalate':sev>=3?'review_urgent':'review', createdAt: nowISO() });
    await serverAudit( { type:'report_profile', targetId:u.id, targetName:u.name||u.email,
      reason: meta.l, byName: Auth.user?.name||'אנונימי', createdAt: nowISO() });
    if(sev >= 4 && Auth.can('mute')){ /* דיווחי חומרה 4 מקבלים טיפול מיידי מצוות */ }
    out.innerHTML = `<div class="callout ${sev>=4?'c-dang':'c-ok'}"><span class="ic">${ic(sev>=4?'alert':'check',18)}</span>
      <div><b>${sev>=4?'הדיווח סווג כחמור והועבר מיד לצוות מודרציה בכיר.':'הדיווח התקבל ונמצא בבדיקה.'}</b><br>
      <span class="small">סיווג: ${esc(meta.l)} · רמת חומרה ${['','קלה','בינונית','חמורה','קריטית'][sev]||'קלה'}.
      נעדכן אתכם במייל כשתתקבל החלטה (אפשר לכבות בהגדרות).</span></div></div>`;
    $('#prgo').style.display='none';
    if(Auth.user) await mailUser(Auth.user.id, 'moderation',
      MAIL_TPL.moderation('הדיווח שלך על פרופיל התקבל',
        `דיווחת על "${u.name||''}" בסיבה: ${meta.l}. הדיווח בבדיקה של צוות המודרציה.`));
    toast('הדיווח נשלח');
  };
}

/* ---------- צ׳אטים פרטיים ---------- */
function dmKey(a,b){ return [a,b].sort().join('__'); }
async function openDM(otherId, otherName){
  const me = Auth.user; if(!me) throw new Error('צריך להתחבר');
  const key = dmKey(me.id, otherId);
  const all = await Store.list('dms');
  let c = all.find(x=>x.key===key);
  if(!c) c = await Store.add('dms', { key, members:[me.id, otherId],
    names:{ [me.id]: me.name||me.email, [otherId]: otherName||'משתמש' },
    lastText:'', lastAt:nowISO(), ...(window._replyTo3?{replyTo:window._replyTo3}:{}),createdAt:nowISO() });
  if(window._replyTo3){window._replyTo3=null;const _br3=document.getElementById('_rBar3');if(_br3)_br3.style.display='none';}
  return c;
}
/* קבוצה פרטית = שיחה עם יותר משני משתתפים */
async function createGroup(name, memberIds, names){
  const me = Auth.user; if(!me) throw new Error('צריך להתחבר');
  const members = Array.from(new Set([me.id, ...(memberIds||[])]));
  if(members.length < 3) throw new Error('קבוצה צריכה לפחות שלושה משתתפים');
  if(members.length > 50) throw new Error('עד 50 משתתפים בקבוצה');
  const nm = {}; members.forEach(m=>{ nm[m] = (names && names[m]) || (m===me.id ? (me.name||me.email) : 'משתמש'); });
  const c = await Store.add('dms', { kind:'group', name: String(name||'קבוצה').slice(0,60),
    key:'g:'+uid(), members, names:nm, ownerId:me.id, lastText:'', lastAt:nowISO(), createdAt:nowISO() });
  await Store.add('dmsgs', { convId:c.id, system:false, senderId:me.id, senderName:me.name||me.email,
    text:`${me.name||'משתמש'} יצר/ה את הקבוצה`, createdAt:nowISO() });
  Sfx.play('join');
  for(const m of members) if(m!==me.id) mailUser(m, 'dm', MAIL_TPL.groupAdd(me.name||me.email, name)).catch(()=>{});
  return c;
}
const isGroup = c => c && (c.kind === 'group' || (c.members||[]).length > 2);
function convTitle(c, meId, users){
  if(!c) return '';
  if(isGroup(c)) return c.name || 'קבוצה';
  const o = (c.members||[]).find(x=>x!==meId);
  return (users.find(u=>u.id===o)||{}).name || c.names?.[o] || 'משתמש';
}
const lastSeenLabel=u=>u?.lastSeenAt?`נראה לאחרונה ${fmtDate(u.lastSeenAt)} · ${fmtTime(u.lastSeenAt)}`:'מצב פעילות מוסתר';

route('/dm', async (app, id)=>{
  if(!Auth.user) return app.innerHTML = requireLogin('צריך להתחבר כדי לראות הודעות פרטיות');
  if(Auth.banInfo()) return renderBanned(app);
  const me = Auth.user;
  const all = await Store.list('dms');
  const mine = all.filter(c=>(c.members||[]).includes(me.id))
                  .sort((a,b)=>String(b.lastAt).localeCompare(String(a.lastAt)));
  const users = await Store.list('users');
  const cur = id ? mine.find(c=>c.id===id) : mine[0];
  const other = cur ? (cur.members||[]).find(x=>x!==me.id) : null;
  const otherU = users.find(u=>u.id===other);

  app.innerHTML = `
  <div class="crumb anim-in"><a href="/community">קהילה</a> ← הודעות פרטיות</div>
  <div class="hub dm-window anim-up">
    <div class="hub-side">
      <div class="hs-h"><span>${ic('message',16)} שיחות</span>
        <span class="row" style="gap:4px">
          <button class="iconbtn" id="dmGrp" style="width:30px;height:30px" title="קבוצה חדשה">${ic('users',15)}</button>
          <button class="iconbtn" id="dmNew" style="width:30px;height:30px" title="שיחה חדשה">${ic('plus',15)}</button></span></div>
      <div class="hs-b" style="padding:8px">
        ${mine.length ? mine.map(c=>{
          const g = isGroup(c);
          const o = (c.members||[]).find(x=>x!==me.id);
          const ou = users.find(u=>u.id===o) || { id:o, name:c.names?.[o]||'משתמש' };
          const av = g ? `<span class="grp-av">${ic('users',16)}</span>` : avatar(ou,'s');
          return `<a class="dm-item ${cur&&c.id===cur.id?'on':''}" href="/dm/${c.id}">
            ${av}<div style="min-width:0">
              <div class="nm">${esc(convTitle(c, me.id, users))}
                ${g?`<span class="b b-gray" style="font-size:.6rem">${(c.members||[]).length}</span>`
                   :(ou.verified&&ou.privacy?.showVerified!==false?`<span class="verified">${ic('check',9,3)}</span>`:'')}</div>
              <div class="lst">${esc(c.lastText||'התחילו לשוחח')}</div>${g?'':`<div class="tiny mute">${lastSeenLabel(ou)}</div>`}</div></a>`;
        }).join('') : `<div class="tiny mute" style="padding:14px">אין עדיין שיחות פרטיות. אפשר לפתוח שיחה מכל פרופיל בקהילה, או ליצור קבוצה.</div>`}
      </div>
    </div>
    <div class="hub-main">
      ${cur ? `
      <div class="hm-h">
        ${isGroup(cur) ? `<span class="grp-av lg">${ic('users',20)}</span>` : avatar(otherU || { id:other, name:cur.names?.[other] })}
        <div style="flex:1;min-width:0"><div class="row" style="gap:6px"><b>${esc(convTitle(cur, me.id, users))}</b>
          ${isGroup(cur) ? `<span class="b b-brand" style="font-size:.62rem">קבוצה</span>` : (otherU?rankBadge(otherU.rank):'')}</div>
          <div class="tiny mute">${isGroup(cur)
            ? esc((cur.members||[]).map(m=>(users.find(u=>u.id===m)||{}).name || cur.names?.[m] || 'משתמש').join(' · ').slice(0,120))
            : `שיחה פרטית · ${lastSeenLabel(otherU)}`}</div></div>
        ${isGroup(cur)
          ? `<button class="btn btn-ghost btn-sm" id="dmMem">${ic('users',14)} משתתפים</button>`
          : `<button class="btn btn-ghost btn-sm" id="dmProf">${ic('user',14)} פרופיל</button>`}
        <button class="iconbtn" id="dmVoice" title="שיחת קול" aria-label="התחלת שיחת קול">${ic('phone',17)}</button>
        <button class="iconbtn" id="dmVideo" title="שיחת וידאו" aria-label="התחלת שיחת וידאו">${ic('camera',17)}</button>
      </div>
      <div class="hm-b chat" id="dchat" style="max-height:none">${loader()}</div>
      <div class="hm-f">
        ${!isGroup(cur)&&cur.dmAccepted===false&&cur.ownerId!==me.id?`<div class="callout c-info" id="dmRequestBar"><span class="ic">${ic('message',18)}</span><div style="flex:1"><b>בקשת הודעה חדשה</b><div class="small">אפשר לקרוא עד שתי הודעות לפני שמחליטים.</div></div><button class="btn btn-p btn-sm" id="acceptDm" type="button">אישור השיחה</button><button class="btn btn-g btn-sm" id="rejectDm" type="button">חסימה</button></div>`:''}
        ${!isGroup(cur)&&cur.dmAccepted===false&&cur.ownerId===me.id?`<div class="callout c-warn"><span class="ic">${ic('clock',18)}</span><div>זו בקשת הודעה. אפשר לשלוח עד שתי הודעות עד שהנמען יאשר את השיחה.</div></div>`:''}
        ${Auth.muted()
          ? `<div class="callout c-warn" style="padding:11px 13px;font-size:.86rem"><span class="ic">${ic('volume-x',17)}</span>
             <div>אתם מושתקים עד ${fmtTime(me.muteUntil)} ${fmtDate(me.muteUntil)}.</div></div>`
          : `<div class="composer" style="border:0;padding:0;margin:0">
              <textarea id="din" placeholder="הודעה פרטית... (Enter לשליחה)" style="min-height:46px"></textarea>
              <div id="dMentionList" class="mention-list" style="display:none;position:absolute;bottom:100%;left:0;right:0"></div>
              <button class="btn btn-p" id="dbtn" style="height:46px">${ic('send',17)}</button></div>
             <div class="tiny mute" style="margin-top:7px">${ic('shield-check',11)} גם הודעות פרטיות נסרקות. אפשר לדווח על כל הודעה.</div>`}
      </div>` : `<div class="hm-b" style="display:grid;place-items:center">
        ${emptyState('message','אין שיחה פתוחה','פתחו שיחה פרטית מכל פרופיל בקהילה, או לחצו על + כדי לבחור משתמש.',
          `<button class="btn btn-p" onclick="${bind(()=>dmPickModal())}">${ic('plus',15)} שיחה חדשה</button>`)}</div>`}
    </div>
  </div>`;

  $('#dmNew').onclick = ()=>dmPickModal();
  $('#dmGrp').onclick = ()=>groupCreateModal();
  const dp = $('#dmProf'); if(dp) dp.onclick = ()=>openProfile(other);
  const dmem = $('#dmMem'); if(dmem) dmem.onclick = ()=>groupMembersModal(cur, users);
  if(!cur) return;
  const acceptDm=$('#acceptDm');if(acceptDm)acceptDm.onclick=async()=>{acceptDm.disabled=true;try{await Store.update('dms',cur.id,{dmAccepted:true});toast('בקשת ההודעה אושרה');render();}catch(e){toast(e.message||'לא ניתן לאשר','err');acceptDm.disabled=false;}};
  const rejectDm=$('#rejectDm');if(rejectDm)rejectDm.onclick=async()=>{rejectDm.disabled=true;try{await Friends.block(other);toast('הבקשה נחסמה');location.hash='#/dm';render();}catch(e){toast(e.message||'לא ניתן לחסום','err');rejectDm.disabled=false;}};

  const box = $('#dchat');
  const paint = (list)=>{
    if(!box || $('#dchat') !== box) return;
    const msgs = list.filter(m=>m.convId===cur.id && !m.deleted)
                     .sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    box.innerHTML = msgs.length ? msgs.map(m=>{
      const isMine = m.senderId === me.id;
      if(m.system) return `<div class="sys-msg">${esc(m.text)}</div>`;
      const su = users.find(u=>u.id===m.senderId);
      return `<div class="msg ${isMine?'mine':''}" data-mid="${m.id}">
        ${avatar({ id:m.senderId, name:m.senderName, avatar:(su?.avatar || (isMine?me.avatar:otherU?.avatar)) },'s')}
        <div class="bub"><div class="who">${esc(m.senderName||'משתמש')} ${rankBadge(m.senderRank)}
          ${m.flagged?`<span class="b b-warn">${ic('flag',10)} נבדק</span>`:''}</div>
          ${m.replyTo?'<div class="reply-quote">↩ '+esc(m.replyTo.sender||'')+': '+esc((m.replyTo.text||'').substring(0,60))+'</div>':''}<div class="txt">${esc(m.text)}</div>${m.callUrl?`<a class="btn btn-p btn-sm" href="${esc(m.callUrl)}" target="_blank" rel="noopener noreferrer" style="margin-top:8px">${ic(m.callType==='video'?'camera':'phone',15)} הצטרפות לשיחה</a>`:''}<div class="tm">${fmtTime(m.createdAt)} ${isMine?`<span class="read-receipt ${m.readAt?'read':m.deliveredAt?'delivered':'sent'}" title="${m.readAt?'נקרא':m.deliveredAt?'נמסר':'נשלח'}">${m.readAt?'✓✓':m.deliveredAt?'✓✓':'✓'}</span>`:''}</div></div>
        <div class="acts">${!isMine?`<button title="דיווח" data-act="report" data-id="${m.id}">${ic('flag',13)}</button>`:''}<button class="reply-btn" data-chat="d" data-mid="${m.id}" data-mtxt="${esc((m.text||'').substring(0,80))}" data-mname="${esc(m.senderName||'')}">↩</button></div></div>`;
    }).join('') : `<div class="empty"><div class="ico">${ic('message',26)}</div><p class="small">אין עדיין הודעות בשיחה הזו.</p></div>`;
    box.scrollTop = box.scrollHeight;
    /* צליל רק על הודעה חדשה של מישהו אחר, ולא בטעינה הראשונה */
    const last = msgs[msgs.length-1];
    if(last && lastSeen && last.id !== lastSeen && last.senderId !== me.id) Sfx.play('msgIn');
    if(last) lastSeen = last.id;
    if(me.privacy?.readReceipts!==false)msgs.filter(m=>m.senderId!==me.id&&!m.readAt).forEach(m=>Store.update('dmsgs',m.id,{readAt:nowISO()}).catch(()=>{}));
    box.querySelectorAll('.acts button').forEach(b=>{
      b.onclick = ()=>reportMessageModal(msgs.find(x=>x.id===b.dataset.id), 'dm:'+cur.id);
    });
  };
  let lastSeen = null;
  onCleanup(Store.watch('dmsgs', paint));

  const sendD = async ()=>{
    const inp = $('#din'); const txt = inp.value.trim(); if(!txt) return;
    const mod = moderate(txt);
    if(mod.violation && mod.severity >= 3){
      toast('ההודעה נחסמה — היא מפרה את כללי הקהילה','err');
      await Store.add('reports', { kind:'message', targetId:me.id, targetName:me.name,
        cat:mod.cat, catLabel:mod.catLabel, details:'נחסם אוטומטית בצ׳אט פרטי', severity:mod.severity,
        byName:'SMAI AI', status:'pending', createdAt:nowISO() });
      return;
    }
    if(!isGroup(cur) && other){
      const rels = await Friends.mine(me.id);
      if(!dmAllowed(rels, me.id, other)){ toast('לא ניתן לשלוח הודעה למשתמש הזה','err'); return; }
    }
    inp.value=''; inp.disabled = true;
    try{
      await Store.add('dmsgs', { convId:cur.id, senderId:me.id, senderName:me.name||me.email,
        senderRank:me.rank, text:txt, flagged:mod.violation, createdAt:nowISO() });
      // Last-message metadata is updated by the server.
      Sfx.play('msgOut');
      const targets = (cur.members||[]).filter(m=>m!==me.id);
      for(const t of targets) mailUser(t, 'dm', MAIL_TPL.dm(me.name||me.email, txt.slice(0,180))).catch(()=>{});
    }catch(e){
      const c = String(e?.code||e?.message||'');
      if(c.includes('permission-denied')||c.includes('PERMISSION_DENIED'))
        toast('שגיאת הרשאות Firestore — עברו ל-#/setup להגדרת הכללים','err');
      else toast('שליחה נכשלה: '+(e?.message||c||'שגיאה לא ידועה'),'err');
      inp.value = txt;
    }
    finally{ inp.disabled=false; inp.focus(); }
  };
  const db = $('#dbtn'); if(db) db.onclick = sendD;
  const di = $('#din'); if(di) di.addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey&&$('#dMentionList')?.style.display==='none'){e.preventDefault();sendD();} });
  if(di){
    const list=$('#dMentionList');let start=-1,items=[],selected=0;
    const allowed=users.filter(user=>(cur.members||[]).includes(user.id)&&user.id!==me.id);
    const closeMentions=()=>{if(list)list.style.display='none';items=[];};
    const choose=index=>{const user=items[index];if(!user)return;const before=di.value.slice(0,start),after=di.value.slice(di.selectionStart),mention='@'+(user.name||user.email||user.id)+' ';di.value=before+mention+after;di.selectionStart=di.selectionEnd=before.length+mention.length;closeMentions();di.focus();};
    const draw=()=>{if(!list)return;list.innerHTML=items.map((user,index)=>`<div class="mention-item ${index===selected?'sel':''}" data-index="${index}">@${esc(user.name||user.email||user.id)}</div>`).join('');list.style.display=items.length?'block':'none';list.querySelectorAll('[data-index]').forEach(row=>row.onmousedown=event=>{event.preventDefault();choose(Number(row.dataset.index));});};
    di.addEventListener('input',()=>{const at=di.value.lastIndexOf('@',di.selectionStart-1);if(at<0)return closeMentions();const query=di.value.slice(at+1,di.selectionStart);if(/\s/.test(query))return closeMentions();start=at;items=allowed.filter(user=>(user.name||user.email||'').toLowerCase().startsWith(query.toLowerCase())).slice(0,8);selected=0;draw();});
    di.addEventListener('keydown',event=>{if(!items.length)return;if(event.key==='ArrowDown'){event.preventDefault();selected=(selected+1)%items.length;draw();}else if(event.key==='ArrowUp'){event.preventDefault();selected=(selected-1+items.length)%items.length;draw();}else if(event.key==='Enter'){event.preventDefault();choose(selected);}else if(event.key==='Escape')closeMentions();});
  }
  const startCall=async type=>{
    const room=`SMAI-Sentinel-${cur.id.replace(/[^A-Za-z0-9-]/g,'').slice(0,70)}-${uid().replace(/[^A-Za-z0-9-]/g,'').slice(0,24)}`;
    const url=`https://meet.jit.si/${room}${type==='audio'?'#config.startWithVideoMuted=true':''}`;
    const label=type==='video'?'שיחת וידאו':'שיחת קול';
    try{
      await Store.add('dmsgs',{convId:cur.id,senderId:me.id,senderName:me.name||me.email,senderRank:me.rank,text:`הזמנה ל${label}`,callType:type,callUrl:url,createdAt:nowISO()});
      openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic(type==='video'?'camera':'phone',20)}</span><h3>${label}</h3></div><div class="m-b"><p>ההזמנה נשלחה למשתתפי השיחה.</p><p class="small mute">החדר נפתח בשירות שיחות חיצוני. אין לשתף בו מידע רגיש שאינו נחוץ.</p></div><div class="m-f"><button class="btn btn-g" onclick="closeModal()">אחר כך</button><a class="btn btn-p" href="${url}" target="_blank" rel="noopener noreferrer" onclick="closeModal()">כניסה לשיחה</a></div>`);
    }catch(e){toast(e.message||'לא ניתן לפתוח שיחה כרגע','err');}
  };
  const voice=$('#dmVoice');if(voice)voice.onclick=()=>startCall('audio');
  const video=$('#dmVideo');if(video)video.onclick=()=>startCall('video');
});


/* ===================== קבוצות פרטיות ===================== */
async function groupCreateModal(){
  const me = Auth.user; if(!me) return;
  const [users, rels] = await Promise.all([Store.list('users'), Friends.mine(me.id)]);
  const friendIds = Friends.ids(rels, me.id);
  const pool = users.filter(u=>u.id!==me.id && !u.banned);
  const sel = new Set();

  openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('users',20)}</span>
    <div style="flex:1"><h3 style="margin:0">קבוצה פרטית חדשה</h3>
    <div class="tiny mute">רק המשתתפים שתבחרו יראו את השיחה</div></div></div>
  <div class="m-b">
    <div class="field"><label class="fl">שם הקבוצה</label>
      <input id="gname" maxlength="60" placeholder="לדוגמה: הורים כיתה ו׳"></div>
    <div class="field" style="margin-bottom:8px"><label class="fl">חיפוש משתתפים</label>
      <input id="gq" placeholder="חיפוש לפי שם..." autocomplete="off"></div>
    <div id="gsel" class="chips"></div>
    <div class="stack" id="glist" style="gap:6px;max-height:280px;overflow:auto;margin-top:8px"></div>
    <div id="gerr"></div>
  </div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button>
    <button class="btn btn-p" id="ggo">${ic('plus',15)} יצירת קבוצה</button></div>`);

  const nameOf = i => (pool.find(u=>u.id===i)||{}).name || 'משתמש';
  const chips = ()=>{
    $('#gsel').innerHTML = Array.from(sel).map(i=>
      `<span class="chip">${esc(nameOf(i))}<button data-x="${i}">${ic('x',11)}</button></span>`).join('');
    $$('#gsel button').forEach(b=>b.onclick = ()=>{ sel.delete(b.dataset.x); chips(); list(); });
  };
  const list = ()=>{
    const q = String($('#gq')?.value||'').trim().toLowerCase();
    const arr = pool.filter(u=>!sel.has(u.id))
      .filter(u=>!q || String(u.name||'').toLowerCase().includes(q))
      .sort((a,b)=>(friendIds.includes(b.id)?1:0)-(friendIds.includes(a.id)?1:0))
      .slice(0,40);
    $('#glist').innerHTML = arr.length ? arr.map(u=>`<button class="pick-row" data-i="${u.id}">
      ${avatar(u,'s')}<span style="flex:1;text-align:start"><b>${esc(u.name||'משתמש')}</b>
      ${friendIds.includes(u.id)?'<span class="b b-ok" style="font-size:.6rem">חבר</span>':''}</span>
      ${ic('plus',14)}</button>`).join('') : '<p class="tiny mute">לא נמצאו משתמשים.</p>';
    $$('#glist .pick-row').forEach(b=>b.onclick = ()=>{ sel.add(b.dataset.i); Sfx.play('tick'); chips(); list(); });
  };
  $('#gq').oninput = debounce(list, 200);
  chips(); list();

  $('#ggo').onclick = async ()=>{
    const name = $('#gname').value.trim();
    if(name.length < 2) return $('#gerr').innerHTML = '<div class="err">צריך שם לקבוצה</div>';
    if(sel.size < 2) return $('#gerr').innerHTML = '<div class="err">בוחרים לפחות שני משתתפים נוספים</div>';
    $('#ggo').disabled = true;
    try{
      const names = {}; Array.from(sel).forEach(i=>{ names[i] = nameOf(i); });
      const c = await createGroup(name, Array.from(sel), names);
      closeModal(); toast('הקבוצה נוצרה'); location.hash = '#/dm/'+c.id;
    }catch(e){ $('#gerr').innerHTML = `<div class="err">${esc(e.message||'שגיאה')}</div>`; $('#ggo').disabled = false; }
  };
}

async function groupMembersModal(conv, users){
  const me = Auth.user; if(!me || !conv) return;
  const owner = conv.ownerId === me.id;
  const mem = (conv.members||[]);
  openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('users',20)}</span>
    <div style="flex:1"><h3 style="margin:0">${esc(conv.name||'קבוצה')}</h3>
    <div class="tiny mute">${mem.length} משתתפים</div></div></div>
  <div class="m-b"><div class="stack" style="gap:7px">
    ${mem.map(i=>{
      const u = users.find(x=>x.id===i) || { id:i, name:conv.names?.[i]||'משתמש' };
      return `<div class="fr-card" style="padding:9px 11px">
        ${avatar(u,'s')}<div class="fr-mid"><b>${esc(u.name||'משתמש')}</b>
          <div class="tiny mute">${i===conv.ownerId?'מנהל/ת הקבוצה':'משתתף/ת'}</div></div>
        <div class="fr-act">${owner && i!==me.id ? `<button class="btn btn-g btn-xs" data-rm="${i}">הסרה</button>`:''}</div></div>`;
    }).join('')}
  </div></div>
  <div class="m-f">
    ${owner?`<button class="btn btn-g" id="gadd">${ic('plus',15)} הוספת משתתף</button>`:''}
    <button class="btn btn-d" id="gleave">${ic('logout',15)} יציאה מהקבוצה</button>
    <button class="btn btn-p" onclick="closeModal()">סגירה</button></div>`);

  $$('#modal [data-rm]').forEach(b=>b.onclick = async ()=>{
    const i = b.dataset.rm;
    const nm = (users.find(x=>x.id===i)||{}).name || 'המשתתף';
    if(!(await confirmBox('הסרת משתתף', `להסיר את <b>${esc(nm)}</b> מהקבוצה?`, 'הסרה', true))) return;
    await Store.update('dms', conv.id, { members: mem.filter(x=>x!==i) });
    await Store.add('dmsgs', { convId:conv.id, system:false, senderId:me.id,
      text:`${nm} הוסר/ה מהקבוצה`, createdAt:nowISO() });
    closeModal(); toast('המשתתף הוסר'); render();
  });

  const ga = $('#gadd'); if(ga) ga.onclick = async ()=>{
    const pool = users.filter(u=>!mem.includes(u.id) && !u.banned);
    openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('plus',20)}</span><h3>הוספת משתתף</h3></div>
    <div class="m-b"><div class="stack" style="gap:6px;max-height:320px;overflow:auto">
      ${pool.slice(0,50).map(u=>`<button class="pick-row" data-i="${u.id}">${avatar(u,'s')}
        <span style="flex:1;text-align:start"><b>${esc(u.name||'משתמש')}</b></span>${ic('plus',14)}</button>`).join('')
        || '<p class="tiny mute">אין משתמשים להוספה.</p>'}
    </div></div><div class="m-f"><button class="btn btn-g" onclick="closeModal()">סגירה</button></div>`);
    $$('#modal .pick-row').forEach(b=>b.onclick = async ()=>{
      const i = b.dataset.i, nm = (pool.find(u=>u.id===i)||{}).name || 'משתמש';
      const names = { ...(conv.names||{}) }; names[i] = nm;
      await Store.update('dms', conv.id, { members:[...mem, i], names });
      await serverNotice({ convId:conv.id, system:true, senderId:me.id,
        text:`${nm} צורף/ה לקבוצה`, createdAt:nowISO() });
      mailUser(i, 'dm', MAIL_TPL.groupAdd(me.name||me.email, conv.name)).catch(()=>{});
      closeModal(); Sfx.play('join'); toast('המשתתף נוסף'); render();
    });
  };

  $('#gleave').onclick = async ()=>{
    if(!(await confirmBox('יציאה מהקבוצה','לא תראו יותר את ההודעות בקבוצה הזו. ההודעות הקיימות נשמרות.','יציאה',true))) return;
    await Store.update('dms', conv.id, { members: mem.filter(x=>x!==me.id) });
    await serverNotice({ convId:conv.id, system:true, senderId:me.id,
      text:`${me.name||'משתמש'} עזב/ה את הקבוצה`, createdAt:nowISO() });
    closeModal(); Sfx.play('leave'); toast('יצאתם מהקבוצה'); location.hash = '#/dm';
  };
}

async function dmPickModal(){
  const me = Auth.user; if(!me) return;
  const users = (await Store.list('users')).filter(u=>u.id!==me.id && !u.isBanned);
  openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('message',20)}</span><h3>שיחה פרטית חדשה</h3></div>
  <div class="m-b">
    <div class="field"><input id="dmq" placeholder="חיפוש משתמש..."></div>
    <div class="stack" id="dmlist" style="gap:6px;max-height:320px;overflow:auto"></div>
  </div>
  <div class="m-f"><button class="btn btn-g" onclick="closeModal()">סגירה</button></div>`);
  const paint = (q='')=>{
    const f = users.filter(u=>!q || String(u.name||u.email).toLowerCase().includes(q.toLowerCase()));
    $('#dmlist').innerHTML = f.length ? f.slice(0,40).map(u=>`
      <button type="button" class="dm-item" data-u="${u.id}" style="width:100%;border:1px solid var(--line);background:var(--surface)">
        ${avatar(u,'s')}<div style="min-width:0;text-align:start">
          <div class="nm">${esc(u.name||u.email)} ${u.verified&&u.privacy?.showVerified!==false?`<span class="verified">${ic('check',9,3)}</span>`:''}</div>
          <div class="lst">${esc(RANKS[u.rank]?.l||'משתמש')}</div></div></button>`).join('')
      : '<div class="tiny mute" style="padding:10px">לא נמצאו משתמשים.</div>';
    $('#dmlist').querySelectorAll('[data-u]').forEach(b=>{
      b.onclick = async ()=>{
        const u = users.find(x=>x.id===b.dataset.u);
        const c = await openDM(u.id, u.name||u.email);
        closeModal(); location.hash = '#/dm/'+c.id;
      };
    });
  };
  paint();
  $('#dmq').oninput = e=>paint(e.target.value.trim());
}
window.dmPickModal = dmPickModal;

/* ===================== הצטרפות לצוות ===================== */
route('/join', (app)=>{
  const openRoles = [
    { r:'trainee', d:'support', t:'מתמחה תמיכה', txt:'הצעד הראשון בצוות. מלווים משתמשים בפניות פשוטות עם חונך צמוד.', need:'גיל 15+, זמינות 4 שעות בשבוע' },
    { r:'agent', d:'harass', t:'נציג הטרדות', txt:'טיפול בפניות הטרדה וסחיטה, כולל תיעוד ראיות והפניה לגורמים.', need:'ניסיון קודם במודרציה או תמיכה' },
    { r:'agent', d:'account', t:'נציג חשבונות', txt:'שחזור חשבונות, התחזות ואבטחת פרופילים ברשתות.', need:'היכרות טובה עם רשתות חברתיות' },
    { r:'agent', d:'child', t:'מלווה הגנת ילדים', txt:'מקרים רגישים במיוחד הכוללים קטינים. עבודה בזוגות ופיקוח צמוד.', need:'גיל 18+, ראיון אישי' },
    { r:'trainee', d:'tech', t:'מתנדב טכנולוגיה', txt:'פיתוח, אוטומציות וכלים פנימיים לצוות.', need:'ידע בסיסי בתכנות' },
    { r:'trainee', d:'other', t:'מנחה קהילה', txt:'ניהול שרתי הקהילה, מודרציה שוטפת ופעילויות.', need:'זמינות בשעות אחה"צ' }
  ];
  app.innerHTML = `
  <div class="page-h anim-up"><div class="eyebrow">${ic('users',13)} קריירה והתנדבות</div>
    <h1>הצטרפות לצוות SMAI</h1>
    <p>הצוות שלנו בנוי ממתנדבים ואנשי מקצוע שמאמינים שאף ילד לא צריך להתמודד לבד. כל מועמד עובר הכשרה, חונכות וליווי.</p></div>

  <div class="grid g3" style="margin-bottom:30px">
    ${[['heart','למה זה חשוב','כל פנייה שנענית בזמן היא ילד או הורה שלא נשארו לבד מול המסך.'],
       ['seedling','מסלול צמיחה','מתחילים כמתמחים, ועם הזמן והניסיון מתקדמים לנציג, נציג בכיר וראש צוות.'],
       ['clock','זמן סביר','מבקשים מינימום 4 שעות בשבוע. אפשר לעצור, לחזור ולשנות היקף בכל שלב.']]
      .map((c,i)=>`<div class="card reveal" style="transition-delay:${i*70}ms">
        <span class="ico-tile i-brand">${ic(c[0],20)}</span><h3>${c[1]}</h3><p class="mute">${c[2]}</p></div>`).join('')}
  </div>

  <div class="sec-h reveal"><div><h2>תפקידים פתוחים</h2><p>בוחרים תפקיד, והטופס למטה מתמלא לבד.</p></div></div>
  <div class="grid g3" style="margin-bottom:34px">
    ${openRoles.map((r,i)=>{
      const d = DEPT_BY[r.d]||DEPT_BY.other;
      return `<div class="card hov reveal" style="transition-delay:${i*55}ms">
        <div class="row" style="justify-content:space-between;margin-bottom:10px">
          <span class="ico-tile i-${d.cls}">${ic(d.ico,19)}</span>${rankBadge(r.r)}
        </div>
        <h3>${esc(r.t)}</h3>
        <p class="mute small">${esc(r.txt)}</p>
        <div class="hr"></div>
        <div class="row small mute" style="gap:7px">${ic('check',14)} ${esc(r.need)}</div>
        <button class="btn btn-g btn-sm btn-block" style="margin-top:12px"
          onclick="${bind(()=>{ const s=$('#appDept'); if(s){ s.value=r.d; $('#appRole').value=r.t; $('#appForm').scrollIntoView({behavior:'smooth',block:'center'}); $('#appRole').focus(); } })}">
          ${ic('send',14)} הגשת מועמדות</button>
      </div>`;
    }).join('')}
  </div>

  <div class="sec-h reveal"><div><h2>תהליך הקבלה</h2><p>שקוף מהרגע הראשון — אתם יודעים בדיוק איפה אתם עומדים.</p></div></div>
  <div class="steps reveal" style="margin-bottom:34px">
    ${[['הגשה','ממלאים את הטופס. לוקח כ-5 דקות.'],
       ['סינון','הצוות עובר על המועמדות תוך 7 ימים.'],
       ['שיחה','שיחת היכרות קצרה בשרת הקהילה.'],
       ['הכשרה','שבועיים חונכות עם נציג בכיר.'],
       ['שיבוץ','מקבלים דרגת מתמחה ומחלקה.']].map((s,i)=>`
      <div class="step"><h4>${i+1}. ${s[0]}</h4><p>${s[1]}</p></div>`).join('')}
  </div>

  <div class="card reveal" id="appForm" style="max-width:760px;margin:0 auto">
    <h2 style="font-size:1.3rem">טופס מועמדות</h2>
    <p class="mute small">כל השדות נשמרים במערכת ונצפים רק על ידי בכירי הצוות.</p>
    <div class="hr"></div>
    <div class="grid g2">
      <div class="field"><label>שם מלא</label><input id="appName" placeholder="ישראל ישראלי" value="${esc(Auth.user?.name||'')}"></div>
      <div class="field"><label>אימייל ליצירת קשר</label><input id="appMail" type="email" placeholder="you@example.com" value="${esc(Auth.user?.email||'')}"></div>
      <div class="field"><label>גיל</label><input id="appAge" type="number" min="13" max="99" placeholder="18"></div>
      <div class="field"><label>שם משתמש בדיסקורד / טלגרם</label><input id="appTag" placeholder="@username"></div>
      <div class="field"><label>מחלקה מבוקשת</label><select id="appDept">${DEPTS.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div>
      <div class="field"><label>תפקיד מבוקש</label><input id="appRole" placeholder="נציג תמיכה"></div>
    </div>
    <div class="field"><label>זמינות שבועית</label>
      <select id="appAvail"><option>4-6 שעות</option><option>6-10 שעות</option><option>10-15 שעות</option><option>15+ שעות</option></select></div>
    <div class="field"><label>ניסיון קודם רלוונטי</label>
      <textarea id="appExp" placeholder="מודרציה בשרתים, תמיכה טכנית, הדרכה, עבודה עם נוער..."></textarea></div>
    <div class="field"><label>למה דווקא SMAI?</label>
      <textarea id="appWhy" style="min-height:120px" placeholder="ספרו לנו קצת עליכם ומה מביא אתכם לכאן"></textarea></div>
    <label class="check"><input type="checkbox" id="appOk"><span>אני מאשר/ת שקראתי את <a href="/privacy">מדיניות הפרטיות</a> ומסכים/ה לשמירת הפרטים לצורך בחינת המועמדות.</span></label>
    <button class="btn btn-p btn-block" id="appSend" style="margin-top:16px">${ic('send',17)} שליחת מועמדות</button>
  </div>`;
  initReveal();

  $('#appSend').onclick = async ()=>{
    const g = id => ($('#'+id)?.value||'').trim();
    if(g('appName').length < 2) return toast('נא למלא שם מלא','warn');
    if(!/^\S+@\S+\.\S+$/.test(g('appMail'))) return toast('כתובת אימייל לא תקינה','warn');
    if(g('appWhy').length < 25) return toast('נשמח לכמה מילים נוספות בשאלה האחרונה','warn');
    if(!$('#appOk').checked) return toast('צריך לאשר את מדיניות הפרטיות','warn');
    const btn = $('#appSend'); btn.disabled = true; btn.innerHTML = `${ic('clock',16)} שולח...`;
    try{
      await Store.add('applications', {
        name:g('appName'), email:g('appMail'), age:g('appAge'), tag:g('appTag'),
        dept:g('appDept'), role:g('appRole'), availability:g('appAvail'),
        experience:g('appExp'), why:g('appWhy'),
        userId: Auth.user?.id || null, status:'pending', createdAt: nowISO()
      });
      openModal(`<div class="m-h"><span class="ico-tile i-ok">${ic('check',20)}</span><h3>המועמדות נשלחה</h3></div>
      <div class="m-b"><p>תודה! נחזור אליך למייל <b>${esc(g('appMail'))}</b> תוך 7 ימי עסקים.</p>
        <p class="small mute">בינתיים מוזמנים להצטרף לשרתי הקהילה ולהכיר את הצוות.</p></div>
      <div class="m-f"><a class="btn btn-g" href="/community" onclick="closeModal()">לקהילה</a>
        <button class="btn btn-p" onclick="closeModal()">סגירה</button></div>`);
      ['appAge','appTag','appRole','appExp','appWhy'].forEach(i=>{ const el=$('#'+i); if(el) el.value=''; });
      $('#appOk').checked = false;
    }catch(e){ toast('שגיאה בשליחה: '+e.message,'err'); }
    btn.disabled = false; btn.innerHTML = `${ic('send',17)} שליחת מועמדות`;
  };
});

/* ===================== מסך התחברות עם גלריית אנימציה ===================== */

route('/login',app=>{
 if(Auth.user){location.hash='#/';return;}
 const scenes=[
  ['/assets/auth/always-behind-you.png','מעטפת הגנה דיגיטלית','shield','אנחנו תמיד מאחוריך','מהרגע הראשון ועד שהעניין נסגר — החשבון והפניות נשארים במקום אחד.'],
  ['/assets/auth/response-247.png','שעון תגובה מהיר','clock','זמינים עבורך 24/7','המערכת קולטת ומנתבת פניות בכל שעה לצוות המתאים.'],
  ['/assets/auth/safe-space.png','מרחב דיגיטלי מוגן','lock','מרחב בטוח לנשום בו','המידע שלך מוגן, והשיחה נשארת זמינה רק לך ולצוות המטפל.']
 ];
 app.innerHTML=`<section class="auth-stage anim-up"><aside class="auth-visual" aria-label="${scenes[0][1]}">${scenes.map((s,i)=>`<div class="auth-scene ${i?'':'on'}" style="background-image:url('${s[0]}')" role="img" aria-label="${s[1]}"></div>`).join('')}<div class="auth-visual-copy"><span class="auth-live"><i></i> מערכת ההגנה פעילה</span><div class="auth-feature"><span id="authFeatureIcon" class="auth-feature-icon">${ic(scenes[0][2],27)}</span><h2 id="authFeatureTitle">${scenes[0][3]}</h2><p id="authFeatureText">${scenes[0][4]}</p></div><div class="auth-dots">${scenes.map((_,i)=>`<button class="${i?'':'on'}" data-scene="${i}" aria-label="שקופית ${i+1}"></button>`).join('')}</div></div></aside><div class="auth-panel"><div class="auth-brand"><span class="eyebrow">SMAI SENTINEL</span><h1>טוב שחזרת</h1><p>כניסה מאובטחת לחשבון ולפניות שלך.</p></div><button id="googleLogin" class="btn btn-g auth-google">${ic('user',18)} המשך עם Google</button><div class="auth-divider"><span>או באמצעות מייל</span></div><form id="emailAuth" class="stack"><div class="field" id="authNameWrap" hidden><label for="authName">שם תצוגה</label><input id="authName" maxlength="80" autocomplete="name" placeholder="איך לפנות אליך?"></div><div class="field"><label for="authEmail">כתובת מייל</label><input id="authEmail" type="email" required autocomplete="email" placeholder="name@example.com"></div><div class="field"><label for="authPassword">סיסמה</label><input id="authPassword" type="password" required minlength="8" autocomplete="current-password" placeholder="לפחות 8 תווים"></div><button class="btn btn-p auth-submit" type="submit">כניסה מאובטחת ${ic('chevron',17)}</button></form><div class="auth-actions"><button id="authMode" class="btn btn-link">אין לי חשבון — הרשמה</button><button id="forgotPassword" class="btn btn-link">שכחתי סיסמה</button></div><p id="authStatus" class="auth-status small" role="status"></p><p class="auth-trust">${ic('shield',14)} פרטי ההתחברות מוצפנים ומנוהלים בשירות אימות מאובטח</p></div></section>`;
 let scene=0,sceneTimer;
 const showScene=i=>{scene=i;$$('.auth-scene').forEach((x,n)=>x.classList.toggle('on',n===i));$$('[data-scene]').forEach((x,n)=>x.classList.toggle('on',n===i));$('.auth-visual')?.setAttribute('aria-label',scenes[i][1]);const f=$('.auth-feature');if(f){f.classList.remove('swap');void f.offsetWidth;$('#authFeatureIcon').innerHTML=ic(scenes[i][2],27);$('#authFeatureTitle').textContent=scenes[i][3];$('#authFeatureText').textContent=scenes[i][4];f.classList.add('swap');}};
 $$('[data-scene]').forEach(b=>b.onclick=()=>showScene(Number(b.dataset.scene)));
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)sceneTimer=setInterval(()=>{if(!$('.auth-stage'))return clearInterval(sceneTimer);showScene((scene+1)%scenes.length);},3000);
 let signup=false;const form=$('#emailAuth'),status=$('#authStatus'),submit=form.querySelector('[type=submit]');
 const message=e=>({'auth/invalid-credential':'המייל או הסיסמה אינם נכונים','auth/user-not-found':'לא נמצא חשבון עם כתובת המייל הזו','auth/email-already-in-use':'כבר קיים חשבון עם המייל הזה','auth/weak-password':'הסיסמה חלשה מדי','auth/too-many-requests':'בוצעו יותר מדי ניסיונות. המתינו מעט ונסו שוב','auth/network-request-failed':'אין כרגע חיבור לשירות ההתחברות','auth/popup-closed-by-user':'חלון Google נסגר לפני השלמת הכניסה','auth/unauthorized-domain':'כתובת האתר עדיין לא אושרה במערכת ההתחברות'}[e?.code]||e?.message||'הפעולה נכשלה');
 const finish=async()=>{await Auth.refresh();await CFG.load().catch(()=>{});history.replaceState(null,'','/');await render();};
 $('#authMode').onclick=()=>{signup=!signup;$('#authNameWrap').hidden=!signup;$('#authName').required=signup;submit.textContent=signup?'יצירת חשבון':'כניסה';$('#authMode').textContent=signup?'יש לי חשבון — כניסה':'אין לי חשבון — הרשמה';$('#authPassword').autocomplete=signup?'new-password':'current-password';status.textContent='';};
 $('#googleLogin').onclick=async()=>{status.textContent='מעביר להתחברות מאובטחת עם Google…';try{await loginGoogle();}catch(e){status.textContent=message(e);}};
 form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;status.textContent=signup?'יוצר חשבון…':'מתחבר…';try{if(signup){await registerEmail($('#authEmail').value.trim(),$('#authPassword').value,$('#authName').value.trim());await Auth.refresh();await request('/api/auth/email-verification','POST',{});status.textContent='החשבון נוצר ונשלח מייל אימות מעוצב.';}else await loginEmail($('#authEmail').value.trim(),$('#authPassword').value);await finish();}catch(e){status.textContent=message(e);}finally{submit.disabled=false;}};
 $('#forgotPassword').onclick=async()=>{const email=$('#authEmail').value.trim();if(!email){status.textContent='הזינו קודם את כתובת המייל.';$('#authEmail').focus();return;}const b=$('#forgotPassword');b.disabled=true;status.textContent='שולח הודעת איפוס מאובטחת…';try{await resetPassword(email);status.textContent='אם קיים חשבון עם הכתובת הזו, נשלחה הודעת איפוס.';}catch(e){status.textContent=message(e);}finally{b.disabled=false;}};
});

route('/account',async app=>{
 if(!Auth.user){app.innerHTML=requireLogin();return;}
 const u=Auth.user,prefs={...mailPrefDefaults(),...(u.mailPrefs||{})},privacy={dmFrom:'all',friendRequests:'all',profileVis:'public',onlineStatus:'friends',showFollowers:true,showVerified:true,showLastSeen:true,readReceipts:true,...(u.privacy||{})};
 const choice=(id,label,items,value)=>`<div class="field"><label for="${id}">${label}</label><select id="${id}">${items.map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${l}</option>`).join('')}</select></div>`;
 app.innerHTML=`<div class="page-h"><div class="eyebrow">מרכז ההגדרות</div><h1>החשבון שלך, בדרך שלך</h1><p>ההגדרות מחולקות לקטגוריות כדי שיהיה קל למצוא ולשנות כל דבר.</p></div>
 <form id="profileForm" class="settings-shell">
  <nav class="settings-nav" aria-label="קטגוריות הגדרות">
   <button type="button" class="on" data-settings-tab="general">${ic('user',17)} כללי</button>
   <button type="button" data-settings-tab="updates">${ic('bell',17)} עדכונים</button>
   <button type="button" data-settings-tab="privacy">${ic('message',17)} פרטיות ו-DM</button>
   <button type="button" data-settings-tab="social">${ic('link',17)} רשתות חברתיות</button>
   <button type="button" data-settings-tab="security">${ic('shield',17)} אבטחה</button>
   <button type="button" data-settings-tab="display">${ic('sparkle',17)} תצוגה ונגישות</button>
  </nav>
  <div class="settings-content">
   <section class="settings-panel on" data-settings-panel="general"><div class="settings-title"><span class="ico-tile i-brand">${ic('user',20)}</span><div><h2>כללי</h2><p>הפרטים שיוצגו בפרופיל ובקהילה.</p></div></div><div class="card"><div class="row">${avatar(u,'l')}<div><h3>${esc(u.name)}</h3>${rankBadge(u.rank)}<div class="small mute">${esc(u.email)} · ${u.emailVerified?'מאומת':'טרם אומת'}</div></div></div><div class="field"><label for="profileName">שם תצוגה</label><input id="profileName" required maxlength="80" value="${esc(u.name)}"></div><div class="field"><label for="profileBio">ביו</label><textarea id="profileBio" maxlength="500" placeholder="ספרו בקצרה על עצמכם">${esc(u.bio||'')}</textarea><div class="hint">עד 500 תווים. אין לפרסם מידע רגיש.</div></div><div class="field"><label for="profileAvatar">כתובת תמונת פרופיל מאובטחת</label><input id="profileAvatar" type="url" value="${esc(u.avatar||'')}" placeholder="https://..."></div></div><div class="card"><h3>כתובת המייל</h3><p class="small mute">השינוי יושלם רק אחרי אישור מהכתובת החדשה.</p><div class="row"><input id="newEmail" type="email" autocomplete="email" placeholder="המייל החדש" style="flex:1"><button id="changeEmail" class="btn btn-g" type="button">שליחת אימות</button></div></div></section>
   <section class="settings-panel" data-settings-panel="updates"><div class="settings-title"><span class="ico-tile i-brand">${ic('bell',20)}</span><div><h2>עדכונים והתראות</h2><p>בחרו אילו הודעות יישלחו גם למייל.</p></div></div><div class="card settings-options">${MAIL_PREFS.map(p=>`<label class="setting-row"><span><b>${esc(p.l)}</b><small>${esc(p.d)}</small></span><input type="checkbox" data-mail-pref="${p.id}" ${prefs[p.id]?'checked':''}></label>`).join('')}</div><div class="callout c-info"><span class="ic">${ic('shield',18)}</span><div>התראות אבטחה קריטיות יישמרו בחשבון גם אם כיביתם עדכוני מייל.</div></div></section>
   <section class="settings-panel" data-settings-panel="privacy"><div class="settings-title"><span class="ico-tile i-brand">${ic('message',20)}</span><div><h2>פרטיות והודעות פרטיות</h2><p>אתם מחליטים מי יכול לפנות אליכם ומה יוצג לאחרים.</p></div></div><div class="card"><h3>הודעות פרטיות (DM)</h3>${choice('dmFrom','מי יכול לשלוח לי הודעה פרטית',[['all','כולם'],['friends','חברים בלבד'],['staff','צוות SMAI בלבד'],['none','אף אחד — חסימת DM']],privacy.dmFrom)}<label class="setting-row"><span><b>אישורי קריאה</b><small>כשהאפשרות פעילה, שני ויים יהפכו לכחולים אחרי שקראתם הודעה</small></span><input id="readReceipts" type="checkbox" ${privacy.readReceipts!==false?'checked':''}></label><p class="small mute">הבחירה נאכפת בשרת גם בשיחות קיימות. משתמש שחסמתם לעולם לא יוכל לשלוח לכם הודעה.</p></div><div class="card"><h3>חברים ופרופיל</h3>${choice('friendRequests','מי יכול לשלוח בקשת חברות',[['all','כולם'],['none','אף אחד — ביטול בקשות חדשות']],privacy.friendRequests)}${choice('profileVis','מי יכול לראות את הפרופיל',[['public','כל חברי הקהילה'],['private','רק אני וצוות מורשה']],privacy.profileVis)}${choice('onlineStatus','מי יכול לראות אם אני פעיל/ה',[['all','כולם'],['friends','חברים בלבד'],['none','אף אחד']],privacy.onlineStatus)}<label class="setting-row"><span><b>הצגת „נראה לאחרונה”</b><small>כיבוי מסתיר את זמן הפעילות ממשתמשים רגילים. ליוצר האתר הוא גלוי תמיד, גם כשחבר צוות מסתיר אותו.</small></span><input id="showLastSeen" type="checkbox" ${privacy.showLastSeen!==false?'checked':''}></label><label class="setting-row"><span><b>הצגת הווי הכחול</b><small>כיבוי מסתיר את סימון החשבון המאומת ליד שמכם</small></span><input id="showVerified" type="checkbox" ${privacy.showVerified!==false?'checked':''}></label><label class="setting-row"><span><b>הצגת עוקבים ונעקבים</b><small>כיבוי מסתיר מאחרים את הרשימות והמספרים</small></span><input id="showFollowers" type="checkbox" ${privacy.showFollowers!==false?'checked':''}></label><a class="btn btn-g btn-sm" href="/friends">${ic('users',15)} ניהול חברים ובקשות</a></div></section>
   <section class="settings-panel" data-settings-panel="social"><div class="settings-title"><span class="ico-tile i-brand">${ic('link',20)}</span><div><h2>רשתות חברתיות</h2><p>הוסיפו לפרופיל קישורים רשמיים שלכם.</p></div></div><div class="card social-links-grid">${[['Instagram','instagram','https://www.instagram.com/username'],['TikTok','tiktok','https://www.tiktok.com/@username'],['Roblox','roblox','https://www.roblox.com/users/...'],['X / Twitter','twitter','https://x.com/username'],['YouTube','youtube','https://www.youtube.com/@channel'],['Discord','discord','https://discord.gg/...'],['Facebook','facebook','https://www.facebook.com/...'],['LinkedIn','linkedin','https://www.linkedin.com/in/...'],['Twitch','twitch','https://www.twitch.tv/...']].map(([label,key,placeholder])=>`<div class="field"><label for="social${key}">${label}</label><input id="social${key}" data-social="${key}" type="url" value="${esc(u.socialLinks?.[key]||'')}" placeholder="${placeholder}"></div>`).join('')}<div class="callout c-info"><span class="ic">${ic('info',18)}</span><div>הקישורים יופיעו בפרופיל. סימון „מחובר ומאומת” יתווסף רק לאחר חיבור OAuth רשמי של כל שירות.</div></div></div></section>
   <section class="settings-panel" data-settings-panel="security"><div class="settings-title"><span class="ico-tile i-brand">${ic('shield',20)}</span><div><h2>אבטחה</h2><p>סיסמה, אימות ופעילות חשודה.</p></div></div><div class="card"><h3>הגנת החשבון</h3><p class="small mute">אימות הרשמה ואיפוס סיסמה נשלחים דרך שירות ההתחברות המאובטח.</p>${u.securityEvents?.length?`<div class="callout c-warn"><span class="ic">${ic('shield',18)}</span><div>זוהתה כניסה מרשת חדשה ב־${fmtDate(u.securityEvents[0].createdAt)}. אם זו לא הייתה הכניסה שלך, אפס את הסיסמה.</div></div>`:''}<div class="row"><button id="changePassword" class="btn btn-g" type="button">איפוס סיסמה</button>${u.emailVerified?'':`<button id="resendVerify" class="btn btn-g" type="button">שליחת אימות מחדש</button>`}<button class="btn btn-g" type="button" disabled title="דורש הפעלת TOTP בפרויקט Firebase">אימות דו־שלבי TOTP — בקרוב</button></div></div><div class="card"><h3>מכשיר ורשת מהימנים</h3><p class="small mute">סימון הרשת הנוכחית כמהימנה ימנע התראות כניסה חוזרות מאותו זיהוי. כתובת ה־IP עצמה אינה מוצגת או נשמרת בפרופיל.</p><div class="row between"><span class="small">זיהויים מהימנים: <b>${Number(u.trustedNetworkCount||0)}</b></span><button id="trustCurrentNetwork" class="btn btn-g" type="button">סימון המכשיר הנוכחי כבטוח</button></div></div><div class="card danger-zone"><h3>אזור רגיש</h3><p class="small mute">בקשת מחיקה עוברת לבדיקה לפני שהמידע מוסר.</p><button id="requestDeletion" class="btn btn-d" type="button">בקשת מחיקת חשבון</button></div></section>
   <section class="settings-panel" data-settings-panel="display"><div class="settings-title"><span class="ico-tile i-brand">${ic('sparkle',20)}</span><div><h2>תצוגה ונגישות</h2><p>התאימו את חוויית השימוש.</p></div></div><div class="card">${choice('accountTheme','ערכת נושא',[['system','לפי המכשיר'],['dark','כהה'],['light','בהירה']],u.theme||'system')}<label class="setting-row"><span><b>צלילי מערכת</b><small>צליל בקבלת הודעה ובפעולות חשובות</small></span><input id="accountSound" type="checkbox" ${u.sound!==false?'checked':''}></label></div></section>
   <div class="settings-save"><p id="profileStatus" role="status"></p><button id="accountLogout" class="btn btn-g" type="button">יציאה</button><button class="btn btn-p" type="submit">שמירת השינויים</button></div>
  </div>
 </form>`;
 $$('[data-settings-tab]').forEach(b=>b.onclick=()=>{$$('[data-settings-tab]').forEach(x=>x.classList.toggle('on',x===b));$$('[data-settings-panel]').forEach(x=>x.classList.toggle('on',x.dataset.settingsPanel===b.dataset.settingsTab));});
 const generalPanel=$('[data-settings-panel="general"]');if(generalPanel)generalPanel.insertAdjacentHTML('beforeend',`<div class="card"><h3>מצב גיל מוגן</h3><p class="small mute">הגדרה עצמית בלבד; אימות חיצוני עתידי לא יעביר אלינו צילום פנים.</p>${choice('ageBand','קבוצת גיל',[['under10','מתחת לגיל 10'],['10to12','10–12'],['13to17','13–17'],['adult','18 ומעלה']],u.ageBand||'13to17')}<p class="small mute">בחשבון מתחת לגיל 10 קישורים שמפרסמים משתמשים מוסתרים. קישורים רשמיים מהמייסד נשארים זמינים.</p><button class="btn btn-g btn-sm" id="reportAgeError" type="button">דיווח על טעות בגיל</button></div>`);
 $('#ageBand').onchange=async e=>{try{await Store.update('users',u.id,{ageBand:e.target.value});await Auth.refresh();$('#profileStatus').textContent='מצב הגיל המוגן נשמר';}catch(err){$('#profileStatus').textContent=err.message;}};
 $('#reportAgeError').onclick=()=>{openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('flag',20)}</span><h3>דיווח על טעות בגיל</h3></div><div class="m-b"><p>הצוות יוכל לתקן את קבוצת הגיל, לאפס אותה או לדרוש אימות חוזר.</p><div class="field"><label>מה לא נכון?</label><textarea id="ageErrorText" minlength="10" maxlength="600"></textarea></div><p id="ageErrorStatus" class="small"></p></div><div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button><button class="btn btn-p" id="sendAgeError">שליחה לצוות</button></div>`);$('#sendAgeError').onclick=async()=>{const text=$('#ageErrorText').value.trim();if(text.length<10)return $('#ageErrorStatus').textContent='נדרש הסבר קצר של לפחות 10 תווים.';const b=$('#sendAgeError');b.disabled=true;try{await Store.add('reports',{kind:'age_dispute',type:'account',targetId:u.id,reason:'בקשה לתיקון גיל',text});closeModal();toast('הדיווח נשלח לצוות');}catch(err){$('#ageErrorStatus').textContent=err.message;b.disabled=false;}};};
 const totpButton=$('[title*="TOTP"]');if(totpButton){totpButton.disabled=false;totpButton.removeAttribute('title');totpButton.textContent='הפעלת אימות דו־שלבי TOTP';totpButton.onclick=async()=>{totpButton.disabled=true;$('#profileStatus').textContent='מכין חיבור מאובטח לאפליקציית אימות…';try{const setup=await beginTotpEnrollment();openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('shield',20)}</span><h3>אימות דו־שלבי</h3></div><div class="m-b"><p>העתיקו את המפתח לאפליקציית אימות כמו Google Authenticator או Microsoft Authenticator.</p><div class="card mono" style="user-select:all;direction:ltr;text-align:center">${esc(setup.secretKey)}</div><div class="field"><label for="totpCode">הקוד בן 6 הספרות</label><input id="totpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div><p id="totpStatus" class="small"></p></div><div class="m-f"><button class="btn btn-g" onclick="closeModal()">ביטול</button><button class="btn btn-p" id="confirmTotp">הפעלה</button></div>`);$('#confirmTotp').onclick=async()=>{const b=$('#confirmTotp');b.disabled=true;try{await finishTotpEnrollment(setup.secret,$('#totpCode').value);closeModal();toast('האימות הדו־שלבי הופעל');}catch(e){$('#totpStatus').textContent=e?.code==='auth/operation-not-allowed'?'צריך להפעיל TOTP במסוף Firebase לפני שניתן להשלים את החיבור.':(e.message||'הקוד לא תקין');b.disabled=false;}};}catch(e){$('#profileStatus').textContent=e?.code==='auth/operation-not-allowed'?'ספק TOTP עדיין לא מופעל בפרויקט Firebase.':(e.message||'לא ניתן להתחיל את החיבור');}finally{totpButton.disabled=false;}};}
 $('#profileForm').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('[type=submit]');b.disabled=true;const mailPrefs={};$$('[data-mail-pref]').forEach(x=>mailPrefs[x.dataset.mailPref]=x.checked);const avatarUrl=$('#profileAvatar').value.trim();const nextPrivacy={dmFrom:$('#dmFrom').value,friendRequests:$('#friendRequests').value,profileVis:$('#profileVis').value,onlineStatus:$('#onlineStatus').value,showFollowers:$('#showFollowers').checked,showVerified:$('#showVerified').checked,showLastSeen:$('#showLastSeen').checked,readReceipts:$('#readReceipts').checked};const socialLinks={};$$('[data-social]').forEach(x=>socialLinks[x.dataset.social]=x.value.trim());try{if(avatarUrl&&!/^https:\/\//.test(avatarUrl))throw new Error('תמונת הפרופיל חייבת להשתמש בכתובת HTTPS');await Store.update('users',u.id,{name:$('#profileName').value.trim(),bio:$('#profileBio').value.trim(),avatar:avatarUrl,mailPrefs,privacy:nextPrivacy,socialLinks,theme:$('#accountTheme').value,sound:$('#accountSound').checked});await Auth.refresh();$('#profileStatus').textContent='כל ההגדרות נשמרו בהצלחה';renderNav();}catch(e){$('#profileStatus').textContent=e.message;}finally{b.disabled=false;}};
 $('#accountLogout').onclick=async()=>{await Auth.signOut();location.hash='#/';await render();};
 if($('#resendVerify'))$('#resendVerify').onclick=async()=>{const result=await request('/api/auth/email-verification','POST',{});$('#profileStatus').textContent=result.message;};
 $('#changePassword').onclick=async()=>{await Auth.changePassword();$('#profileStatus').textContent='קישור מאובטח לאיפוס הסיסמה נשלח למייל.';};
 const trustButton=$('#trustCurrentNetwork');if(trustButton)trustButton.onclick=async()=>{trustButton.disabled=true;$('#profileStatus').textContent='שומר זיהוי מאובטח של הרשת הנוכחית…';try{const result=await request('/api/security/trust-current','POST',{});await Auth.refresh();$('#profileStatus').textContent=`המכשיר והרשת סומנו כמהימנים. נשמרו ${result.count} זיהויים מהימנים.`;trustButton.textContent='המכשיר הנוכחי מסומן כבטוח';}catch(e){$('#profileStatus').textContent=e.message;trustButton.disabled=false;}};
 $('#changeEmail').onclick=async()=>{const email=$('#newEmail').value.trim();if(!email)return $('#profileStatus').textContent='הזינו כתובת מייל חדשה.';const b=$('#changeEmail');b.disabled=true;try{await requestEmailChange(email);$('#profileStatus').textContent='נשלח מייל אימות לכתובת החדשה. השינוי יושלם לאחר האישור.';}catch(e){$('#profileStatus').textContent=e.message;}finally{b.disabled=false;}};
 $('#requestDeletion').onclick=async()=>{if(!confirm('לשלוח בקשה למחיקת החשבון? החשבון לא יימחק מיד.'))return;await Store.add('reports',{kind:'account_delete',type:'account',reason:'בקשת מחיקת חשבון',text:'המשתמש ביקש להתחיל תהליך מחיקה'});$('#profileStatus').textContent='בקשת המחיקה התקבלה ונשמרה. הצוות יעדכן אותך לפני ביצוע מחיקה.';};
});

route('/admin', async (app)=>{
  if(!Auth.user) return app.innerHTML = requireLogin('הפאנל פתוח לחברי צוות בלבד');
  if(!Auth.can('viewPanel')) return app.innerHTML = `<div class="card center" style="max-width:480px;margin:50px auto">
    <div class="ico-tile i-dang" style="margin:0 auto 14px;width:56px;height:56px">${ic('lock',24)}</div>
    <h2 style="font-size:1.3rem">אין לך הרשאה לאזור הזה</h2>
    <p class="mute">פאנל הצוות פתוח מדרגת מתמחה ומעלה. אם לדעתך זו טעות, פנו לראש המחלקה.</p>
    <a class="btn btn-g" href="/">חזרה לדף הבית</a></div>`;

  const TABS = [
    { k:'queue', l:'תור פניות', ic:'file', cap:'viewPanel' },
    { k:'depts', l:'לפי מחלקה', ic:'building', cap:'viewPanel' },
    { k:'mod',   l:'מודרציה ודיווחים', ic:'flag', cap:'moderateChat' },
    { k:'appeals', l:'ערעורים', ic:'message', cap:'ban' },
    { k:'apps',  l:'מועמדויות', ic:'users', cap:'reviewApps' },
    { k:'verify', l:'תגי אימות', ic:'check', cap:'reviewApps' },
    { k:'users', l:'משתמשים ודרגות', ic:'shield', cap:'manageUsers' },
    { k:'system', l:'מערכת ומיילים', ic:'settings', cap:'siteConfig' },
    ...(['admin','founder'].includes(Auth.user?.rank)?[{ k:'emergency', l:'גישה בחירום', ic:'alert', cap:'siteConfig' }]:[]),
    ...(Auth.user?.rank==='founder'?[{ k:'campaigns', l:'קמפיינים', ic:'sparkle', cap:'siteConfig' }]:[]),
    ...(Auth.user?.rank==='founder'?[{ k:'praise', l:'מילים טובות', ic:'heart', cap:'siteConfig' }]:[]),
    { k:'backup', l:'גיבוי ונתונים', ic:'file', cap:'siteConfig' },
  ].filter(t=>Auth.can(t.cap));

  app.innerHTML = `
  <div class="page-h anim-up"><div class="eyebrow">${ic('shield',13)} אזור צוות</div>
    <h1>פאנל ניהול</h1><p>שלום ${esc((Auth.user.name||'').split(' ')[0]||'צוות')} — הנה מה שמחכה לטיפול.</p></div>
  <div id="admStats" class="grid g4 anim-up d1" style="margin-bottom:20px"></div>
  <div class="tabs anim-up d2" id="admTabs">
    ${TABS.map((t,i)=>`<button class="${i===0?'on':''}" data-k="${t.k}">${ic(t.ic,15)} ${esc(t.l)}</button>`).join('')}
  </div>
  <div id="admBody" class="anim-up d2">${loader()}</div>`;

  const paintStats = (tickets, reports, apps)=>{
    if(!Auth.user || !$('#admStats')) return;
    const openN = tickets.filter(t=>!['resolved','closed'].includes(t.status)).length;
    const crit = tickets.filter(t=>t.priority==='critical' && !['resolved','closed'].includes(t.status)).length;
    const mineN = tickets.filter(t=>t.assignedTo===Auth.user.id && !['resolved','closed'].includes(t.status)).length;
    const pend = reports.filter(r=>r.status==='pending').length + apps.filter(a=>a.status==='pending').length;
    $('#admStats').innerHTML = [
      ['file','פניות פתוחות',openN,'brand'],['alert','דחוף / קריטי',crit,'dang'],
      ['user','משויכות אליי',mineN,'ok'],['flag','ממתין לבדיקה',pend,'warn']
    ].map(s=>`<div class="stat"><div class="row between" style="margin-bottom:7px"><span class="ico-tile i-${s[3]}">${ic(s[0],18)}</span></div><div class="n">${s[2]}</div><div class="l">${s[1]}</div></div>`).join('');
  };

  let tickets=[], reports=[], apps=[], users=[], appeals=[], modlog=[], vapps=[], maillog=[], campaigns=[], emergencyRequests=[], feedback=[];
  async function loadAll(){
    if(!Auth.user || !Auth.can('viewPanel')) return;
    [tickets, reports, apps, users, appeals, modlog, vapps, maillog, campaigns, emergencyRequests, feedback] = await Promise.all([
      Store.list('tickets'), Store.list('reports'), Store.list('applications'),
      Store.list('users'), Store.list('appeals'), Store.list('modlog'),
      Store.list('verifyApps').catch(()=>[]), Store.list('mail').catch(()=>[]),
      Auth.user?.rank==='founder'?Store.list('campaigns').catch(()=>[]):Promise.resolve([]),
      ['admin','founder'].includes(Auth.user?.rank)?Store.list('emergencyRequests').catch(()=>[]):Promise.resolve([]),
      Auth.user?.rank==='founder'?Store.list('feedback').catch(()=>[]):Promise.resolve([])
    ]);
    paintStats(tickets, reports, apps);
  }
  await loadAll();

  let tab = TABS[0].k, q = '', fStatus = '', fDept = '', fMine = false;

  function tQueue(){
    let rows = tickets.slice();
    if(fMine) rows = rows.filter(t=>t.assignedTo===Auth.user.id);
    if(fStatus) rows = rows.filter(t=>t.status===fStatus);
    if(fDept) rows = rows.filter(t=>t.dept===fDept);
    if(q){ const s=q.toLowerCase(); rows = rows.filter(t=>((t.title||'')+' '+(t.body||'')+' '+(t.code||'')+' '+(t.name||'')).toLowerCase().includes(s)); }
    rows.sort((a,b)=>((PRIO[b.priority]?.r||0)-(PRIO[a.priority]?.r||0)) || (b.createdAt||'').localeCompare(a.createdAt||''));
    return `
    <div class="card" style="padding:14px 16px;margin-bottom:14px">
      <div class="row" style="gap:10px">
        <input id="admQ" style="flex:1;min-width:210px" placeholder="חיפוש לפי נושא, קוד או שם" value="${esc(q)}">
        <select id="admStatus" style="max-width:170px"><option value="">כל הסטטוסים</option>
          ${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${fStatus===k?'selected':''}>${esc(v.l)}</option>`).join('')}</select>
        <select id="admDept" style="max-width:190px"><option value="">כל המחלקות</option>
          ${DEPTS.map(d=>`<option value="${d.id}" ${fDept===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
        <button class="chip ${fMine?'on':''}" id="admMine">${ic('user',14)} רק שלי</button>
      </div>
    </div>
    ${rows.length ? `<div class="stack" style="gap:10px">${rows.map((t,i)=>ticketRow(t,i)).join('')}</div>`
      : emptyState('check','אין פניות שתואמות לסינון','כשתיפתח פנייה חדשה היא תופיע כאן אוטומטית.')}
    <p class="hint center" style="margin-top:14px">${rows.length} מתוך ${tickets.length} פניות</p>`;
  }

  function tDepts(){
    return `<div class="grid g3">${DEPTS.map(d=>{
      const inD = tickets.filter(t=>t.dept===d.id);
      const openN = inD.filter(t=>!['resolved','closed'].includes(t.status)).length;
      const critN = inD.filter(t=>t.priority==='critical' && !['resolved','closed'].includes(t.status)).length;
      const staff = users.filter(u=>u.dept===d.id && (RANKS[u.rank]||RANKS.citizen).staff);
      const pct = inD.length ? Math.round((inD.length-openN)/inD.length*100) : 100;
      return `<div class="card hov">
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <span class="ico-tile i-${d.cls}">${ic(d.ico,19)}</span>
          ${critN?`<span class="b b-dang">${critN} קריטי</span>`:`<span class="b b-ok">תקין</span>`}</div>
        <h3>${esc(d.name)}</h3>
        <p class="mute small">${esc(d.desc)}</p>
        <div class="hr"></div>
        <div class="row" style="justify-content:space-between;font-size:.86rem">
          <span class="mute">פתוחות</span><b>${openN}</b></div>
        <div class="row" style="justify-content:space-between;font-size:.86rem">
          <span class="mute">סה"כ</span><b>${inD.length}</b></div>
        <div class="meter" title="שיעור סגירה"><i style="width:${pct}%"></i></div>
        <span class="hint">${pct}% מהפניות במחלקה נסגרו</span>
        <div class="hr"></div>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          ${staff.length ? staff.slice(0,6).map(s=>`<span title="${esc(s.name||s.email)} · ${esc((RANKS[s.rank]||RANKS.citizen).l)}">${avatar(s,'s')}</span>`).join('')
            : '<span class="small mute">אין צוות משויך</span>'}
        </div>
        <button class="btn btn-g btn-sm btn-block" style="margin-top:12px" onclick="${bind(()=>{ fDept=d.id; tab='queue'; paintTabs(); paint(); })}">
          ${ic('arrow',14)} לתור של המחלקה</button>
      </div>`;
    }).join('')}</div>`;
  }

  function tMod(){
    const pend = reports.filter(r=>r.status==='pending');
    const done = reports.filter(r=>r.status!=='pending').slice(0,25);
    const card = r=>{
      const prof = r.kind==='profile';
      const c = (prof ? PROFILE_REPORTS.find(x=>x.id===r.cat) : MSG_REPORTS.find(x=>x.id===r.cat))
        || {l:r.catLabel||r.cat||'דיווח', sev:1};
      return `<div class="card" style="padding:15px">
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <div class="row" style="gap:8px">
            ${prof?`<span class="b b-brand">${ic('user',11)} דיווח על פרופיל</span>`:''}
            <span class="b ${c.sev>=3?'b-dang':c.sev===2?'b-warn':'b-gray'}">${esc(c.l)}</span>
            ${r.aiAction && r.aiAction!=='none' ? `<span class="b b-brand">${ic('sparkle',11)} AI: ${esc(ACT_LABEL[r.aiAction]||r.aiAction)}</span>`:''}
            ${r.status==='pending'?'<span class="b b-warn">ממתין</span>':`<span class="b b-ok">${esc(r.status==='removed'?'טופל — הוסר':'נבדק')}</span>`}
          </div>
          <span class="small mute">${ago(r.createdAt)}</span>
        </div>
        ${prof ? `<div class="row" style="gap:10px;align-items:center;margin:8px 0">
            ${avatar(users.find(x=>x.id===r.targetId)||{name:r.targetName},'m')}
            <div><b>${esc(r.targetName||'משתמש')}</b>
              <div class="small mute">${esc((users.find(x=>x.id===r.targetId)||{}).bio||'ללא תיאור')}</div></div>
          </div>` : `<blockquote class="qt">${esc((r.text||'').slice(0,320))}</blockquote>`}
        <div class="row small mute" style="gap:12px;margin-top:9px;flex-wrap:wrap">
          <span>${ic('user',12)} ${prof?'הפרופיל המדווח':'כותב ההודעה'}: <b>${esc(r.targetName||'לא ידוע')}</b></span>
          <span>${ic('flag',12)} דווח על ידי: ${esc(r.byName||'אנונימי')}</span>
          ${r.server?`<span>${ic('hash',12)} ${esc(SRV_NAME(r.server))}</span>`:''}
        </div>
        ${r.details?`<p class="small" style="margin-top:8px">הערת המדווח: "${esc(r.details)}"</p>`:''}
        ${r.status==='pending' ? `<div class="row" style="gap:8px;margin-top:12px">
          ${prof ? `<button class="btn btn-d btn-sm" onclick="${bind(()=>modAct(r,'removed'))}">${ic('camera',14)} איפוס תמונה ותיאור</button>
            <button class="btn btn-g btn-sm" onclick="${bind(()=>openProfile(r.targetId))}">${ic('user',14)} צפייה בפרופיל</button>`
          : `<button class="btn btn-d btn-sm" onclick="${bind(()=>modAct(r,'removed'))}">${ic('trash',14)} מחיקת ההודעה</button>`}
          ${Auth.can('mute')?`<button class="btn btn-g btn-sm" onclick="${bind(()=>{ const u=users.find(x=>x.id===r.targetId); if(u) muteModal(u); else toast('המשתמש לא נמצא במערכת','warn'); })}">${ic('volume-x',14)} השתקה</button>`:''}
          ${Auth.can('ban')?`<button class="btn btn-g btn-sm" onclick="${bind(()=>{ const u=users.find(x=>x.id===r.targetId); if(u) banModal(u); else toast('המשתמש לא נמצא במערכת','warn'); })}">${ic('ban',14)} הרחקה</button>`:''}
          <button class="btn btn-ghost btn-sm" onclick="${bind(()=>modAct(r,'dismissed'))}">${ic('x',14)} דחיית הדיווח</button>
        </div>` : `<p class="hint" style="margin-top:8px">טופל על ידי ${esc(r.handledByName||'הצוות')} · ${fmtDate(r.handledAt||r.createdAt)}</p>`}
      </div>`;
    };
    return `
    <div class="grid g4" style="margin-bottom:16px">
      ${[['flag','דיווחים ממתינים',pend.length,'warn'],['trash','הודעות שהוסרו',reports.filter(r=>r.status==='removed').length,'dang'],
        ['volume-x','השתקות פעילות',users.filter(u=>u.muteUntil && new Date(u.muteUntil)>new Date()).length,'brand'],
        ['ban','מורחקים',users.filter(u=>u.isBanned && (!u.banUntil || new Date(u.banUntil)>new Date())).length,'dang']]
        .map(s=>`<div class="stat"><div class="row between" style="margin-bottom:7px"><span class="ico-tile i-${s[3]}">${ic(s[0],18)}</span></div><div class="n">${s[2]}</div><div class="l">${s[1]}</div></div>`).join('')}
    </div>
    <div class="sec-h"><div><h2 style="font-size:1.15rem">דיווחים ממתינים</h2>
      <p>כל דיווח נבדק אוטומטית על ידי מנוע המודרציה, וההחלטה הסופית תמיד אנושית.</p></div></div>
    ${pend.length ? `<div class="stack" style="gap:12px;margin-bottom:26px">${pend.map(card).join('')}</div>`
      : emptyState('check','אין דיווחים ממתינים','הקהילה נקייה כרגע. יפה.')}
    <div class="sec-h"><div><h2 style="font-size:1.15rem">יומן מודרציה</h2><p>25 הפעולות האחרונות.</p></div></div>
    ${modlog.length ? `<div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr>
        <th>פעולה</th><th>משתמש</th><th>סיבה</th><th>מבצע</th><th>מתי</th></tr></thead><tbody>
        ${modlog.slice(0,25).map(m=>`<tr>
          <td><span class="b ${m.type==='ban'?'b-dang':m.type==='mute'?'b-warn':'b-gray'}">${esc(MOD_ACT_L[m.type]||m.type||'')}</span></td>
          <td>${esc(m.targetName||'')}</td><td class="small">${esc(m.reason||'')}</td>
          <td class="small">${esc(m.byName||'')}</td><td class="small mute">${ago(m.createdAt)}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('file','היומן ריק','כל פעולת מודרציה תתועד כאן אוטומטית.')}
    ${done.length?`<div class="sec-h" style="margin-top:26px"><div><h2 style="font-size:1.15rem">דיווחים שטופלו</h2></div></div>
      <div class="stack" style="gap:10px">${done.map(card).join('')}</div>`:''}`;
  }

  async function modAct(r, status){
    await Store.update('reports', r.id, { status, handledBy:Auth.user.id, handledByName:Auth.user.name||Auth.user.email, handledAt:nowISO() });
    if(status==='removed' && r.msgId){
      try{ await Store.update('cmsgs', r.msgId, { deleted:true, deletedBy:Auth.user.name, deletedAt:nowISO() }); }catch(e){}
    }
    if(status==='removed' && r.kind==='profile' && r.targetId){
      try{ await Store.update('users', r.targetId, { avatar:'', bio:'' }); }catch(e){}
      await mailUser(r.targetId, 'moderation', MAIL_TPL.moderation('הפרופיל שלך אופס',
        'תמונת הפרופיל ו/או התיאור שלך הוסרו על ידי צוות המודרציה בעקבות דיווח. אפשר להעלות תוכן חדש שתואם את כללי הקהילה דרך עמוד ההגדרות.'));
    }
    await serverAudit( { type: status==='removed'?'delete_message':'dismiss', targetName:r.targetName||'',
      targetId:r.targetId||'', reason:r.catLabel||'', byName:Auth.user.name||Auth.user.email, byId:Auth.user.id, createdAt:nowISO() });
    toast(status==='removed' ? 'ההודעה הוסרה והדיווח נסגר' : 'הדיווח נדחה');
    await loadAll(); paint();
  }

  function tAppeals(){
    const pend = appeals.filter(a=>a.status==='pending');
    if(!appeals.length) return emptyState('message','אין ערעורים','כשמשתמש מורחק יגיש ערעור, הוא יופיע כאן.');
    return `<div class="stack" style="gap:12px">${appeals.map(a=>`
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <div class="row" style="gap:8px"><b>${esc(a.userName||'משתמש')}</b>
            <span class="b ${a.status==='pending'?'b-warn':a.status==='accepted'?'b-ok':'b-gray'}">
              ${a.status==='pending'?'ממתין':a.status==='accepted'?'התקבל':'נדחה'}</span></div>
          <span class="small mute">${ago(a.createdAt)}</span>
        </div>
        ${a.banReason?`<p class="small mute">סיבת ההרחקה: ${esc(a.banReason)}</p>`:''}
        <blockquote class="qt">${esc(a.text||'')}</blockquote>
        ${a.status==='pending' && Auth.can('ban') ? `<div class="row" style="gap:8px;margin-top:12px">
          <button class="btn btn-ok btn-sm" onclick="${bind(()=>appealAct(a,'accepted'))}">${ic('check',14)} קבלת הערעור וביטול ההרחקה</button>
          <button class="btn btn-ghost btn-sm" onclick="${bind(()=>appealAct(a,'rejected'))}">${ic('x',14)} דחייה</button>
        </div>`:''}
      </div>`).join('')}</div>
      <p class="hint center" style="margin-top:12px">${pend.length} ערעורים ממתינים</p>`;
  }
  async function appealAct(a, status){
    await Store.update('appeals', a.id, { status, handledBy:Auth.user.id, handledByName:Auth.user.name, handledAt:nowISO() });
    if(status==='accepted' && a.userId){
      await Store.update('users', a.userId, { isBanned:false, banUntil:null, banReason:'', banAppealStatus:'accepted' });
      await serverAudit( { type:'unban', targetId:a.userId, targetName:a.userName, reason:'ערעור התקבל',
        byName:Auth.user.name||Auth.user.email, byId:Auth.user.id, createdAt:nowISO() });
    } else if(a.userId){
      await Store.update('users', a.userId, { banAppealStatus:'rejected' });
    }
    toast(status==='accepted' ? 'ההרחקה בוטלה' : 'הערעור נדחה');
    await loadAll(); paint();
  }

  function tApps(){
    if(!apps.length) return emptyState('users','אין מועמדויות','שתפו את עמוד ההצטרפות כדי לקבל מועמדים.',
      '<a class="btn btn-g btn-sm" href="/join">לעמוד ההצטרפות</a>');
    return `<div class="stack" style="gap:12px">${apps.map(a=>{
      const d = DEPT_BY[a.dept]||DEPT_BY.other;
      return `<div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:9px">
          <div class="row" style="gap:9px">
            <span class="ico-tile i-${d.cls}">${ic(d.ico,17)}</span>
            <div><b>${esc(a.name)}</b><div class="small mute">${esc(a.email)} ${a.age?'· גיל '+esc(a.age):''} ${a.tag?'· '+esc(a.tag):''}</div></div>
          </div>
          <span class="b ${a.status==='pending'?'b-warn':a.status==='accepted'?'b-ok':'b-gray'}">
            ${a.status==='pending'?'ממתין':a.status==='accepted'?'אושר':'נדחה'}</span>
        </div>
        <div class="row small mute" style="gap:12px;flex-wrap:wrap;margin-bottom:8px">
          <span>${ic('building',12)} ${esc(d.name)}</span>
          ${a.role?`<span>${ic('star',12)} ${esc(a.role)}</span>`:''}
          ${a.availability?`<span>${ic('clock',12)} ${esc(a.availability)}</span>`:''}
          <span>${ago(a.createdAt)}</span>
        </div>
        ${a.experience?`<p class="small"><b>ניסיון:</b> ${esc(a.experience)}</p>`:''}
        ${a.why?`<blockquote class="qt">${esc(a.why)}</blockquote>`:''}
        ${a.status==='pending' ? `<div class="row" style="gap:8px;margin-top:12px">
          <button class="btn btn-ok btn-sm" onclick="${bind(()=>appAct(a,'accepted'))}">${ic('check',14)} אישור וצירוף כמתמחה</button>
          <button class="btn btn-ghost btn-sm" onclick="${bind(()=>appAct(a,'rejected'))}">${ic('x',14)} דחייה</button>
          <a class="btn btn-g btn-sm" href="mailto:${esc(a.email)}">${ic('mail',14)} מייל למועמד</a>
        </div>`:''}
      </div>`;
    }).join('')}</div>`;
  }
  async function appAct(a, status){
    await Store.update('applications', a.id, { status, handledBy:Auth.user.id, handledAt:nowISO() });
    if(status==='accepted'){
      const u = users.find(x=>x.id===a.userId || (a.email && x.email===a.email));
      if(u && Auth.can('setRankAdmin')===false && !Auth.can('manageUsers')){ /* אין הרשאה לשנות דרגה */ }
      else if(u){
        await Store.update('users', u.id, { rank:'trainee', rankLvl:RANKS.trainee.lvl, dept:a.dept });
        toast(`${a.name} צורף לצוות בדרגת מתמחה`);
      } else {
        toast('המועמדות אושרה. אחרי שהמועמד ייצור חשבון אפשר לשייך לו דרגה.');
      }
    } else toast('המועמדות נדחתה');
    await loadAll(); paint();
  }

  function tVerify(){
    const pend = vapps.filter(a=>a.status==='pending');
    const rest = vapps.filter(a=>a.status!=='pending');
    if(!vapps.length) return emptyState('check','אין בקשות לתג מאומת',
      'משתמשים יכולים להגיש בקשה דרך טופס הדיווח, בקטגוריית "קהילת SMAI".');
    const card = a=>{
      const u = users.find(x=>x.id===a.userId) || { name:a.name, email:a.email };
      return `<div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:10px">
          <div class="row" style="gap:10px">${avatar(u,'m')}
            <div><b>${esc(a.name||'משתמש')}</b> ${u.verified?`<span class="b b-brand">${ic('check',10)} מאומת</span>`:''}
              <div class="small mute">${esc(a.email||'')} · ${rankBadge(u.rank||'citizen')}</div></div></div>
          <span class="b ${a.status==='pending'?'b-warn':a.status==='approved'?'b-ok':'b-gray'}">
            ${a.status==='pending'?'ממתין':a.status==='approved'?'אושר':'נדחה'}</span>
        </div>
        <blockquote class="qt">${esc(a.why||'')}</blockquote>
        ${a.links?`<p class="small mute" style="margin-top:8px">${ic('link',12)} ${esc(a.links)}</p>`:''}
        <p class="hint" style="margin-top:6px">${ago(a.createdAt)}</p>
        ${a.status==='pending' ? `<div class="row" style="gap:8px;margin-top:12px">
          <button class="btn btn-ok btn-sm" onclick="${bind(()=>verifyAct(a,'approved'))}">${ic('check',14)} אישור התג</button>
          <button class="btn btn-ghost btn-sm" onclick="${bind(()=>verifyAct(a,'rejected'))}">${ic('x',14)} דחייה</button>
        </div>`:`<p class="hint" style="margin-top:8px">טופל על ידי ${esc(a.handledByName||'הצוות')}</p>`}
      </div>`;
    };
    return `
    <div class="grid g3" style="margin-bottom:16px">
      ${[['clock','ממתינות',pend.length,'warn'],['check','מאומתים',users.filter(u=>u.verified).length,'ok'],
         ['file','סה"כ בקשות',vapps.length,'brand']]
        .map(x=>`<div class="stat"><div class="row between" style="margin-bottom:7px"><span class="ico-tile i-${x[3]}">${ic(x[0],18)}</span></div><div class="n">${x[2]}</div><div class="l">${x[1]}</div></div>`).join('')}
    </div>
    <div class="sec-h"><div><h2 style="font-size:1.15rem">בקשות ממתינות</h2>
      <p>תג מאומת ניתן למשתמשים פעילים ואמינים בקהילה. הוא לא מקנה הרשאות צוות.</p></div></div>
    ${pend.length ? `<div class="stack" style="gap:12px;margin-bottom:24px">${pend.map(card).join('')}</div>`
      : emptyState('check','אין בקשות ממתינות','כל הבקשות טופלו.')}
    ${rest.length?`<div class="sec-h"><div><h2 style="font-size:1.15rem">היסטוריה</h2></div></div>
      <div class="stack" style="gap:10px">${rest.slice(0,20).map(card).join('')}</div>`:''}`;
  }
  async function verifyAct(a, status){
    await Store.update('verifyApps', a.id, { status, handledBy:Auth.user.id,
      handledByName:Auth.user.name||Auth.user.email, handledAt:nowISO() });
    if(a.userId){
      if(status==='approved'){
        await Store.update('users', a.userId, { verified:true });
        await mailUser(a.userId, 'appStatus', MAIL_TPL.appStatus('התג המאומת שלך אושר',
          'ברכות! החשבון שלך בקהילת SMAI קיבל תג מאומת. התג יופיע ליד השם שלך בצ׳אט, בפורומים ובפרופיל.'));
      } else {
        await mailUser(a.userId, 'appStatus', MAIL_TPL.appStatus('החלטה בבקשת התג המאומת',
          'בדקנו את הבקשה שלך לתג מאומת ובשלב זה היא לא אושרה. אפשר להגיש בקשה חדשה בהמשך אחרי פעילות נוספת בקהילה.'));
      }
    }
    toast(status==='approved' ? 'התג אושר' : 'הבקשה נדחתה');
    await loadAll(); paint();
  }

  function tBackup(){return '<div class="card"><h2>ייצוא נתוני המערכת</h2><p>קובץ הגיבוי מכיל מידע רגיש. שמרו אותו במקום מאובטח ואל תשתפו אותו בציבור.</p><button id="bkDl" class="btn btn-p">הורדת גיבוי</button><p class="small mute">ייבוא מהמערכת הקודמת יבוצע רק לאחר התאמת חשבונות והרשאות. אין כרגע ייבוא אוטומטי.</p></div>';}
  function tSystem(){return '<div class="card"><div class="eyebrow">חיבורי מערכת</div><h2>מצב השירותים</h2><p>מצב החיבור נבדק מול השרת. מפתחות אינם נשמרים בדפדפן.</p><a href="/setup" class="btn btn-p">פתיחת מרכז המערכת</a></div>';}
  function tEmergency(){
    if(!['admin','founder'].includes(Auth.user?.rank))return '<div class="err">אין הרשאת חירום.</div>';
    const userOptions=users.map(u=>`<option value="${u.id}">${esc(u.name||u.email)} · ${esc(u.email||'')}</option>`).join('');
    const cards=emergencyRequests.map(r=>`<article class="card"><div class="row between"><div><span class="b ${r.status==='approved'?'b-ok':r.status==='rejected'?'b-dang':'b-warn'}">${r.status==='approved'?'מאושר':r.status==='rejected'?'נדחה':'ממתין לאישור נוסף'}</span><h3>${esc(r.caseRef)}</h3><p class="small mute">${esc(r.reason)}</p><div class="tiny mute">נפתח על ידי ${esc(r.requestedByName||'מנהל')} · משתמש ${esc(r.targetUserId)}</div></div><div class="row">${r.status==='pending'&&r.requestedBy!==Auth.user.id?`<button class="btn btn-p btn-sm" data-emergency-approve="${r.id}">אישור לשעה</button><button class="btn btn-g btn-sm" data-emergency-reject="${r.id}">דחייה</button>`:''}${r.status==='approved'&&Date.parse(r.expiresAt)>Date.now()&&[r.requestedBy,r.approvedBy].includes(Auth.user.id)?`<button class="btn btn-g btn-sm" data-emergency-export="${r.id}">ייצוא ראיות</button>`:''}</div></div></article>`).join('');
    return `<div class="callout c-dang"><span class="ic">${ic('alert',18)}</span><div><b>גישה חריגה ומבוקרת</b><br><span class="small">פותחת לשעה חבילת הורדה של כל הפניות ושיחות ה־DM של המשתמש. הפעולה נרשמת ביומן סודי ואינה שולחת למשתמש התראה או מייל. אין תמונות פנים, סיסמאות, קודים או הערות צוות פנימיות.</span></div></div><form id="emergencyForm" class="card stack" style="margin-top:14px"><h2>פתיחת אירוע</h2><div class="field"><label>משתמש</label><select id="emergencyTarget" required>${userOptions}</select></div><div class="field"><label>מספר אירוע / תיק משטרתי</label><input id="emergencyCase" required maxlength="80"></div><div class="field"><label>סיבה מפורטת</label><textarea id="emergencyReason" required minlength="20" maxlength="1000"></textarea></div><button class="btn btn-d">פתיחת גישה לכל השיחות למשך שעה</button></form><div class="stack" style="margin-top:16px">${cards||'<div class="card center mute">אין אירועי חירום</div>'}</div>`;
  }
  function tCampaigns(){
    if(Auth.user?.rank!=='founder')return '<div class="err">ניהול קמפיינים זמין למייסד בלבד.</div>';
    const audience={all:'כולם',members:'משתמשים מחוברים',staff:'צוות בלבד'};
    return `<div class="grid g2"><form id="campaignForm" class="card stack"><div><span class="eyebrow">FOUNDER ONLY</span><h2>קמפיין חדש</h2><p class="small mute">תמונה או סרטון מאוחסנים בכתובת HTTPS מאובטחת. אפשר לקבוע קהל, תזמון ומשך הופעה.</p></div><div class="field"><label>כותרת</label><input id="campaignTitle" required maxlength="90"></div><div class="field"><label>תיאור קצר</label><textarea id="campaignBody" maxlength="220"></textarea></div><div class="grid g2"><div class="field"><label>סוג</label><select id="campaignType"><option value="image">תמונה</option><option value="video">סרטון</option></select></div><div class="field"><label>קהל יעד</label><select id="campaignAudience"><option value="all">כולם</option><option value="members">משתמשים מחוברים</option><option value="staff">צוות בלבד</option></select></div></div><div class="field"><label>כתובת המדיה (HTTPS)</label><input id="campaignMedia" type="url" required placeholder="https://..."></div><div class="field"><label>קישור בלחיצה (רשות)</label><input id="campaignLink" type="url" placeholder="https://..."></div><div class="grid g2"><div class="field"><label>מתאריך</label><input id="campaignStart" type="datetime-local"></div><div class="field"><label>עד תאריך</label><input id="campaignEnd" type="datetime-local"></div></div><div class="grid g2"><div class="field"><label>משך בכל הופעה</label><select id="campaignSeconds"><option value="5">5 שניות</option><option value="10" selected>10 שניות</option><option value="20">20 שניות</option><option value="0">עד סגירה</option></select></div><div class="field"><label>תדירות</label><select id="campaignFrequency"><option value="session">פעם בביקור</option><option value="daily">פעם ביום</option><option value="always">בכל כניסה</option></select></div></div><label class="check"><input id="campaignActive" type="checkbox" checked><span><span class="t">הקמפיין פעיל</span><span class="d">יוצג רק בתוך טווח התאריכים שנבחר.</span></span></label><label class="check"><input id="campaignNotify" type="checkbox" checked><span><span class="t">שליחה גם כהתראה</span><span class="d">ההתראה תופיע למשתמשים בקהל היעד.</span></span></label><button class="btn btn-p">פרסום הקמפיין</button></form><div class="stack"><div class="page-h"><h2>קמפיינים קיימים</h2><p>${campaigns.length} קמפיינים</p></div>${campaigns.length?campaigns.map(c=>`<article class="card"><div class="row between"><div><span class="b ${c.active?'b-ok':'b-warn'}">${c.active?'פעיל':'מושהה'}</span> <span class="b">${audience[c.audience]||c.audience}</span><h3>${esc(c.title)}</h3></div><button class="btn btn-g btn-sm" data-campaign-toggle="${c.id}" data-active="${c.active?'1':'0'}">${c.active?'השהיה':'הפעלה'}</button></div><p class="small mute">${esc(c.body||'')} · ${c.seconds||0} שניות · ${esc(c.frequency||'session')}</p></article>`).join(''):'<div class="card center mute">עדיין אין קמפיינים</div>'}</div></div>`;
  }

  function tPraise(){
    if(Auth.user?.rank!=='founder')return '<div class="err">צפייה מרוכזת במילים טובות זמינה ליוצר בלבד.</div>';
    const options=users.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','he')).map(u=>`<option value="${esc(u.id)}">${esc(u.name||u.email)}${isStaffUser(u)?' · '+esc(RANKS[u.rank]?.l||'צוות'):''}</option>`).join('');
    return `<div class="card" style="margin-bottom:16px"><div class="row between"><div><span class="eyebrow">FOUNDER ONLY</span><h2 style="margin:5px 0">מילים טובות לפי משתמש</h2><p class="small mute">בחרו משתמש כדי לראות את כל המילים הטובות והדירוגים שקיבל.</p></div><div class="field" style="min-width:min(100%,340px);margin:0"><label for="praiseUserFilter">משתמש</label><select id="praiseUserFilter"><option value="">בחירת משתמש</option>${options}</select></div></div></div><div id="praiseAdminResults">${emptyState('heart','בחרו משתמש','המילים הטובות והדירוגים שלו יוצגו כאן.')}</div>`;
  }

  function tUsers(){
    const rows = users.slice().sort((a,b)=>lvl(b)-lvl(a));
    return `
    <div class="card" style="padding:14px 16px;margin-bottom:14px">
      <input id="usrQ" placeholder="חיפוש לפי שם או אימייל">
    </div>
    <div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr>
      <th>משתמש</th><th>דרגה</th><th>מחלקה</th><th>מצב</th><th>הצטרפות</th><th></th></tr></thead>
      <tbody id="usrBody">${rows.map(u=>userRow(u)).join('')}</tbody></table></div>
    <p class="hint center" style="margin-top:12px">${users.length} משתמשים רשומים</p>`;
  }
  function userRow(u){
    const banned = u.isBanned && (!u.banUntil || new Date(u.banUntil) > new Date());
    const muted = u.muteUntil && new Date(u.muteUntil) > new Date();
    return `<tr data-s="${esc(((u.name||'')+' '+(u.email||'')).toLowerCase())}">
      <td><div class="row" style="gap:9px">${avatar(u,'s')}<div>
        <b>${esc(u.name||'ללא שם')}</b><div class="small mute">${esc(u.email||'')}</div></div></div></td>
      <td>${rankBadge(u.rank)}</td>
      <td>${u.dept?`<span class="b b-${(DEPT_BY[u.dept]||DEPT_BY.other).cls}">${esc((DEPT_BY[u.dept]||DEPT_BY.other).short)}</span>`:'<span class="mute small">—</span>'}</td>
      <td>${banned?'<span class="b b-dang">מורחק</span>':muted?'<span class="b b-warn">מושתק</span>':'<span class="b b-ok">פעיל</span>'}</td>
      <td class="small mute">${fmtDate(u.createdAt)}</td>
      <td><button class="btn btn-g btn-xs" onclick="${bind(async ()=>{ await userActionsModal(u.id, users); })}">${ic('settings',13)} ניהול</button></td>
    </tr>`;
  }

  function paintTabs(){
    $$('#admTabs button').forEach(b=>b.classList.toggle('on', b.dataset.k===tab));
  }
  function paint(){
    const body = $('#admBody');if(!body)return;
    body.innerHTML = tab==='queue' ? tQueue() : tab==='depts' ? tDepts() : tab==='mod' ? tMod()
      : tab==='appeals' ? tAppeals() : tab==='apps' ? tApps() : tab==='verify' ? tVerify()
      : tab==='system' ? tSystem() : tab==='campaigns' ? tCampaigns() : tab==='praise' ? tPraise() : tab==='emergency' ? tEmergency() : tab==='backup' ? tBackup() : tUsers();
    if(tab==='emergency'){
      $('#emergencyForm').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;try{await Store.add('emergencyRequests',{targetUserId:$('#emergencyTarget').value,caseRef:$('#emergencyCase').value.trim(),reason:$('#emergencyReason').value.trim()});toast('הגישה לכל השיחות נפתחה לשעה ותועדה');await loadAll();paint();}catch(err){toast(err.message||'הבקשה נכשלה','err');b.disabled=false;}};
      $$('[data-emergency-approve]').forEach(b=>b.onclick=async()=>{await Store.update('emergencyRequests',b.dataset.emergencyApprove,{status:'approved',decisionNote:'אושר בפאנל החירום'});toast('הגישה אושרה לשעה ותועדה');await loadAll();paint();});
      $$('[data-emergency-reject]').forEach(b=>b.onclick=async()=>{await Store.update('emergencyRequests',b.dataset.emergencyReject,{status:'rejected',decisionNote:'נדחה בפאנל החירום'});toast('הבקשה נדחתה ותועדה');await loadAll();paint();});
      $$('[data-emergency-export]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const data=await request('/api/emergency/'+encodeURIComponent(b.dataset.emergencyExport)+'/evidence');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='smai-emergency-evidence-'+data.caseRef+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('חבילת הראיות נוצרה והגישה נרשמה');}catch(err){toast(err.message||'הייצוא נכשל','err');}finally{b.disabled=false;}});
    }
    if(tab==='campaigns'){
      const type=$('#campaignType'),media=$('#campaignMedia'),body=$('#campaignBody');if(type&&!type.querySelector('[value="text"]'))type.insertAdjacentHTML('afterbegin','<option value="text">טקסט בלבד</option>');if(media)media.required=false;if(body){body.maxLength=1000;body.insertAdjacentHTML('afterend','<button class="btn btn-g btn-sm" type="button" id="campaignAddLink">הוספת קישור לטקסט המסומן</button>');$('#campaignAddLink').onclick=()=>{const label=body.value.slice(body.selectionStart,body.selectionEnd)||'כאן',url=prompt('כתובת HTTPS לקישור:','https://');if(!url||!/^https:\/\//.test(url))return;body.setRangeText(`[${label}](${url})`,body.selectionStart,body.selectionEnd,'end');body.focus();};}
      $('#campaignForm').onsubmit=async e=>{e.preventDefault();const val=id=>$('#'+id).value;await Store.add('campaigns',{title:val('campaignTitle').trim(),body:val('campaignBody').trim(),mediaType:val('campaignType'),mediaUrl:val('campaignMedia').trim(),linkUrl:val('campaignLink').trim(),audience:val('campaignAudience'),placement:'site',startAt:val('campaignStart')?new Date(val('campaignStart')).toISOString():'',endAt:val('campaignEnd')?new Date(val('campaignEnd')).toISOString():'',seconds:Number(val('campaignSeconds')),frequency:val('campaignFrequency'),active:$('#campaignActive').checked,notifyUsers:$('#campaignNotify').checked});toast('הקמפיין פורסם');await loadAll();paint();};
      $$('[data-campaign-toggle]').forEach(b=>b.onclick=async()=>{await Store.update('campaigns',b.dataset.campaignToggle,{active:b.dataset.active!=='1'});await loadAll();paint();});
    }
    if(tab==='praise'){
      const select=$('#praiseUserFilter');select.onchange=()=>{const uid=select.value,target=users.find(u=>u.id===uid),rows=feedback.filter(x=>(x.targetId||x.staffId)===uid).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));$('#praiseAdminResults').innerHTML=!uid?emptyState('heart','בחרו משתמש','המילים הטובות והדירוגים שלו יוצגו כאן.'):rows.length?`<div class="sec-h"><div><h2>${esc(target?.name||target?.email||'משתמש')}</h2><p>${rows.length} פריטי משוב חיובי ודירוג</p></div></div><div class="stack">${rows.map(x=>`<article class="card"><div class="row between"><span class="b ${x.kind==='ticket_rating'?'b-warn':'b-ok'}">${x.kind==='ticket_rating'?`דירוג ${x.rating}/5`:'מילה טובה'}</span><span class="tiny mute">${fmtDate(x.createdAt)} ${fmtTime(x.createdAt)}</span></div>${x.kind==='ticket_rating'?`<div class="rating-stars" aria-label="${x.rating} מתוך 5">${[1,2,3,4,5].map(n=>`<span class="${n<=x.rating?'on':''}">★</span>`).join('')}</div>`:''}<p>${esc(x.text)}</p>${x.ticketCode?`<a class="btn btn-g btn-sm" href="/ticket/${encodeURIComponent(x.ticketId)}">פתיחת פנייה ${esc(x.ticketCode)}</a>`:''}</article>`).join('')}</div>`:emptyState('heart','אין עדיין מילים טובות','המשתמש עדיין לא קיבל מילה טובה או דירוג טיפול.');};
    }
    if(tab==='queue'){
      const qi = $('#admQ');
      qi.oninput = debounce(()=>{ q = qi.value.trim(); const p = qi.selectionStart; paint(); const n=$('#admQ'); if(n){ n.focus(); n.setSelectionRange(p,p); } }, 260);
      $('#admStatus').onchange = e=>{ fStatus = e.target.value; paint(); };
      $('#admDept').onchange = e=>{ fDept = e.target.value; paint(); };
      $('#admMine').onclick = ()=>{ fMine = !fMine; paint(); };
    }
    if(tab==='backup'){
      $('#bkDl').onclick = async (e)=>{ e.target.disabled = true; try{ const sn = await Backup.download();
        toast('הגיבוי הורד — '+Object.values(sn.counts).reduce((a,b)=>a+b,0)+' רשומות'); } finally{ e.target.disabled = false; } };
    }
    if(tab==='users'){
      const ui = $('#usrQ');
      ui.oninput = debounce(()=>{ const s = ui.value.trim().toLowerCase();
        $$('#usrBody tr').forEach(tr=>tr.style.display = !s || tr.dataset.s.includes(s) ? '' : 'none'); }, 180);
    }
  }
  $$('#admTabs button').forEach(b=>b.onclick = ()=>{ tab = b.dataset.k; paintTabs(); paint(); });
  paint();

  // רענון חי של התור
  onCleanup(Store.watch('tickets', async ()=>{
    if(!Auth.user || !$('#admBody')) return;
    await loadAll();if(!$('#admBody'))return; if(tab==='queue'||tab==='depts') paint();
  }));
});
const ACT_LABEL = { escalate:'הסלמה לצוות', delete_mute:'מחיקה והשתקה', delete_warn:'מחיקה ואזהרה', warn:'אזהרה', none:'ללא' };
const MOD_ACT_L = { ban:'הרחקה', unban:'ביטול הרחקה', mute:'השתקה', unmute:'ביטול השתקה',
  delete_message:'מחיקת הודעה', dismiss:'דחיית דיווח', warn:'אזהרה', rank:'שינוי דרגה' };
function SRV_NAME(id){ const s = (window.__SRV_CACHE||[]).find(x=>x.id===id) || SEED_SERVERS.find(x=>x.id===id); return s? s.name : id; }

route('/setup',async app=>{
 if(!Auth.can('siteConfig')){app.innerHTML=requireLogin('האזור פתוח למנהל המערכת בלבד');return;}
 const state=await request('/api/status');
 const gemini=state.aiMode==='gemini';
 app.innerHTML=`<div class="page-h"><div class="eyebrow">SYSTEM / INTEGRATIONS</div><h1>מרכז המערכת</h1><p>המצב האמיתי של השירותים שמאחורי Sentinel.</p></div><div class="grid g3"><div class="card"><span class="b b-ok">מחובר</span><h2>אחסון נתונים</h2><p>פניות, הודעות והרשאות נשמרים בשרת.</p></div><div class="card"><span class="b ${gemini?'b-ok':'b-warn'}">${gemini?'מערכת AI פעילה':'מצב בסיסי פעיל'}</span><h2>SMAI AI</h2><p>${gemini?'מערכת ה-AI פועלת דרך השרת והמפתח אינו נחשף בדפדפן.':'העוזר והפניות מקבלים כרגע הכוונה אוטומטית לפי נושא. לאחר הגדרת מפתח API תקין, המערכת תעבור אוטומטית למצב AI.'}</p>${gemini?'':`<a class="btn btn-g" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">יצירת מפתח AI</a>`}</div><div class="card"><span class="b ${state.mail?'b-ok':'b-warn'}">${state.mail?'מחובר':'ממתין לספק שליחה'}</span><h2>עדכונים במייל</h2><p>כתובת המערכת: <b>${esc(state.mailFrom||'minipro.7548@gmail.com')}</b>. ${state.mail?'שירות השליחה מחובר.':'עדיין לא נשלחים מיילים. סיסמת אפליקציה של Gmail אינה נשמרת באתר; נדרש שירות דואר מאובטח דרך HTTP.'}</p></div></div><div class="card" style="margin-top:24px"><h2>העברת המידע הישן</h2><p>זו מערכת נתונים חדשה ונפרדת. מידע וחשבונות Firebase הישנים לא הועברו ולא שונו. נדרש תהליך העברה מאושר לפני החלפת האתר הציבורי.</p><a class="btn btn-g" href="/admin">חזרה לפאנל הניהול</a></div>`;
});

route('/terms', (app)=>{
  const S = [
    ['1. מי אנחנו ומה SMAI עושה',
     `SMAI היא יוזמה אזרחית שנועדה לשמור על המרחב הדיגיטלי בטוח יותר לילדים ולבני נוער. אנחנו מקבלים דיווחים על
      הטרדות, סחיטה, הפצת תוכן ופגיעות אחרות ברשת, מנתחים אותם, מלווים את הפונים בצעדים המעשיים הנכונים, ומסייעים
      מול הפלטפורמות שבהן הפגיעה התרחשה. השירות ניתן ללא תשלום.`],
    ['2. SMAI אינו תחליף למשטרה ואינו גוף חירום',
     `זה הסעיף הכי חשוב בעמוד הזה. SMAI אינו רשות אכיפה, אינו גוף חקירה, אינו שירות רפואי ואינו שירות חירום.
      אין לנו סמכות לעצור אדם, לחייב פלטפורמה למחוק תוכן, או לפעול במקום גורמי אכיפת החוק.
      במצב של סכנה מיידית לחיים או לשלמות הגוף יש להתקשר למשטרת ישראל בטלפון 100 — מיד, ולא דרך האתר.
      אין להסתמך על האתר, על טופס הדיווח או על הצ׳אט כאמצעי להזעקת עזרה במצב חירום. הפניות באתר נבדקות
      על ידי מערכת ועל ידי מתנדבים, ואין התחייבות לזמן תגובה כלשהו.`],
    ['3. איך אנחנו כן עוזרים',
     `אנחנו מספקים ניתוח ראשוני של המקרה, הכוונה מעשית לצעדים הנכונים (תיעוד, חסימה, דיווח בפלטפורמה, הגנה על החשבון),
      ליווי אישי בצ׳אט מול נציג, סיוע בניסוח בקשות הסרה מול הפלטפורמות, ומדריכים כתובים. במקרים שמחייבים זאת
      נמליץ בבירור לפנות למשטרה או לגורם מקצועי, ונלווה אתכם גם אחרי הפנייה אליהם.`],
    ['4. הגבלת אחריות',
     `השירות ניתן כמות שהוא (AS IS) וללא כל אחריות מכל סוג. SMAI, מפעיליו, המתנדבים בו וכל מי מטעמו אינם אחראים,
      במישרין או בעקיפין, לכל נזק — ישיר, עקיף, תוצאתי, כספי, נפשי או אחר — שייגרם כתוצאה משימוש באתר,
      מהסתמכות על מידע או המלצה שניתנו בו, מעיכוב במענה, מאי-מענה, מתקלה טכנית, או מכל פעולה או מחדל של
      משתמש אחר. כל החלטה שתתקבל על סמך מידע מהאתר היא באחריות המשתמש בלבד.
      אין באמור באתר משום ייעוץ משפטי, ייעוץ רפואי או ייעוץ פסיכולוגי מקצועי.`],
    ['5. גיל ושימוש על ידי קטינים',
     `האתר מיועד גם לקטינים, ולכן הוא כתוב בשפה פשוטה ומכבדת. מומלץ מאוד שקטין ישתף מבוגר שהוא סומך עליו.
      במקרים שבהם עולה חשש לסכנה ממשית לחיי קטין, אנו שומרים לעצמנו את הזכות לפנות לגורמי אכיפה או לגורם
      מוסמך אחר גם ללא הסכמה מוקדמת — זו החריגה היחידה לכלל החיסיון שלנו.`],
    ['6. כללי התנהגות בקהילה',
     `הקהילה של SMAI היא מרחב מוגן. אסורים בה: הטרדה, איומים, שנאה וגזענות, תוכן מיני, פנייה אישית לקטינים,
      חשיפת פרטים אישיים של אחר, התחזות לצוות, פישינג, הונאות וספאם. הודעות נסרקות אוטומטית, ומשתמש שמפר את
      הכללים עלול לקבל אזהרה, השתקה או הרחקה — לפי חומרת המקרה. לכל החלטת מודרציה יש זכות ערעור מתוך האתר.`],
    ['7. דיווחי שווא ושימוש לרעה',
     `דיווח שקרי ביודעין על משתמש או על אדם אחר פוגע במי שבאמת זקוק לעזרה, ומעכב את הטיפול בו.
      דיווחי שווא חוזרים יובילו להרחקה קבועה, ובמקרים חמורים יועברו לגורמי אכיפה.`],
    ['8. פרטיות ומידע',
     `מה שאתם כותבים לנו נשאר חסוי ונגיש לכם ולצוות המורשה. אנחנו לא מוכרים מידע, לא משתפים אותו
      עם מפרסמים, לא פונים לבית הספר ולא פונים להורים בלי לדבר איתכם — למעט מצב של סכנת חיים.
      פירוט מלא נמצא ב<a href="/privacy">מדיניות הפרטיות</a>.`],
    ['9. קניין רוחני',
     `התכנים, המדריכים והעיצוב באתר שייכים ל-SMAI. מותר לשתף קישורים ולצטט לצורך עזרה לאחרים, ואסור להעתיק
      את התוכן ולהציגו כאילו הוא שלכם או לעשות בו שימוש מסחרי ללא אישור בכתב.`],
    ['10. שינויים בתנאים ובשירות',
     `אנחנו רשאים לעדכן את התנאים, לשנות את השירות, להוסיף או להסיר יכולות, ואף להפסיק את פעילות האתר —
      בכל עת וללא הודעה מוקדמת. המשך שימוש באתר לאחר עדכון מהווה הסכמה לתנאים המעודכנים.`],
    ['11. דין וסמכות שיפוט',
     `על תנאים אלה יחולו דיני מדינת ישראל בלבד, וסמכות השיפוט הבלעדית בכל עניין הנוגע אליהם נתונה
      לבתי המשפט המוסמכים במחוז תל אביב.`]
  ];
  app.innerHTML = `
  <div class="page-h anim-up"><div class="eyebrow">${ic('file',13)} משפטי</div><h1>תנאי שימוש</h1>
    <p>קראו את זה פעם אחת. זה קצר, כתוב בעברית פשוטה, ומסביר בדיוק מה אנחנו כן ומה אנחנו לא.</p></div>

  <div class="callout c-dang anim-up d1" style="margin-bottom:22px">
    <span class="ic">${ic('alert',20)}</span>
    <div><b>SMAI אינו תחליף למשטרה ואינו גוף חירום.</b>
      במצב סכנה מיידית יש להתקשר למשטרת ישראל — 100. אל תחכו לתשובה מהאתר.</div>
  </div>

  <div class="split">
    <div class="card anim-up d2">
      <p class="small mute">עדכון אחרון: ${fmtDate(nowISO())}. השימוש באתר, לרבות שליחת דיווח או פתיחת חשבון,
        מהווה הסכמה מלאה לתנאים שלהלן.</p>
      <hr class="divider">
      ${S.map(([h,b],i)=>`<section id="t${i}" style="margin-bottom:22px">
        <h3 style="font-size:1.06rem;margin:0 0 7px">${esc(h)}</h3>
        <p class="small" style="line-height:1.85;margin:0;color:var(--text)">${b}</p>
      </section>`).join('')}
      <hr class="divider">
      <div class="callout c-info"><span class="ic">${ic('heart',18)}</span>
        <div>אנחנו כאן כי מגיע לכל ילד להרגיש בטוח ברשת. אם משהו בתנאים לא ברור —
          <a href="/report">פתחו פנייה</a> ונסביר בשמחה.</div></div>
    </div>
    <aside class="stack anim-up d3">
      <div class="card sticky">
        <div class="card-h"><span class="ico-tile i-brand">${ic('list',19)}</span><h4>ניווט מהיר</h4></div>
        <div class="stack" style="gap:4px">
          ${S.map(([h],i)=>`<a class="btn btn-ghost btn-sm" style="justify-content:flex-start" href="/terms" onclick="${bind(()=>{ document.getElementById('t'+i)?.scrollIntoView({behavior:'smooth',block:'start'}); })}">${esc(h)}</a>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="row" style="gap:9px;font-weight:800;margin-bottom:7px">${ic('phone',16)} סכנה מיידית</div>
        <p class="small mute" style="margin:0 0 10px">אל תשתמשו באתר. התקשרו עכשיו.</p>
        <a class="btn btn-d btn-block" href="tel:100">${ic('phone',16)} משטרת ישראל 100</a>
      </div>
      <div class="card">
        <p class="small mute" style="margin:0">רוצים לקרוא גם על מה קורה עם המידע שלכם?</p>
        <a class="btn btn-g btn-sm btn-block" href="/privacy" style="margin-top:10px">${ic('lock',15)} מדיניות פרטיות</a>
      </div>
    </aside>
  </div>`;
});

route('/partners',app=>{app.innerHTML=`<div class="page-h partner-hero"><div class="eyebrow">SAFETY NETWORK / 04</div><h1>רשת אחת. הרבה דרכים לעזור.</h1><p>SMAI Sentinel היא יוזמה עצמאית. אנחנו משתמשים במשאבים ובערוצי דיווח ציבוריים של גופים שונים, ומסמנים שותפות רשמית רק אחרי אישור כתוב.</p></div><div class="partner-grid"><article class="partner-card"><div class="partner-logo"><img src="https://logo.clearbit.com/kidsafe.com?size=96" alt="KidSAFE" loading="lazy"><span>01</span></div><div><span class="partner-status">משאב בטיחות חיצוני</span><h2>KidSAFE</h2><p>מידע והכוונה בנושאי בטיחות ילדים ברשת. אין כאן טענה להסמכה או לשותפות רשמית.</p></div><a class="btn btn-g" href="https://kidsafe.com/" target="_blank" rel="noopener noreferrer nofollow">פתיחת המשאב ${ic('arrow',15)}</a></article><article class="partner-card"><div class="partner-logo">${platLogo('roblox')}<span>02</span></div><div><span class="partner-status">ערוץ דיווח ציבורי</span><h2>Roblox</h2><p>גישה ישירה לערוצי התמיכה והדיווח הציבוריים של Roblox, ללא מצג של חסות או שותפות.</p></div><a class="btn btn-g" href="https://www.roblox.com/support" target="_blank" rel="noopener noreferrer nofollow">Roblox Support ${ic('arrow',15)}</a></article><article class="partner-card"><div class="partner-logo"><img src="https://logo.clearbit.com/ic3.gov?size=96" alt="IC3" loading="lazy"><span>03</span></div><div><span class="partner-status muted">מידע בלבד · ארה״ב</span><h2>FBI / IC3</h2><p>מידע על ערוץ IC3 הרשמי למקרי פשיעת סייבר בעלי זיקה לארצות הברית. אין שותפות רשמית.</p></div><a class="btn btn-g" href="https://www.ic3.gov/" target="_blank" rel="noopener noreferrer nofollow">IC3 הרשמי ${ic('arrow',15)}</a></article><article class="partner-card partner-intelligence"><div class="partner-logo intelligence-mark">✦<span>04</span></div><div><span class="partner-status">SMAI INTELLIGENCE</span><h2>מיון חכם, מקומי ופרטי</h2><p>המנוע המקומי בודק דיווחים במכשיר, מסמן דחיפות ומנתב לצוות הנכון — בלי לשלוח את הטקסט לשירות חיצוני.</p></div><button class="btn btn-p" onclick="document.getElementById('ai-fab')?.click()">פתיחת העוזר החכם ${ic('arrow',15)}</button></article></div><div class="transparency-note"><span>${ic('shield-check',20)}</span><div><b>שקיפות לפני לוגואים.</b><p>שמות וסימנים מסחריים שייכים לבעליהם. „שותף מאומת” יוצג רק לאחר אישור כתוב שניתן לבדיקה.</p></div></div>`;});

route('/team-praise',async app=>{
 if(!Auth.user)return app.innerHTML=requireLogin('צריך להתחבר כדי לשלוח מילה טובה');
 const people=(await Store.list('users')).filter(u=>u.id!==Auth.user.id).sort((a,b)=>(a.name||'').localeCompare(b.name||'','he'));
 const visible=await Store.list('feedback'),mine=visible.filter(x=>x.byId===Auth.user.id&&['praise','staff_praise'].includes(x.kind)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))),received=visible.filter(x=>(x.targetId||x.staffId)===Auth.user.id&&['praise','staff_praise'].includes(x.kind)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 app.innerHTML=`<div class="page-h anim-up"><div class="eyebrow">SMAI COMMUNITY</div><h1>מילה טובה</h1><p>מישהו בקהילה או בצוות עזר לכם, עודד אתכם או עשה משהו טוב? ספרו לו.</p></div><div class="improve-grid"><form id="praiseForm" class="card stack"><div class="card-h"><span class="ico-tile i-ok">${ic('heart',20)}</span><div><h3 style="margin:0">שליחת מילה טובה</h3><div class="tiny mute">בחרו אדם מהקהילה וכתבו מה הערכתם</div></div></div><div class="field"><label for="praiseTarget">למי שולחים?</label><select id="praiseTarget" required><option value="">בחירה מהרשימה</option>${people.map(u=>`<option value="${esc(u.id)}">${esc(u.name||u.email)}${isStaffUser(u)?' · '+esc(RANKS[u.rank]?.l||'צוות'):''}</option>`).join('')}</select></div><div class="field"><label for="praiseText">המילה הטובה שלכם</label><textarea id="praiseText" required minlength="5" maxlength="2000" placeholder="ספרו מה האדם עשה ואיך זה עזר או שימח אתכם"></textarea></div><button class="btn btn-p" type="submit">${ic('heart',16)} שליחת מילה טובה</button><p id="praiseStatus" class="small" role="status"></p></form><section><h2>מילים טובות שקיבלתם</h2><div class="stack">${received.length?received.map(x=>`<article class="card pad-sm"><div class="row between"><b>${esc(x.byName||'חבר/ת קהילה')}</b><span class="b b-ok">${ic('heart',11)} בשבילך</span></div><p class="small">${esc(x.text)}</p><span class="tiny mute">${fmtDate(x.createdAt)}</span></article>`).join(''):'<div class="card center mute">עוד לא קיבלתם מילה טובה.</div>'}</div><h2 style="margin-top:24px">מה שכבר שלחתם</h2><div class="stack">${mine.length?mine.map(x=>`<article class="card pad-sm"><div class="row between"><b>${esc(x.targetName||x.staffName||'משתמש')}</b><span class="b b-ok">נשלח</span></div><p class="small">${esc(x.text)}</p><span class="tiny mute">${fmtDate(x.createdAt)}</span></article>`).join(''):'<div class="card center mute">עדיין לא שלחתם מילה טובה.</div>'}</div></section></div>`;
 $('#praiseForm').onsubmit=async e=>{e.preventDefault();const submit=e.currentTarget.querySelector('[type=submit]'),status=$('#praiseStatus');submit.disabled=true;try{await Store.add('feedback',{kind:'praise',targetId:$('#praiseTarget').value,text:$('#praiseText').value.trim()});toast('המילה הטובה נשלחה');render();}catch(err){status.textContent=err.message;submit.disabled=false;}};
});

route('/improve',async app=>{
 if(!Auth.user)return app.innerHTML=requireLogin('צריך להתחבר כדי לדווח על באג או לשלוח הצעה');
 const mine=(await Store.list('reports')).filter(x=>x.byId===Auth.user.id&&['bug','suggestion'].includes(x.kind));
 app.innerHTML=`<div class="page-h anim-up"><div class="eyebrow">SMAI IMPROVEMENT</div><h1>באגים והצעות</h1><p>מצאתם משהו שלא עובד או שיש לכם רעיון? שלחו אותו ישירות לצוות התחזוקה.</p></div><div class="improve-grid"><form id="improveForm" class="card stack"><div class="field"><label for="improveKind">סוג הפנייה</label><select id="improveKind"><option value="bug">דיווח על באג</option><option value="suggestion">הצעה לשיפור</option></select></div><div class="field"><label for="improveTitle">כותרת קצרה</label><input id="improveTitle" required minlength="4" maxlength="100" placeholder="למשל: הכפתור לא נפתח בטלפון"></div><div class="field"><label for="improveText">פירוט</label><textarea id="improveText" required minlength="15" maxlength="2000" placeholder="מה קרה, באיזה עמוד ומה ציפיתם שיקרה?"></textarea></div><div class="field"><label for="improvePath">העמוד שבו זה קרה</label><input id="improvePath" maxlength="180" value="${esc(location.pathname)}"></div><button class="btn btn-p" type="submit">${ic('send',16)} שליחה לצוות התחזוקה</button><p id="improveStatus" class="small" role="status"></p></form><section><h2>הדיווחים שלי</h2><div class="stack">${mine.length?mine.map(x=>`<article class="card pad-sm"><div class="row between"><b>${esc(x.reason||'דיווח')}</b><span class="b ${x.status==='closed'?'b-ok':'b-warn'}">${x.status==='closed'?'טופל':'בבדיקה'}</span></div><p class="small mute">${esc(x.text||'')}</p><span class="tiny mute">${fmtDate(x.createdAt)}</span></article>`).join(''):'<div class="card center mute">עדיין לא שלחתם דיווחים או הצעות.</div>'}</div></section></div>`;
 $('#improveForm').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;const status=$('#improveStatus');status.textContent='שולח…';try{await Store.add('reports',{kind:$('#improveKind').value,type:'maintenance',reason:$('#improveTitle').value.trim(),text:$('#improveText').value.trim(),targetId:$('#improvePath').value.trim()});status.textContent='הדיווח נשמר ונשלח לצוות התחזוקה.';toast('תודה — הדיווח התקבל');setTimeout(()=>render(),500);}catch(err){status.textContent=err.message||'השליחה נכשלה';b.disabled=false;}};
});

route('/privacy',app=>{app.innerHTML='<div class="page-h"><div class="eyebrow">שקיפות</div><h1>פרטיות בגרסת הבדיקה</h1><p>עדכון: 10 בספטמבר 2026</p></div><div class="stack" style="max-width:850px"><section class="card"><h2>מה נשמר</h2><p>שם התצוגה, אימייל ומזהה החשבון מתקבלים משירות ההזדהות. תוכן הפניות, ההודעות והפעולות שלכם נשמר בשרת. שימוש בכינוי אינו אנונימיות מלאה: הפנייה משויכת לחשבון שלכם.</p></section><section class="card"><h2>מי יכול לגשת</h2><p>פניות נגישות לפונה ולצוות המורשה; הערות פנימיות זמינות לצוות בלבד. תוכן קהילתי גלוי למשתתפים המורשים באותו מרחב. שיחות פרטיות מוגבלות לחברי השיחה.</p></section><section class="card"><h2>סיוע של AI</h2><p>רק לאחר אישור מפורש, התוכן שנשלח לעוזר מועבר לספק AI חיצוני. בבקשת AI בתוך פנייה נשלחים גם התיאור וההודעות הגלויות האחרונות. אין לשלוח סיסמאות, קודי אימות, תמונות אינטימיות או פרטים מזהים שאינם נחוצים.</p></section><section class="card"><h2>אחסון ובקשות פרטיות</h2><p>המידע נשמר באמצעות תשתית Sites ו-Cloudflare. בגרסה זו עדיין אין מחיקה אוטומטית לפי זמן. אפשר לבקש תיקון, ייצוא או מחיקה באמצעות פנייה לצוות. ההעדפות וטיוטות מסוימות נשמרות גם בדפדפן.</p><a class="btn btn-g" href="/report">פנייה בנושא פרטיות</a></section><section class="card"><h2>לפני פתיחה לציבור</h2><p>זוהי גרסת בדיקה פרטית. יש לקבוע מדיניות שמירת מידע, נוהל מחיקה, תנאים ושימוש של קטינים לפני הפעלה ציבורית. אין להזין כאן מידע רגיש אמיתי לצורך הבדיקה.</p></section></div>';});
/* ===================== 404 ===================== */
route('/updates', async (app)=>{

  const u = Auth.user;
  const allUpdates = await Store.list('updates').catch(()=>[]);
  const installedList = u ? (u.installedUpdates||[]) : [];
  const available = allUpdates.filter(upd=>!installedList.includes(upd.version));
  const installed = allUpdates.filter(upd=>installedList.includes(upd.version));

  const isFounder = u && (u.rankLvl||0) >= 70;

  const renderCard = (upd, inst=false) => `
    <div class="card mb-3">
      <div class="d-flex align-items-center gap-2 mb-1">
        ${ic('download',18)} <strong>${esc(upd.name)}</strong>
        <span class="badge">${esc(upd.version)}</span>
        <span class="badge" style="background:var(--accent2)">${esc(upd.category||'optional')}</span>
      </div>
      <p class="text-muted small">${esc(upd.description||'')}</p>
      <ul class="small mb-2">${(upd.changelog||[]).map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
      ${inst
        ? `<span class="badge" style="background:var(--success)">מותקן ✓</span>`
        : `<button class="btn btn-primary btn-sm install-btn" data-ver="${esc(upd.version)}" data-id="${esc(upd.id)}">התקן עכשיו</button>`
      }
    </div>`;

  app.innerHTML = `
    <div class="page-header"><h1>${ic('download',22)} עדכונים</h1></div>
    ${isFounder ? `<button id="publishUpdateBtn" class="btn btn-secondary btn-sm mb-3">${ic('plus',16)} פרסם עדכון חדש</button>` : ''}
    <h3>זמינים להתקנה (${available.length})</h3>
    ${available.length ? available.map(u=>renderCard(u,false)).join('') : '<p class="text-muted">אין עדכונים זמינים</p>'}
    <h3 class="mt-4">היסטוריה (${installed.length})</h3>
    ${installed.length ? installed.map(u=>renderCard(u,true)).join('') : '<p class="text-muted">לא הותקנו עדכונים</p>'}
  `;

  /* install handler */
  app.querySelectorAll('.install-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const ver = btn.dataset.ver;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> מתקין...`;
      /* fake progress */
      await new Promise(r=>setTimeout(r,2500));
      try {
        if(Auth.user){
          const inst2 = [...(Auth.user.installedUpdates||[]), ver];
          await Store.update('users', Auth.user.id, {installedUpdates: inst2});
          Auth.user.installedUpdates = inst2;
        }
        toast('העדכון הותקן בהצלחה!','success');
        await new Promise(r=>setTimeout(r,800));
        location.reload();
      } catch(e){ toast('שגיאה בהתקנת העדכון','error'); btn.disabled=false; }
    });
  });

  /* founder publish button */
  if(isFounder){
    const pubBtn = document.getElementById('publishUpdateBtn');
    if(pubBtn) pubBtn.addEventListener('click',()=>{
      openModal(`
        <h3>פרסם עדכון חדש</h3>
        <div class="form-group"><label>גרסה</label><input id="upVer" class="form-control" placeholder="1.1"></div>
        <div class="form-group"><label>שם</label><input id="upName" class="form-control" placeholder="שם העדכון"></div>
        <div class="form-group"><label>תיאור</label><input id="upDesc" class="form-control" placeholder="תיאור קצר"></div>
        <div class="form-group"><label>שינויים (שורה לכל שינוי)</label><textarea id="upLog" class="form-control" rows="4"></textarea></div>
        <div class="form-group"><label>קטגוריה</label>
          <select id="upCat" class="form-control">
            <option value="optional">אופציונלי</option>
            <option value="required">חובה</option>
            <option value="silent">שקט</option>
          </select>
        </div>
        <div class="d-flex gap-2 mt-3">
          <button id="doPublish" class="btn btn-primary">פרסם</button>
          <button onclick="closeModal()" class="btn btn-secondary">ביטול</button>
        </div>
      `);
      document.getElementById('doPublish').addEventListener('click', async ()=>{
        const v=document.getElementById('upVer').value.trim();
        const n=document.getElementById('upName').value.trim();
        const d=document.getElementById('upDesc').value.trim();
        const log=document.getElementById('upLog').value.split('\n').filter(Boolean);
        const cat=document.getElementById('upCat').value;
        if(!v||!n){toast('נא למלא גרסה ושם','error');return;}
        await Store.add('updates',{version:v,name:n,description:d,changelog:log,category:cat,releasedAt:new Date().toISOString()});
        closeModal();
        toast('העדכון פורסם!','success');
        render();
      });
    });
  }
});

route('/404', (app)=>{
  app.innerHTML = `<div class="center" style="padding:70px 0">
    <div class="ico-tile i-brand" style="margin:0 auto 18px;width:70px;height:70px;animation:bob 3s ease-in-out infinite">${ic('search',30)}</div>
    <h1 style="font-size:2rem">הדף הזה לא נמצא</h1>
    <p class="mute" style="max-width:44ch;margin:0 auto 22px">אולי הקישור ישן, או שנפלה טעות בכתובת.
      אפשר לחזור לדף הבית או לפתוח פנייה חדשה.</p>
    <div class="row" style="justify-content:center">
      <a class="btn btn-p" href="/">${ic('home',17)} לדף הבית</a>
      <a class="btn btn-g" href="/report">${ic('send',17)} פתיחת פנייה</a></div></div>`;
});

/* ===================== ראוטר ===================== */
let RENDERING = false; let _renderPending = false;
async function renderCampaign(app,path){
  if(['/login','/admin','/setup'].includes(path))return;
  try{
    const at=Date.now(),rows=await Store.list('campaigns');
    const eligible=rows.filter(c=>c.active&&(!c.startAt||Date.parse(c.startAt)<=at)&&(!c.endAt||Date.parse(c.endAt)>=at)&&(c.audience==='all'||c.audience==='members'&&Auth.user||c.audience==='staff'&&lvl(Auth.user)>=10));
    const c=eligible.find(x=>{const key='smai_campaign_'+x.id;return x.frequency==='always'||!localStorage.getItem(key)||(x.frequency==='daily'&&at-Number(localStorage.getItem(key))>86400000);});
    if(!c)return;
    localStorage.setItem('smai_campaign_'+c.id,String(at));
    const media=c.mediaType==='video'?`<video class="campaign-media" src="${esc(c.mediaUrl)}" autoplay muted loop playsinline></video>`:c.mediaType==='image'?`<img class="campaign-media" src="${esc(c.mediaUrl)}" alt="">`:'';
    app.insertAdjacentHTML('afterbegin',`<aside id="siteCampaign" class="site-campaign anim-up ${media?'':'campaign-text-only'}"><div class="campaign-copy"><span class="eyebrow">עדכון מ־SMAI SENTINEL</span><h2>${esc(c.title)}</h2><p>${campaignRichText(c.body||'')}</p>${c.linkUrl?`<a class="btn btn-p btn-sm" href="${esc(c.linkUrl)}" target="_blank" rel="noopener">למידע נוסף</a>`:''}</div>${media}<button class="campaign-close" aria-label="סגירת הפרסומת">×</button></aside>`);
    $('.campaign-close').onclick=()=>$('#siteCampaign')?.remove();
    if(Number(c.seconds)>0)setTimeout(()=>$('#siteCampaign')?.remove(),Number(c.seconds)*1000);
  }catch{}
}
async function render(){
  if(RENDERING){ _renderPending = true; return; } RENDERING = true; _renderPending = false;
  runCleanup();
  const app = $('#app');
  if(location.hash.startsWith('#/'))history.replaceState(null,'',location.hash.slice(1));
  const parts = location.pathname.split('/').filter(Boolean);
  const path = '/' + (parts[0] || '');
  const decode=x=>{try{return decodeURIComponent(x);}catch{return x;}};
  const arg = parts[1] ? decode(parts[1]) : null;
  const arg2 = parts[2] ? decode(parts[2]) : null;
  const arg3 = parts[3] ? decode(parts[3]) : null;

  renderNav();
  document.body.classList.toggle('is-auth', path === '/login');
  app.classList.toggle('admin-workspace',path==='/admin');

  // חסימת מורחקים מכל האתר למעט מסכי מידע
  if(Auth.user && Auth.banInfo() && !['/privacy','/terms','/login','/'].includes(path)){
    window.scrollTo({top:0}); if(renderBanned(app)){ RENDERING = false; return; }
  }

  const fn = ROUTES[path] || ROUTES['/404'];
  app.innerHTML = loader();
  try{ await fn(app, arg, arg2, arg3); await renderCampaign(app,path); }
  catch(e){
    console.error(e);
    if((e?.code==='permission-denied'||e?.message?.includes('permission'))&&!Auth.user&&!firebaseUser()){location.hash='#/login';return;}
    app.innerHTML = `<div class="card center" style="max-width:520px;margin:50px auto">
      <div class="ico-tile i-dang" style="margin:0 auto 14px;width:56px;height:56px">${ic('alert',24)}</div>
      <h2 style="font-size:1.25rem">משהו השתבש בטעינת העמוד</h2>
      <p class="mute small">${esc(e.message||'שגיאה לא ידועה')}</p>
      <div class="row" style="justify-content:center"><button class="btn btn-g" onclick="location.reload()">רענון</button>
        <a class="btn btn-p" href="/">לדף הבית</a></div></div>`;
  }
  document.title = (PAGE_TITLES[path] ? PAGE_TITLES[path] + ' · ' : '') + SITE.name + ' — ' + SITE.tagline;
  try{ initReveal(); }catch(_){}
  RENDERING = false;
  if(_renderPending) render();
}
const PAGE_TITLES = {
  '/report':'דיווח חדש', '/my':'הפניות שלי', '/track':'מעקב פנייה', '/ticket':'פנייה',
  '/articles':'מדריכים', '/article':'מדריך', '/community':'קהילה', '/server':'שרת קהילה',
  '/join':'הצטרפות לצוות', '/login':'כניסה', '/account':'החשבון שלי', '/admin':'פאנל צוות',
  '/setup':'התקנה', '/privacy':'פרטיות', '/terms':'תנאי שימוש', '/partners':'שיתופי פעולה', '/dm':'הודעות פרטיות', '/friends':'חברים', '/team-praise':'מילה טובה', '/improve':'באגים והצעות', '/404':'לא נמצא', '/updates':'עדכונים'
};

/* ===================== ערכת נושא, תפריט, אתחול ===================== */
function initTheme(){
  const saved = localStorage.getItem('smai_theme');
  const sys = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const set = t=>{
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('smai_theme', t);
    const b = $('#themeBtn'); if(b) b.innerHTML = ic(t==='dark'?'sun':'moon',18);
  };
  set(saved || 'dark');
  $('#themeBtn').onclick = ()=>set(document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark');
}
function initLanguage(){
  const apply=lang=>{localStorage.setItem('smai_lang',lang);document.documentElement.lang=lang;document.documentElement.dir=lang==='en'?'ltr':'rtl';const b=$('#languageToggle');if(b){b.textContent=lang==='en'?'עב':'EN';b.setAttribute('aria-label',lang==='en'?'Switch to Hebrew':'מעבר לאנגלית');}const settings=document.querySelector('.top-utility a[href="/account"]');if(settings)settings.textContent=lang==='en'?'Settings':'הגדרות';const notices=$('#topNotifShortcut');if(notices&&!notices.querySelector('.top-notif-count'))notices.textContent=lang==='en'?'Notifications':'התראות';renderNav();};
  apply(currentLang());const b=$('#languageToggle');if(b)b.onclick=()=>{apply(currentLang()==='en'?'he':'en');render();renderFooter();};
}
function initSfx(){
  Sfx.paintBtn();
  const b = $('#sfxBtn'); if(!b) return;
  b.onclick = ()=>{ Sfx.setOn(!Sfx.isOn()); toast(Sfx.isOn()?'צלילים הופעלו':'צלילים הושתקו','ok',1800,true); };
}
function initBurger(){
  const b = $('#burger'), nav = $('#nav');
  const desktop=()=>matchMedia('(min-width:761px)').matches;
  const paint=()=>{
    if(desktop()){
      const collapsed=localStorage.getItem('smai_sidebar_collapsed')==='1';
      document.body.classList.toggle('sidebar-collapsed',collapsed);
      b.classList.toggle('on',!collapsed);
      b.setAttribute('aria-expanded',String(!collapsed));
      b.setAttribute('aria-label',collapsed?'פתיחת סרגל הניווט':'כיווץ סרגל הניווט');
    }else{
      document.body.classList.remove('sidebar-collapsed');
      b.setAttribute('aria-expanded',String(nav.classList.contains('open')));
      b.setAttribute('aria-label',nav.classList.contains('open')?'סגירת התפריט':'פתיחת התפריט');
    }
  };
  b.onclick=()=>{
    if(desktop())localStorage.setItem('smai_sidebar_collapsed',document.body.classList.contains('sidebar-collapsed')?'0':'1');
    else nav.classList.toggle('open');
    paint();
  };
  nav.addEventListener('click',e=>{if(!desktop()&&e.target.closest('a')){nav.classList.remove('open');paint();}});
  addEventListener('resize',paint,{passive:true});
  paint();
}
function initNotif(){
  const openNotifications = async ()=>{
    if(!Auth.user) return toast('התחברו כדי לראות עדכונים','warn');
    const [tickets, appeals, notifications] = await Promise.all([Store.list('tickets'), Store.list('appeals'),Store.list('notifications')]);
    const mine = tickets.filter(t=>t.reporterId===Auth.user.id).slice(0,6);
    const staff = Auth.can('viewPanel')
      ? tickets.filter(t=>t.status==='new' || (t.priority==='critical' && !['resolved','closed'].includes(t.status))).slice(0,6)
      : [];
    const row = t=>`<a class="ch" href="/ticket/${t.id}" onclick="closeModal()">
      ${ic('file',16)}<span class="nm">${esc(t.title)}</span>${statusBadge(t.status)}</a>`;
    const notice=n=>`<a class="ch ${n.read?'':'notification-unread'}" href="${esc(n.href||n.ticketId&&`/ticket/${encodeURIComponent(n.ticketId)}`||'/account')}" onclick="closeModal()">
      ${ic('message',16)}<span class="nm"><b>${esc(n.title||'תשובה חדשה בפנייה')}</b><small>${esc(n.text||'')}</small></span></a>`;
    openModal(`<div class="m-h"><span class="ico-tile i-brand">${ic('bell',20)}</span><h3>התראות</h3>${notifications.some(n=>!n.read)?'<button class="btn btn-g btn-sm" id="markAllNotifications" type="button">סמן הכול כנקרא</button>':''}</div>
    <div class="m-b" style="padding:14px">
      ${notifications.length?`<h4 class="small mute" style="margin:0 0 8px">התראות חדשות</h4><div class="stack" style="gap:4px;margin-bottom:16px">${notifications.slice(0,10).map(notice).join('')}</div>`:''}
      ${staff.length?`<h4 class="small mute" style="margin:0 0 8px">דורש טיפול</h4>
        <div class="stack" style="gap:4px;margin-bottom:16px">${staff.map(row).join('')}</div>`:''}
      <h4 class="small mute" style="margin:0 0 8px">הפניות שלי</h4>
      ${mine.length?`<div class="stack" style="gap:4px">${mine.map(row).join('')}</div>`
        :'<p class="small mute">אין פניות פתוחות. זה דווקא סימן טוב.</p>'}
      ${Auth.can('ban') && appeals.filter(a=>a.status==='pending').length
        ? `<div class="callout c-warn" style="margin-top:14px"><span class="ic">${ic('message',17)}</span>
           <div>${appeals.filter(a=>a.status==='pending').length} ערעורים ממתינים לבדיקה.
           <a href="/admin" onclick="closeModal()">לפאנל</a></div></div>` : ''}
    </div>`);
    const markAll=$('#markAllNotifications');if(markAll)markAll.onclick=async()=>{markAll.disabled=true;await Promise.all(notifications.filter(n=>!n.read).map(n=>Store.update('notifications',n.id,{read:true}).catch(()=>{})));markAll.textContent='הכול סומן כנקרא';syncNotificationBadge();};
  };
  $('#notifBtn').onclick=openNotifications;
  const topShortcut=$('#topNotifShortcut');if(topShortcut)topShortcut.onclick=openNotifications;
}
let notificationWatchStop=null,notificationWatchUser='';
function syncNotificationBadge(){
  const button=$('#notifBtn'),user=Auth.user;
  if(!button||!user){notificationWatchStop?.();notificationWatchStop=null;notificationWatchUser='';return;}
  if(notificationWatchUser===user.id)return;
  notificationWatchStop?.();notificationWatchUser=user.id;
  notificationWatchStop=Store.watch('notifications',rows=>{
    const count=rows.filter(n=>!n.read).length;
    button.innerHTML=`${ic('bell',18)}${count?`<span class="notif-badge">${Math.min(count,99)}</span>`:''}`;
    button.setAttribute('aria-label',count?`${count} התראות שלא נקראו`:'התראות');
    button.classList.toggle('has-notifications',count>0);
    const topShortcut=$('#topNotifShortcut');
    if(topShortcut){const label=currentLang()==='en'?'Notifications':'התראות';topShortcut.innerHTML=count?`${label}<span class="top-notif-count">${Math.min(count,99)}</span>`:label;topShortcut.classList.toggle('has-notifications',count>0);}
  });
}
function initDemoStrip(){
  const el = $('#demoStrip');
  if(FB_ON){ el.style.display = 'none'; return; }
  el.innerHTML = `<div class="wrap row" style="gap:9px;justify-content:center;flex-wrap:wrap">
    ${ic('info',15)}<b>מצב הדגמה.</b> הנתונים נשמרים בדפדפן הזה בלבד —
    <a href="/setup">חברו את האתר ל-Firebase</a> כדי לעבוד באמת.</div>`;
}


/* Boot never writes demo data or bypasses authentication. */
(async function boot(){
 initTheme();initLanguage();initSfx();initBurger();initNotif();renderFooter();$('#demoStrip').style.display='none';
 try{await Auth.refresh();await CFG.load();}catch(e){toast(e.message,'warn');}
 const navigate=path=>{history.pushState(null,'',path);closeModal();window.scrollTo({top:0});return render();};
 window.navigate=navigate;
 document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target||a.hasAttribute('download'))return;const url=new URL(a.href,location.href);if(url.origin!==location.origin||url.pathname.startsWith('/api/'))return;e.preventDefault();navigate(url.pathname+url.search);});
 window.addEventListener('popstate',()=>{closeModal();window.scrollTo({top:0});render();});
 window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#/'))history.replaceState(null,'',location.hash.slice(1));closeModal();window.scrollTo({top:0});render();});
 await render();document.body.classList.add('ready');initAssistant();
})();


async function serverAudit(){/* The server records successful mutations; clients cannot forge audit entries. */}

document.addEventListener('keydown',e=>{if(e.key!=='Tab'||!$('#modalBg').classList.contains('open'))return;const nodes=$$('#modal a[href],#modal button:not([disabled]),#modal input:not([disabled]),#modal textarea,#modal select').filter(e=>e.getClientRects().length);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});

async function serverNotice(){/* User-visible ticket events are generated by the server after a successful mutation. */}

window.showBanAppeal=showBanAppeal;window.submitBanAppeal=submitBanAppeal;
window.addEventListener('unhandledrejection',e=>{e.preventDefault();toast(e.reason?.message||'הפעולה לא הושלמה. נסו שוב.','err');});
