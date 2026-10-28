'use strict';
const $ = id => document.getElementById(id);
let session;
try { session = JSON.parse(sessionStorage.getItem('haysagOkeySession')); } catch {}
if (!session) location.replace('/');
const socket = io({transports:['websocket'],autoConnect:false});
let state = null, selected = new Set(), draft = [], order = [], lastRound = null, resultSeen = null, arranged = null, drag = null;
const colors = {Kirmizi:'red',Yesil:'green',Mavi:'blue',Siyah:'black',Sahte:'black'};
function element(tag, cls, text) { const e = document.createElement(tag); if(cls)e.className=cls; if(text!==undefined)e.textContent=text; return e; }
function tileButton(tile, small = false) {
  const e = element(small?'span':'button','tile '+(colors[tile.color] || 'black')+(small?' mini':''));
  if (!small) { e.type='button'; e.setAttribute('aria-pressed',String(selected.has(tile.id))); }
  const label = tile.isFakeJoker ? '★' : String(tile.number);
  e.append(element('span','tile-number',label),element('span','tile-dot','•'));
  const isOkey = !tile.isFakeJoker && tile.color === state?.okey?.color && tile.number === state?.okey?.number;
  e.setAttribute('aria-label',(tile.isFakeJoker?'Sahte okey':tile.color+' '+tile.number)+(isOkey?' · Okey':''));
  if(isOkey)e.classList.add('joker');
  return e;
}
function message(text) { $('tableMessage').textContent=text; }
function ownTurn() { return state?.phase==='playing' && state.currentPlayer===state.playerIndex && state.players.every(p=>p.connected) && socket.connected; }
function canPlay() { return ownTurn() && state.hasDrawn; }
function renderHand() {
  const byId = new Map(state.tiles.map(t=>[t.id,t]));
  order = order.filter(id=>byId.has(id));
  state.tiles.forEach(t=>{if(!order.includes(t.id))order.push(t.id);});
  const used = new Set(draft.flat());
  const orderedGroups=arranged ? arranged.groups.map(g=>g.filter(id=>byId.has(id))).filter(g=>g.length) : [];
  const groupedIds=new Set(orderedGroups.flat());
  const layout=RackLayout.positions(orderedGroups,order.filter(id=>!groupedIds.has(id)));
  $('hand').style.setProperty('--rack-columns',layout.width);
  const cells=layout.rows.flatMap((row,r)=>row.map((id,c)=>({id,r,c}))).filter(cell=>cell.id!==null);
  $('hand').replaceChildren(...cells.map(({id,r,c})=>{
    const t=byId.get(id), e=tileButton(t);
    e.classList.toggle('selected',selected.has(id)); e.classList.toggle('in-group',used.has(id));
    e.onclick=()=>{ if(used.has(id))return; selected.has(id)?selected.delete(id):selected.add(id); renderHand(); renderControls(); };
    e.dataset.tileId=id; e.style.gridRow=r+1; e.style.gridColumn=c+1;
    e.onpointerdown=event=>beginDrag(event,id,e,used.has(id));
    return e;
  }));
  $('handCount').textContent='('+state.tiles.length+')';
  $('draft').replaceChildren(...draft.map((ids,i)=>{
    const g=element('button','draft-group'); g.type='button';
    ids.forEach(id=>g.append(tileButton(byId.get(id),true)));
    g.append(element('span','',' ×')); g.setAttribute('aria-label','Hazırlanan '+(i+1)+'. grubu geri al');
    g.onclick=()=>{ draft.splice(i,1);renderHand();renderControls(); }; return g;
  }));
}
function renderControls() {
  const mine=ownTurn(), play=canPlay();
  $('draw').disabled=!mine||state.hasDrawn; $('drawDiscard').disabled=!mine||state.hasDrawn||!state.discards[(state.playerIndex+3)%4];
  $('makeGroup').disabled=!play||selected.size<2;
  $('discard').disabled=!play||selected.size!==1||draft.length>0;
  $('open').disabled=!play||draft.length===0;
  $('discardZone').disabled=!play||draft.length>0;
  $('discardZone').classList.toggle('ready',play&&draft.length===0);
  $('pairs').disabled=!!state.playerState?.hasOpened;
  if(state.playerState?.hasOpened)$('pairs').checked=state.playerState.openType==='pairs';
  $('open').textContent=state.playerState?.hasOpened?'Grupları indir':'El aç';
  const paused=state.players.some(p=>!p.connected);
  $('turnInfo').textContent=paused?'Bağlantısı kesilen oyuncu bekleniyor…':mine?(state.hasDrawn?'Sıra sende · Taş at veya el aç':'Sıra sende · Taş çek'):'Sıra: '+(state.players[state.currentPlayer]?.name||'—');
  $('openInfo').textContent=state.playerState?.hasOpened?($('pairs').checked?'Çift açtın':'Elin açık'):'Açılış: '+state.minimumOpenScore+' / 5 çift';
}
function scoreRows(container) {
  container.replaceChildren();
  if(state.teamMode)for(let i=1;i<=2;i++)container.append(element('div','score-row','Takım '+i+' · '+(state.scores['team'+i]||0)));
  else state.players.forEach((p,i)=>container.append(element('div','score-row',p.name+' · '+(state.scores['player'+i]||0))));
}
function render() {
  $('waiting').hidden=state.phase!=='lobby'; $('playArea').hidden=state.phase==='lobby';
  $('waitingCode').textContent=state.roomCode;
  $('startWithBots').hidden=state.phase!=='lobby' || !state.host;
  $('startWithBots').disabled=!socket.connected || state.players.some(p=>!p.connected);
  $('waitingStatus').textContent=state.players.length+'/4 oyuncu · Dördüncü oyuncu geldiğinde el başlar.';
  $('waitingPlayers').replaceChildren(...Array.from({length:4},(_,i)=>element('div','waiting-player',state.players[i]?(state.players[i].name+(state.players[i].isBot?' · Bot':state.players[i].connected?' · Hazır':' · Bağlantı bekleniyor')):'Boş sandalye')));
  if(state.phase==='lobby')return;
  $('roundInfo').textContent=state.round+'. el · '+state.roomCode+(state.teamMode?' · Eşli':' · Tekli');
  $('pileInfo').textContent='Yığında '+state.pileCount+' taş';
  $('indicatorInfo').replaceChildren(element('span','','Gösterge '),tileButton(state.indicator,true),element('span','',' Okey '),tileButton({...state.okey,isFakeJoker:false},true));
  $('players').replaceChildren(...state.players.map((p,i)=>{
    const box=element('div','player'+(i===state.currentPlayer?' current':'')+(p.connected?'':' offline'));
    box.dataset.seat=(i-state.playerIndex+4)%4;
    box.append(element('span','player-initial',p.name.slice(0,1).toLocaleUpperCase('tr')),element('strong','',p.name+(i===state.playerIndex?' (Sen)':'')),element('small','',p.connected?p.tileCount+' taş'+(p.isBot?' · Bot':'')+(p.hasOpened?' · Açtı':''):'Bağlantı kesildi'));
    if(state.teamMode)box.append(element('small','','Takım '+p.team));return box;
  }));
  $('groups').replaceChildren(...Array.from({length:4},(_,seat)=>{
    const owner=(state.playerIndex+seat)%4, groups=state.openedGroups[owner]||[];
    const area=element('section','owner-groups');area.dataset.seat=seat;
    area.append(element('h3','',state.players[owner].name+(owner===state.playerIndex?' · Sen':'')));
    const list=element('div','owner-melds');
    groups.forEach((group,index)=>{
      const box=element('button','table-group');box.type='button';
      const tiles=element('span','group-tiles');RackLayout.orderMeld(group,state.okey).forEach(t=>tiles.append(tileButton(t,true)));box.append(tiles);
      box.setAttribute('aria-label',state.players[owner].name+' · '+(index+1)+'. gruba seçili taşı işle');
      box.onclick=()=>{if(selected.size!==1||!canPlay())return message('İşlemek için sıranızda tek taş seçin.');socket.emit('addToGroup',{owner,group:index,tileId:[...selected][0]});};
      list.append(box);
    });
    if(!groups.length)list.append(element('small','no-melds','Henüz açmadı'));
    area.append(list);return area;
  }));
  $('tableDiscards').replaceChildren(...[1,2,3].map(seat=>{
    const owner=(state.playerIndex+seat)%4,box=element('div','seat-discard');box.dataset.seat=seat;
    box.append(element('small','',state.players[owner].name+' · Son atış'));
    if(state.discards[owner])box.append(tileButton(state.discards[owner],true));else box.append(element('span','discard-empty','—'));
    return box;
  }));
  $('rightTile').replaceChildren(...(state.discards[state.playerIndex]?[tileButton(state.discards[state.playerIndex],true)]:[]));
  const left=state.discards[(state.playerIndex+3)%4];
  $('leftTile').replaceChildren(element('span','','Soldaki taş: '),...(left?[tileButton(left,true)]:[element('span','','—')]));
  scoreRows($('scores'));renderHand();renderControls();
  if(state.phase==='finished' && resultSeen!==state.round){
    resultSeen=state.round; $('resultTitle').textContent=state.result.draw?'Yığın bitti · El puansız kapandı':state.result.winner+' eli bitirdi';
    scoreRows($('resultScores'));$('newRound').hidden=!state.host;
    if(!$('resultDialog').open)$('resultDialog').showModal();
  }
}
socket.on('connect',()=>{ $('connection').textContent='Bağlı';if(session)socket.emit('resume',{roomCode:session.roomCode,token:session.token}); });
socket.on('disconnect',()=>{ $('connection').textContent='Yeniden bağlanılıyor';message('Bağlantı yenileniyor. Yeriniz korunuyor.');if(state)renderControls(); });
socket.on('connect_error',()=>{ $('connection').textContent='Bağlantı bekleniyor';message('Sunucuya ulaşılamıyor. Otomatik yeniden denenecek.'); });
socket.on('sessionExpired',()=>{sessionStorage.removeItem('haysagOkeySession');location.replace('/?room='+encodeURIComponent(session.roomCode));});
socket.on('gameError',data=>message(data.message));socket.on('notice',data=>message(data.message));
socket.on('state',data=>{
  const hadState=!!state;
  const changed=hadState && (JSON.stringify(state.tiles.map(t=>t.id).sort())!==JSON.stringify(data.tiles.map(t=>t.id).sort()) || state.currentPlayer!==data.currentPlayer || state.phase!==data.phase || state.hasDrawn!==data.hasDrawn);
  if(drag?.ghost){drag.ghost.remove();drag.tile.classList.remove('drag-source');$('discardZone').classList.remove('drag-over');drag=null;}
  state=data;
  if(lastRound!==data.round){order=[];arranged=null;draft=[];selected.clear();lastRound=data.round;$('pairs').checked=false;if($('resultDialog').open)$('resultDialog').close();}
  else if(changed){draft=[];selected.clear();}
  if(changed||!hadState)message('');
  render();
});
$('draw').onclick=()=>socket.emit('drawTile',{});$('drawDiscard').onclick=()=>socket.emit('drawTile',{fromDiscard:true});
$('discard').onclick=()=>{if(selected.size===1)socket.emit('discardTile',{tileId:[...selected][0]});};
$('makeGroup').onclick=()=>{if(selected.size<2)return;draft.push([...selected]);selected.clear();renderHand();renderControls();};
$('open').onclick=()=>socket.emit('openHand',{groups:draft,pairs:$('pairs').checked});
$('clear').onclick=()=>{selected.clear();draft=[];renderHand();renderControls();};
for(const [id,pairs] of [['sortColor',false],['sortNumber',true]])$(id).onclick=()=>{
  if(!state)return;
  arranged=RackLayout.arrange(state.tiles,state.okey,pairs);
  order=[...arranged.groups.flat(),...arranged.loose];
  selected.clear();renderHand();renderControls();socket.emit('sortTiles',{ids:order});
};
function discardTile(id) {
  if(!canPlay())return message('Taş atmak için sıranı bekle ve önce taş çek.');
  if(draft.length)return message('Önce hazırladığın grupları indir veya seçimi temizle.');
  if(!state.tiles.some(t=>t.id===id))return;
  socket.emit('discardTile',{tileId:id});
}
$('discardZone').onclick=()=>selected.size===1?discardTile([...selected][0]):message('Atmak için bir taş seç veya taşı buraya sürükle.');
function beginDrag(event,id,tile,used) {
  if(used || event.button!==0 || drag)return;
  const startX=event.clientX,startY=event.clientY;
  drag={id,pointerId:event.pointerId,startX,startY,tile,ghost:null};
  tile.setPointerCapture(event.pointerId);
  tile.onpointermove=move=>{
    if(!drag || move.pointerId!==drag.pointerId)return;
    if(!drag.ghost && Math.hypot(move.clientX-startX,move.clientY-startY)>7){
      drag.ghost=tile.cloneNode(true);drag.ghost.classList.add('drag-ghost');
      const rect=tile.getBoundingClientRect();drag.ghost.style.width=rect.width+'px';drag.ghost.style.height=rect.height+'px';
      document.body.append(drag.ghost);tile.classList.add('drag-source');
    }
    if(drag.ghost){
      move.preventDefault();drag.ghost.style.left=move.clientX+'px';drag.ghost.style.top=move.clientY+'px';
      const hit=document.elementFromPoint(move.clientX,move.clientY);
      $('discardZone').classList.toggle('drag-over',!!hit?.closest('#discardZone')&&canPlay()&&!draft.length);
    }
  };
  const finish=(up,cancel=false)=>{
    if(!drag || up.pointerId!==drag.pointerId)return;
    const current=drag;drag=null;
    current.ghost?.remove();tile.classList.remove('drag-source');$('discardZone').classList.remove('drag-over');
    if(!current.ghost || cancel)return;
    // Suppress the click generated after a pointer drag, including on touch screens.
    const suppress=e=>{e.preventDefault();e.stopPropagation();};
    document.addEventListener('click',suppress,{capture:true,once:true});
    setTimeout(()=>document.removeEventListener('click',suppress,true),0);
    const hit=document.elementFromPoint(up.clientX,up.clientY);
    if(hit?.closest('#discardZone'))return discardTile(id);
    const target=hit?.closest('#hand [data-tile-id]')?.dataset.tileId;
    if(target && target!==id){
      const from=order.indexOf(id),to=order.indexOf(target);
      if(from<0||to<0)return;
      order.splice(from,1);order.splice(to,0,id);arranged=null;renderHand();socket.emit('sortTiles',{ids:order});
    }
  };
  tile.onpointerup=up=>finish(up);tile.onpointercancel=up=>finish(up,true);
}
$('invite').onclick=async()=>{
  if(!session)return;const link=new URL('/?room='+session.roomCode,location.origin).href;
  try{if(navigator.share)await navigator.share({title:'HAYSAG OKEY',text:'101 masamıza katıl · '+session.roomCode,url:link});else{await navigator.clipboard.writeText(link);message('Davet bağlantısı kopyalandı.');}}
  catch(error){if(error.name!=='AbortError')message('Davet kodu: '+session.roomCode+' · '+link);}
};
$('rules').onclick=()=>$('rulesDialog').showModal();$('closeRules').onclick=()=>$('rulesDialog').close();
$('startWithBots').onclick=()=>socket.emit('startWithBots',{});
$('leave').onclick=()=>socket.emit('leaveRoom',{});
$('newRound').onclick=()=>socket.emit('newRound',{});$('closeResult').onclick=()=>$('resultDialog').close();
if(session)socket.connect();
