'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { io } = require('socket.io-client');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGameServer } = require('../server');
const { groupValue } = require('../server/rules');
const GameLogic = require('../server/gameLogic');
const tile = (color, number, copy=0) => ({color,number,id:color+'-'+number+'-'+copy,isFakeJoker:false});
function event(socket, name) {
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => { socket.off(name,handler);reject(new Error('Timed out: '+name)); },3000);
    const handler = value => { clearTimeout(timer);resolve(value); };
    socket.once(name,handler);
  });
}
async function setup(t, options={}) {
  const service = createGameServer(options);
  service.server.listen(0,'127.0.0.1'); await once(service.server,'listening');
  const url='http://127.0.0.1:'+service.server.address().port;
  const clients=[];
  t.after(async()=>{ clients.forEach(s=>s.disconnect());await new Promise(resolve=>service.io.close(resolve)); });
  async function client() {
    const s=io(url,{transports:['websocket'],forceNew:true,reconnection:false});clients.push(s);await event(s,'connect');return s;
  }
  async function join(name, code, options={}) {
    const s=await client();const sessionEvent=event(s,'session'),stateEvent=event(s,'state');
    s.emit('joinGame',{playerName:name,create:!code,roomCode:code,...options});
    return { socket:s, session:await sessionEvent,state:await stateEvent };
  }
  async function table(options={}) {
    const players=[];players.push(await join('Oyuncu0',null,options));
    const code=players[0].session.roomCode;
    for(let i=1;i<4;i++)players.push(await join('Oyuncu'+i,code));
    for (const p of players) await p.socket.emitWithAck('resume',p.session);
    return {players,room:service.rooms.get(code),code};
  }
  return {...service,client,join,table,url};
}

