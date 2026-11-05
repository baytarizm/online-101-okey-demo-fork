'use strict';
const {Worker}=require('node:worker_threads');const path=require('node:path');const H=require('./heuristic');
class BotRunner{
 constructor(){this.worker=null;this.active=null;this.serial=0;this.closed=false;this.stats={requests:0,search:0,noSamples:0,busy:0,timeout:0,error:0,invalid:0,closed:0};}
 warm(){
  if(this.closed||this.worker)return;
  let worker;try{worker=this.worker=new Worker(path.join(__dirname,'worker.js'));}catch{return;}worker.unref();
  worker.on('message',message=>{if(this.worker===worker&&this.active?.id===message.id)this.finish(message.result?.card||this.active.fallback,message.error?'error':message.result?.samples>0?'search':'noSamples');});
  worker.on('error',()=>{if(this.worker!==worker)return;if(this.active)this.finish(this.active.fallback,'error');this.worker=null;});
  worker.on('exit',()=>{if(this.worker!==worker)return;if(this.active)this.finish(this.active.fallback,'error');this.worker=null;});
 }
 choose(view,options={}){
  this.stats.requests++;const fallback=H.chooseCard(view);if(this.closed){this.stats.closed++;return Promise.resolve(fallback);}
  // One worker per service, no unbounded work queue. Busy tables use the bounded fallback.
  if(this.active){this.stats.busy++;return Promise.resolve(fallback);}
  this.warm();if(!this.worker){this.stats.error++;return Promise.resolve(fallback);}
  return new Promise(resolve=>{
   const id=++this.serial;const timer=setTimeout(()=>{const worker=this.worker;this.worker=null;this.finish(fallback,'timeout');worker?.terminate();},Math.max(10,Math.min(100,Number(options.budgetMs)||35))+120);
   this.active={id,resolve,timer,fallback,legal:view.legal.slice()};try{this.worker.postMessage({id,view,options:{samples:options.samples,budgetMs:options.budgetMs}});}catch{const worker=this.worker;this.worker=null;this.finish(fallback,'error');worker?.terminate();}
  });
 }
 finish(id,reason='search'){const job=this.active;if(!job)return;clearTimeout(job.timer);this.active=null;if(!job.legal.includes(id))reason='invalid';this.stats[reason]++;job.resolve(job.legal.includes(id)?id:job.fallback);}
 close(){this.closed=true;if(this.active)this.finish(this.active.fallback,'closed');this.worker?.terminate();this.worker=null;}
}
module.exports={BotRunner};
