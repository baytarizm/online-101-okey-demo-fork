'use strict';
const rules=require('../public/js/game-rules');
function selectedGroups(game,index,groups,pairs=false,values={}) {
 const hand=game.playerTiles[index],used=new Set();
 if(!Array.isArray(groups)||!groups.length||groups.length>11)throw rules.failure('GECERSIZ_PER','Önce geçerli grupları seçin.');
 const chosen=groups.map(ids=>{
  if(!Array.isArray(ids)||ids.length<2||ids.length>13)throw rules.failure('GECERSIZ_PER','Geçersiz grup.');
  return ids.map(id=>{const tile=hand.find(t=>t.id===id);if(!tile||used.has(id))throw rules.failure('GECERSIZ_PER','Taşlar elinizde bulunmalı ve bir kez kullanılmalı.');used.add(id);return tile;});
 });
 if(used.size>=hand.length)throw rules.failure('TAS_SAYISI_YANLIS','Bitirmek için elinizde bir atış taşı kalmalı.');
 const result=chosen.map(g=>rules.meld(game,g,pairs,values));
 if(result.some(g=>!g))throw rules.failure('GECERSIZ_PER',pairs?'Her çift aynı iki taştan oluşmalı.':'Geçersiz seri veya per.');
 return {tiles:result.map(g=>g.tiles),types:result.map(g=>g.type),used,score:result.reduce((s,g)=>s+g.score,0)};
}
module.exports={...rules,selectedGroups};
