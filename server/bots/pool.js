'use strict';
const {BotRunner}=require('./runner');
class BotPool{
 constructor({size=1}={}){const n=Number(size);this.size=Number.isFinite(n)?Math.max(1,Math.min(2,Math.floor(n))):1;this.runners=Array.from({length:this.size},()=>new BotRunner());}
 warm(){this.runners.forEach(r=>r.warm());}
 choose(view,options){return (this.runners.find(r=>!r.active)||this.runners[0]).choose(view,options);}
 get stats(){const totals={};for(const r of this.runners)for(const [key,value]of Object.entries(r.stats))totals[key]=(totals[key]||0)+value;return totals;}
 close(){this.runners.forEach(r=>r.close());}
}
module.exports={BotPool};
