// GIPHY requires browser-side search. This is a restricted public client key,
// never a server secret. No account identifiers or chat contents are sent.
export function mountGifPicker(root,onSelect){
  const key=import.meta.env.VITE_GIPHY_API_KEY;
  root.innerHTML='<form class="gif-search"><input aria-label="חיפוש GIF" placeholder="חיפוש GIF…" maxlength="50"><button class="btn btn-p">חיפוש</button></form><p class="gif-status" role="status"></p><div class="gif-results"></div><small>Powered by GIPHY · חיפוש GIFים נשלח ל־GIPHY</small>';
  const status=root.querySelector('.gif-status'),results=root.querySelector('.gif-results');
  if(!key){status.textContent='גלריית ה־GIFים עדיין לא מחוברת. אפשר בינתיים להעלות GIF מהמכשיר.';root.querySelector('button').disabled=true;return;}
  let pending;
  const search=async(query='')=>{
    pending?.abort();const controller=new AbortController();pending=controller;
    status.textContent='טוען GIFים…';results.replaceChildren();
    try{
      const url=new URL('https://api.giphy.com/v1/gifs/'+(query?'search':'trending'));
      url.search=new URLSearchParams({api_key:key,limit:'20',rating:'g',...(query?{q:query}:{})});
      const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error();
      const data=await response.json();if(!root.isConnected)return;
      for(const gif of data.data||[]){
        const media=gif.images?.fixed_height;if(!media?.url)continue;
        const parsed=new URL(media.url);if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.giphy.com'))continue;
        const button=document.createElement('button');button.type='button';button.className='gif-choice';button.setAttribute('aria-label',gif.title||'בחירת GIF');
        const img=document.createElement('img');img.src=parsed.href;img.alt=gif.title||'GIF';img.loading='lazy';button.append(img);
        button.onclick=()=>onSelect(parsed.href);results.append(button);
      }
      status.textContent=results.children.length?'בחירת GIF תוסיף אותו לטיוטה לפני השליחה.':'לא נמצאו תוצאות.';
    }catch(error){if(error.name!=='AbortError')status.textContent='לא ניתן לטעון GIFים כרגע. נסו שוב.';}
  };
  root.querySelector('form').onsubmit=event=>{event.preventDefault();search(root.querySelector('input').value.trim());};search();
}
