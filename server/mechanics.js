'use strict';
const {config,settings,failure,effective,wild,meld,selectedGroups}=require('./rules');
const fail=(code,message)=>{throw failure(code,message);};
function initialize(game,options={}) {game.config=config(options);game.turnNumber=0;game.lastEvent=null;game.turnCheckpoint=null;game.pendingJokers=[];game.lastDrawnId=null;}
function mustDraw(g){if(!g.hasDrawn)fail('TAS_SAYISI_YANLIS','Önce taş çekin.');}
function opened(g,i){if(!g.playerStates[i].hasOpened)fail('ACMADAN_ISLEME_YAPILAMAZ','Önce el açmalısınız.');}
function consume(g,i,ids){const s=g.playerStates[i];if(s.drawnFromDiscardTile&&ids.includes(s.drawnFromDiscardTile.id)){s.drawnFromDiscardTile=null;s.mustOpenThisTurn=false;g.turnCheckpoint=null;}g.pendingJokers=(g.pendingJokers||[]).filter(id=>!ids.includes(id));}
function event(g,type,i,extra={}) {g.lastEvent={id:(g.eventNumber=(g.eventNumber||0)+1),type,player:i,...extra};}
function draw(g,i,fromDiscard){
 if(g.hasDrawn)fail('TAS_SAYISI_YANLIS','Zaten taş çektiniz.');
 let tile;
 if(fromDiscard){
  const previous=(i+3)%4,pile=g.discardPiles[previous];tile=pile.at(-1);
  if(!tile||pile.length<=(g.deadDiscards?.[previous]||0))fail('DESTE_BOS','Çekilebilecek taze taş yok.');
  if(wild(g,tile)&&!settings(g).OKEY_YERDEN_ALINABILIR)fail('OKEY_YERDEN_ALINAMAZ','Yerdeki okey bu masada alınamaz.');
  g.turnCheckpoint=JSON.parse(JSON.stringify({...g,turnCheckpoint:null}));pile.pop();
  const s=g.playerStates[i];s.drawnFromDiscardTile=tile;s.mustOpenThisTurn=!s.hasOpened;
 }else{
  if(!g.tiles.length)return {draw:true};
  const previous=(i+3)%4;g.deadDiscards||={};g.deadDiscards[previous]=g.discardPiles[previous].length;
  tile=g.tiles.pop();
 }
 g.playerTiles[i].push(tile);g.hasDrawn=true;g.lastDrawnId=tile.id;
 event(g,'OnTileDrawn',i,{tile,fromDiscard});return {};
}
function rollbackDiscardDraw(g,i){
 if(!g.playerStates[i].drawnFromDiscardTile)return false;
 if(g.turnCheckpoint){const checkpoint=g.turnCheckpoint;Object.assign(g,checkpoint);g.turnCheckpoint=null;}
 return true;
}
function preview(room,i,data){
 const g=room.game,s=g.playerStates[i],pairs=data.pairs===true;
 if(s.hasOpened&&(s.openType==='pairs')!==pairs)fail('CIFT_ACAN_SERI_ISLEYEMEZ','Açma türünü değiştiremezsiniz. Çift açan oyuncu seri/küt işleyemez.');
 const chosen=selectedGroups(g,i,data.groups,pairs,data.jokerValues||{});
 if(!s.hasOpened&&pairs&&chosen.tiles.length<room.config.ACMA_BARAJI_CIFT)fail('CIFT_SAYISI_YETERSIZ','Çift açmak için en az '+room.config.ACMA_BARAJI_CIFT+' çift gerekli.');
 if(!s.hasOpened&&!pairs&&chosen.score<room.minimumOpenScore)fail('ACMA_BARAJI_YETERSIZ','En az '+room.minimumOpenScore+' puan gerekli.');
 if(s.drawnFromDiscardTile&&!chosen.used.has(s.drawnFromDiscardTile.id))fail('YERDEN_TAS_KULLANILMADI','Yerden aldığınız taşı açtığınız gruplarda kullanın.');
 return chosen;
}
function open(room,i,data){
 const g=room.game;mustDraw(g);const s=g.playerStates[i],chosen=preview(room,i,data),wasOpen=s.hasOpened;
 if(!wasOpen){s.openedTurn=g.turnNumber;s.openScore=0;if(!data.pairs&&room.stackingMode)room.minimumOpenScore=chosen.score+1;}
 s.hasOpened=true;s.openType=data.pairs?'pairs':'normal';s.openScore+=chosen.score;s.openedGroups.push(...chosen.tiles);
 g.playerTiles[i]=g.playerTiles[i].filter(t=>!chosen.used.has(t.id));consume(g,i,[...chosen.used]);
 event(g,'OnMeldOpened',i,{groups:chosen.tiles});return {};
}
function targetGroup(room,i,data){
 const g=room.game;mustDraw(g);opened(g,i);
 if(!room.config.ISLEME_ACIK)fail('ISLEME_KAPALI','Bu masada taş işleme kapalı.');
 if(!Number.isInteger(data.owner)||data.owner<0||data.owner>3||!Number.isInteger(data.group)||data.group<0)fail('GECERSIZ_PER','Geçersiz grup.');
 if(room.teamMode&&data.owner!==i&&data.owner%2===i%2&&!room.config.ORTAK_ISLEME)fail('ORTAK_ISLEME_KAPALI','Eşin perlerine işleme kapalı.');
 const target=g.playerStates[data.owner],group=target.openedGroups[data.group];
 if(!group)fail('GECERSIZ_PER','Geçersiz grup.');
 if(g.playerStates[i].openType==='pairs'&&target.openType!=='pairs')fail('CIFT_ACAN_SERI_ISLEYEMEZ','Çift açan oyuncu yalnızca çift işleyebilir.');
 return {target,group};
}
function add(room,i,data){
 const g=room.game,{target,group}=targetGroup(room,i,data);
 // A complete pair cannot contain three tiles. Further pairs are submitted atomically as a new pair group.
 if(target.openType==='pairs')fail('GECERSIZ_PER','Tamamlanmış çifte tek taş eklenemez; iki taşı gruplayıp çift indir veya joker değiştir.');
 const tile=g.playerTiles[i].find(t=>t.id===data.tileId);
 if(!tile)fail('GECERSIZ_PER','Bu taş elinizde yok.');
 if(g.playerTiles[i].length===1&&!room.config.BITIS_ISLEYEREK)fail('TAS_SAYISI_YANLIS','Bitirmek için bir atış taşı bırakın.');
 const result=meld(g,[...group,tile],false,data.jokerValues||{});
 if(!result)fail('GECERSIZ_PER','Taş bu gruba uymuyor.');
 if(data.position==='BAS'&&result.tiles[0].id!==tile.id||data.position==='SON'&&result.tiles.at(-1).id!==tile.id||data.position==='ARA'&&[result.tiles[0].id,result.tiles.at(-1).id].includes(tile.id))fail('GECERSIZ_PER','Taş bu konuma işlenemez.');
 if(g.playerTiles[i].length===1&&g.pendingJokers?.some(id=>id!==tile.id))fail('JOKER_ELDE_KALAMAZ','Jokeri aynı turda kullanın.');
 // Do not finish while a discarded tile remains unconsumed.
 if(g.playerTiles[i].length===1&&g.playerStates[i].drawnFromDiscardTile?.id!==tile.id&&g.playerStates[i].drawnFromDiscardTile)fail('YERDEN_TAS_KULLANILMADI','Önce yerden aldığınız taşı kullanın.');
 target.openedGroups[data.group]=result.tiles;g.playerTiles[i]=g.playerTiles[i].filter(t=>t.id!==tile.id);consume(g,i,[tile.id]);
 event(g,'OnTileProcessed',i,{tile,owner:data.owner,group:data.group});return {finished:!g.playerTiles[i].length};
}
function swap(room,i,data){
 const g=room.game,{target,group}=targetGroup(room,i,data);
 const joker=group.find(t=>t.id===data.jokerTileId),tile=g.playerTiles[i].find(t=>t.id===data.tileId);
 if(!joker||!wild(g,joker)||!tile||wild(g,tile))fail('GECERSIZ_PER','Jokerin yerine gerçek taşı seçin.');
 const expected=joker.joker_deger,actual=effective(g,tile);
 if(!expected||expected.color!==actual.color||expected.number!==actual.number)fail('GECERSIZ_PER','Taş, jokerin temsil ettiği değerle aynı olmalı.');
 const result=meld(g,group.map(t=>t.id===joker.id?tile:t),target.openType==='pairs');
 if(!result)fail('GECERSIZ_PER','Joker değişimi geçersiz.');
 if(!g.pendingJokers?.length)g.jokerCheckpoint=JSON.parse(JSON.stringify({...g,jokerCheckpoint:null}));
 target.openedGroups[data.group]=result.tiles;g.playerTiles[i]=g.playerTiles[i].filter(t=>t.id!==tile.id);
 const returned={...joker};delete returned.joker_deger;g.playerTiles[i].push(returned);consume(g,i,[tile.id]);
 if(room.config.JOKER_AYNI_TUR_KULLAN){g.pendingJokers||=[];g.pendingJokers.push(joker.id);}
 event(g,'OnJokerSwapped',i,{owner:data.owner,group:data.group,tile,jokerId:joker.id});return {};
}
function discard(room,i,data){
 const g=room.game;mustDraw(g);const hand=g.playerTiles[i],at=hand.findIndex(t=>t.id===data.tileId),s=g.playerStates[i];
 if(at<0)fail('GECERSIZ_PER','Bu taş elinizde yok.');
 if(s.drawnFromDiscardTile){rollbackDiscardDraw(g,i);fail('YERDEN_TAS_KULLANILMADI','Yerden alınan taş kullanılmadı; alma geri alındı. Önce taş çekip el açın veya işleyin.');}
 const tile=hand[at];
 if(wild(g,tile)&&room.config.OKEY_ATMA_YASAK)fail('OKEY_ATMA_YASAK','Bu masada okey atılamaz.');
 if((g.pendingJokers||[]).some(id=>id!==tile.id))fail('JOKER_ELDE_KALAMAZ','Aldığınız jokeri bu turda işleyin veya atın.');
 if(hand.length===1&&!s.hasOpened)fail('ACMADAN_ISLEME_YAPILAMAZ','Önce el açın.');
 const playable=g.playerStates.some((p,owner)=>p.hasOpened&&p.openType!=='pairs'&&(!room.teamMode||owner===i||owner%2!==i%2||room.config.ORTAK_ISLEME)&&p.openedGroups.some(group=>meld(g,[...group,tile])));
 hand.splice(at,1);g.discardPiles[i].push(tile);g.lastDiscard=tile;consume(g,i,[tile.id]);
 event(g,'OnTileDiscarded',i,{tile});
 return {finished:!hand.length,penalty:playable&&room.penaltyMode?room.config.ISLER_TAS_CEZA:0};
}
function next(g,i){g.currentPlayer=(i+1)%4;g.hasDrawn=false;g.turnNumber++;g.lastDrawnId=null;g.pendingJokers=[];g.turnCheckpoint=null;g.jokerCheckpoint=null;}
function points(room,index,draw=false){
 const g=room.game,c=room.config,s=g.playerStates[index],pairs=s?.openType==='pairs';
 const instant=!draw&&s?.openedTurn===g.turnNumber;
 const okey=!draw&&g.lastDiscard&&wild(g,g.lastDiscard)&&g.lastEvent?.type==='OnTileDiscarded';
 const factor=draw?1:c.NORMAL_CARPAN*(pairs?c.CIFT_CARPAN:1)*(instant?c.ELDEN_CARPAN:1)*(okey?c.OKEY_CARPAN:1);
 const result=g.playerTiles.map((hand,i)=>{
  if(!draw&&i===index)return c.KAZANAN_PUAN*factor;
  if(!draw&&room.teamMode&&c.ESIN_ELI_KAPANIR&&i%2===index%2)return 0;
  const state=g.playerStates[i];
  const base=!state.hasOpened?c.ACMAMIS_CEZA:hand.reduce((sum,t)=>sum+(wild(g,t)?c.ELDE_OKEY_CEZA:effective(g,t).number),0);
  return base*factor;
 });
 return {points:result,type:draw?'BERABERE':okey?'OKEY_ILE_BITIRME':instant?'ELDEN_BITIRME':pairs?'CIFT_ILE_BITIRME':'NORMAL',factor};
}
module.exports={initialize,draw,open,preview,add,swap,discard,next,points,rollbackDiscardDraw,event};
