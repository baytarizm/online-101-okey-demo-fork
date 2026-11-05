'use strict';
const crypto = require('node:crypto');
const SUITS=['S','H','D','C'];
const TYPES={el:{name:'El Almaz',rate:-50,total:13},kupa:{name:'Kupa Almaz',rate:-30,total:13},kiz:{name:'Kız Almaz',rate:-100,total:4},erkek:{name:'Erkek Almaz',rate:-60,total:8},rifki:{name:'Rıfkı',rate:-320,total:1},son:{name:'Son İki',rate:-180,total:2},koz:{name:'Koz',rate:50,total:13}};
const card=id=>({id,suit:id[0],rank:Number(id.slice(1))});
const deck=()=>SUITS.flatMap(s=>Array.from({length:13},(_,i)=>s+(i+2)));
function deal(g){
 const cards=deck();for(let i=51;i>0;i--){const j=crypto.randomInt(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}
 g.hands=Array.from({length:4},(_,i)=>cards.slice(i*13,i*13+13).sort((a,b)=>SUITS.indexOf(a[0])-SUITS.indexOf(b[0])||card(a).rank-card(b).rank));
 g.owner=g.round%4;g.current=g.owner;g.contract=null;g.trump=null;g.trick=[];g.lastTrick=null;g.trickNo=0;g.broken=false;g.counts=[0,0,0,0];g.phase='choosing';g.played=[];
}
function create(){const g={round:0,history:[],scores:[0,0,0,0]};deal(g);return g;}
function options(g){if(g.phase!=='choosing')return [];const owned=g.history.filter(r=>r.owner===g.owner);return Object.keys(TYPES).filter(t=>t==='koz'?g.round>=4&&owned.filter(r=>r.type==='koz').length<2:owned.filter(r=>r.type!=='koz').length<3&&g.history.filter(r=>r.type===t).length<2);}
function choose(g,p,type,trump){
 if(g.phase!=='choosing'||p!==g.owner||!options(g).includes(type))throw Error('Bu oyunu seçemezsiniz. İlk seçim ceza olmalı.');
 if(type==='koz'&&!SUITS.includes(trump))throw Error('Geçerli bir koz seçin.');
 // Rıfkı veya kupa ası tek kupaysa aynı oyuncu için yeniden dağıtılır.
 if(type==='rifki'){let tries=0;while(g.hands.some(h=>{const hearts=h.filter(c=>c[0]==='H');return hearts.length===1&&['H13','H14'].includes(hearts[0]);})&&tries++<200)deal(g);}
 g.contract=type;g.trump=type==='koz'?trump:null;g.phase='playing';
}
function penalty(id,type){const c=card(id);return type==='kupa'?c.suit==='H':type==='kiz'?c.rank===12:type==='erkek'?[11,13].includes(c.rank):type==='rifki'?id==='H13':false;}
function winner(trick,trump){let best=trick[0];for(const x of trick.slice(1)){const c=card(x.card),b=card(best.card);if(c.suit===b.suit&&c.rank>b.rank||c.suit===trump&&b.suit!==trump)best=x;}return best.player;}
function legal(g,p){
 if(g.phase!=='playing'||p!==g.current)return [];
 const hand=g.hands[p],type=g.contract;
 if(!g.trick.length){const blocked=type==='koz'?g.trump:['kupa','rifki'].includes(type)?'H':null;const others=hand.filter(id=>id[0]!==blocked);return blocked&&!g.broken&&others.length?others:hand.slice();}
 const lead=g.trick[0].card[0],follow=hand.filter(id=>id[0]===lead);
 if(follow.length){
  const highest=Math.max(...g.trick.filter(x=>x.card[0]===lead).map(x=>card(x.card).rank));
  if(type==='koz'&&lead===g.trump){const higher=follow.filter(id=>card(id).rank>highest);if(higher.length)return higher;}
  const forced=follow.filter(id=>penalty(id,type)&&card(id).rank<highest);return forced.length?forced:follow;
 }
 if(type==='koz'){
  const trumps=hand.filter(id=>id[0]===g.trump);if(!trumps.length)return hand.slice();
  const highest=Math.max(0,...g.trick.filter(x=>x.card[0]===g.trump).map(x=>card(x.card).rank));const higher=trumps.filter(id=>card(id).rank>highest);return higher.length?higher:trumps;
 }
 if(type==='rifki'){if(hand.includes('H13'))return ['H13'];const hearts=hand.filter(id=>id[0]==='H');if(hearts.length)return hearts;}
 const forced=hand.filter(id=>penalty(id,type));return forced.length?forced:hand.slice();
}
function play(g,p,id){
 if(!legal(g,p).includes(id))throw Error('Bu kart oynanamaz. Renk ve zorunlu kart kuralını izleyin.');
 g.played ||= [];g.played.push({player:p,card:id,lead:g.trick[0]?.card[0]||id[0],trick:g.trickNo});
 g.hands[p].splice(g.hands[p].indexOf(id),1);g.trick.push({player:p,card:id});
 if(id[0]===(g.contract==='koz'?g.trump:'H'))g.broken=true;
 if(g.trick.length<4){g.current=(p+1)%4;return;}
 const w=winner(g.trick,g.trump);g.trickNo++;
 let count=['el','koz'].includes(g.contract)?1:g.contract==='son'?(g.trickNo>=12?1:0):g.trick.filter(x=>penalty(x.card,g.contract)).length;
 g.counts[w]+=count;g.lastTrick={cards:g.trick.slice(),winner:w,number:g.trickNo};g.phase='trick';g.current=w;
}
function advance(g){
 if(g.phase!=='trick')throw Error('El henüz bitmedi.');
 const done=g.trickNo===13||g.counts.reduce((a,b)=>a+b,0)===TYPES[g.contract].total;
 g.trick=[];
 if(!done){g.phase='playing';return;}
 const points=g.counts.map(n=>n*TYPES[g.contract].rate);points.forEach((n,i)=>g.scores[i]+=n);
 g.history.push({owner:g.owner,type:g.contract,suit:g.trump,counts:g.counts.slice(),points});g.round++;
 g.phase=g.round===20?'finished':'roundEnd';
}
function next(g){if(g.phase!=='roundEnd')throw Error('Yeni oyuna geçilemez.');deal(g);}
function botChoice(g,p){return require('./bots').chooseContract(require('./bots/view').fromGame(g,p));}
function botCard(view){return require('./bots').chooseCard(view);}
module.exports={TYPES,SUITS,card,deck,create,deal,choose,options,legal,play,advance,next,winner,penalty,botChoice,botCard};
