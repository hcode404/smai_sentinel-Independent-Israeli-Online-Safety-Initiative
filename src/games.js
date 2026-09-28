const titles={ttt:'איקס־עיגול',four:'ארבע בשורה',sticks:'21 גפרורים'};
export async function renderGames(app,{Store,user,esc,onCleanup},id){
  let stopped=false,timer,busy=false,room;
  onCleanup(()=>{stopped=true;clearTimeout(timer);});
  app.innerHTML=`<section class="card"><h1>משחקים ביחד</h1><p>משחקים קצרים לשני שחקנים. פותחים חדר ושולחים לחבר קישור.</p><div class="games-catalog">${Object.entries(titles).map(([game,title])=>`<button class="btn btn-g" data-game="${game}"><strong>${title}</strong><small>${game==='sticks'?'לוקחים 1–3. האחרון מנצח.':game==='four'?'מחברים ארבעה דיסקים.':'שלושה סימנים ברצף.'}</small></button>`).join('')}</div><p id="gameError" role="status"></p><div id="gameRoom"></div></section>`;
  const error=message=>{if(!stopped)app.querySelector('#gameError').textContent=message;};
  app.querySelectorAll('[data-game]').forEach(button=>button.onclick=async()=>{
    if(!user){error('יש להתחבר כדי לשחק אונליין.');return;}
    if(busy)return;busy=true;button.disabled=true;
    try{const created=await Store.add('gameRooms',{game:button.dataset.game});location.href='/games/'+encodeURIComponent(created.id);}catch(e){error(e.message);}finally{busy=false;button.disabled=false;}
  });
  if(!id)return;if(!user){error('התחברו ופתחו שוב את הקישור לחדר.');return;}
  const act=async payload=>{if(busy)return;busy=true;try{room=await Store.update('gameRooms',id,payload);await refresh();error('');}catch(e){error(e.message);await refresh();}finally{busy=false;paint();}};
  const paint=()=>{
    if(stopped||!room)return;const mine=room.players.indexOf(user.id),canMove=!busy&&room.status==='playing'&&mine===room.turn;
    const status=room.status==='waiting'?'ממתינים לשחקן נוסף':room.status==='finished'?(room.winner===null?'תיקו':`${room.names[room.winner]} ניצח/ה`):`${room.names[room.turn]} — התור שלך${mine===room.turn?'':'ם'}`;
    app.querySelector('#gameRoom').innerHTML=`<div class="game-room"><div class="row between"><h2>${titles[room.game]}</h2><button class="btn btn-g" id="gameShare">העתקת קישור הזמנה</button></div><p>${room.names.map(esc).join(' מול ')}</p><h3 role="status">${esc(status)}</h3>${room.status==='waiting'&&mine<0?'<button class="btn btn-p" id="gameJoin">הצטרפות למשחק</button>':''}${room.game==='sticks'?`<div class="match-pile">${room.remaining} גפרורים נשארו</div><div class="row">${[1,2,3].map(n=>`<button class="btn btn-p" data-move="${n}" ${!canMove||n>room.remaining?'disabled':''}>לקחת ${n}</button>`).join('')}</div>`:`<div class="game-board ${room.game==='four'?'four':''}" dir="ltr">${room.board.map((cell,index)=>`<button class="game-cell player-${cell}" data-move="${room.game==='four'?index%7:index}" aria-label="משבצת ${index+1}: ${cell||'ריקה'}" ${!canMove||(room.game==='ttt'&&cell)?'disabled':''}>${room.game==='ttt'?(cell===1?'×':cell===2?'○':''):cell?'●':''}</button>`).join('')}</div>`}<p class="small mute">המהלכים מסתנכרנים אוטומטית. חדר תקף ל־24 שעות.</p></div>`;
    app.querySelector('#gameShare').onclick=()=>navigator.clipboard.writeText(location.origin+'/games/'+encodeURIComponent(id)).then(()=>error('קישור ההזמנה הועתק')).catch(()=>error('קישור ההזמנה: '+location.origin+'/games/'+id));
    app.querySelector('#gameJoin')?.addEventListener('click',()=>act({action:'join'}));
    app.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{if(canMove)act({move:Number(b.dataset.move),revision:room.revision});});
  };
  const refresh=async()=>{try{const data=await Store.get('gameRooms',id);if(!stopped){room=data;paint();}}catch(e){error(e.message);}};
  const poll=async()=>{await refresh();if(!stopped)timer=setTimeout(poll,3000);};poll();
}
