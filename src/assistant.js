import {request} from './api.js';
export function initAssistant(){
  const toggle=document.createElement('button');toggle.id='ai-fab';toggle.className='btn btn-p';toggle.setAttribute('aria-label','פתיחת עוזר בטיחות');toggle.setAttribute('aria-expanded','false');toggle.textContent='✧  עוזר בטיחות';
  const dialog=document.createElement('dialog');dialog.className='sentinel-assistant';
  dialog.innerHTML=`<header><div><strong>עוזר הבטיחות</strong><p data-assistant-mode>בודק את מצב השירות…</p></div><button type="button" class="iconbtn" aria-label="סגירה">✕</button></header><div class="assistant-messages" aria-live="polite"><p data-assistant-intro>אפשר להתייעץ על חשבון שנפרץ, הטרדה או דיווח. בסכנה מיידית: 100.</p></div><form><label for="assistant-input">במה אפשר לעזור?</label><textarea id="assistant-input" rows="3" maxlength="6000" required placeholder="ספרו בקצרה, בלי סיסמאות או מידע מזהה"></textarea><label class="assistant-consent" hidden><input type="checkbox"> אני מאשר/ת להעביר את ההודעה לספק Gemini לקבלת תשובה.</label><button class="btn btn-p" type="submit">שליחה לעוזר</button><p class="assistant-error" role="alert"></p></form>`;
  document.body.append(toggle,dialog);
  toggle.onclick=()=>{dialog.showModal();toggle.setAttribute('aria-expanded','true');};
  dialog.querySelector('header button').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{toggle.setAttribute('aria-expanded','false');toggle.focus();});
  const messages=dialog.querySelector('.assistant-messages'),input=dialog.querySelector('textarea'),form=dialog.querySelector('form'),error=dialog.querySelector('[role=alert]'),button=form.querySelector('button'),consent=dialog.querySelector('.assistant-consent'),consentInput=consent.querySelector('input');
  let aiMode='basic';
  request('/api/status').then(status=>{
    aiMode=status.aiMode||'basic';
    dialog.querySelector('[data-assistant-mode]').textContent=aiMode==='gemini'?'Gemini AI מחובר':'הכוונה אוטומטית בסיסית';
    dialog.querySelector('[data-assistant-intro]').textContent=aiMode==='gemini'?'התשובות נוצרות באמצעות Gemini ועלולות לטעות. אין לשלוח סיסמאות או קודי אימות. בסכנה מיידית: 100.':'העוזר מספק הכוונה קבועה לפי נושא ואינו מודל AI. אין לשלוח סיסמאות או קודי אימות. בסכנה מיידית: 100.';
    consent.hidden=aiMode!=='gemini';consentInput.required=aiMode==='gemini';
  }).catch(()=>{dialog.querySelector('[data-assistant-mode]').textContent='הכוונה אוטומטית בסיסית';});
  const history=[];
  const add=(text,kind)=>{const p=document.createElement('p');p.className='assistant-message '+kind;p.textContent=text;messages.append(p);messages.scrollTop=messages.scrollHeight;};
  form.onsubmit=async event=>{
    event.preventDefault();if(!input.value.trim()||button.disabled)return;
    const prompt=input.value.trim();button.disabled=true;button.textContent='חושב…';error.textContent='';
    try{const result=await request('/api/ai','POST',{prompt,history});add(prompt,'user');add(result.text,'model');history.push({role:'user',text:prompt},{role:'model',text:result.text});input.value='';if(result.mode&&result.mode!==aiMode)location.reload();}
    catch(e){error.textContent=e.message;}finally{button.disabled=false;button.textContent='שליחה לעוזר';input.focus();}
  };
}
