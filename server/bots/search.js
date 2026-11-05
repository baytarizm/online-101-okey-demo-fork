'use strict';
const {performance}=require('node:perf_hooks');const K=require('../king');const Legacy=require('./legacy');const H=require('./heuristic');const {knowledge}=require('./information');
function shuffled(values,random){const a=values.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function determinize(view,info,random=Math.random){
 const slots=[];for(let p=0;p<4;p++)if(p!==view.player)for(let i=0;i<info.counts[p];i++)slots.push(p);
 if(slots.length!==info.unseen.length)return null;
 const order=shuffled(info.unseen,random),slotOrder=shuffled(slots.map((_,i)=>i),random),occupants=Array(slots.length).fill(null);
 // Randomized bipartite matching: capacities and all proven voids are hard constraints.
 // Matching is not uniform over valid deals; Monte Carlo estimates are approximate.
 function place(id,visited){for(const index of slotOrder){if(visited.has(index)||info.voids[slots[index]].has(id[0]))continue;visited.add(index);if(occupants[index]===null||place(occupants[index],visited)){occupants[index]=id;return true;}}return false;}
 for(const id of order)if(!place(id,new Set()))return null;
 const hands=Array.from({length:4},()=>[]);hands[view.player]=view.hand.slice();occupants.forEach((id,i)=>hands[slots[i]].push(id));return hands;
}
function simulation(view,hands){return {hands:hands.map(h=>h.slice()),phase:'playing',current:view.player,owner:view.owner,contract:view.contract,trump:view.trump,
 trick:view.trick.map(x=>({...x})),trickNo:view.trickNo||0,broken:!!view.broken,counts:(view.counts||[0,0,0,0]).slice(),scores:[0,0,0,0],history:[],round:0,played:[]};}
function rollout(view,hands,id,deadline,now){const g=simulation(view,hands);K.play(g,view.player,id);let moves=0;
 while(g.phase==='playing'||g.phase==='trick'){
  if(++moves%8===0&&now()>=deadline)return null;
  if(g.phase==='trick'){K.advance(g);continue;}
  const p=g.current,legal=K.legal(g,p);
  // Simulated players see only their simulated hand and the public simulated trick.
  const candidate=Legacy.chooseCard({player:p,hand:g.hands[p],legal,trick:g.trick,contract:g.contract,trump:g.trump});K.play(g,p,candidate);
 }
 return g.scores;
}
function search(view,{samples=24,budgetMs=35,random=Math.random,now=()=>performance.now()}={}){
 const start=now(),deadline=start+Math.max(0,Math.min(100,Number(budgetMs)||0));
 const info=knowledge(view),ranked=H.rankCards(view,{info}),fallback=ranked[0]?.card;
 const maxSamples=Math.max(0,Math.min(256,Math.floor(Number(samples)||0))),totals=new Map(view.legal.map(id=>[id,0]));let completed=0,attempted=0;
 const leader=(view.scores||[0,0,0,0]).indexOf(Math.max(...(view.scores||[0,0,0,0])));
 for(let sample=0;sample<maxSamples&&now()<deadline;sample++){
  attempted++;const hands=determinize(view,info,random);if(!hands)break;
  const scores=[];let complete=true;
  // All candidate cards share a hidden deal; incomplete batches are discarded to avoid unequal sampling.
  for(const id of shuffled(view.legal,random)){
   if(now()>=deadline){complete=false;break;}
   const points=rollout(view,hands,id,deadline,now);if(!points){complete=false;break;}
   scores.push([id,points[view.player]-(leader!==view.player?points[leader]*.04:0)]);
  }
  if(!complete)break;completed++;for(const [id,score] of scores)totals.set(id,totals.get(id)+score);
 }
 const candidates=ranked.map(r=>({...r,meanScore:completed?totals.get(r.card)/completed:null,searchUtility:completed?totals.get(r.card)/completed+r.utility*.20:r.utility})).sort((a,b)=>b.searchUtility-a.searchUtility);
 return {card:completed?candidates[0].card:fallback,samples:completed,attempted,candidates,elapsedMs:now()-start};
}
module.exports={determinize,simulation,rollout,search};
