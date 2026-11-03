/* Shared evaluator: server authority, opening previews and bot planning. */
(function(root) {
'use strict';
const COLORS=['Sari','Mavi','Siyah','Kirmizi'];
const DEFAULTS=Object.freeze({TAS_SAYISI:106,ILK_ACAN_TAS:22,ACMA_BARAJI_SERI:101,ACMA_BARAJI_CIFT:5,ISLEME_ACIK:true,ORTAK_ISLEME:true,OKEY_YERDEN_ALINABILIR:false,OKEY_ATMA_YASAK:false,TUR_SURESI_SN:30,SERI_DONUSU:false,SAHTE_OKEY_MODU:'GOSTERGE',JOKER_AYNI_TUR_KULLAN:true,BITIS_ISLEYEREK:true,ESIN_ELI_KAPANIR:true,ACMAMIS_CEZA:202,NORMAL_CARPAN:1,OKEY_CARPAN:2,CIFT_CARPAN:2,ELDEN_CARPAN:2,KAZANAN_PUAN:-101,ELDE_OKEY_CEZA:101,ISLER_TAS_CEZA:101,RENK_SIMGE:true,OKEY_PARLAT:true,CEKME_MS:250,ATMA_MS:300,ACMA_MS:400});
const failure=(code,message)=>Object.assign(new Error(message),{code});
function config(input={}) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw failure('GECERSIZ_AYAR','Geçersiz masa ayarı.');
 const result={...DEFAULTS};
 for(const [key,value] of Object.entries(input)) {
  if(!Object.prototype.hasOwnProperty.call(DEFAULTS,key)||typeof value!==typeof DEFAULTS[key]||typeof value==='number'&&(!Number.isInteger(value)||value<(key==='KAZANAN_PUAN'?-10000:0)||value>10000))throw failure('GECERSIZ_AYAR','Geçersiz ayar: '+key);
  result[key]=value;
 }
 if(result.TAS_SAYISI!==106||result.ILK_ACAN_TAS!==22||result.ACMA_BARAJI_CIFT<1||result.ACMA_BARAJI_CIFT>11||result.ACMA_BARAJI_SERI<1||result.TUR_SURESI_SN>600||!['GOSTERGE','OKEY','JOKER'].includes(result.SAHTE_OKEY_MODU))throw failure('GECERSIZ_AYAR','Taş sayısı, açılış barajı veya süre geçersiz.');
 return result;
}
const settings=g=>g.config||DEFAULTS;
const effective=(g,t)=>t.isFakeJoker?(settings(g).SAHTE_OKEY_MODU==='GOSTERGE'?g.indicator||g.okey:g.okey):t;
const wild=(g,t)=>t.isFakeJoker?settings(g).SAHTE_OKEY_MODU==='JOKER':t.color===g.okey.color&&t.number===g.okey.number;
function meld(game,tiles,pairs=false,values={}) {
 if(!Array.isArray(tiles)||tiles.some(t=>!t)||new Set(tiles.map(t=>t.id)).size!==tiles.length)return null;
 if(pairs?tiles.length!==2:tiles.length<3||tiles.length>13)return null;
 const normals=tiles.filter(t=>!wild(game,t)),jokers=tiles.filter(t=>wild(game,t)),known=normals.map(t=>effective(game,t));
 const accepts=(t,v)=>{const lock=values[t.id]||t.joker_deger;return !lock||lock.color===v.color&&lock.number===v.number;};
 function result(type,ordered,assigned) {
  if(jokers.some(t=>!assigned[t.id]||!COLORS.includes(assigned[t.id].color)||!Number.isInteger(assigned[t.id].number)||assigned[t.id].number<1||assigned[t.id].number>13||!accepts(t,assigned[t.id])))return null;
  return {type,score:pairs?0:ordered.reduce((s,t)=>s+(assigned[t.id]||effective(game,t)).number,0),tiles:ordered.map(t=>wild(game,t)?{...t,joker_deger:assigned[t.id]}:{...t})};
 }
 if(pairs) {
  const value=known[0]||values[jokers[0]?.id]||jokers[0]?.joker_deger||{color:COLORS[0],number:1};
  if(known.some(t=>t.color!==value.color||t.number!==value.number))return null;
  return result('CIFT',tiles,Object.fromEntries(jokers.map(t=>[t.id,value])));
 }
 if(tiles.length<=4&&known.every(t=>t.number===known[0]?.number)&&new Set(known.map(t=>t.color)).size===known.length) {
  const number=known[0]?.number||values[jokers[0]?.id]?.number||jokers[0]?.joker_deger?.number||13;
  const free=COLORS.filter(c=>!known.some(t=>t.color===c)),assigned={};let valid=true;
  for(const t of jokers){const lock=values[t.id]||t.joker_deger;if(lock){const at=free.indexOf(lock.color);if(at<0||lock.number!==number){valid=false;break;}assigned[t.id]=lock;free.splice(at,1);}}
  for(const t of jokers)if(!assigned[t.id])assigned[t.id]={color:free.shift(),number};
  if(valid){const ordered=[...tiles].sort((a,b)=>COLORS.indexOf((assigned[a.id]||effective(game,a)).color)-COLORS.indexOf((assigned[b.id]||effective(game,b)).color));const found=result('KUT',ordered,assigned);if(found)return found;}
 }
 if(known.length&&(!known.every(t=>t.color===known[0].color)||new Set(known.map(t=>t.number)).size!==known.length))return null;
 const color=known[0]?.color||values[jokers[0]?.id]?.color||jokers[0]?.joker_deger?.color||COLORS[0];
 for(let start=13;start>=1;start--){
  const numbers=Array.from({length:tiles.length},(_,i)=>settings(game).SERI_DONUSU?(start+i-1)%13+1:start+i);
  if(numbers.some(n=>n>13)||known.some(t=>!numbers.includes(t.number)))continue;
  const ordered=[],assigned={},free=[...jokers];let valid=true;
  for(const number of numbers){const natural=normals.find(t=>effective(game,t).number===number);if(natural){ordered.push(natural);continue;}const value={color,number};const at=free.findIndex(t=>accepts(t,value));if(at<0){valid=false;break;}const [t]=free.splice(at,1);ordered.push(t);assigned[t.id]=value;}
  if(valid){const found=result('SERI',ordered,assigned);if(found)return found;}
 }
 return null;
}
const groupValue=(g,t,p=false)=>meld(g,t,p)?.score??null;
const api={COLORS,DEFAULTS,config,failure,settings,effective,wild,meld,groupValue};
if(typeof module!=='undefined')module.exports=api;else root.GameRules=api;
})(typeof globalThis==='undefined'?this:globalThis);
