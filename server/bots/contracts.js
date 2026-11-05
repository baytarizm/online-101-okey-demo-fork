'use strict';
const K=require('../king');
const rank=id=>Number(id.slice(1)),bound=(x,a,b)=>Math.min(b,Math.max(a,x));
function structure(hand){
 const suits=Object.fromEntries(K.SUITS.map(s=>[s,hand.filter(c=>c[0]===s).sort((a,b)=>rank(b)-rank(a))]));
 const controls=K.SUITS.reduce((n,s)=>n+suits[s].reduce((m,id,i)=>m+(rank(id)===14?1:rank(id)===13?(suits[s].some(c=>rank(c)===14)?.9:.6):rank(id)===12?.35:rank(id)===11?.15:0),0),0);
 return {suits,controls,voids:K.SUITS.filter(s=>!suits[s].length).length,short:K.SUITS.filter(s=>suits[s].length<=1).length,low:hand.filter(id=>rank(id)<=6).length};
}
function evaluateContracts(view){
 const hand=view.hand,{suits,controls,short,low}=structure(hand),hearts=suits.H;
 const ntTricks=bound(controls+.4-short*.3,0,10),share=ntTricks/13;
 const ownQ=hand.filter(c=>rank(c)===12).length,ownMale=hand.filter(c=>[11,13].includes(rank(c))).length;
 const heartDanger=hearts.reduce((n,id)=>n+Math.max(0,rank(id)-10)/4,0);
 const king=hand.includes('H13'),ace=hand.includes('H14');
 const riskKing=king?bound(.7-(hearts.length-2)*.12+Number(ace)*.07, .10,.96):bound(.10+Number(ace)*.25-heartDanger*.02-short*.035,.01,.55);
 const lowReserve=hand.map(rank).sort((a,b)=>a-b).slice(0,3).reduce((a,b)=>a+b,0)/3;
 const expected={el:-50*ntTricks,kupa:-30*bound(13*share*.75+heartDanger*.7-short*.35,0,13),kiz:-100*bound(4*share*.75+ownQ*.25-short*.12,0,4),erkek:-60*bound(8*share*.8+ownMale*.32-short*.2,0,8),rifki:-320*riskKing,son:-360*bound(.08+(lowReserve-3)*.035+(controls-3)*.02-low*.012,.01,.8)};
 const owned=view.history.filter(r=>r.owner===view.player),remainingTrump=2-owned.filter(r=>r.type==='koz').length,remainingSelections=5-owned.length;
 const leader=view.scores.indexOf(Math.max(...view.scores)),behind=Math.max(...view.scores)-view.scores[view.player],late=(view.round||0)/20;
 const rows=[];
 for(const type of view.options){
  for(const trump of type==='koz'?K.SUITS:[null]){
   let estimate=expected[type];
   if(type==='koz'){
    const cards=suits[trump],trumpControls=cards.reduce((n,c)=>n+(rank(c)>=12?1:rank(c)>=10?.7:.4),0);
    const outside=controls-cards.reduce((n,c)=>n+(rank(c)===14?1:rank(c)===13?.6:rank(c)===12?.35:rank(c)===11?.15:0),0);
    estimate=50*bound(trumpControls+Math.max(0,cards.length-3)*.6+outside*.65,0,13);
   }
   const fair=K.TYPES[type].rate*K.TYPES[type].total/4;
   let utility=estimate-fair;
   // Spend a trump right only when this hand beats its future opportunity, unless rights force it.
   if(type==='koz')utility-=Math.max(0,remainingSelections-remainingTrump)*7;
   // Under the existing >=0 win rule, protect a late positive score; chase upside if far behind.
   const volatility=type==='rifki'?100:type==='son'?65:type==='koz'?45:25;
   utility+=late*(view.scores[view.player]>=0?-volatility*.12:behind>250?volatility*.12:0);
   // Own low penalties allow the current leader to absorb a larger share of the fixed negative pool.
   if(type!=='koz'&&leader!==view.player&&behind>0)utility+=late*Math.max(0,estimate-fair)*.04;
   rows.push({type,trump,expectedScore:estimate,utility,remainingTrump,remainingSelections});
  }
 }
 return rows.sort((a,b)=>b.utility-a.utility);
}
function chooseContract(view){const best=evaluateContracts(view)[0];if(!best)throw Error('Bot için geçerli oyun seçimi yok.');return {type:best.type,trump:best.trump};}
module.exports={structure,evaluateContracts,chooseContract};
