'use strict';
const {rng}=require('./bot-arena');
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
function interval(values,{confidence=.95,resamples=2000,seed=19283}={}){
 if(!values.length)throw Error('Empty sample');const random=rng(seed),draws=[];
 for(let b=0;b<resamples;b++){let total=0;for(let i=0;i<values.length;i++)total+=values[Math.floor(random()*values.length)];draws.push(total/values.length);}
 draws.sort((a,b)=>a-b);const alpha=(1-confidence)/2;
 return {n:values.length,mean:mean(values),confidence,ci:[draws[Math.floor(alpha*resamples)],draws[Math.min(resamples-1,Math.floor((1-alpha)*resamples))]]};
}
function placement(scores,seat){const score=scores[seat],max=Math.max(...scores),ties=scores.filter(n=>n===max).length;return {nonnegative:Number(score>=0),firstShare:score===max?1/ties:0,soleFirst:Number(score===max&&ties===1),rank:1+scores.filter(n=>n>score).length+(scores.filter(n=>n===score).length-1)/2};}
module.exports={mean,interval,placement};
