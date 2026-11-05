'use strict';
const fs=require('node:fs');const {performance,monitorEventLoopDelay}=require('node:perf_hooks');const http=require('node:http');const {BotPool}=require('../server/bots/pool');const {createGameServer}=require('../server');const K=require('../server/king');const {fromGame}=require('../server/bots/view');const {seededHands}=require('./bot-arena');
const {HealthProbe}=require('./bot-health-probe');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const quantile=(values,p)=>{const a=values.slice().sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor(a.length*p))]||0;};
function positions(n){return Array.from({length:n},(_,i)=>{const g=K.create();g.hands=seededHands(910001+i);g.contract=['el','kupa','kiz','erkek','son','koz'][i%6];g.trump=g.contract==='koz'?'S':null;g.phase='playing';return fromGame(g,0);});}
async function scenario({tables,poolSize,mode,durationMs=10000,turnSpacingMs=3000}){
 const views=positions(tables),pool=new BotPool({size:poolSize});pool.warm();await sleep(300);
 const service=createGameServer();await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));const port=service.server.address().port,latencies=[],health=[],jobs=[];let illegal=0,healthErrors=0;
 const loop=monitorEventLoopDelay({resolution:5});loop.enable();const start=performance.now();
 const probe=new HealthProbe();await probe.start(port);
 function submit(view){const begin=performance.now();const job=pool.choose(view,{samples:24,budgetMs:35}).then(id=>{latencies.push(performance.now()-begin);if(!view.legal.includes(id))illegal++;});jobs.push(job);}
 try{
  if(mode==='burst'){for(const view of views)submit(view);await Promise.all(jobs);await sleep(50);}
  else{let index=0;const gap=turnSpacingMs/tables;while(performance.now()-start<durationMs){const due=index*gap;if(due>performance.now()-start)await sleep(due-(performance.now()-start));submit(views[index++%tables]);}await Promise.all(jobs);}
  const probed=await probe.stop();health.push(...probed.times);healthErrors=probed.errors;loop.disable();const totals=pool.stats;
  return {tables,poolSize,mode,durationMs:performance.now()-start,offeredDecisionsPerSecond:mode==='staggered'?tables*1000/turnSpacingMs:null,requests:totals.requests,stats:totals,searchFraction:totals.search/totals.requests,fallbackFraction:1-totals.search/totals.requests,illegal,moveMs:{p50:quantile(latencies,.5),p95:quantile(latencies,.95),p99:quantile(latencies,.99),max:Math.max(...latencies)},health:{requests:health.length,errors:healthErrors,p95Ms:quantile(health,.95),p99Ms:quantile(health,.99)},eventLoop:{p99Ms:loop.percentile(99)/1e6,maxMs:loop.max/1e6},note:'Virtual public observations through the production BotRunner; isolated real HTTP health endpoint probed from a separate process. Not 300 accepted rooms or a Render capacity guarantee.'};
 }finally{await probe.stop().catch(()=>{});loop.disable();pool.close();await new Promise(resolve=>service.io.close(resolve));}
}
async function run(directory='reports/validation'){const results=[];for(const poolSize of [1,2])for(const tables of [50,100,300])for(const mode of ['burst','staggered']){const result=await scenario({poolSize,tables,mode});results.push(result);console.log(JSON.stringify(result));fs.writeFileSync(directory+'/load.json',JSON.stringify({admissionLimits:{globalTables:100,perIpTables:10},results},null,2)+'\n');}return results;}
if(require.main===module)run(process.argv[2]).catch(error=>{console.error(error);process.exitCode=1;});module.exports={scenario};
