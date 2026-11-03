/* Local-only rack commands. Every edit conserves physical tile IDs. */
(function(root){
'use strict';
const Rules=typeof module!=='undefined'?require('./game-rules'):root.GameRules;
function orderMeld(tiles,okey,game={}){return Rules.meld({...game,okey},tiles,tiles.length===2)?.tiles||tiles;}
function sort(tiles,game,mode='SERI'){
 const special=t=>t.isFakeJoker||Rules.wild(game,t);
 const compare=(a,b)=>Rules.COLORS.indexOf(a.color)-Rules.COLORS.indexOf(b.color)||a.number-b.number||a.id.localeCompare(b.id);
 const rest=tiles.filter(t=>!special(t)).sort(compare),end=tiles.filter(special),groups=[];
 if(mode==='CIFT'){
  while(rest.length){const a=rest.shift(),at=rest.findIndex(b=>a.color===b.color&&a.number===b.number);groups.push(at<0?[a.id]:[a.id,rest.splice(at,1)[0].id]);}
  groups.sort((a,b)=>b.length-a.length);
 }else if(mode==='KUT'){
  for(let n=1;n<=13;n++){
   const numbered=rest.filter(t=>t.number===n);
   while(numbered.length){const chosen=[];for(const color of Rules.COLORS){const at=numbered.findIndex(t=>t.color===color);if(at>=0)chosen.push(numbered.splice(at,1)[0].id);}if(!chosen.length)break;groups.push(chosen);}
  }
 }else{
  for(const t of rest){const prev=groups.at(-1),last=prev&&tiles.find(x=>x.id===prev.at(-1));if(last&&last.color===t.color&&t.number===last.number+1)prev.push(t.id);else groups.push([t.id]);}
 }
 if(end.length)groups.push(end.map(t=>t.id));
 return {groups,loose:[]};
}
// Compatibility API used by earlier callers, now using the canonical validator.
function arrange(tiles,okey,pairs=false){
 const game={okey},groups=[],remaining=[...tiles];
 if(pairs){for(let a=0;a<remaining.length;a++){for(let b=a+1;b<remaining.length;b++)if(Rules.meld(game,[remaining[a],remaining[b]],true)){groups.push([remaining[a].id,remaining[b].id]);remaining.splice(b,1);remaining.splice(a--,1);break;}}}
 else{
  let found=true;while(found){found=false;outer:for(let a=0;a<remaining.length;a++)for(let b=a+1;b<remaining.length;b++)for(let c=b+1;c<remaining.length;c++){const m=Rules.meld(game,[remaining[a],remaining[b],remaining[c]]);if(m){groups.push(m.tiles.map(t=>t.id));[c,b,a].forEach(i=>remaining.splice(i,1));found=true;break outer;}}}
 }
 return {groups,loose:remaining.map(t=>t.id)};
}
function positions(groups,loose){
 const chunks=[...groups.filter(g=>g.length),...loose.map(id=>[id])];
 for(const gap of [1,0]){
  const rows=[[],[]];let failed=false;
  for(const group of chunks){let r=rows.findIndex(row=>row.length+(row.length?gap:0)+group.length<=15);if(r<0){failed=true;break;}if(rows[r].length&&gap)rows[r].push(null);rows[r].push(...group);}
  if(!failed)return {rows:rows.map(row=>[...row,...Array(15-row.length).fill(null)]),width:15};
 }
 const ids=chunks.flat();if(ids.length>30)throw Error('Istaka kapasitesi aşıldı.');
 return {rows:[ids.slice(0,15),ids.slice(15)].map(row=>[...row,...Array(15-row.length).fill(null)]),width:15};
}
class Rack {
 constructor(ids=[],saved=null){this.slots=saved?.length===30?[...saved]:[...ids,...Array(Math.max(0,30-ids.length)).fill(null)];this.past=[];this.future=[];this.reconcile(ids);}
 reconcile(ids){const wanted=new Set(ids);this.slots=this.slots.map(id=>wanted.has(id)?id:null);const seen=new Set();this.slots=this.slots.map(id=>{if(!id||seen.has(id))return null;seen.add(id);return id;});for(const id of ids)if(!seen.has(id)){const at=this.slots.indexOf(null);if(at<0)throw Error('Istaka dolu.');this.slots[at]=id;seen.add(id);}}
 apply(fn){const before=[...this.slots];try{fn();const valid=a=>a.filter(Boolean).sort().join('|');if(this.slots.length!==30||valid(before)!==valid(this.slots))throw Error('Taş kümesi değiştirilemez.');}catch(e){this.slots=before;throw e;}if(JSON.stringify(before)!==JSON.stringify(this.slots)){this.past.push(before);this.past=this.past.slice(-20);this.future=[];}}
 move(id,row,col,mode='swap',ids=[id]){if(!Number.isInteger(row)||row<0||row>1||!Number.isInteger(col)||col<0||col>14)throw Error('Geçersiz slot.');this.apply(()=>{
  const at=row*15+col,from=this.slots.indexOf(id);if(from<0)throw Error('Taş bulunamadı.');
  if(mode==='group'){const selected=ids.filter(x=>this.slots.includes(x));if(col+selected.length>15)throw Error('Grup satıra sığmıyor.');const clean=this.slots.map(x=>selected.includes(x)?null:x);if(clean.slice(at,at+selected.length).some(Boolean))throw Error('Grup için boş alan seçin.');selected.forEach((x,j)=>clean[at+j]=x);this.slots=clean;}
  else if(mode==='insert'){this.slots[from]=null;const end=row*15+15,empty=this.slots.findIndex((x,j)=>j>=at&&j<end&&!x);if(empty<0)throw Error('Satırda boşluk yok.');for(let j=empty;j>at;j--)this.slots[j]=this.slots[j-1];this.slots[at]=id;}
  else {if(mode==='empty'&&this.slots[at])throw Error('Boş slot seçin.');[this.slots[from],this.slots[at]]=[this.slots[at],this.slots[from]];}
 });}
 arrange(result,row){this.apply(()=>{if(row===undefined)this.slots=positions(result.groups,result.loose).rows.flat();else {if(row!==0&&row!==1)throw Error('Geçersiz satır.');const ids=[...result.groups.flat(),...result.loose];if(ids.length>15)throw Error('Satır dolu.');this.slots.splice(row*15,15,...ids,...Array(15-ids.length).fill(null));}});}
 gap(row,col,count=1){if(!Number.isInteger(count)||count<1||count>15||!Number.isInteger(row)||row<0||row>1||!Number.isInteger(col)||col<0||col+count>15)throw Error('Geçersiz boşluk.');this.apply(()=>{const start=row*15,end=start+15,segment=this.slots.slice(start,end);for(let i=0;i<count;i++){const empty=segment.lastIndexOf(null);if(empty<col)throw Error('Yeterli boşluk yok.');segment.splice(empty,1);segment.splice(col,0,null);}this.slots.splice(start,15,...segment);});}
 undo(ids){if(!this.past.length)return;this.future.push([...this.slots]);this.slots=this.past.pop();this.reconcile(ids);}
 redo(ids){if(!this.future.length)return;this.past.push([...this.slots]);this.slots=this.future.pop();this.reconcile(ids);}
}
const api={sort,arrange,positions,orderMeld,Rack};if(typeof module!=='undefined')module.exports=api;else root.RackLayout=api;
})(typeof globalThis==='undefined'?this:globalThis);
