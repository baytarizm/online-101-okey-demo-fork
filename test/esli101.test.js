'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Rules=require('../server/rules');
const M=require('../server/mechanics');
const Game=require('../server/gameLogic');
const {Rack,sort,positions}=require('../public/js/rack-layout');
let serial=0;
const tile=(color,number)=>({color,number,id:'spec-'+serial++,isFakeJoker:false});
function room(options={}){
 const g=new Game();g.okey={color:'Kirmizi',number:1};g.indicator=tile('Kirmizi',13);g.hasDrawn=true;g.currentPlayer=0;
 const r={game:g,config:Rules.config(options),teamMode:true,minimumOpenScore:options.ACMA_BARAJI_SERI||101};M.initialize(g,r.config);return r;
}
const code=(fn,value)=>assert.throws(fn,e=>e.code===value);
function opened(g,i,pairs=false){g.playerStates[i].hasOpened=true;g.playerStates[i].openType=pairs?'pairs':'normal';}
function meldFixture(r,owner=2){const group=[tile('Mavi',3),tile('Mavi',4),tile('Mavi',5)];opened(r.game,owner);r.game.playerStates[owner].openedGroups=[group];return group;}
test('config validates supplied settings and supports the three explicit fake joker meanings',()=>{
 assert.equal(Rules.config().TUR_SURESI_SN,30);code(()=>Rules.config({TUR_SURESI_SN:-1}),'GECERSIZ_AYAR');
 code(()=>Rules.config({SAHTE_OKEY_MODU:'unknown'}),'GECERSIZ_AYAR');code(()=>Rules.config({TAS_SAYISI:107}),'GECERSIZ_AYAR');
 const r=room(),fake={...tile('Sahte',0),isFakeJoker:true};assert.equal(Rules.effective(r.game,fake).number,13);
 r.game.config=Rules.config({SAHTE_OKEY_MODU:'OKEY'});assert.equal(Rules.effective(r.game,fake).number,1);
 r.game.config=Rules.config({SAHTE_OKEY_MODU:'JOKER'});assert(Rules.wild(r.game,fake));
});
test('joker represented value is authoritative, locked and visible; 13→1 wrap is configurable',()=>{
 const r=room(),joker=tile('Kirmizi',1),a=tile('Mavi',11),b=tile('Mavi',13);
 const m=Rules.meld(r.game,[a,joker,b]);assert.equal(m.score,36);assert.deepEqual(m.tiles[1].joker_deger,{color:'Mavi',number:12});
 assert.equal(Rules.meld(r.game,m.tiles.concat(tile('Mavi',12))),null);
 const wrap=[tile('Sari',12),tile('Sari',13),tile('Sari',1)];assert.equal(Rules.meld(r.game,wrap),null);
 r.game.config=Rules.config({SERI_DONUSU:true});assert.equal(Rules.meld(r.game,wrap).score,26);
 const p=Rules.meld(r.game,[tile('Mavi',7),tile('Kirmizi',1)],true);assert.equal(p.type,'CIFT');
 const j1=tile('Kirmizi',1),j2=tile('Kirmizi',1);assert.equal(Rules.meld(r.game,[j1,j2],true,{[j1.id]:{color:'Mavi',number:999}}),null);
});
test('opening is atomic and respects configurable series and pair thresholds',()=>{
 const r=room({ACMA_BARAJI_SERI:60}),g=r.game,group=[tile('Mavi',10),tile('Sari',10),tile('Siyah',10)],spare=tile('Sari',2);g.playerTiles[0]=[...group,spare];
 const before=JSON.stringify(g);code(()=>M.open(r,0,{groups:[group.map(t=>t.id)]}),'ACMA_BARAJI_YETERSIZ');assert.equal(JSON.stringify(g),before);
 r.minimumOpenScore=30;M.open(r,0,{groups:[group.map(t=>t.id)]});assert.equal(g.playerTiles[0].length,1);assert.equal(g.playerStates[0].openScore,30);
 const q=room({ACMA_BARAJI_CIFT:2}),pairs=Array.from({length:2},(_,i)=>[tile('Mavi',i+2),tile('Mavi',i+2)]);q.game.playerTiles[0]=[...pairs.flat(),tile('Siyah',8)];M.open(q,0,{pairs:true,groups:pairs.map(p=>p.map(t=>t.id))});assert.equal(q.game.playerStates[0].openType,'pairs');
});
test('paired processing checks own, partner, opponent and disabled settings independently',()=>{
 const r=room(),g=r.game;meldFixture(r);opened(g,0);const extra=tile('Mavi',6);g.playerTiles[0]=[extra,tile('Siyah',3)];
 r.config.ORTAK_ISLEME=false;code(()=>M.add(r,0,{owner:2,group:0,tileId:extra.id}),'ORTAK_ISLEME_KAPALI');
 r.config.ORTAK_ISLEME=true;M.add(r,0,{owner:2,group:0,tileId:extra.id,position:'SON'});assert.equal(g.playerStates[2].openedGroups[0].length,4);
 r.config.ISLEME_ACIK=false;code(()=>M.add(r,0,{owner:2,group:0,tileId:g.playerTiles[0][0].id}),'ISLEME_KAPALI');
});
test('pair openers cannot process series or switch opening mode',()=>{
 const r=room(),g=r.game;opened(g,0,true);meldFixture(r);const t=tile('Mavi',6);g.playerTiles[0]=[t,tile('Siyah',9)];
 code(()=>M.add(r,0,{owner:2,group:0,tileId:t.id}),'CIFT_ACAN_SERI_ISLEYEMEZ');
 code(()=>M.open(r,0,{groups:[]}), 'CIFT_ACAN_SERI_ISLEYEMEZ');
});
test('an unused discarded draw rolls back all temporary table mutations and permits a fresh draw',()=>{
 const r=room(),g=r.game;opened(g,0);meldFixture(r);g.hasDrawn=false;
 const dropped=tile('Sari',9),extra=tile('Mavi',6),spare=tile('Siyah',8);g.discardPiles[3]=[dropped];g.playerTiles[0]=[extra,spare];g.tiles=[tile('Mavi',1)];
 M.draw(g,0,true);M.add(r,0,{owner:2,group:0,tileId:extra.id});code(()=>M.discard(r,0,{tileId:spare.id}),'YERDEN_TAS_KULLANILMADI');
 assert.equal(g.playerStates[2].openedGroups[0].length,3);assert.deepEqual(g.playerTiles[0],[extra,spare]);assert.equal(g.discardPiles[3].at(-1).id,dropped.id);assert(!g.hasDrawn);
 M.draw(g,0,false);assert.equal(g.playerTiles[0].length,3);
});
test('a discarded tile can be consumed by processing after opening, including allowed okey',()=>{
 const r=room(),g=r.game;opened(g,0);meldFixture(r);g.hasDrawn=false;g.playerTiles[0]=[tile('Siyah',8)];const dropped=tile('Mavi',6);g.discardPiles[3]=[dropped];M.draw(g,0,true);M.add(r,0,{owner:2,group:0,tileId:dropped.id});assert.equal(g.playerStates[0].drawnFromDiscardTile,null);M.discard(r,0,{tileId:g.playerTiles[0][0].id});
 const q=room(),joker=tile('Kirmizi',1);q.game.hasDrawn=false;q.game.discardPiles[3]=[joker];code(()=>M.draw(q.game,0,true),'OKEY_YERDEN_ALINAMAZ');q.game.config.OKEY_YERDEN_ALINABILIR=true;M.draw(q.game,0,true);assert.equal(q.game.lastDrawnId,joker.id);
});
test('joker swap requires the exact represented tile; obligation must be processed or discarded',()=>{
 const r=room(),g=r.game;opened(g,0);opened(g,2);const joker=tile('Kirmizi',1);g.playerStates[2].openedGroups=[Rules.meld(g,[tile('Mavi',3),joker,tile('Mavi',5)]).tiles];
 const replacement=tile('Mavi',4),spare=tile('Siyah',8);g.playerTiles[0]=[replacement,spare];
 code(()=>M.swap(r,0,{owner:2,group:0,jokerTileId:joker.id,tileId:spare.id}),'GECERSIZ_PER');
 M.swap(r,0,{owner:2,group:0,jokerTileId:joker.id,tileId:replacement.id});assert(g.playerTiles[0].some(t=>t.id===joker.id));
 code(()=>M.discard(r,0,{tileId:spare.id}),'JOKER_ELDE_KALAMAZ');M.discard(r,0,{tileId:joker.id});assert.equal(g.pendingJokers.length,0);
});
test('pair joker swap obeys the pair restriction, and a full pair rejects a third tile',()=>{
 const r=room(),g=r.game;opened(g,0,true);opened(g,2,true);const joker=tile('Kirmizi',1);g.playerStates[2].openedGroups=[Rules.meld(g,[tile('Mavi',7),joker],true).tiles];const real=tile('Mavi',7);g.playerTiles[0]=[real,tile('Sari',3)];
 code(()=>M.add(r,0,{owner:2,group:0,tileId:real.id}),'GECERSIZ_PER');M.swap(r,0,{owner:2,group:0,tileId:real.id,jokerTileId:joker.id});assert.equal(g.playerStates[2].openedGroups[0].length,2);
});
test('last tile processing can finish and is configurable; team partner closes with no penalty',()=>{
 const r=room(),g=r.game;opened(g,0);meldFixture(r);const extra=tile('Mavi',6);g.playerTiles[0]=[extra];r.config.BITIS_ISLEYEREK=false;code(()=>M.add(r,0,{owner:2,group:0,tileId:extra.id}),'TAS_SAYISI_YANLIS');r.config.BITIS_ISLEYEREK=true;assert(M.add(r,0,{owner:2,group:0,tileId:extra.id}).finished);
 g.playerTiles[2]=[tile('Siyah',13)];const scored=M.points(r,0);assert.equal(scored.points[2],0);assert.equal(scored.points[1],202);
 r.config.ESIN_ELI_KAPANIR=false;assert.equal(M.points(r,0).points[2],13);
});
test('deck exhaustion scores every remaining hand, with no winner bonus',()=>{
 const r=room(),g=r.game;opened(g,0);g.playerTiles[0]=[tile('Mavi',7)];g.hasDrawn=false;assert(M.draw(g,0,false).draw);assert.deepEqual(M.points(r,0,true).points,[7,202,202,202]);
});
test('finish multipliers stack once and retained real jokers receive one penalty',()=>{
 const r=room(),g=r.game;opened(g,0,true);opened(g,1);g.playerStates[0].openedTurn=g.turnNumber;g.playerTiles[1]=[tile('Kirmizi',1),tile('Mavi',4)];g.lastDiscard=tile('Kirmizi',1);g.lastEvent={type:'OnTileDiscarded'};
 const scored=M.points(r,0);assert.equal(scored.factor,8);assert.equal(scored.points[0],-808);assert.equal(scored.points[1],105*8);
});
test('rack commands, 20-step history, row sorts and all modes preserve exactly the tile IDs',()=>{
 const tiles=Array.from({length:22},(_,i)=>tile(Rules.COLORS[i%4],i%13+1)),ids=tiles.map(t=>t.id),r=new Rack(ids);
 for(const mode of ['SERI','CIFT','KUT']){r.arrange(sort(tiles,{okey:{color:'Kirmizi',number:13}},mode));assert.deepEqual(r.slots.filter(Boolean).sort(),[...ids].sort());assert.equal(r.slots.length,30);}
 for(let n=0;n<24;n++)r.move(r.slots[0],0,1);assert.equal(r.past.length,20);
 const saved=[...r.slots];r.undo(ids);r.redo(ids);assert.deepEqual(r.slots,saved);
 const pairs=Array.from({length:11},(_,i)=>['a'+i,'b'+i]);const layout=positions(pairs,[]);assert.equal(layout.width,15);assert(layout.rows.every(row=>row.length===15));assert.equal(layout.rows.flat().filter(Boolean).length,22);
});
test('rack supports move, swap, insert, ordered group move and explicit gaps without losing a tile',()=>{
 const r=new Rack(['a','b','c','d']);r.move('a',1,0,'empty');assert.equal(r.slots[15],'a');r.move('b',0,2);assert.equal(r.slots[2],'b');r.move('d',0,1,'insert');assert.equal(r.slots[1],'d');r.move('a',1,2,'group',['a','b']);assert.deepEqual(r.slots.slice(17,19),['a','b']);r.gap(1,2,1);assert.equal(r.slots[17],null);assert.deepEqual(r.slots.filter(Boolean).sort(),['a','b','c','d']);
});
