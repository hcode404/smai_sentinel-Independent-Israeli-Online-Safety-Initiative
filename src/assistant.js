import {request} from './api.js';
import './assistant.css';
export function initAssistant(){
  const toggle=document.createElement('button');toggle.id='ai-fab';toggle.className='btn btn-p';toggle.setAttribute('aria-label','פתיחת עוזר בטיחות');toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<span aria-hidden="true">✦</span> עוזר SMAI';
  const dialog=document.createElement('dialog');dialog.className='sentinel-assistant';
  dialog.innerHTML=`<header><div class="assistant-brand"><span class="assistant-orb" aria-hidden="true"></span><div><strong>SMAI AI</strong><p data-assistant-mode>מנוע מקומי פעיל · המידע נשאר במכשיר</p></div></div><button type="button" class="iconbtn" aria-label="סגירה">✕</button></header><div class="assistant-messages" aria-live="polite"><div class="assistant-message model assistant-welcome"><span class="assistant-avatar" aria-hidden="true">✦</span><div><strong>היי, אני עוזר הבטיחות של SMAI.</strong><p>ספרו לי מה קרה ואעזור לבחור את הצעד הבטוח הבא. הבדיקה הראשונית מתבצעת במכשיר ואין לשלוח סיסמאות או קודי אימות.</p></div></div><div class="assistant-suggestions"><button type="button">פרצו לי לחשבון</button><button type="button">מישהו מטריד אותי</button><button type="button">איך שומרים ראיות?</button></div></div><form><label class="sr-only" for="assistant-input">הודעה לעוזר</label><div class="assistant-composer"><textarea id="assistant-input" rows="1" maxlength="6000" required placeholder="כתבו הודעה…" aria-describedby="assistant-hint"></textarea><button class="assistant-send" type="submit" aria-label="שליחת הודעה">➤</button></div><div class="assistant-form-meta"><span id="assistant-hint">Enter לשליחה · Shift+Enter לשורה חדשה</span><span>בדיקה מקומית · אל תשתפו סודות</span></div><p class="assistant-error" role="alert"></p></form>`;
  document.body.append(toggle,dialog);
  dialog.querySelector('[data-assistant-mode]').textContent='עוזר האתר · שיחה עם AI';
  dialog.querySelector('.assistant-welcome p').textContent='שאלו על האתר או על בטיחות ברשת. ההודעות וההקשר נשלחים לשירות AI חיצוני לצורך מענה. אין לשלוח סיסמאות או קודי אימות.';
  dialog.querySelector('.assistant-form-meta span:last-child').textContent='מענה AI · אל תשתפו סודות';
  const close=dialog.querySelector('header>.iconbtn'),messages=dialog.querySelector('.assistant-messages'),input=dialog.querySelector('textarea'),form=dialog.querySelector('form'),error=dialog.querySelector('[role=alert]'),button=form.querySelector('.assistant-send');
  toggle.onclick=()=>{dialog.showModal();toggle.setAttribute('aria-expanded','true');setTimeout(()=>input.focus(),80);};close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{toggle.setAttribute('aria-expanded','false');toggle.focus();});
  const history=[],scroll=()=>{messages.scrollTop=messages.scrollHeight;};
  const add=(text,kind)=>{const row=document.createElement('div');row.className='assistant-message '+kind;const bubble=document.createElement('div');bubble.textContent=text;if(kind==='model'){const avatar=document.createElement('span');avatar.className='assistant-avatar';avatar.setAttribute('aria-hidden','true');avatar.textContent='✦';row.append(avatar);}row.append(bubble);messages.append(row);scroll();};
  const typing=()=>{const row=document.createElement('div');row.className='assistant-message model assistant-typing';row.setAttribute('aria-label','מערכת ה-AI מקלידה');row.innerHTML='<span class="assistant-avatar" aria-hidden="true">✦</span><div><i></i><i></i><i></i><small>מקליד…</small></div>';messages.append(row);scroll();return row;};
  const resize=()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,132)+'px';};input.addEventListener('input',resize);input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
  dialog.querySelectorAll('.assistant-suggestions button').forEach(chip=>chip.onclick=()=>{input.value=chip.textContent;resize();form.requestSubmit();dialog.querySelector('.assistant-suggestions')?.remove();});
  form.onsubmit=async event=>{
    event.preventDefault();if(!input.value.trim()||button.disabled)return;
    const prompt=input.value.trim();button.disabled=true;error.textContent='';add(prompt,'user');input.value='';resize();
    dialog.querySelector('.assistant-suggestions')?.remove();const indicator=typing();
    try{
      const result=await request('/api/ai','POST',{prompt,history:history.slice(-8),consent:true,requireModel:true});
      if(result.mode!=='gemini')throw new Error('שירות ה-AI עדיין לא מחובר. נדרשת הגדרת מפתח בשרת.');
      add(result.text,'model');history.push({role:'user',text:prompt},{role:'model',text:result.text});history.splice(0,Math.max(0,history.length-8));
    }catch(e){error.textContent=e.message;input.value=prompt;resize();}
    finally{indicator.remove();button.disabled=false;input.focus();}
  };
}
