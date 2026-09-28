export function searchSurprise(query){
  const themes={'67':['67','#9b87ff'],'six seven':['67','#9b87ff'],'סיקס סבן':['67','#9b87ff'],'gg':['GG','#6b9cff'],'מזל טוב':['מזל טוב','#ffbc58'],'happy birthday':['HAPPY BIRTHDAY','#ffbc58'],'לב':['♥','#f472b6'],'אהבה':['♥','#f472b6'],'love':['♥','#f472b6'],'שלג':['❄','#b7e4ff'],'snow':['❄','#b7e4ff'],'smai':['SMAI','#72e3cf']};
  const theme=themes[query.trim().toLowerCase()];if(!theme)return false;
  document.querySelector('.search-surprise')?.remove();
  const layer=document.createElement('div');layer.className='search-surprise';layer.setAttribute('aria-label','הפתעת חיפוש');
  const close=document.createElement('button');close.type='button';close.textContent='סגירה ×';close.className='btn btn-g';close.onclick=()=>layer.remove();layer.append(close);
  const title=document.createElement('strong');title.textContent=theme[0];title.style.color=theme[1];layer.append(title);
  for(let i=0;i<24;i++){const piece=document.createElement('span');piece.textContent=theme[0];piece.style.cssText=`left:${Math.random()*94}%;animation-delay:${Math.random()}s;color:${theme[1]};font-size:${18+Math.random()*22}px`;layer.append(piece);}
  document.body.append(layer);setTimeout(()=>layer.remove(),4500);return true;
}
