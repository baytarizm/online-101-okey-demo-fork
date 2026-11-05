'use strict';
const fs=require('node:fs');const http=require('node:http');const {performance,monitorEventLoopDelay}=require('node:perf_hooks');const {io}=require('socket.io-client');const {createGameServer}=require('../server');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));const emit=(socket,event,data)=>new Promise((resolve,reject)=>socket.timeout(15000).emit(event,data,(error,result)=>error?reject(error):result?.ok?resolve(result):reject(Error(result?.message||'Socket rejection'))));
function q(values,p){const a=values.slice().sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(a.length*p))]||0;}
async function run(tables){
 // Only this isolated harness raises admission limits. Production defaults remain 100 total/10 per IP.
 const service=createGameServer({maxRooms:tables,maxRoomsPerIp:tables,roomTtl:60000});await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));const port=service.server.address().port,url='http://127.0.0.1:'+port,clients=[],records=[],health=[];let errors=0,healthErrors=0;const loop=monitorEventLoopDelay({resolution:5});loop.enable();let pending=[];
 const tick=setInterval(()=>{const start=performance.now();pending.push(new Promise(resolve=>http.get({host:'127.0.0.1',port,path:'/health',agent:false},res=>{res.resume();res.on('end',()=>{health.push(performance.now()-start);resolve();});}).on('error',()=>{healthErrors++;resolve();})));},50);
 const started=performance.now(),memoryBefore=process.memoryUsage().rss;
 try{
  await Promise.all(Array.from({length:tables},async(_,i)=>{
   const socket=io(url,{transports:['websocket'],forceNew:true,reconnection:false});clients.push(socket);const r={state:null,start:null,completed:null};records.push(r);socket.on('state',state=>{r.state=state;if(r.start&&state.lastTrick&&!r.completed)r.completed=performance.now();});socket.on('gameError',()=>errors++);
   await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
   await emit(socket,'joinGame',{create:true,withBots:true,playerName:'Load '+i,botDifficulty:'hard'});await emit(socket,'chooseContract',{type:'el'});r.socket=socket;
  }));
  const setupMs=performance.now()-started;
  await Promise.all(records.map(async r=>{r.start=performance.now();await emit(r.socket,'playCard',{card:r.state.legal[0]});}));
  const timeout=performance.now()+15000;while(records.some(r=>!r.completed)&&performance.now()<timeout)await delay(50);
  clearInterval(tick);await Promise.all(pending);loop.disable();const times=records.filter(r=>r.completed).map(r=>r.completed-r.start);
  return {tables,clients:clients.length,roomCount:service.rooms.size,testOnlyAdmissionOverride:true,productionAdmission:{total:100,perIp:10},setupMs,completedFirstTricks:times.length,totalMs:performance.now()-started,errors,worker:service.botStats(),firstTrickMs:{p50:q(times,.5),p95:q(times,.95),max:Math.max(...times)},health:{requests:health.length,errors:healthErrors,p95Ms:q(health,.95),p99Ms:q(health,.99)},eventLoop:{p99Ms:loop.percentile(99)/1e6,maxMs:loop.max/1e6},rssIncreaseMiB:(process.memoryUsage().rss-memoryBefore)/1048576,note:'Actual isolated Socket.IO server: one human client and three hard bots per room, production 850 ms bot delay. First trick only; not a long soak or deployed Render measurement.'};
 }finally{clearInterval(tick);loop.disable();clients.forEach(socket=>socket.disconnect());await new Promise(resolve=>service.io.close(resolve));}
}
async function main(){const results=[];for(const tables of [50,100,300]){const r=await run(tables);results.push(r);console.log(JSON.stringify(r));fs.writeFileSync('reports/validation/socket-load.json',JSON.stringify(results,null,2)+'\n');}}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={run};
