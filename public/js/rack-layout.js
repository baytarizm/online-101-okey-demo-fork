/* Shared by the browser and the layout tests. Sorting never opens a hand. */
(function(root) {
  'use strict';
  function orderMeld(tiles,okey) {
    const wild=t=>!t.isFakeJoker && t.color===okey.color && t.number===okey.number;
    const value=t=>t.isFakeJoker?okey:t;
    const normal=tiles.filter(t=>!wild(t)),jokers=tiles.filter(wild);
    if(tiles.length<3 || !normal.length || normal.every(t=>value(t).number===value(normal[0]).number))
      return [...normal.sort((a,b)=>value(a).color.localeCompare(value(b).color)),...jokers];
    for(let start=14-tiles.length;start>=1;start--)if(normal.every(t=>value(t).number>=start && value(t).number<start+tiles.length)){
      const remaining=[...jokers];return Array.from({length:tiles.length},(_,i)=>normal.find(t=>value(t).number===start+i)||remaining.shift());
    }
    return tiles;
  }
  function arrange(tiles, okey, pairs = false) {
    const wild = t => !t.isFakeJoker && t.color===okey.color && t.number===okey.number;
    const value = t => t.isFakeJoker ? okey : t;
    const candidates=[];
    function add(indices) {
      const normal=indices.map(i=>tiles[i]).filter(t=>!wild(t)).map(value);
      let valid=false;
      if(pairs) valid=normal.length<2 || normal.every(t=>t.color===normal[0].color && t.number===normal[0].number);
      else if(normal.length) {
        valid=indices.length<=4 && normal.every(t=>t.number===normal[0].number) && new Set(normal.map(t=>t.color)).size===normal.length;
        if(!valid && normal.every(t=>t.color===normal[0].color) && new Set(normal.map(t=>t.number)).size===normal.length)
          valid=Math.max(...normal.map(t=>t.number))-Math.min(...normal.map(t=>t.number))<indices.length;
      }
      if(valid)candidates.push({indices,mask:indices.reduce((m,i)=>m|(1<<i),0)});
    }
    function combos(start,size,indices=[]) {
      if(!size)return add(indices);
      for(let i=start;i<=tiles.length-size;i++)combos(i+1,size-1,[...indices,i]);
    }
    if(pairs)combos(0,2);
    else {
      combos(0,3);combos(0,4);
      // Enumerate long runs without an exponential combination scan.
      const jokers=tiles.flatMap((t,i)=>wild(t)?[i]:[]);
      for(const color of ['Kirmizi','Yesil','Mavi','Siyah'])for(let start=1;start<=9;start++)for(let end=start+4;end<=13;end++)for(let copy=0;copy<2;copy++){
        const indices=[];let j=0;
        for(let n=start;n<=end;n++){
          const matches=tiles.flatMap((t,i)=>!wild(t)&&value(t).color===color&&value(t).number===n?[i]:[]);
          if(matches.length)indices.push(matches[copy%matches.length]);else if(j<jokers.length)indices.push(jokers[j++]);else break;
        }
        if(indices.length===end-start+1)add(indices);
      }
    }
    const byTile=tiles.map((_,i)=>candidates.filter(c=>c.mask&(1<<i))),memo=new Map();let visits=0;
    function solve(mask) {
      if(!mask || ++visits>12000)return {count:0,groups:[]};
      if(memo.has(mask))return memo.get(mask);
      const bit=mask&-mask,index=31-Math.clz32(bit);let best=solve(mask^bit);
      for(const c of byTile[index])if((mask&c.mask)===c.mask){
        const tail=solve(mask^c.mask),count=tail.count+c.indices.length;
        if(count>best.count)best={count,groups:[c.indices,...tail.groups]};
      }
      memo.set(mask,best);return best;
    }
    const chosen=solve((1<<tiles.length)-1).groups;
    const used=new Set(chosen.flat());
    const compare=(a,b)=>value(a).color.localeCompare(value(b).color)||value(a).number-value(b).number;
    const groups=chosen.map(indices=>orderMeld(indices.map(i=>tiles[i]),okey).map(t=>t.id));
    const loose=tiles.filter((_,i)=>!used.has(i)).sort(compare).map(t=>t.id);
    return {groups,loose};
  }
  function positions(groups, loose) {
    // One empty cell separates each meld. A meld never straddles the two shelves.
    const rows=[[],[]];
    let shelf=0;
    for(const group of groups){
      if(rows[shelf].length+(rows[shelf].length?1:0)+group.length>16 && shelf===0)shelf=1;
      if(rows[shelf].length)rows[shelf].push(null);
      rows[shelf].push(...group);
    }
    if(loose.length && rows[shelf].length)rows[shelf].push(null);
    for(const id of loose){
      if(rows[shelf].length>=16 && shelf===0)shelf=1;
      rows[shelf].push(id);
    }
    const width=Math.max(16,...rows.map(r=>r.length));
    return {rows,width};
  }
  const api={arrange,positions,orderMeld};
  if(typeof module!=='undefined')module.exports=api;else root.RackLayout=api;
})(typeof globalThis==='undefined'?this:globalThis);
