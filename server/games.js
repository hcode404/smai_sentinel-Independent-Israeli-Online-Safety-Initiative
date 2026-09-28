export function gameWrite(old,input,user,check){
  if(!old){
    check(['ttt','four','sticks'].includes(input.game),400,'משחק לא מוכר');
    return {game:input.game,ownerId:user.id,players:[user.id],names:[String(user.name||'שחקן').slice(0,80)],board:Array(input.game==='four'?42:9).fill(0),remaining:21,turn:0,status:'waiting',winner:null,revision:0};
  }
  check(Date.now()-Date.parse(old.createdAt)<86400000,400,'תוקף החדר הסתיים. פתחו משחק חדש');
  if(input.action==='join'){
    check(old.status==='waiting'&&old.players.length===1&&!old.players.includes(user.id),409,'החדר כבר מלא או שאתם כבר בפנים');
    return {players:[...old.players,user.id],names:[...old.names,String(user.name||'שחקן').slice(0,80)],status:'playing',revision:old.revision+1};
  }
  check(old.players.includes(user.id),403,'אינכם משתתפים במשחק');
  check(old.status==='playing'&&old.players[old.turn]===user.id,409,'זה אינו התור שלכם');
  check(input.revision===old.revision,409,'הלוח השתנה, נסו שוב');
  const marker=old.turn+1,patch={turn:1-old.turn,revision:old.revision+1};
  if(old.game==='sticks'){
    check(Number.isInteger(input.move)&&input.move>=1&&input.move<=3&&input.move<=old.remaining,400,'אפשר לקחת 1–3 גפרורים');
    patch.remaining=old.remaining-input.move;
    if(!patch.remaining)Object.assign(patch,{status:'finished',winner:old.turn});
    return patch;
  }
  const board=[...old.board],width=old.game==='four'?7:3,height=old.game==='four'?6:3,goal=old.game==='four'?4:3;
  check(Number.isInteger(input.move)&&input.move>=0&&input.move<(old.game==='four'?7:9),400,'מהלך לא תקין');
  let cell=input.move;
  if(old.game==='four'){cell=-1;for(let row=height-1;row>=0;row--)if(!board[row*width+input.move]){cell=row*width+input.move;break;}}
  check(cell>=0&&!board[cell],400,'המקום תפוס');board[cell]=marker;patch.board=board;
  const won=board.some((value,index)=>value===marker&&[[0,1],[1,0],[1,1],[1,-1]].some(([dy,dx])=>Array.from({length:goal},(_,i)=>{const y=Math.floor(index/width)+dy*i,x=index%width+dx*i;return y>=0&&y<height&&x>=0&&x<width&&board[y*width+x]===marker;}).every(Boolean)));
  if(won)Object.assign(patch,{status:'finished',winner:old.turn});
  else if(board.every(Boolean))Object.assign(patch,{status:'finished',winner:null});
  return patch;
}
