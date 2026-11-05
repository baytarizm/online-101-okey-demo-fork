'use strict';
(function(root){const handRows=(hand,descending=false)=>['SH','CD'].map(suits=>hand.filter(id=>suits.includes(id[0])).sort((a,b)=>suits.indexOf(a[0])-suits.indexOf(b[0])||(descending?-1:1)*(Number(a.slice(1))-Number(b.slice(1)))));if(typeof module==='object'&&module.exports)module.exports={handRows};else root.KingHand={handRows};})(typeof window==='object'?window:globalThis);
