'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {arrange,positions}=require('../public/js/rack-layout');
const {groupValue}=require('../server/rules');
const okey={color:'Kirmizi',number:1};
let serial=0;
const tile=(color,number)=>({id:'layout-'+serial++,color,number,isFakeJoker:false});
function verify(tiles,result,pairs) {
  const ids=[...result.groups.flat(),...result.loose];
  assert.equal(new Set(ids).size,tiles.length);assert.equal(ids.length,tiles.length);
  const map=new Map(tiles.map(t=>[t.id,t]));
  for(const group of result.groups)assert.notEqual(groupValue({okey},group.map(id=>map.get(id)),pairs),null);
}
test('seri diz separates valid runs and sets without losing loose tiles',()=>{
  const tiles=[tile('Mavi',10),tile('Yesil',8),tile('Mavi',8),tile('Siyah',8),tile('Mavi',9),tile('Yesil',3),tile('Kirmizi',8)];
  const result=arrange(tiles,okey);verify(tiles,result,false);
  assert.equal(result.groups.length,2);assert.equal(result.groups.flat().length,6);assert.equal(result.loose.length,1);
  const layout=positions(result.groups,result.loose);
  assert.equal(layout.rows[0][3],null);
});
test('çift diz leaves one gap between every pair including duplicate fours',()=>{
  const tiles=Array.from({length:4},()=>tile('Mavi',6)).concat([tile('Siyah',9),tile('Siyah',9),tile('Yesil',2)]);
  const result=arrange(tiles,okey,true);verify(tiles,result,true);
  assert.deepEqual(result.groups.map(g=>g.length),[2,2,2]);
  const row=positions(result.groups,result.loose).rows[0];assert.equal(row[2],null);assert.equal(row[5],null);
});
test('sorting supports fake and real okey; no 12-13-1 wrap',()=>{
  const tiles=[tile('Mavi',11),tile('Mavi',13),tile('Kirmizi',1),{...tile('Sahte',0),isFakeJoker:true},tile('Kirmizi',2),tile('Kirmizi',3)];
  const result=arrange(tiles,okey);verify(tiles,result,false);assert.equal(result.groups.flat().length,6);
  const wrap=[tile('Yesil',12),tile('Yesil',13),tile('Yesil',1)];assert.equal(arrange(wrap,okey).groups.length,0);
});
test('rack keeps each meld on a shelf, all pairs visible in two rows',()=>{
  const groups=Array.from({length:11},(_,i)=>['p'+i+'a','p'+i+'b']);const layout=positions(groups,[]);
  assert.equal(layout.rows.length,2);
  for(const group of groups)assert(layout.rows.some(row=>row.includes(group[0])&&row.includes(group[1])));
  assert.equal(layout.rows.flat().filter(x=>x!==null).length,22);
});
