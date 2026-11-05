'use strict';
// Frozen pre-upgrade policy for reproducible comparisons; own hand and public data only.
const {SUITS,card,winner,penalty}=require('../king');
function chooseContract(view){
 const g={...view,hands:{[view.player]:view.hand}},p=view.player;
 const opts=view.options,h=g.hands[p],strength=s=>h.filter(id=>id[0]===s).reduce((n,id)=>n+Math.max(0,card(id).rank-9),0)+h.filter(id=>id[0]===s).length*2;
 const trump=SUITS.slice().sort((a,b)=>strength(b)-strength(a))[0];
 if(opts.includes('koz')&&(strength(trump)>=15||opts.length===1))return {type:'koz',trump};
 const risk=t=>h.reduce((n,id)=>n+(penalty(id,t)?card(id).rank:0)+Math.max(0,card(id).rank-10)*(t==='el'||t==='son'?3:0),0)+(t==='rifki'&&h.includes('H13')?50:0);
 const penalties=opts.filter(t=>t!=='koz');return {type:penalties.sort((a,b)=>risk(a)-risk(b))[0]||'koz',trump};
}
// The bot receives only its own hand and public trick/history, never opponents' hands.
function chooseCard(view){
 const ids=view.legal.slice(),type=view.contract;
 if(!view.trick.length)return ids.sort((a,b)=>type==='koz'?card(b).rank-card(a).rank:card(a).rank-card(b).rank)[0];
 const wins=id=>winner([...view.trick,{player:view.player,card:id}],view.trump)===view.player;
 if(type==='koz'){const winning=ids.filter(wins);return (winning.length?winning:ids).sort((a,b)=>card(a).rank-card(b).rank)[0];}
 const safe=ids.filter(id=>!wins(id));return (safe.length?safe:ids).sort((a,b)=>safe.length?(Number(penalty(b,type))-Number(penalty(a,type))||card(b).rank-card(a).rank):card(a).rank-card(b).rank)[0];
}

module.exports={chooseContract,chooseCard};
