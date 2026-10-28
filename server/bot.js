'use strict';
const { groupValue, effective, wild } = require('./rules');

// The planner receives only this bot's hand and public table information.
function keepValue(view, tile) {
  const game = { okey:view.okey };
  if (wild(game,tile)) return 1000;
  const value = effective(game,tile);
  let score = -value.number / 10;
  for (const other of view.tiles) {
    if (other.id === tile.id || wild(game,other)) continue;
    const t = effective(game,other);
    if (t.color === value.color && t.number === value.number) score += view.openType === 'pairs' ? 45 : 4;
    else if (view.openType !== 'pairs') {
      if (t.number === value.number) score += 10;
      if (t.color === value.color && Math.abs(t.number-value.number) === 1) score += 12;
      if (t.color === value.color && Math.abs(t.number-value.number) === 2) score += 5;
    }
  }
  return score;
}

function findGroups(view, pairs = false) {
  const tiles = view.tiles, game = {okey:view.okey};
  if (tiles.length < (pairs ? 3 : 4)) return {groups:[],score:0};
  const candidates = [], seen = new Set();
  function add(indices) {
    const mask = indices.reduce((m,i) => m | (1 << i),0);
    if (seen.has(mask)) return;
    const value = groupValue(game,indices.map(i=>tiles[i]),pairs);
    if (value === null) return;
    seen.add(mask); candidates.push({ mask, score:value, indices });
  }
  function combinations(start, size, indices) {
    if (!size) return add(indices);
    for (let i=start;i<=tiles.length-size;i++) combinations(i+1,size-1,[...indices,i]);
  }
  if (pairs) combinations(0,2,[]);
  else {
    combinations(0,3,[]); combinations(0,4,[]);
    // Longer runs: pick one physical copy for each number, using at most two okeys.
    const jokers = tiles.flatMap((t,i)=>wild(game,t)?[i]:[]);
    for (const color of ['Kirmizi','Yesil','Mavi','Siyah']) {
      for(let start=1;start<=9;start++)for(let end=start+4;end<=13;end++)for(let variant=0;variant<2;variant++){
        const indices=[];let joker=0,valid=true;
        for(let number=start;number<=end;number++){
          const matches=tiles.flatMap((t,i)=>{const e=effective(game,t);return !wild(game,t)&&e.color===color&&e.number===number?[i]:[];});
          if(matches.length)indices.push(matches[variant % matches.length]);
          else if(joker<jokers.length)indices.push(jokers[joker++]);
          else {valid=false;break;}
        }
        if(valid)add(indices);
      }
    }
  }
  // Always reserve one legal final discard. Bounded search keeps shared-server turns cheap.
  const reserved = tiles.map((t,i)=>({i,value:keepValue(view,t)})).sort((a,b)=>a.value-b.value)[0].i;
  const initial = ((1 << tiles.length)-1) & ~(1 << reserved);
  const byTile=tiles.map((_,i)=>candidates.filter(c=>c.mask & (1<<i)));
  const memo=new Map();let visits=0;
  const weight=c=>pairs || view.hasOpened ? c.indices.length*100+c.score : c.score*100+c.indices.length;
  function solve(mask) {
    if(!mask)return {weight:0,chosen:[]};
    if(memo.has(mask))return memo.get(mask);
    if(++visits>6000)return {weight:0,chosen:[]};
    const bit=mask & -mask, index=31-Math.clz32(bit);
    let best=solve(mask ^ bit);
    for(const candidate of byTile[index]){
      if((mask & candidate.mask)!==candidate.mask)continue;
      const tail=solve(mask ^ candidate.mask),total=weight(candidate)+tail.weight;
      if(total>best.weight)best={weight:total,chosen:[candidate,...tail.chosen]};
    }
    memo.set(mask,best);return best;
  }
  const chosen=solve(initial).chosen;
  return {groups:chosen.map(c=>c.indices.map(i=>tiles[i].id)),score:chosen.reduce((sum,c)=>sum+c.score,0)};
}
function chooseDiscard(view) {
  const game={okey:view.okey};
  return [...view.tiles].sort((a,b)=>{
    const value=t=>keepValue(view,t)+(view.penaltyMode && view.openedGroups.some((groups,i)=>view.openTypes[i]!=='pairs'&&groups.some(g=>groupValue(game,[...g,t])!==null))?150:0);
    return value(a)-value(b);
  })[0]?.id;
}
module.exports={ findGroups, chooseDiscard };
