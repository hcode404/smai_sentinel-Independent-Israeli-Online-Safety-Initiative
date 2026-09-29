export const categories={all:'הכול',sports:'ספורט',nature:'טבע',space:'חלל',digital:'טכנולוגיה',celebration:'חגיגה',classic:'קלאסי'};
const rows=[
 ['aurora','זוהר צפוני','classic','wave','✦','#36d9c4','#956bff',40],
 ['sunset','שקיעה','classic','drift','◦','#ff9173','#f05eac',60],
 ['cosmos','קוסמוס','classic','orbit','✧','#748bff','#c071f7',90],
 ['neon','ניאון','classic','pulse','◇','#b1f453','#34d5cf',120],
 ['football','הרגע של הגול','sports','goal','⚽','#36dfb7','#117a9d',40],
 ['basketball','על הבאזר','sports','bounce','🏀','#ff9945','#ad516c',45],
 ['tennis','נקודת משחק','sports','rally','🎾','#d5ef67','#39bfa2',45],
 ['racing','קו הסיום','sports','dash','🏎️','#f96c7c','#b078ed',50],
 ['champion','על הפודיום','sports','rise','🏆','#f8d577','#cc8a4c',60],
 ['snow','שלג שקט','nature','fall','❄','#c7efff','#688bd7',40],
 ['petals','פריחת אביב','nature','drift','🌸','#f5a6d4','#a891ef',45],
 ['rain','אחרי הגשם','nature','rain','│','#80ccdc','#5979b9',45],
 ['leaves','רוח סתיו','nature','swirl','🍂','#e1b574','#ce7462',50],
 ['meteor','מטר מטאורים','space','shoot','✦','#d8c5ff','#6b80eb',50],
 ['orbit','במסלול','space','orbit','🪐','#e6b9ec','#7487ef',60],
 ['stardust','אבק כוכבים','space','twinkle','✧','#a8caff','#bc91ef',50],
 ['moon','אור ירח','space','moon','☾','#e1dffb','#788bc7',45],
 ['matrix','זרם נתונים','digital','matrix','01','#81edab','#41a6b3',55],
 ['scan','סריקת אור','digital','scan','─','#73e7e2','#638be9',50],
 ['signal','אות חי','digital','signal','◉','#97d3fd','#a987e8',55],
 ['portal','מעבר צבע','digital','portal','◎','#d396f3','#83a7ff',60],
 ['confetti','סיבה לחגוג','celebration','confetti','▪','#ffa9ad','#9ccfff',40],
 ['hearts','אהבה קטנה','celebration','rise','♥','#f3a4c8','#b68bdf',45],
 ['sparks','ניצוצות','celebration','burst','✶','#f5d299','#d595da',50],
 ['ribbons','סרטי אור','celebration','wave','〜','#a8e4d5','#a9a2f2',55]
];
export const catalog=rows.map(([id,name,category,motion,symbol,a,b,price])=>({id,name,category,motion,symbol,a,b,price,upcomingPaid:category!=='classic',description:category==='sports'?'באנר ספורט מונפש ומסגרת תואמת':'באנר חי ומסגרת תואמת לפרופיל'}));
export const cosmetic=id=>catalog.find(item=>item.id===id);
export function profileScene(id,{compact=false}={}){
 const item=cosmetic(id);if(!item)return '<div class="profile-scene scene-default" aria-hidden="true"></div>';
 return `<div class="profile-scene scene-${item.motion} scene-item-${item.id} ${compact?'scene-compact':''}" style="--scene-a:${item.a};--scene-b:${item.b}" aria-hidden="true">${item.id==='football'?'<img class="stadium-art" src="/profile-stadium.jpg" alt="" loading="lazy" decoding="async"><span class="goal-ball">⚽</span><span class="goal-celebrate">GOAL!</span>':Array.from({length:8},(_,i)=>`<span class="scene-particle" style="--i:${i}"></span>`).join('')}<span class="scene-shade"></span></div>`;
}
