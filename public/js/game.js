'use strict';
const $ = id => document.getElementById(id);
let session;
try { session = JSON.parse(sessionStorage.getItem('haysagOkeySession')); } catch {}
if (!session) location.replace('/');
const socket = io({transports:['websocket'],autoConnect:false});
let state = null, selected = new Set(), draft = [], order = [], lastRound = null, resultSeen = null, arranged = null, drag = null;
let rack=null, jokerValues={}, previewSequence=0, seenEvent=null, clockOffset=0;
const colors = {Kirmizi:'red',Sari:'yellow',Yesil:'yellow',Mavi:'blue',Siyah:'black',Sahte:'black'};
function element(tag, cls, text) { const e = document.createElement(tag); if(cls)e.className=cls; if(text!==undefined)e.textContent=text; return e; }
function tileButton(tile, small = false) {
  const e = element(small?'span':'button','tile '+(colors[tile.color] || 'black')+(small?' mini':''));
  if (!small) { e.type='button'; e.setAttribute('aria-pressed',String(selected.has(tile.id))); }
  const label = tile.isFakeJoker ? '★' : String(tile.number);
  e.append(element('span','tile-number',label),element('span','tile-dot',state?.config?.RENK_SIMGE?({Sari:'●',Yesil:'●',Mavi:'▲',Siyah:'■',Kirmizi:'◆'}[tile.color]||'★'):'•'));
  if(tile.joker_deger)e.append(element('span','joker-value',tile.joker_deger.number+' '+({Sari:'S',Mavi:'M',Siyah:'Y',Kirmizi:'K'}[tile.joker_deger.color]||'')));
  const isOkey = !tile.isFakeJoker && tile.color === state?.okey?.color && tile.number === state?.okey?.number;
  e.setAttribute('aria-label',(tile.isFakeJoker?'Sahte okey':tile.color+' '+tile.number)+(isOkey?' · Okey':''));
  if(isOkey&&!small&&state?.config?.OKEY_PARLAT)e.classList.add('joker');
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
  rack.reconcile(state.tiles.map(t=>t.id));
  order=rack.slots.filter(Boolean);
  $('hand').style.setProperty('--rack-columns',15);
  $('hand').replaceChildren(...rack.slots.map((id,slot)=>{
    const row=Math.floor(slot/15),col=slot%15;
    if(!id){const empty=element('button','rack-empty');empty.type='button';empty.dataset.slot=slot;empty.style.gridRow=row+1;empty.style.gridColumn=col+1;empty.setAttribute('aria-label',(row+1)+'. satır '+(col+1)+'. boş yuva');empty.onclick=()=>{if(selected.size===1)rackEdit(()=>rack.move([...selected][0],row,col,'empty'));};empty.ondblclick=()=>rackEdit(()=>rack.gap(row,col,1));return empty;}
    const t=byId.get(id),e=tileButton(t);
    e.classList.toggle('selected',selected.has(id));e.classList.toggle('in-group',used.has(id));
    e.onclick=()=>{if(used.has(id))return;selected.has(id)?selected.delete(id):selected.add(id);renderHand();renderControls();};
    e.dataset.tileId=id;e.dataset.slot=slot;e.style.gridRow=row+1;e.style.gridColumn=col+1;
    e.onpointerdown=event=>beginDrag(event,id,e,used.has(id));return e;
  }));
  saveRack();
  $('handCount').textContent='('+state.tiles.length+')';
  $('draft').replaceChildren(...draft.map((ids,i)=>{
    const group=element('div','draft-group');
    ids.forEach(id=>{const tile=byId.get(id);if(!tile)return;const inferred=GameRules.meld(ruleGame(),ids.map(x=>byId.get(x)),$('pairs').checked,jokerValues)?.tiles.find(t=>t.id===id)?.joker_deger;const mini=tileButton(inferred?{...tile,joker_deger:inferred}:tile,true);if(GameRules.wild(ruleGame(),tile)){mini.setAttribute('role','button');mini.tabIndex=0;mini.setAttribute('aria-label','Jokerin temsil değerini seç');mini.onclick=()=>chooseJoker(id);mini.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseJoker(id);}};}group.append(mini);});
    const remove=element('button','text-button','×');remove.type='button';remove.setAttribute('aria-label',(i+1)+'. grubu geri al');remove.onclick=()=>{draft.splice(i,1);renderHand();renderControls();};group.append(remove);return group;
  }));
}
function ruleGame(){return {config:state.config,okey:state.okey,indicator:state.indicator};}
function rackKey(){return 'haysag-rack:'+state.roomCode+':'+state.playerIndex+':'+state.round;}
function saveRack(){try{sessionStorage.setItem(rackKey(),JSON.stringify(rack.slots));}catch{}}
function rackEdit(fn){try{fn();selected.clear();renderHand();renderControls();}catch(error){message(error.message);$('hand').classList.remove('invalid-move');void $('hand').offsetWidth;$('hand').classList.add('invalid-move');}}
function openingPreview(){
  const byId=new Map(state.tiles.map(t=>[t.id,t])),pairs=$('pairs').checked;
  const results=draft.map(ids=>GameRules.meld(ruleGame(),ids.map(id=>byId.get(id)),pairs,jokerValues));
  const score=results.reduce((sum,g)=>sum+(g?.score||0),0),used=new Set(draft.flat());
  let error=results.some(g=>!g)?'Geçersiz per veya çift.':used.size>=state.tiles.length?'Bir atış taşı bırak.':null;
  if(!state.playerState?.hasOpened&&!error){if(pairs&&draft.length<state.config.ACMA_BARAJI_CIFT)error='En az '+state.config.ACMA_BARAJI_CIFT+' çift gerekli.';if(!pairs&&score<state.minimumOpenScore)error='Açılış barajı '+state.minimumOpenScore+'.';}
  const drawn=state.playerState?.drawnFromDiscardTile;
  if(drawn&&!used.has(drawn.id))error='Yerden aldığın taşı bu açılışta kullan.';
  return {valid:draft.length>0&&!error,score,error,groups:results};
}
function chooseJoker(id){
  const dialog=$('jokerDialog'),value=jokerValues[id];$('jokerColor').value=value?.color||'Mavi';$('jokerNumber').value=value?.number||1;
  $('confirmJoker').onclick=()=>{if(!$('jokerNumber').checkValidity())return $('jokerNumber').reportValidity();jokerValues[id]={color:$('jokerColor').value,number:Number($('jokerNumber').value)};dialog.close();renderHand();renderControls();};dialog.showModal();
}