test('106 tiles survive dealing, including both fake jokers',()=>{
  for(let i=0;i<30;i++){
    const g=new GameLogic();g.startGame(Array.from({length:4},(_,i)=>({name:'P'+i})));
    const tiles=[g.indicator,...g.tiles,...g.playerTiles.flat()];
    assert.equal(tiles.length,106);assert.equal(new Set(tiles.map(t=>t.id)).size,106);assert.equal(tiles.filter(t=>t.isFakeJoker).length,2);
    assert.deepEqual(g.playerTiles.map(h=>h.length).sort(),[21,21,21,22]);
  }
});
test('fake joker is a fixed tile; sequences cannot wrap or repeat',()=>{
  const g={okey:{color:'Kirmizi',number:5}};
  const fake={id:'Sahte-1',color:'Sahte',number:0,isFakeJoker:true};
  assert.equal(groupValue(g,[fake,tile('Kirmizi',6),tile('Kirmizi',7)]),18);
  assert.equal(groupValue(g,[fake,tile('Mavi',9),tile('Mavi',10)]),null);
  assert.equal(groupValue(g,[tile('Mavi',12),tile('Mavi',13),tile('Mavi',1)]),null);
  assert.equal(groupValue(g,[tile('Mavi',7),tile('Mavi',7,1),tile('Mavi',8)]),null);
  assert.equal(groupValue(g,[tile('Mavi',11),tile('Mavi',13),tile('Kirmizi',5)]),36);
});
test('four players start; another room is isolated; snapshots hide hands and tokens',async t=>{
  const service=await setup(t), {players,room}=await service.table();
  assert.equal(room.phase,'playing');
  const state=players[3].state;
  assert.equal(state.tiles.length,room.game.playerTiles[3].length);
  assert(!JSON.stringify(state).includes('tokenHash'));assert(!('playerTiles' in state));assert(!('socketId' in state.players[0]));
  const other=await service.join('Diğer masa');assert.notEqual(other.session.roomCode,room.code);assert.equal(other.state.players.length,1);
  const fifth=await service.client();const error=event(fifth,'gameError');fifth.emit('joinGame',{playerName:'Beşinci',roomCode:room.code});assert.match((await error).message,/dolu/);
});
test('turn enforcement, one draw per turn, tile conservation and safe sorting',async t=>{
  const service=await setup(t),{players,room}=await service.table();
  let i=room.game.currentPlayer;const current=players[i].socket, other=players[(i+1)%4].socket;
  let p=event(other,'gameError');other.emit('drawTile',{});assert.match((await p).message,/Sıra/);
  p=event(current,'gameError');current.emit('drawTile',{});assert.match((await p).message,/Zaten/);
  const original=room.game.playerTiles[i].map(t=>t.id);
  p=event(current,'gameError');current.emit('sortTiles',{ids:original.map((id,j)=>j?'forged':id)});assert.match((await p).message,/Sadece/);assert.deepEqual(room.game.playerTiles[i].map(t=>t.id),original);
  p=event(current,'state');current.emit('sortTiles',{ids:[...original].reverse()});await p;assert.deepEqual(room.game.playerTiles[i].map(t=>t.id),[...original].reverse());
  p=event(other,'state');current.emit('discardTile',{tileId:original[0]});let state=await p;assert.equal(state.currentPlayer,(i+1)%4);assert.equal(state.hasDrawn,false);
  p=event(other,'state');other.emit('drawTile',{});state=await p;assert.equal(state.hasDrawn,true);
  const all=[room.game.indicator,...room.game.tiles,...room.game.playerTiles.flat(),...room.game.discardPiles.flat()];assert.equal(all.length,106);assert.equal(new Set(all.map(t=>t.id)).size,106);
});
test('forged score, duplicate IDs, malformed payload and out-of-turn opening are rejected',async t=>{
  const service=await setup(t),{players,room}=await service.table();const i=room.game.currentPlayer,s=players[i].socket;
  let p=event(s,'gameError');s.emit('openHand',{groups:[[room.game.playerTiles[i][0].id]],score:999});assert.match((await p).message,/Geçersiz/);
  const id=room.game.playerTiles[i][0].id;p=event(s,'gameError');s.emit('openHand',{groups:[[id,id,id]],score:999});assert.match((await p).message,/bir kez/);
  const other=players[(i+1)%4].socket;p=event(other,'gameError');other.emit('openHand',{groups:[],score:999});assert.match((await p).message,/Sıra/);
  p=event(s,'gameError');s.emit('drawTile',null);assert.match((await p).message,/Geçersiz/);
  assert.equal(room.game.playerStates[i].hasOpened,false);
});
test('opening uses server score and sends remaining tiles only to owner',async t=>{
  const service=await setup(t),{players,room}=await service.table({stackingMode:true});const i=room.game.currentPlayer,s=players[i].socket;
  room.game.okey={color:'Siyah',number:1};
  const sets=[10,11,13].map(n=>['Mavi','Kirmizi','Yesil'].map(c=>tile(c,n)));
  const spare=tile('Siyah',9);room.game.playerTiles[i]=[...sets.flat(),spare];
  const own=event(s,'state'),opponent=event(players[(i+1)%4].socket,'state');
  s.emit('openHand',{groups:sets.map(g=>g.map(t=>t.id)),score:9999});const state=await own,other=await opponent;
  assert.equal(state.playerState.openScore,102);assert.equal(state.minimumOpenScore,103);assert.deepEqual(state.tiles,[spare]);assert(!JSON.stringify(other.tiles).includes(spare.id));assert(!('remainingTiles' in other));
});
test('discard from left must be used when opening; invalid discard keeps turn intact',async t=>{
  const service=await setup(t),{players,room}=await service.table();const i=room.game.currentPlayer,s=players[i].socket;
  const g=room.game;g.okey={color:'Siyah',number:1};g.hasDrawn=false;g.discardPiles[(i+3)%4]=[tile('Mavi',4)];
  let p=event(s,'state');s.emit('drawTile',{fromDiscard:true});await p;
  const length=g.playerTiles[i].length;p=event(s,'gameError');s.emit('discardTile',{tileId:g.playerTiles[i][0].id});assert.match((await p).message,/el aç/);assert.equal(g.currentPlayer,i);assert.equal(g.playerTiles[i].length,length);
});
test('resume requires token, preserves seats, and does not expose another hand',async t=>{
  const service=await setup(t),{players,room}=await service.table();const owner=players[1];
  owner.socket.disconnect();
  const intruder=await service.client();let p=event(intruder,'sessionExpired');intruder.emit('resume',{roomCode:room.code,token:'a'.repeat(64),playerName:owner.session.playerName});await p;
  const resumed=await service.client();p=event(resumed,'state');resumed.emit('resume',owner.session);const state=await p;
  assert.equal(state.playerIndex,1);assert.deepEqual(state.tiles,room.game.playerTiles[1]);assert.equal(room.players.length,4);
});
test('pairs are removed from hand, and finish cannot be scored twice',async t=>{
  const service=await setup(t),{players,room}=await service.table();const i=room.game.currentPlayer,s=players[i].socket;
  const pairs=[2,3,4,6,7].map(n=>[tile('Mavi',n),tile('Mavi',n,1)]);room.game.playerTiles[i]=[...pairs.flat(),tile('Siyah',9)];room.game.okey={color:'Kirmizi',number:1};
  let p=event(s,'state');s.emit('openHand',{pairs:true,groups:pairs.map(g=>g.map(t=>t.id))});let state=await p;assert.equal(state.tiles.length,1);assert.equal(state.openedGroups[i].length,5);
  p=event(s,'state');s.emit('discardTile',{tileId:'Siyah-9-0'});state=await p;assert.equal(state.phase,'finished');assert.equal(state.scores['player'+i],-202);
  p=event(s,'gameError');s.emit('discardTile',{tileId:'Siyah-9-0'});await p;assert.equal(room.scores['player'+i],-202);
});
test('optional disk checkpoint restores room and private token session',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'haysag-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const stateFile=path.join(dir,'rooms.json');
  const first=await setup(t,{stateFile}),{session}=await first.join('Kalıcı');
  assert(fs.existsSync(stateFile));const second=await setup(t,{stateFile}),s=await second.client();const p=event(s,'state');s.emit('resume',session);assert.equal((await p).players[0].name,'Kalıcı');
});
test('health and HTML are served with security headers',async t=>{
  const service=await setup(t);const r=await fetch(service.url+'/health');assert.equal(r.status,200);assert.equal((await r.json()).service,'HAYSAG OKEY');assert.match(r.headers.get('content-security-policy'),/default-src 'self'/);
  const html=await (await fetch(service.url+'/')).text();assert(html.includes('HAYSAG OKEY'));
});
