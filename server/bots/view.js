'use strict';
const K=require('../king');
// The sole adapter allowed to see a real game. All copies are detached; no opponent cards cross it.
function fromGame(g,player){
 return {player,hand:g.hands[player].slice(),cardCounts:g.hands.map(h=>h.length),
  legal:K.legal(g,player),options:K.options(g).slice(),contract:g.contract,trump:g.trump,
  trick:g.trick.map(x=>({...x})),played:(g.played||[]).map(x=>({...x})),trickNo:g.trickNo,
  broken:g.broken,counts:g.counts.slice(),scores:g.scores.slice(),round:g.round,owner:g.owner,
  history:g.history.map(r=>({...r,counts:r.counts.slice(),points:r.points.slice()}))};
}
module.exports={fromGame};
