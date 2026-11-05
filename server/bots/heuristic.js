'use strict';
const K=require('../king');const Legacy=require('./legacy');const {knowledge}=require('./information');
const rank=id=>Number(id.slice(1));const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
function probAny(ids,p,info){let none=1;for(const id of ids)none*=1-(info.probabilities[id]?.[p]||0);return 1-none;}
function riskFeatures(view,id,info){
 const player=view.player,trick=[...(view.trick||[]),{player,card:id}],lead=trick[0].card[0],type=view.contract,trump=view.trump;
 const remaining=Array.from({length:4-trick.length},(_,i)=>(player+i+1)%4),winsNow=K.winner(trick,trump)===player;
 let winProbability=Number(winsNow),futurePenalty=0,penaltyChance=0;
 const leadCards=info.unseen.filter(c=>c[0]===lead),penalties=info.unseen.filter(c=>K.penalty(c,type));
 for(const p of remaining){
  const hasLead=1-(info.voids[p].has(lead)?1:1-probAny(leadCards,p,info));
  const higher=info.unseen.filter(c=>c[0]===id[0]&&rank(c)>rank(id));
  let beats=probAny(higher,p,info);
  // In penalty games a player ducks when a lower follow card exists. Possessing an ace
  // does not mean they will spend it to rescue our king from taking the trick.
  if(type!=='koz'){const lower=info.unseen.filter(c=>c[0]===lead&&rank(c)<rank(id));beats*=1-probAny(lower,p,info);}
  if(type==='koz'&&id[0]!==trump)beats=clamp(beats+(1-hasLead)*probAny(info.unseen.filter(c=>c[0]===trump),p,info));
  winProbability*=1-beats;
  // A void player must discard a penalty when possible; following suit can also expose one.
  const leadPenalties=penalties.filter(c=>c[0]===lead),offPenalties=penalties.filter(c=>c[0]!==lead);
  const chance=hasLead*probAny(leadPenalties,p,info)/Math.max(1,leadCards.length/4)+(1-hasLead)*probAny(offPenalties,p,info);
  futurePenalty+=chance*Math.abs(K.TYPES[type].rate);penaltyChance=1-(1-penaltyChance)*(1-chance);
 }
 const visible=trick.filter(x=>K.penalty(x.card,type)).length*Math.abs(K.TYPES[type].rate);
 if(visible)penaltyChance=1;
 let cost=visible+futurePenalty;
 if(type==='el'){cost=50;penaltyChance=1;}
 if(type==='son'){cost=(view.trickNo||0)>=11?180:0;penaltyChance=cost?1:0;}
 return {winProbability:clamp(winProbability),penaltyProbability:penaltyChance,penaltyValue:penaltyChance?cost/penaltyChance:0,expectedPenalty:winProbability*penaltyChance*(penaltyChance?cost/penaltyChance:0),remaining};
}
function rankCards(view,{info=knowledge(view)}={}){
 const hand=view.hand,type=view.contract,trump=view.trump,n=hand.length,played=view.played||[];
 const unseen=info.unseen;
 return view.legal.map(id=>{
  const features=riskFeatures(view,id,info),r=rank(id),suit=id[0],length=hand.filter(c=>c[0]===suit).length;
  const higher=unseen.filter(c=>c[0]===suit&&rank(c)>r).length;
  const danger=clamp((r-5)/9)*clamp(1-higher/9),safe=1-features.winProbability;
  let utility;
  if(type==='koz'){
   const top=unseen.filter(c=>c[0]===trump),ours=hand.filter(c=>c[0]===trump).length;
   utility=features.winProbability*50;
   // Do not waste a high winner when a lower card already wins the trick.
   utility-=features.winProbability*(r-2)*.9;
   if(view.trick.length){const winsNow=K.winner([...view.trick,{player:view.player,card:id}],trump)===view.player;utility+=winsNow?35:0;}
   if(!view.trick.length){
    utility+=suit===trump&&ours>=top.length/3&&higher===0?14:0;
    utility+=suit!==trump?length*2+clamp((r-10)/4)*6:0;
    if(suit===trump&&ours<top.length/3&&higher>0)utility-=9;
   }else if(!features.winProbability)utility-=suit===trump?8+r:0;
  }else{
   utility=-features.expectedPenalty;
   // Void creation and high-card shedding matter only when this is a relatively safe trick.
   utility+=danger*(type==='el'?27:type==='son'?((view.trickNo||0)<10?50:12):18)*(safe+.15);
   if(K.penalty(id,type))utility+=safe*(type==='rifki'?270:Math.abs(K.TYPES[type].rate)*.85);
   if(!view.trick.length&&length===1&&suit!=='H')utility+=4*safe;
   if(type==='son'&&(view.trickNo||0)<10){utility+=r*1.4;utility-=r<=6?8:0;}
   if(type==='el'&&view.trick.length===3&&features.expectedPenalty===0)utility+=r;
   if(type==='rifki'){
    const hearts=hand.filter(c=>c[0]==='H').length;
    if(hand.includes('H13')){
     if(id==='H13')utility+=safe*(hearts<=3?35:15);
     else if(suit==='H'&&r<13)utility-=hearts<=3?22:5; // retain low heart covers for a short king
     else if(suit!=='H'&&length===1)utility+=8*safe;
    }else if(!played.some(x=>x.card==='H13')&&!view.trick.length){
     const target=info.probabilities.H13||[];
     const leader=(view.scores||[0,0,0,0]).indexOf(Math.max(...(view.scores||[0,0,0,0])));
     let pressure=0;for(let p=0;p<4;p++)if(p!==view.player&&info.voids[p].has(suit))pressure+=(target[p]||0)*(p===leader?1.1:1);
     utility+=pressure*25*safe;
     if(suit==='H'&&r<13)utility+=7*safe;
    }
   }
  }
  return {card:id,utility,...features};
 }).sort((a,b)=>b.utility-a.utility||view.legal.indexOf(a.card)-view.legal.indexOf(b.card));
}
function chooseCard(view){
 if(view.legal.length===1)return view.legal[0];
 if(view.contract==='koz'){
  // Do not sacrifice a currently winning follow card merely because later players might beat it.
  if(view.trick.length)return Legacy.chooseCard(view);
  const info=knowledge(view),masters=view.legal.filter(id=>!info.unseen.some(c=>c[0]===id[0]&&rank(c)>rank(id)));
  const ownTrumps=view.hand.filter(c=>c[0]===view.trump).length,remainingTrumps=info.unseen.filter(c=>c[0]===view.trump).length;
  const masterTrump=masters.find(c=>c[0]===view.trump);
  if(masterTrump&&ownTrumps>=remainingTrumps/3)return masterTrump;
  const side=masters.filter(c=>c[0]!==view.trump&&!info.voids.some((v,p)=>p!==view.player&&v.has(c[0])&&probAny(info.unseen.filter(x=>x[0]===view.trump),p,info)>0));
  if(side.length)return side.sort((a,b)=>view.hand.filter(c=>c[0]===b[0]).length-view.hand.filter(c=>c[0]===a[0]).length)[0];
  return Legacy.chooseCard(view);
 }
 return rankCards(view)[0]?.card;
}
module.exports={rankCards,chooseCard,riskFeatures};
