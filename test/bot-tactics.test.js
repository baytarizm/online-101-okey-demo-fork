'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const K=require('../server/king');const H=require('../server/bots/heuristic');const T=require('../server/bots/tactics');const Bots=require('../server/bots');const {knowledge}=require('../server/bots/information');
const {search}=require('../server/bots/search');const {rng}=require('../scripts/bot-arena');
function position(contract,hand,trick=[],extra={}){
 const player=trick.length;
 const v={contract,hand,player,trick,played:[],trickNo:0,broken:false,cardCounts:[13,13,13,13].map((n,p)=>p===player?hand.length:n-(p<player?1:0)),...extra};
 const g={phase:'playing',contract,current:player,hands:Array.from({length:4},(_,p)=>p===player?hand:[]),trick,broken:v.broken,trump:null};
 v.legal=K.legal(g,player);return v;
}
test('male and queen ownership lets a bot cash the safe ace rather than duck',()=>{
 for(const [type,hand] of [['erkek',['S3','S11','S13','S14']],['kiz',['S2','S11','S12','S13','S14']]]){
  const v=position(type,hand,[{player:0,card:'S4'}]);
  for(const difficulty of ['medium','hard'])assert.equal(Bots.chooseCard(v,{difficulty,samples:0}),'S14');
  assert.ok(H.rankCards(v).find(r=>r.card==='S14').tacticalBonus>0);
 }
});
test('known voids or visible penalties stop the protected-suit cashing bonus',()=>{
 const hand=['S3','S11','S13','S14'];
 const voidView=position('erkek',hand,[{player:0,card:'S2'}],{played:[{player:2,card:'D2',lead:'S'}]});
 assert.equal(H.rankCards(voidView).find(r=>r.card==='S14').tacticalBonus,0);
 assert.equal(H.chooseCard(voidView),'S3');
 const visible=position('erkek',hand,[{player:0,card:'S2'},{player:1,card:'D11'}]);
 assert.equal(H.rankCards(visible).find(r=>r.card==='S14').tacticalBonus,0);
});
test('protected-suit cashing is a first-follow tactic, not a reason to open an ace or force a later lead',()=>{
 const hand=['S3','S11','S12','S13','S14'];
 for(const v of [position('kiz',hand),position('kiz',hand,[{player:0,card:'S2'}],{trickNo:2,played:[{player:2,card:'S4',lead:'S',trick:0}]})])assert.equal(H.rankCards(v).find(r=>r.card==='S14').tacticalBonus,0);
});
test('hard search with completed samples retains the protected ace tactic on a complete public position',()=>{
 for(const contract of ['erkek','kiz']){
  const hand=['S3','S11','S12','S13','S14','H2','H3','H4','D2','D3','D4','C2','C3'];
  const v=position(contract,hand,[{player:0,card:'S2'}],{counts:[0,0,0,0],scores:[0,0,0,0]});
  const r=search(v,{samples:4,budgetMs:35,now:()=>0,random:rng(2201)});assert.equal(r.samples,4);assert.equal(r.card,'S14');
 }
});
test('an unaccounted suit penalty or a forced penalty is never treated as safe',()=>{
 const v=position('erkek',['S3','S13','S14'],[{player:0,card:'S2'}]);
 assert.equal(H.rankCards(v).find(r=>r.card==='S14').tacticalBonus,0);
 const forced=position('erkek',['S3','S11','S13','S14'],[{player:0,card:'S12'}]);
 assert.deepEqual(forced.legal,['S11']);assert.equal(Bots.chooseCard(forced),'S11');
});
test('last-two sheds winning high cards through trick eleven and ducks on the penalized tricks',()=>{
 for(const trickNo of [0,9,10]){
  const v=position('son',['S2','S8','S14'],[{player:0,card:'S7'}],{trickNo});assert.equal(H.chooseCard(v),'S14');
 }
 for(const trickNo of [11,12]){
  const v=position('son',['S2','S8','S14'],[{player:0,card:'S7'}],{trickNo});assert.equal(H.chooseCard(v),'S2');
 }
});
test('hearts are led low after breaking, but remain illegal before breaking',()=>{
 const hand=['H4','H14','S2'];
 const broken=position('kupa',hand,[],{broken:true});assert.equal(H.chooseCard(broken),'H4');
 const closed=position('kupa',hand);assert.deepEqual(closed.legal,['S2']);assert.equal(Bots.chooseCard(closed),'S2');
 const only=position('kupa',['H4','H14']);assert.ok(only.legal.includes('H4'));
});
test('when heart eight and ace both must take four-five-seven, all non-easy levels spend the ace',()=>{
 const v=position('kupa',['H8','H14'],[{player:0,card:'H4'},{player:1,card:'H5'},{player:2,card:'H7'}]);
 for(const difficulty of ['medium','hard'])assert.equal(Bots.chooseCard(v,{difficulty,samples:4}),'H14');
 assert.equal(T.equivalentWinner(v),'H14');
});
test('equivalent-winner shortcut preserves escapes, distinct penalty values, and trump policy',()=>{
 const trick=[{player:0,card:'H4'},{player:1,card:'H5'},{player:2,card:'H7'}];
 assert.equal(T.equivalentWinner(position('kupa',['H2','H8','H14'],trick)),null);
 assert.equal(T.equivalentWinner(position('rifki',['H13','H14'],trick)),null);
 assert.equal(T.equivalentWinner({...position('koz',['H8','H14'],trick),trump:'H'}),null);
 const v=position('kupa',['H8','H14'],trick.slice(0,2));assert.equal(T.equivalentWinner(v),null);
});
test('tactics cannot obtain opponent hands, do not mutate the view, and stay finite',()=>{
 const v=position('erkek',['S3','S11','S13','S14'],[{player:0,card:'S2'}]),before=JSON.stringify(v);
 Object.defineProperty(v,'hands',{get(){throw Error('Opponent hands accessed');}});
 const info=knowledge(v);for(const row of H.rankCards(v,{info}))assert.ok(Number.isFinite(row.utility));
 assert.equal(H.chooseCard(v),'S14');assert.equal(JSON.stringify(v),before);
});