function renderControls() {
  const mine=ownTurn(), play=canPlay();
  $('draw').disabled=!mine||state.hasDrawn; const left=state.discards[(state.playerIndex+3)%4];$('drawDiscard').disabled=!mine||state.hasDrawn||!left||(!state.config.OKEY_YERDEN_ALINABILIR&&GameRules.wild(ruleGame(),left));
  $('makeGroup').disabled=!play||selected.size<2;
  $('discard').disabled=!play||selected.size!==1||draft.length>0;
  const preview=openingPreview();$('open').disabled=!play||!preview.valid;
  $('previewInfo').textContent=draft.length?($('pairs').checked?draft.length+' çift':preview.score+' puan')+(preview.error?' · '+preview.error:' · Açılış geçerli'):'';
  $('previewInfo').classList.toggle('valid',preview.valid);
  $('undo').disabled=!rack?.past.length;$('redo').disabled=!rack?.future.length;
  $('cancelDraw').hidden=!state.playerState?.drawnFromDiscardTile;
  $('cancelDraw').disabled=!mine;
  $('discardZone').disabled=!play||draft.length>0;
  $('discardZone').classList.toggle('ready',play&&draft.length===0);
  $('pairs').disabled=!!state.playerState?.hasOpened;
  if(state.playerState?.hasOpened)$('pairs').checked=state.playerState.openType==='pairs';
  $('open').textContent=state.playerState?.hasOpened?'Grupları indir':'El aç';
  const paused=state.players.some(p=>!p.connected);
  $('turnInfo').textContent=paused?'Bağlantısı kesilen oyuncu bekleniyor…':mine?(state.hasDrawn?'Sıra sende · Taş at veya el aç':'Sıra sende · Taş çek'):'Sıra: '+(state.players[state.currentPlayer]?.name||'—');
  $('openInfo').textContent=state.playerState?.hasOpened?($('pairs').checked?'Çift açtın':'Elin açık'):'Açılış: '+state.minimumOpenScore+' / '+state.config.ACMA_BARAJI_CIFT+' çift';
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
    if(state.teamMode)box.append(element('small','','Takım '+(p.team===1?'A':'B')));
    if(i!==state.playerIndex){const back=element('div','opponent-rack');back.setAttribute('aria-label',p.tileCount+' kapalı taş');for(let n=0;n<Math.min(p.tileCount,12);n++)back.append(element('span','tile-back'));box.append(back);}return box;
  }));
  $('groups').replaceChildren(...Array.from({length:4},(_,seat)=>{
    const owner=(state.playerIndex+seat)%4, groups=state.openedGroups[owner]||[];
    const area=element('section','owner-groups');area.dataset.seat=seat;area.classList.toggle('team-a',owner%2===0&&state.teamMode);area.classList.toggle('team-b',owner%2===1&&state.teamMode);area.classList.toggle('partner',state.teamMode&&owner!==state.playerIndex&&owner%2===state.playerIndex%2&&state.config.ORTAK_ISLEME);
    area.append(element('h3','',state.players[owner].name+(owner===state.playerIndex?' · Sen':'')));
    const list=element('div','owner-melds');
    groups.forEach((group,index)=>{
      const box=element('button','table-group');box.type='button';
      const tiles=element('span','group-tiles');group.forEach(t=>{const mini=tileButton(t,true);if(GameRules.wild(ruleGame(),t)){mini.classList.add('swappable');mini.onclick=e=>{e.stopPropagation();if(!canPlay()||selected.size!==1)return message('Jokerin yerine koyacağın gerçek taşı seç.');socket.emit('swapJoker',{owner,group:index,jokerTileId:t.id,tileId:[...selected][0]});};}tiles.append(mini);});box.append(tiles);
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
    resultSeen=state.round; $('resultTitle').textContent=state.result.draw?'Yığın bitti · El puanlandı':state.result.winner+' eli bitirdi';
    scoreRows($('resultScores'));$('newRound').hidden=!state.host;
    if(!$('resultDialog').open)$('resultDialog').showModal();
  }
}
socket.on('connect',()=>{ $('connection').textContent='Bağlı';if(session)socket.emit('resume',{roomCode:session.roomCode,token:session.token}); });
socket.on('disconnect',()=>{ $('connection').textContent='Yeniden bağlanılıyor';message('Bağlantı yenileniyor. Yeriniz korunuyor.');if(state)renderControls(); });
socket.on('connect_error',()=>{ $('connection').textContent='Bağlantı bekleniyor';message('Sunucuya ulaşılamıyor. Otomatik yeniden denenecek.'); });
socket.on('sessionExpired',()=>{sessionStorage.removeItem('haysagOkeySession');location.replace('/?room='+encodeURIComponent(session.roomCode));});
socket.on('gameError',data=>{message(data.message+(data.code?' · '+data.code:''));$('hand').classList.remove('invalid-move');void $('hand').offsetWidth;$('hand').classList.add('invalid-move');});socket.on('notice',data=>message(data.message));
socket.on('state',data=>{
  const hadState=!!state;
  const changed=hadState && (JSON.stringify(state.tiles.map(t=>t.id).sort())!==JSON.stringify(data.tiles.map(t=>t.id).sort()) || state.currentPlayer!==data.currentPlayer || state.phase!==data.phase || state.hasDrawn!==data.hasDrawn);
  if(drag?.ghost){drag.ghost.remove();drag.tile.classList.remove('drag-source');$('discardZone').classList.remove('drag-over');drag=null;}
  const previous=state;state=data;clockOffset=data.serverNow-Date.now();document.documentElement.style.setProperty('--draw-ms',data.config.CEKME_MS+'ms');document.documentElement.style.setProperty('--discard-ms',data.config.ATMA_MS+'ms');document.documentElement.style.setProperty('--open-ms',data.config.ACMA_MS+'ms');
  if(!rack||lastRound!==data.round){let saved;try{saved=JSON.parse(sessionStorage.getItem(rackKey()));}catch{}rack=new RackLayout.Rack(data.tiles.map(t=>t.id),saved);}
  if(previous?.currentPlayer!==data.currentPlayer)document.dispatchEvent(new CustomEvent('OnTurnChanged',{detail:{player:data.currentPlayer}}));
  if(data.lastEvent&&seenEvent!==data.lastEvent.id){seenEvent=data.lastEvent.id;document.dispatchEvent(new CustomEvent(data.lastEvent.type,{detail:data.lastEvent}));const e=data.lastEvent;if(e.player!==data.playerIndex){const name=data.players[e.player]?.name||'';const text={OnTileDrawn:e.fromDiscard?' yerden taş aldı':' desteden taş çekti',OnTileDiscarded:' taş attı',OnMeldOpened:' el açtı / per indirdi',OnTileProcessed:' taş işledi',OnJokerSwapped:' joker değiştirdi',OnHandFinished:' eli bitirdi'}[e.type];if(text)$('moveNotice').textContent=name+text;}$('hand').dataset.animation=e.type;if(e.type==='OnMeldOpened'){$('groups').classList.remove('meld-animation');void $('groups').offsetWidth;$('groups').classList.add('meld-animation');}}

  if(lastRound!==data.round){order=[];arranged=null;draft=[];jokerValues={};selected.clear();lastRound=data.round;$('pairs').checked=false;if($('resultDialog').open)$('resultDialog').close();}
  else if(changed){draft=[];selected.clear();}
  if(changed||!hadState)message('');
  render();
});
$('draw').onclick=()=>socket.emit('drawTile',{});$('drawDiscard').onclick=()=>socket.emit('drawTile',{fromDiscard:true});
$('discard').onclick=()=>{if(selected.size===1)socket.emit('discardTile',{tileId:[...selected][0]});};
$('makeGroup').onclick=()=>{if(selected.size<2)return;draft.push([...selected]);selected.clear();renderHand();renderControls();};
$('open').onclick=()=>socket.emit('openHand',{groups:draft,pairs:$('pairs').checked,jokerValues});
$('pairs').onchange=()=>renderControls();
$('cancelDraw').onclick=()=>socket.emit('cancelDiscardDraw',{});
$('clear').onclick=()=>{selected.clear();draft=[];renderHand();renderControls();};
for(const [id,mode] of [['sortColor','SERI'],['sortNumber','CIFT'],['sortSet','KUT']])$(id).onclick=()=>rackEdit(()=>rack.arrange(RackLayout.sort(state.tiles,ruleGame(),mode)));
$('undo').onclick=()=>rackEdit(()=>rack.undo(state.tiles.map(t=>t.id)));
$('redo').onclick=()=>rackEdit(()=>rack.redo(state.tiles.map(t=>t.id)));

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
    const target=hit?.closest('#hand [data-slot]');
    if(target){const slot=Number(target.dataset.slot),ids=selected.has(id)&&selected.size>1?order.filter(x=>selected.has(x)):[id];rackEdit(()=>rack.move(id,Math.floor(slot/15),slot%15,ids.length>1?'group':up.shiftKey?'insert':'swap',ids));}

  };
  tile.onpointerup=up=>finish(up);tile.onpointercancel=up=>finish(up,true);
}
$('invite').onclick=async()=>{
  if(!session)return;const link=new URL('/?room='+session.roomCode,location.origin).href;
  try{if(navigator.share)await navigator.share({title:'HAYSAG OKEY',text:'101 masamıza katıl · '+session.roomCode,url:link});else{await navigator.clipboard.writeText(link);message('Davet bağlantısı kopyalandı.');}}
  catch(error){if(error.name!=='AbortError')message('Davet kodu: '+session.roomCode+' · '+link);}
};
$('rules').onclick=()=>{$('rulesSummary').textContent='Açılış: '+state.config.ACMA_BARAJI_SERI+' puan / '+state.config.ACMA_BARAJI_CIFT+' çift. Süre: '+(state.config.TUR_SURESI_SN||'süresiz')+'. Sahte okey: '+({GOSTERGE:'göstergeyi temsil eder',OKEY:'okey değerinin sabit taşı',JOKER:'serbest joker'}[state.config.SAHTE_OKEY_MODU])+'.';$('rulesDialog').showModal();};$('closeRules').onclick=()=>$('rulesDialog').close();
$('startWithBots').onclick=()=>socket.emit('startWithBots',{});
$('leave').onclick=()=>socket.emit('leaveRoom',{});
$('newRound').onclick=()=>socket.emit('newRound',{});$('closeResult').onclick=()=>$('resultDialog').close();
// Local commands never change the authoritative hand or another player's layout.
window.YazbozKomut=(command,data={})=>{
 if(!state||!rack)return;
 const ids=state.tiles.map(t=>t.id);
 if(command==='tas_sec'){selected.has(data.tileId)?selected.delete(data.tileId):ids.includes(data.tileId)&&selected.add(data.tileId);renderHand();renderControls();return;}
 if(command==='coklu_sec'){selected=new Set((data.tileIds||[]).filter(id=>ids.includes(id)));renderHand();renderControls();return;}
 if(command==='acmayi_iptal'){draft=[];jokerValues={};selected.clear();renderHand();renderControls();return;}
 const local={tas_tasi:()=>rack.move(data.tileId,data.hedefSatir,data.hedefSutun,'empty'),tas_degistir:()=>{const to=rack.slots.indexOf(data.tileIdB);rack.move(data.tileIdA,Math.floor(to/15),to%15);},tas_araya_sok:()=>rack.move(data.tileId,data.hedefSatir,data.hedefSutun,'insert'),grup_tasi:()=>rack.move(data.tileIds[0],data.hedefSatir,data.hedefSutun,'group',data.tileIds),bosluk_birak:()=>rack.gap(data.satir,data.sutun,data.adet),siralama_sifirla:()=>rack.undo(ids),undo:()=>rack.undo(ids),redo:()=>rack.redo(ids)};
 if(local[command])return rackEdit(local[command]);
 if(['seri_diz','cift_diz','kut_diz'].includes(command))return rackEdit(()=>{const tiles=data.satir===undefined?state.tiles:rack.slots.slice(data.satir*15,data.satir*15+15).filter(Boolean).map(id=>state.tiles.find(t=>t.id===id));rack.arrange(RackLayout.sort(tiles,ruleGame(),{seri_diz:'SERI',cift_diz:'CIFT',kut_diz:'KUT'}[command]),data.satir);});
 socket.emit(command,data);
};
setInterval(()=>{if(!state)return;const remaining=state.turnDeadline?Math.max(0,Math.ceil((state.turnDeadline-Date.now()-clockOffset)/1000)):null;$('turnClock').textContent=remaining===null?'Süresiz / beklemede':remaining+' sn';document.querySelectorAll('.player.current').forEach(e=>e.style.setProperty('--turn-progress',((remaining||0)/Math.max(1,state.config.TUR_SURESI_SN)*100)+'%'));},200);
if(session)socket.connect();
