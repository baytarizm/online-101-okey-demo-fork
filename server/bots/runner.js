'use strict';
const {Worker}=require('node:worker_threads');const path=require('node:path');const H=require('./heuristic');
class BotRunner{
 constructor(){this.worker=null;this.active=null;this.serial=0;this.closed=false;}
 choose(view,options={}){
  const fallback=H.chooseCard(view);if(this.closed)return Promise.resolve(fallback);
  // One worker per service, no unbounded work queue. Busy tables use the bounded fallback.
  if(this.active)return Promise.resolve(fallback);
  if(!this.worker){
   const worker=this.worker=new Worker(path.join(__dirname,'worker.js'));worker.unref();
   worker.on('message',message=>{if(this.active?.id===message.id)this.finish(message.result?.card||this.active.fallback);});
   worker.on('error',()=>{if(this.worker!==worker)return;if(this.active)this.finish(this.active.fallback);this.worker=null;});
   worker.on('exit',()=>{if(this.worker!==worker)return;if(this.active)this.finish(this.active.fallback);this.worker=null;});
  }
  return new Promise(resolve=>{
   const id=++this.serial;const timer=setTimeout(()=>{const worker=this.worker;this.worker=null;this.finish(fallback);worker?.terminate();},Math.max(10,Math.min(100,Number(options.budgetMs)||35))+120);
   this.active={id,resolve,timer,fallback,legal:view.legal.slice()};this.worker.postMessage({id,view,options:{samples:options.samples,budgetMs:options.budgetMs}});
  });
 }
 finish(id){const job=this.active;if(!job)return;clearTimeout(job.timer);this.active=null;job.resolve(job.legal.includes(id)?id:job.fallback);}
 close(){this.closed=true;if(this.active)this.finish(this.active.fallback);this.worker?.terminate();this.worker=null;}
}
module.exports={BotRunner};
