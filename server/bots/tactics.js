'use strict';
const K=require('../king');
const rank=id=>Number(id.slice(1));
function probAny(ids,player,info){let none=1;for(const id of ids)none*=1-(info.probabilities[id]?.[player]||0);return 1-none;}
// All of these decisions use the bot's own hand and public play only.
function equivalentWinner(view){
 if(view.contract==='koz'||view.trick.length!==3||view.legal.length<2)return null;
 const first=view.legal[0],penalty=K.penalty(first,view.contract);
 if(!view.legal.every(id=>id[0]===first[0]&&K.penalty(id,view.contract)===penalty&&K.winner([...view.trick,{player:view.player,card:id}],null)===view.player))return null;
 // Same trick owner and same immediate penalty: spend the highest winner and keep the duck.
 return view.legal.slice().sort((a,b)=>rank(b)-rank(a))[0];
}
function bonus(view,id,info,features){
 const type=view.contract,suit=id[0],r=rank(id),hand=view.hand,trick=view.trick;
 let value=0;
 const firstSuitLead=trick.length>0&&!(view.played||[]).some(x=>x.lead===suit&&x.trick<(view.trickNo||0));
 if(['erkek','kiz'].includes(type)&&firstSuitLead&&!K.penalty(id,type)&&!trick.some(x=>K.penalty(x.card,type))){
  const lead=trick[0]?.card[0]||suit,penaltyRanks=type==='erkek'?[11,13]:[12];
  const protectedSuit=penaltyRanks.every(n=>hand.includes(suit+n)||info.played.has(suit+n));
  const winsNow=K.winner([...trick,{player:view.player,card:id}],null)===view.player;
  if(suit===lead&&protectedSuit&&winsNow&&r>Math.max(...penaltyRanks)){
   const leadCards=info.unseen.filter(c=>c[0]===lead),offPenalties=info.unseen.filter(c=>c[0]!==lead&&K.penalty(c,type));
   let followConfidence=1,knownDiscardRisk=false;
   for(const p of features.remaining){
    if(info.voids[p].has(lead)&&probAny(offPenalties,p,info)>0)knownDiscardRisk=true;
    followConfidence*=offPenalties.length?probAny(leadCards,p,info):1;
   }
   if(!knownDiscardRisk)value+=(r-10)*10*followConfidence;
  }
 }
 if(type==='son'&&(view.trickNo||0)<11){
  // The first eleven tricks are free, including the trick immediately before the last two.
  value+=features.winProbability*12;
 }
 if(type==='kupa'&&view.broken&&!trick.length&&suit==='H'){
  const lowest=hand.filter(c=>c[0]==='H').sort((a,b)=>rank(a)-rank(b))[0];
  if(id===lowest){
   const hearts=info.unseen.filter(c=>c[0]==='H');
   let followers=0;for(let p=0;p<4;p++)if(p!==view.player&&!info.voids[p].has('H'))followers+=probAny(hearts,p,info);
   value+=(1-features.winProbability)*followers*30*.45;
  }
 }
 return value;
}
module.exports={bonus,equivalentWinner};
