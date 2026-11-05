'use strict';
const express=require('express');const http=require('node:http');const crypto=require('node:crypto');const path=require('node:path');const fs=require('node:fs');const {Server}=require('socket.io');const K=require('./king');
const BOT_PROFILES=[{name:'Bot Tavuk',avatar:'tavuk'},{name:'Bot At',avatar:'at'},{name:'Bot Koyun',avatar:'koyun'}];
function fillBotSeats(r){while(r.players.length<4){const used=r.players.filter(p=>p.isBot).map(p=>p.avatar);const profile=BOT_PROFILES.find(p=>!used.includes(p.avatar))||BOT_PROFILES[0];r.players.push({...profile,isBot:true});}}
const Bots=require('./bots');const {BotPool}=require('./bots/pool');const {fromGame:botView}=require('./bots/view');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function createGameServer({botDelay=850,trickDelay=1500,turnMs=30000,stateFile=process.env.STATE_FILE,roomTtl=30*60_000,maxRooms=100,maxRoomsPerIp=10,botWorkers=process.env.BOT_WORKERS||1}={}){
 const botRunner=new BotPool({size:botWorkers});
 const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:4096}),rooms=new Map(),timers=new Map();
 const origin=new URL(process.env.YAZBOZ_ORIGIN||'https://yazbozhaysag.vercel.app').origin;
 app.disable('x-powered-by');app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'self' ${origin}; base-uri 'none'; form-action 'self'`);next();});
 app.get('/health',(req,res)=>res.json({ok:true,service:'HAYSAG KING',version:3}));app.get('/game',(req,res)=>res.sendFile(path.join(__dirname,'../public/index.html')));app.use(express.static(path.join(__dirname,'../public')));
 if(stateFile&&fs.existsSync(stateFile)){try{for(const r of JSON.parse(fs.readFileSync(stateFile,'utf8'))){if(r.kind!=='king'||Date.now()-r.updatedAt>roomTtl)continue;r.players.forEach(p=>p.socketId=null);rooms.set(r.code,r);}}catch(e){console.error('Masa kayıtları okunamadı:',e.message);}}
 const ready=r=>r.players.every(p=>p.isBot||p.socketId);
 const hostIndex=r=>r.players.findIndex(p=>!p.isBot);
 function persist(){if(!stateFile)return;fs.mkdirSync(path.dirname(stateFile),{recursive:true,mode:0o700});fs.writeFileSync(stateFile+'.tmp',JSON.stringify([...rooms.values()]),{mode:0o600});fs.renameSync(stateFile+'.tmp',stateFile);}
 function snapshot(r,i){const g=r.game;return {roomCode:r.code,botDifficulty:r.botDifficulty||'medium',playerIndex:i,host:i===hostIndex(r),phase:g?.phase||'lobby',round:g?Math.min(g.round+1,20):0,owner:g?.owner,current:g?.current,contract:g?.contract,trump:g?.trump,trick:g?.trick||[],lastTrick:g?.lastTrick,counts:g?.counts||[0,0,0,0],scores:g?.scores||[0,0,0,0],history:g?.history||[],hand:g?.hands[i]||[],legal:g?K.legal(g,i):[],options:g&&g.owner===i?K.options(g):[],deadline:r.deadline,serverNow:Date.now(),players:r.players.map((p,j)=>({name:p.name,avatar:p.avatar||'sigir',isBot:!!p.isBot,connected:!!p.socketId||!!p.isBot,cardCount:g?.hands[j]?.length||0})),paused:!!g&&!ready(r)};}
 function schedule(r){if(timers.has(r.code))clearTimeout(timers.get(r.code));timers.delete(r.code);r.deadline=null;if(!r.game||!ready(r))return;
 const g=r.game;if(['finished','roundEnd'].includes(g.phase))return;
 const delay=g.phase==='trick'?trickDelay:r.players[g.current]?.isBot?botDelay:turnMs;
 r.deadline=Date.now()+delay;
 const timer=setTimeout(async()=>{timers.delete(r.code);if(rooms.get(r.code)!==r||!ready(r))return;try{if(g.phase==='trick')K.advance(g);else if(await auto(r)===false)return;broadcast(r);}catch(e){console.error('King sıra hatası:',e.message);}},delay);timer.unref();timers.set(r.code,timer);
 }
 async function auto(r){const g=r.game,p=g.current,view=botView(g,p);if(g.phase==='choosing'){const choice=Bots.chooseContract(view,{difficulty:r.botDifficulty||'medium'});K.choose(g,p,choice.type,choice.trump);}else if(g.phase==='playing'){
  const key=g.round+':'+g.trickNo+':'+g.trick.length+':'+p;
  const options=Bots.settings({difficulty:r.botDifficulty||'medium',samples:process.env.BOT_MC_SAMPLES,budgetMs:process.env.BOT_MC_BUDGET_MS}),difficulty=options.difficulty;
  const id=difficulty==='hard'&&view.legal.length>1?await botRunner.choose(view,options):Bots.chooseCard(view,options);
  if(rooms.get(r.code)!==r||r.game!==g||!ready(r)||g.phase!=='playing'||key!==g.round+':'+g.trickNo+':'+g.trick.length+':'+g.current)return false;
  K.play(g,p,id);
 }}
 function broadcast(r){r.updatedAt=Date.now();schedule(r);for(let i=0;i<r.players.length;i++)if(r.players[i].socketId)io.to(r.players[i].socketId).emit('state',snapshot(r,i));persist();}
 function start(r){if(r.players.length!==4||!ready(r))throw Error('Dört oyuncu bağlı olmalı.');r.game=K.create();}
 const sweep=setInterval(()=>{for(const [code,r] of rooms)if(r.players.every(p=>!p.socketId)&&Date.now()-r.updatedAt>roomTtl){clearTimeout(timers.get(code));timers.delete(code);rooms.delete(code);}persist();},60000);sweep.unref();
 io.on('connection',socket=>{let joined=null,budget=60,last=Date.now();
 function member(){const r=rooms.get(joined),i=r?.players.findIndex(p=>p.socketId===socket.id);if(!r||i<0)throw Error('Önce masaya katılın.');return {r,i};}
 function action(name,fn){socket.on(name,(data={},ack)=>{if(Date.now()-last>1000){budget=60;last=Date.now();}if(--budget<0){if(typeof ack==='function')ack({ok:false,message:'Çok sık işlem yaptınız.'});return;}try{if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Geçersiz istek.');fn(data);if(typeof ack==='function')ack({ok:true});}catch(e){socket.emit('gameError',{message:e.message});if(typeof ack==='function')ack({ok:false,message:e.message});}});}
 action('joinGame',d=>{if(joined)throw Error('Zaten masadasınız.');const name=String(d.playerName||'').trim();if(!/^[\p{L}\p{N} _.-]{1,24}$/u.test(name))throw Error('1–24 karakterlik bir isim girin.');let r;
 if(d.create===true){if(rooms.size>=maxRooms)throw Error('Masa sınırı dolu.');const ip=hash(socket.handshake.address);if([...rooms.values()].filter(x=>x.creatorIp===ip).length>=maxRoomsPerIp)throw Error('Bu bağlantı için masa sınırı dolu.');let code;do{code=crypto.randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));r={kind:'king',botDifficulty:Bots.settings({difficulty:d.botDifficulty||process.env.BOT_DIFFICULTY}).difficulty,code,creatorIp:ip,players:[],game:null,updatedAt:Date.now()};rooms.set(code,r);if(r.botDifficulty==='hard')botRunner.warm();}else{r=rooms.get(String(d.roomCode||'').trim().toUpperCase());if(!r)throw Error('Masa bulunamadı.');}
 if(r.game||r.players.length>=4)throw Error('Masa dolu veya başlamış.');if(r.players.some(p=>p.name.toLocaleLowerCase('tr')===name.toLocaleLowerCase('tr')))throw Error('Bu isim masada kullanılıyor.');const token=crypto.randomBytes(32).toString('hex');r.players.push({name,tokenHash:hash(token),socketId:socket.id});joined=r.code;socket.emit('session',{roomCode:r.code,token,playerName:name});if(d.create&&d.withBots){fillBotSeats(r);start(r);}else if(r.players.length===4&&ready(r))start(r);broadcast(r);});
 action('resume',d=>{if(typeof d.token!=='string'||!/^[a-f0-9]{64}$/.test(d.token))throw Error('Geçersiz oturum.');const r=rooms.get(d.roomCode),p=r?.players.find(p=>p.tokenHash===hash(d.token));if(!p){socket.emit('sessionExpired');return;}if(joined&&joined!==r.code)throw Error('Başka masadasınız.');const old=p.socketId;p.socketId=socket.id;joined=r.code;if(old&&old!==socket.id)io.sockets.sockets.get(old)?.disconnect(true);if(!r.game&&r.players.length===4&&ready(r))start(r);broadcast(r);});
 action('startWithBots',()=>{const {r,i}=member();if(i!==0||r.game)throw Error('Botları masa sahibi beklerken ekleyebilir.');if(!ready(r))throw Error('Ayrılan oyuncunun dönmesi bekleniyor.');fillBotSeats(r);start(r);broadcast(r);});
 for(const [event,fn] of Object.entries({chooseContract:(g,i,d)=>K.choose(g,i,d.type,d.trump),playCard:(g,i,d)=>K.play(g,i,d.card)}))action(event,d=>{const {r,i}=member();if(!r.game||!ready(r))throw Error('Diğer oyuncunun bağlantısı bekleniyor.');fn(r.game,i,d);broadcast(r);});
 action('nextRound',()=>{const {r,i}=member();if(i!==hostIndex(r)||!r.game||!ready(r))throw Error('Masa sahibi diğer oyuncular bağlıyken devam edebilir.');K.next(r.game);broadcast(r);});
 action('rematch',()=>{const {r,i}=member();if(i!==hostIndex(r)||r.game?.phase!=='finished')throw Error('Maç tamamlanmalı.');start(r);broadcast(r);});
 action('leaveRoom',()=>{const {r,i}=member();if(r.game){const used=r.players.filter(p=>p.isBot).map(p=>p.avatar),profile=BOT_PROFILES.find(p=>!used.includes(p.avatar))||{name:'Bot Sığır',avatar:'sigir'};r.players[i]={...profile,isBot:true};}else r.players.splice(i,1);joined=null;socket.emit('sessionExpired');if(!r.players.some(p=>!p.isBot)){clearTimeout(timers.get(r.code));timers.delete(r.code);rooms.delete(r.code);}else broadcast(r);persist();});
 socket.on('disconnect',()=>{if(!joined)return;const r=rooms.get(joined),p=r?.players.find(p=>p.socketId===socket.id);if(!p)return;p.socketId=null;broadcast(r);});
 });
 server.on('close',()=>{botRunner.close();clearInterval(sweep);for(const t of timers.values())clearTimeout(t);});return {app,server,io,rooms,botStats:()=>({...botRunner.stats})};
}
if(require.main===module){const {server}=createGameServer();const portArg=process.argv.indexOf('--port');const port=Number(process.env.PORT||(portArg>=0?process.argv[portArg+1]:3000));if(!Number.isInteger(port)||port<1||port>65535)throw Error('Geçersiz port.');server.listen(port,'0.0.0.0',()=>console.log('HAYSAG KING hazır.'));process.on('SIGTERM',()=>{server.close();setTimeout(()=>process.exit(0),2000).unref();});}
module.exports={createGameServer};
