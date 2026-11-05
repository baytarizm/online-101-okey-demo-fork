'use strict';
const K=require('../king');
function knowledge(view,{limited=false}={}){
 const played=view.played||[],seen=new Set(played.map(x=>x.card));
 for(const x of view.trick||[])seen.add(x.card);
 const own=new Set(view.hand),voids=Array.from({length:4},()=>new Set());
 if(!limited)for(const x of played)if(x.lead&&x.card[0]!==x.lead)voids[x.player].add(x.lead);
 // Current public trick also works for callers that have not yet appended their event log.
 const lead=view.trick?.[0]?.card[0];if(!limited&&lead)for(const x of view.trick)if(x.card[0]!==lead)voids[x.player].add(lead);
 const unseen=K.deck().filter(id=>!own.has(id)&&!seen.has(id)),counts=view.cardCounts?.slice()||Array.from({length:4},(_,p)=>p===view.player?view.hand.length:13-played.filter(x=>x.player===p).length-(view.trick||[]).filter(x=>x.player===p&&!played.some(y=>y.card===x.card)).length);
 const probabilities={};
 for(const id of unseen){const weights=counts.map((n,p)=>p===view.player||voids[p].has(id[0])?0:n);const total=weights.reduce((a,b)=>a+b,0);probabilities[id]=weights.map(n=>total?n/total:0);}
 // Iterative proportional fitting: exact zero constraints, normalized card rows and capacity margins.
 // These are approximate marginals, not an exact Bayesian posterior over equally likely deals.
 if(counts.reduce((n,c,p)=>n+(p===view.player?0:c),0)===unseen.length){
  for(let iteration=0;iteration<120;iteration++){
   const sums=[0,0,0,0];for(const row of Object.values(probabilities))row.forEach((n,p)=>sums[p]+=n);
   for(const row of Object.values(probabilities)){for(let p=0;p<4;p++)if(sums[p])row[p]*=counts[p]/sums[p];const total=row.reduce((a,b)=>a+b,0);if(total)for(let p=0;p<4;p++)row[p]/=total;}
   if(sums.every((n,p)=>p===view.player||Math.abs(n-counts[p])<1e-7))break;
  }
 }
 return {played:seen,voids,unseen,counts,probabilities};
}
module.exports={knowledge};
