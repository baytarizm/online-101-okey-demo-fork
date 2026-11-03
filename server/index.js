'use strict';
const express = require('express');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Server } = require('socket.io');
const GameLogic = require('./gameLogic');
const { groupValue, config, failure, meld } = require('./rules');
const mechanics = require('./mechanics');
const { findGroups, chooseDiscard } = require('./bot');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const avatars = ['alibicim.png', 'egefitness.png', 'james.jpg', 'lvblc5.jpg'];
const namePattern = /^[\p{L}\p{N} _.-]{1,24}$/u;

function createGameServer({ stateFile = process.env.STATE_FILE, roomTtl = 30 * 60_000, botDelay = 1000 } = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 16_384, serveClient: true });
  const rooms = new Map();
  const timers = new Set();
  const botTimers = new Map();
  const runningBots = new Set();
  const turnTimers = new Map();
  const ready = room => room.players.every(p => p.isBot || p.socketId);
  const yazbozOrigin = new URL(process.env.YAZBOZ_ORIGIN || 'https://yazbozhaysag.vercel.app').origin;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'self' ${yazbozOrigin}; base-uri 'none'; form-action 'self'`);
    next();
  });
  app.get('/health', (req,res) => res.json({ ok: true, service: 'HAYSAG OKEY' }));
  app.get('/game', (req,res) => res.sendFile(path.join(__dirname, '../public/game.html')));
  app.use(express.static(path.join(__dirname, '../public')));

  if (stateFile && fs.existsSync(stateFile)) {
    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    for (const room of saved) {
      if (Date.now() - room.updatedAt > roomTtl) continue;
      room.players.forEach(p => { p.socketId = null; });
      room.config = config(room.config || {SAHTE_OKEY_MODU:'OKEY'});
      if (room.game) { room.game = Object.assign(new GameLogic(), room.game); room.game.config=room.config; room.game.pendingJokers ||= []; room.game.turnNumber ||= 0; }
      room.turnDeadline=null;
      rooms.set(room.code, room);
    }
  }
  function persist() {
    if (!stateFile) return;
    fs.mkdirSync(path.dirname(stateFile), { recursive: true, mode: 0o700 });
    fs.writeFileSync(stateFile + '.tmp', JSON.stringify([...rooms.values()]), { mode: 0o600 });
    fs.renameSync(stateFile + '.tmp', stateFile);
  }
  function publicPlayers(room) {
    return room.players.map((p,i) => ({ name:p.name, avatar:p.avatar, team:room.teamMode ? i % 2 + 1 : null, connected:!!p.socketId || !!p.isBot, isBot:!!p.isBot,
      tileCount:room.game?.playerTiles[i].length || 0, hasOpened:room.game?.playerStates[i].hasOpened || false }));
  }
  function snapshot(room, index) {
    const g = room.game;
    return { roomCode:room.code, players:publicPlayers(room), playerIndex:index, host:index === 0, phase:room.phase,
      teamMode:room.teamMode, stackingMode:room.stackingMode, penaltyMode:room.penaltyMode, scores:room.scores,
      config:room.config, turnDeadline:room.turnDeadline, serverNow:Date.now(), lastEvent:g?.lastEvent ? (g.lastEvent.type==='OnTileDrawn' && !g.lastEvent.fromDiscard && g.lastEvent.player!==index ? {...g.lastEvent,tile:undefined} : g.lastEvent) : null,
      minimumOpenScore:room.minimumOpenScore, round:room.round, result:room.result,
      tiles:g?.playerTiles[index] || [], indicator:g?.indicator, okey:g?.okey,
      currentPlayer:g?.currentPlayer, hasDrawn:g?.hasDrawn || false, pileCount:g?.tiles.length || 0,
      melds:g?.playerStates.flatMap((s,owner)=>s.openedGroups.map((tiles,group)=>({id:room.round+':'+owner+':'+group,tur:meld(g,tiles,s.openType==='pairs')?.type,tasler:tiles,sahip:owner,takim:owner%2===0?'A':'B'}))) || [],
      playerState:g?.playerStates[index], openedGroups:g?.playerStates.map(s => s.openedGroups) || [[],[],[],[]],
      discards:g?.discardPiles.map(p => p.at(-1) || null) || [null,null,null,null] };
  }
  function broadcast(room) {
    scheduleTurn(room);
    room.updatedAt = Date.now();
    room.players.forEach((p,i) => { if (p.socketId) io.to(p.socketId).emit('state', snapshot(room,i)); });
    persist();
    scheduleBot(room);
  }
  function start(room) {
    room.game = new GameLogic();
    room.game.startGame(room.players);
    mechanics.initialize(room.game,room.config);
    room.turnDeadline=null; room.turnKey=null;
    room.phase = 'playing'; room.minimumOpenScore = room.config.ACMA_BARAJI_SERI; room.result = null; room.round++;
  }
  function finish(room, index, draw = false) {
    const game = room.game;
    const scored=mechanics.points(room,index,draw), points=scored.points;
    room.players.forEach((p,i) => {
      const key = room.teamMode ? 'team' + (i % 2 + 1) : 'player' + i;
      room.scores[key] = (room.scores[key] || 0) + points[i];
    });
    room.phase = 'finished';
    room.result = { winner:draw ? null : room.players[index].name, winnerTeam:!draw && room.teamMode ? index%2+1 : null, points, type:scored.type, factor:scored.factor, draw, hands:game.playerTiles };
    mechanics.event(game,'OnHandFinished',index,{type:scored.type});
  }
  const sweep = setInterval(() => {
    for (const [code, room] of rooms) {
      if (room.players.every(p => !p.socketId) && Date.now() - room.updatedAt > roomTtl) rooms.delete(code);
    }
    persist();
  }, 60_000);
  sweep.unref();

  function assertTurn(room,index) {
    if (room.phase !== 'playing') throw new Error('Aktif el bulunmuyor.');
    if (room.game.currentPlayer !== index) throw failure('SIRA_SENDE_DEGIL','Sıra sizde değil.');
    if (!ready(room)) throw new Error('Ayrılan oyuncunun dönmesi bekleniyor.');
  }
  const moves = {
    drawTile:(room,i,data)=>mechanics.draw(room.game,i,data.fromDiscard===true),
    discardTile:mechanics.discard,
    openHand:mechanics.open,
    addToGroup:mechanics.add,
    swapJoker:mechanics.swap,
  };
  function performMove(room,index,name,data={}) {
    assertTurn(room,index);
    try {
      if(name==='drawTile'&&data.fromDiscard)room.game.checkpointMinimum=room.minimumOpenScore;
      const result=moves[name](room,index,data)||{};
      if(result.penalty){
        const key=room.teamMode?'team'+(index%2+1):'player'+index;
        room.scores[key]=(room.scores[key]||0)+result.penalty;
      }
      if(result.draw)finish(room,index,true);
      else if(result.finished)finish(room,index);
      else if(name==='discardTile')mechanics.next(room.game,index);
      broadcast(room);
    } catch(error) {
      // In particular, publish the rollback of an unused discarded tile.
      if(error.code==='YERDEN_TAS_KULLANILMADI'&&room.game.checkpointMinimum!==undefined)room.minimumOpenScore=room.game.checkpointMinimum;
      broadcast(room);throw error;
    }
  }
  function scheduleTurn(room) {
    const old=turnTimers.get(room.code);
    const key=room.game?room.round+':'+room.game.turnNumber+':'+room.game.currentPlayer:null;
    const active=room.phase==='playing' && ready(room) && room.config.TUR_SURESI_SN>0;
    if(!active){if(old)clearTimeout(old.timer);turnTimers.delete(room.code);if(room.turnDeadline)room.turnRemaining=Math.max(1,room.turnDeadline-Date.now());room.turnDeadline=null;return;}
    if(old?.key===key)return;
    if(old)clearTimeout(old.timer);
    if(room.turnKey!==key){room.turnRemaining=null;room.turnDeadline=null;}
    room.turnKey=key;
    room.turnDeadline ||= Date.now()+(room.turnRemaining??room.config.TUR_SURESI_SN*1000);room.turnRemaining=null;
    const timer=setTimeout(()=>{
      turnTimers.delete(room.code);
      if(rooms.get(room.code)!==room || room.phase!=='playing' || !ready(room))return;
      const i=room.game.currentPlayer;
      try {
        if(room.game.pendingJokers?.length && room.game.jokerCheckpoint){
          const checkpoint=room.game.jokerCheckpoint;Object.assign(room.game,checkpoint);room.game.jokerCheckpoint=null;
        }
        mechanics.rollbackDiscardDraw(room.game,i);
        if(!room.game.hasDrawn)performMove(room,i,'drawTile',{});
        if(room.phase!=='playing')return;
        const hand=room.game.playerTiles[i];
        let id=room.game.lastDrawnId;
        const {wild}=require('./rules');
        if(!id || room.config.OKEY_ATMA_YASAK && wild(room.game,hand.find(t=>t.id===id)))
          id=chooseDiscard({...botView(room,i),tiles:hand.filter(t=>!room.config.OKEY_ATMA_YASAK||!wild(room.game,t))});
        performMove(room,i,'discardTile',{tileId:id});
      }catch(error){console.error('Süre hamlesi:',error.message);room.turnDeadline=null;broadcast(room);}
    },Math.max(1,room.turnDeadline-Date.now()));
    timer.unref();turnTimers.set(room.code,{key,timer});
  }
  function fillBots(room) {
    if (!ready(room)) throw new Error('Bağlantısı kesilen oyuncunun dönmesini bekleyin.');
    const names = ['Bot Sığır','Bot Koyun','Bot Kanatlı'];
    let next=0;
    while(room.players.length<4) {
      let name=names[next % names.length];next++;
      while(room.players.some(p=>p.name===name))name+=' 2';
      room.players.push({name,isBot:true,socketId:null,tokenHash:null,avatar:avatars[room.players.length]});
    }
    start(room);
  }
  function botView(room,index) {
    const game=room.game,state=game.playerStates[index];
    return { tiles:game.playerTiles[index],okey:game.okey,indicator:game.indicator,config:room.config,hasOpened:state.hasOpened,openType:state.openType,
      penaltyMode:room.penaltyMode,openedGroups:game.playerStates.map(s=>s.openedGroups),openTypes:game.playerStates.map(s=>s.openType) };
  }
  function botTurn(room) {
    const index=room.game.currentPlayer;
    if(!room.game.hasDrawn)performMove(room,index,'drawTile',{});
    if(room.phase!=='playing')return;
    let view=botView(room,index);
    let pairs=view.openType==='pairs',plan=findGroups(view,pairs);
    if(!view.hasOpened && plan.score<room.minimumOpenScore) {
      const pairPlan=findGroups(view,true);
      if(pairPlan.groups.length>=room.config.ACMA_BARAJI_CIFT){pairs=true;plan=pairPlan;}else plan={groups:[],score:0};
    }
    if(plan.groups.length)performMove(room,index,'openHand',{groups:plan.groups,pairs});
    // Process only public melds and keep a final discard in hand.
    if(room.game.playerStates[index].hasOpened) {
      let processed=true;
      while(processed && room.game.playerTiles[index].length>1) {
        processed=false;
        const state=room.game.playerStates[index];
        if(state.openType==='pairs' || !room.config.ISLEME_ACIK)break;
        outer:for(const tile of room.game.playerTiles[index])for(let owner=0;owner<4;owner++){
          const target=room.game.playerStates[owner];
          if(target.openType==='pairs' || room.teamMode && owner!==index && owner%2===index%2 && !room.config.ORTAK_ISLEME)continue;
          for(let group=0;group<target.openedGroups.length;group++)if(groupValue(room.game,[...target.openedGroups[group],tile])!==null){
            performMove(room,index,'addToGroup',{owner,group,tileId:tile.id});processed=true;break outer;
          }
        }
      }
    }
    performMove(room,index,'discardTile',{tileId:chooseDiscard(botView(room,index))});
  }
  function scheduleBot(room) {
    if(runningBots.has(room.code))return;
    if(botTimers.has(room.code)){clearTimeout(botTimers.get(room.code));botTimers.delete(room.code);}
    if(room.phase!=='playing' || !ready(room) || !room.players[room.game.currentPlayer]?.isBot)return;
    const timer=setTimeout(()=>{
      botTimers.delete(room.code);
      if(rooms.get(room.code)!==room || room.phase!=='playing' || !ready(room) || !room.players[room.game.currentPlayer]?.isBot)return;
      runningBots.add(room.code);
      try { botTurn(room); }
      catch(error) {
        console.error('Bot hamlesi tamamlanamadı:',error.message);
        // A rejected plan must not leave a valid draw/discard turn stuck.
        if(room.phase==='playing' && room.players[room.game.currentPlayer]?.isBot && ready(room)){
          const index=room.game.currentPlayer;
          try { if(!room.game.hasDrawn)performMove(room,index,'drawTile',{});
            if(room.phase==='playing')performMove(room,index,'discardTile',{tileId:chooseDiscard(botView(room,index))});
          } catch(fallback) { console.error('Bot sırası durdu:',fallback.message); }
        }
      } finally {runningBots.delete(room.code);scheduleBot(room);}
    },botDelay);
    timer.unref();botTimers.set(room.code,timer);
  }

  io.on('connection', socket => {
    let joinedRoom = null;
    let budget = 60, resetAt = Date.now();
    function sendError(message,code) { socket.emit('gameError', { message,code }); }
    function member() {
      if (!joinedRoom) throw new Error('Önce masaya katılın.');
      const room = rooms.get(joinedRoom);
      const index = room?.players.findIndex(p => p.socketId === socket.id);
      if (!room || index < 0) throw new Error('Masa oturumunuz bulunamadı.');
      return { room, index, game:room.game };
    }
    function action(name, fn) {
      socket.on(name, (data = {}, ack) => {
        if (Date.now() - resetAt >= 1000) { budget = 60; resetAt = Date.now(); }
        if (--budget < 0) return;
        try {
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Geçersiz istek.');
          const result=fn(data);
          if (typeof ack === 'function') ack({ok:true,...result});
        } catch (err) { sendError(err.message,err.code || 'GECERSIZ_ISTEK'); if (typeof ack === 'function') ack({ok:false,message:err.message,code:err.code || 'GECERSIZ_ISTEK'}); }
      });
    }
    action('joinGame', data => {
      if (joinedRoom) throw new Error('Zaten bir masadasınız.');
      const name = String(data.playerName || '').trim();
      if (!namePattern.test(name)) throw new Error('İsim 1–24 harf, sayı, boşluk, nokta veya tire içermeli.');
      let room;
      if (data.create === true) {
        if (rooms.size >= 100) throw new Error('Masa sınırına ulaşıldı. Daha sonra deneyin.');
        const fromIp = [...rooms.values()].filter(r => r.creatorIp === hash(socket.handshake.address));
        if (fromIp.length >= 10) throw new Error('Bu bağlantıdan en fazla 10 masa açılabilir.');
        let code;
        do { code = crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase(); } while (rooms.has(code));
        room = { config:config(data.config || {}), code, creatorIp:hash(socket.handshake.address), players:[], phase:'lobby', game:null,
          teamMode:data.teamMode !== false, stackingMode:data.stackingMode === true, penaltyMode:data.penaltyMode === true,
          scores:{}, round:0, minimumOpenScore:101, result:null, updatedAt:Date.now() };
        rooms.set(code,room);
      } else {
        const code = String(data.roomCode || '').toUpperCase().trim();
        room = rooms.get(code);
        if (!room) throw new Error('Masa bulunamadı. Davet kodunu kontrol edin.');
      }
      if (room.phase !== 'lobby' || room.players.length >= 4) throw new Error('Masa dolu veya oyun başlamış.');
      if (room.players.some(p => p.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) throw new Error('Masada bu isim kullanılıyor.');
      const token = crypto.randomBytes(32).toString('hex');
      room.players.push({ name, avatar:avatars.includes(data.avatar) ? data.avatar : avatars[room.players.length], tokenHash:hash(token), socketId:socket.id });
      joinedRoom = room.code;
      socket.emit('session', { roomCode:room.code, token, playerName:name });
      if (data.create === true && data.withBots === true) fillBots(room);
      else if (room.players.length === 4 && ready(room)) start(room);
      broadcast(room);
    });
    action('resume', data => {
      if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token)) throw new Error('Geçersiz oturum.');
      const room = rooms.get(data.roomCode);
      const player = room?.players.find(p => p.tokenHash === hash(data.token));
      if (!player) { socket.emit('sessionExpired'); return; }
      if (joinedRoom && joinedRoom !== room.code) throw new Error('Başka bir masadasınız.');
      const oldSocket = player.socketId;
      player.socketId = socket.id; joinedRoom = room.code;
      if (oldSocket && oldSocket !== socket.id) io.sockets.sockets.get(oldSocket)?.disconnect(true);
      if (room.phase === 'lobby' && room.players.length === 4 && ready(room)) start(room);
      broadcast(room);
    });
    action('drawTile', data => { const {room,index}=member(); performMove(room,index,'drawTile',data); });
    action('discardTile', data => { const {room,index}=member(); performMove(room,index,'discardTile',data); });
    action('openHand', data => { const {room,index}=member(); performMove(room,index,'openHand',data); });
    action('addToGroup', data => { const {room,index}=member(); performMove(room,index,'addToGroup',data); });
    action('swapJoker',data=>{const {room,index}=member();performMove(room,index,'swapJoker',data);});
    action('previewOpen',data=>{const {room,index}=member();assertTurn(room,index);const result=mechanics.preview(room,index,data);socket.emit('openingPreview',{valid:true,score:result.score,groups:result.tiles,requestId:data.requestId});});
    action('cancelDiscardDraw',()=>{const {room,index}=member();assertTurn(room,index);if(mechanics.rollbackDiscardDraw(room.game,index)&&room.game.checkpointMinimum!==undefined)room.minimumOpenScore=room.game.checkpointMinimum;broadcast(room);});
    // Turkish command contract; legacy socket names remain compatible with existing clients.
    const commandTarget=(room,data)=>{
      if(!data.hedefMeldId && !data.meldId)return data;
      const parts=String(data.hedefMeldId||data.meldId).split(':').map(Number);
      if(parts.length!==3 || parts[0]!==room.round || parts.some(n=>!Number.isInteger(n)))throw failure('GECERSIZ_PER','Per kimliği geçersiz.');
      return {...data,owner:parts[1],group:parts[2]};
    };
    for(const [command,move] of Object.entries({desteden_cek:'drawTile',yerden_al:'drawTile',tas_at:'discardTile',ac_seri_kut:'openHand',ac_cift:'openHand',acmayi_onayla:'openHand',tas_isle:'addToGroup',joker_al:'swapJoker',eli_bitir:'discardTile'}))action(command,data=>{
      const {room,index}=member();
      const input=commandTarget(room,data);
      if(command==='yerden_al')input.fromDiscard=true;
      if(command==='ac_cift')input.pairs=true;
      if(command==='ac_seri_kut')input.pairs=false;
      if(data.meldler)input.groups=data.meldler.map(g=>Array.isArray(g)?g:g.tasler.map(t=>typeof t==='string'?t:t.id));
      if(data.ciftler){input.groups=data.ciftler.map(g=>g.map(t=>typeof t==='string'?t:t.id));input.pairs=true;}
      if(data.yerineKonanTileId)input.tileId=data.yerineKonanTileId;
      if(data.pozisyon)input.position=data.pozisyon;
      performMove(room,index,move,input);
    });
    action('acma_onizle',data=>{
      const {room,index}=member();assertTurn(room,index);
      try{const p=mechanics.preview(room,index,data);return {gecerli:true,puan:p.score,meldler:p.tiles};}
      catch(error){let score=0;try{score=require('./rules').selectedGroups(room.game,index,data.groups,data.pairs===true,data.jokerValues||{}).score;}catch{}return {gecerli:false,puan:score,hata_kodu:error.code||'GECERSIZ_PER',message:error.message};}
    });
    action('sortTiles', data => {
      const { room,index,game } = member();
      if (room.phase !== 'playing' || !Array.isArray(data.ids)) throw new Error('Geçersiz sıralama.');
      const hand = game.playerTiles[index];
      if (data.ids.length !== hand.length || new Set(data.ids).size !== hand.length || data.ids.some(id => !hand.some(t => t.id === id))) throw new Error('Sadece elinizdeki taşların yerini değiştirebilirsiniz.');
      game.playerTiles[index] = data.ids.map(id => hand.find(t => t.id === id));
      socket.emit('state',snapshot(room,index)); persist();
    });
    action('startWithBots', () => {
      const {room,index}=member();
      if(index!==0 || room.phase!=='lobby')throw new Error('Botları yalnızca masa sahibi bekleme ekranında ekleyebilir.');
      fillBots(room);broadcast(room);
    });
    action('newRound', () => {
      const { room,index } = member();
      if (index !== 0 || room.phase !== 'finished' || !ready(room)) throw new Error('Yeni eli masa sahibi, dört oyuncu bağlıyken başlatabilir.');
      start(room); broadcast(room);
    });
    action('leaveRoom', () => {
      const {room,index} = member();
      if (room.phase !== 'lobby') throw new Error('El sürerken yeriniz korunur. Sekmeyi kapatıp yeniden bağlanabilirsiniz.');
      room.players.splice(index,1); joinedRoom = null; socket.emit('sessionExpired');
      if (!room.players.length) rooms.delete(room.code);
      else broadcast(room);
      persist();
    });
    socket.on('disconnect', () => {
      if (!joinedRoom) return;
      const room = rooms.get(joinedRoom);
      const p = room?.players.find(p => p.socketId === socket.id);
      if (!p) return;
      p.socketId = null;
      broadcast(room);
      // Keep the seat and game indices stable. Only unused lobby seats expire.
      if (room.phase === 'lobby') {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (room.phase !== 'lobby' || p.socketId || !rooms.has(room.code)) return;
          room.players = room.players.filter(other => other !== p);
          if (!room.players.length) rooms.delete(room.code); else broadcast(room);
          persist();
        }, 120_000);
        timers.add(timer); timer.unref();
      }
    });
  });
  server.on('close', () => { clearInterval(sweep); timers.forEach(clearTimeout); botTimers.forEach(clearTimeout); botTimers.clear(); turnTimers.forEach(t=>clearTimeout(t.timer));turnTimers.clear(); });
  return { app, server, io, rooms };
}
if (require.main === module) {
  const {server} = createGameServer();
  const portIndex = process.argv.indexOf('--port');
  const port = Number(process.env.PORT || (portIndex >= 0 ? process.argv[portIndex + 1] : 3000));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  server.listen(port, '0.0.0.0', () => console.log('HAYSAG OKEY hazır.'));
}
module.exports = { createGameServer };
