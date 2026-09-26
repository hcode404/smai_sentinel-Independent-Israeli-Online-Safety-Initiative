import {request} from './api.js';
import {categories,profileScene} from './profile-catalog.js';
export async function renderStudioShop(app,{user,esc,preview,toast}){
 app.innerHTML='<p role="status">טוען את האוסף שלכם…</p>';
 let state,category='all',ownedOnly=false,busy=false;
 const draw=()=>{
  const items=state.catalog.filter(item=>(category==='all'||item.category===category)&&(!ownedOnly||state.owned.includes(item.id)));
  app.innerHTML=`<header class="rewards-head"><div><span class="eyebrow">SMAI PROFILE STUDIO</span><h1>יותר מִשם ותמונה.</h1><p>בחרו רקע שמספר משהו עליכם.</p><div class="shop-toplinks"><a class="btn btn-g" href="/daily">הכלים שלי</a><a class="btn btn-g" href="/support">תמיכה ביוזמה</a><button class="btn btn-g" id="shopMyProfile">הפרופיל שלי</button></div></div><div class="reward-balance"><b>${state.balance}</b><span>נקודות זכות</span></div></header>
  <details class="shop-missions"><summary>המשימות שלי · ${state.missions.filter(m=>m.done&&!m.claimed).length} פרסים מחכים</summary><p class="daily-note">כל משימה מזכה פעם אחת. פונים לצוות כשצריך עזרה אמיתית.</p><div class="reward-grid">${state.missions.map(m=>`<article class="reward-card"><b>${esc(m.name)}</b><span>+${m.points} נקודות</span>${m.claimed?'<span>✓ נאסף</span>':m.done?`<button class="btn btn-p" data-action="claim" data-id="${m.id}">איסוף נקודות</button>`:`<a class="btn btn-g" href="${m.href}">מעבר למשימה</a>`}</article>`).join('')}</div></details>
  <div class="row between"><h2>בחרו את האווירה שלכם</h2><label><input id="ownedOnly" type="checkbox" ${ownedOnly?'checked':''}> רק העיצובים שלי</label></div>
  <nav class="studio-tabs" aria-label="קטגוריות עיצובים">${Object.entries(categories).map(([id,label])=>`<button data-category="${id}" aria-pressed="${category===id}">${label}</button>`).join('')}</nav>
  <p class="daily-note">זמינים עכשיו בנקודות. קולקציות בתשלום מתוכננות בהמשך; כרגע אין חיוב כספי.</p>
  <div class="reward-grid shop-catalog">${items.map(item=>{const owned=state.owned.includes(item.id),equipped=state.equipped===item.id;return `<article class="reward-card">${profileScene(item.id,{compact:true})}<div class="shop-card-body"><span class="shop-label">${categories[item.category]}${equipped?' · בשימוש':''}</span><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><b>${owned?'באוסף שלכם':item.price+' נקודות'}</b><div class="shop-card-actions"><button class="btn btn-g" data-preview="${item.id}">תצוגה בפרופיל</button><button class="btn btn-p" data-action="${owned?'equip':'buy'}" data-id="${equipped?'':item.id}" ${!owned&&state.balance<item.price?'disabled':''}>${equipped?'הסרה':owned?'החלה':state.balance<item.price?'חסרות נקודות':'רכישה'}</button></div></div></article>`;}).join('')||'<p>אין עדיין עיצובים באוסף הזה. אפשר לצפות בכל הקטגוריות.</p>'}</div>
  <section class="premium-roadmap"><span class="eyebrow">בהמשך · טרם פתוח לרכישה</span><h2>SMAI Plus — יותר מקום ליום שלכם</h2><p>הכיוון לחבילה העתידית: סנכרון משימות בין מכשירים, תזכורות מתוזמנות, מרחב עבודה משותף וקולקציות פרופיל מיוחדות. המחיר ותחילת השירות טרם נקבעו.</p><a class="btn btn-p" href="/daily">נסו עכשיו את הכלים החינמיים</a></section>
  <details class="shop-missions"><summary>היסטוריית נקודות</summary><div class="reward-ledger">${state.history.map(row=>`<div><span>${esc(row.text)}</span><b dir="ltr">${row.points>0?'+':''}${row.points}</b></div>`).join('')||'<p>הפרסים והרכישות שלכם יופיעו כאן.</p>'}</div></details><p id="shopStatus" role="status"></p>`;
  app.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>{category=button.dataset.category;draw();});
  app.querySelector('#ownedOnly').onchange=e=>{ownedOnly=e.target.checked;draw();};
  app.querySelector('#shopMyProfile').onclick=()=>preview();
  app.querySelectorAll('[data-preview]').forEach(button=>button.onclick=()=>preview(button.dataset.preview));
  app.querySelectorAll('[data-action]').forEach(button=>button.onclick=async()=>{
   if(busy)return;busy=true;app.querySelectorAll('[data-action]').forEach(b=>b.disabled=true);
   try{state=await request('/api/rewards','POST',{action:button.dataset.action,id:button.dataset.id});user.profileStyle=state.equipped;draw();toast(button.dataset.action==='buy'?'נוסף לאוסף — לחצו על החלה כדי להשתמש':'נשמר בהצלחה','ok');}
   catch(error){draw();app.querySelector('#shopStatus').textContent=error.message;toast(error.message,'err');}
   finally{busy=false;}
  });
 };
 try{state=await request('/api/rewards');draw();}catch(error){app.innerHTML=`<div class="card pad"><h2>לא ניתן לטעון כרגע את החנות</h2><p>${esc(error.message)}</p><a class="btn btn-g" href="/shop">ניסיון נוסף</a></div>`;}
}
