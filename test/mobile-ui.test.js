const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {handRows}=require('../public/js/hand-layout');
test('two rows retain all cards in black/red suit groups without mutating the hand',()=>{
 const hand=['D14','H3','S8','C2','S2','H14','C13'],original=hand.slice();
 assert.deepEqual(handRows(hand),[['S2','S8','H3','H14'],['C2','C13','D14']]);
 assert.deepEqual(handRows(hand,true),[['S8','S2','H14','H3'],['C13','C2','D14']]);assert.deepEqual(hand,original);
});
test('sparse and single-suit hands keep each card once',()=>{
 for(const suit of 'SHCD'){const hand=Array.from({length:13},(_,i)=>suit+(i+2));assert.deepEqual(handRows(hand).flat().sort(),hand.slice().sort());}
 assert.deepEqual(handRows([]),[[],[]]);
});
function ui(){
 const nodes=new Map(),listeners={},messages=[],emits=[],removed=[];
 const node=s=>{if(!nodes.has(s))nodes.set(s,{textContent:'',classList:{add(){},remove(){}},innerHTML:'',value:'',reportValidity:()=>true,focus(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(s);};
 const socket={connected:true,on:(n,f)=>listeners[n]=f,timeout:()=>({emit:(event,data,ack)=>{emits.push({event,data});socket.ack=ack;}}),disconnect(){socket.connected=false;}};
 const parent={postMessage:(data,origin)=>messages.push({data,origin})};
 const window={KingHand:{handRows},parent,addEventListener(){}};
 const ctx=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[]},window,io:()=>socket,localStorage:{getItem:()=>null,removeItem:key=>removed.push(key)},location:{search:''},URLSearchParams,setInterval(){},setTimeout(){},clearTimeout(){},Date,console});
 vm.runInContext(fs.readFileSync('public/js/king.js','utf8'),ctx);
 const state={phase:'choosing',playerIndex:0,current:0,owner:0,round:1,roomCode:'ABC123',scores:[0,0,0,0],players:['Ömer','Bot Tavuk','Bot At','Bot Koyun'].map((name,i)=>({name,isBot:i>0,avatar:['sigir','tavuk','at','koyun'][i],cardCount:13})),history:[],trick:[],hand:['S2','H14','C3','D8'],legal:['S2'],options:['el'],serverNow:Date.now()};
 return {node,listeners,socket,messages,emits,removed,state,ctx};
}
test('only the chooser gets an icon menu inside the table; legal card enabling is preserved',()=>{
 const u=ui();assert.match(u.node('#app').innerHTML,/Masa kur/);u.listeners.state(u.state);
 let html=u.node('#app').innerHTML;assert.ok(html.indexOf('id="contract-picker"')>html.indexOf('aria-label="King masası"'));
 assert.ok(html.indexOf('id="contract-picker"')<html.indexOf('</section>'));
 assert.ok(html.indexOf('Oyununu seç')<html.indexOf('Elindeki kartlar'));assert.match(html,/♥K/);assert.match(html,/0\/2 oynandı/);
 assert.match(html,/data-card="S2"  aria-label/);assert.match(html,/data-card="H14" disabled/);
 assert.match(html,/id="toggle-trump"[^>]+disabled/);assert.match(html,/id="trump-suits" class="trump-suits" hidden/);
 u.listeners.state({...u.state,owner:1,current:1});assert.doesNotMatch(u.node('#app').innerHTML,/id="contract-picker"/);
});
test('trump suits open without sending a contract; pausing keeps cards disabled',()=>{
 const u=ui();u.listeners.state({...u.state,round:5,options:['koz']});u.node('#toggle-trump').onclick();
 assert.match(u.node('#app').innerHTML,/id="trump-suits" class="trump-suits"  aria-label/);assert.equal(u.emits.length,0);
 u.listeners.state({...u.state,paused:true});assert.match(u.node('#app').innerHTML,/data-card="S2" disabled/);
});
test('the traditional deck contains matching artwork for all 52 card IDs',()=>{
 const u=ui(),svg=fs.readFileSync('public/assets/cards.svg','utf8');
 for(const suit of 'SHDC')for(let rank=2;rank<=14;rank++){
  const html=vm.runInContext('card('+JSON.stringify(suit+rank)+')',u.ctx),fragment=html.match(/cards.svg#([^"]+)/)[1];
  assert.ok(svg.includes('id="'+fragment+'"'),fragment);
 }
 assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b/i);
});
test('exit requires confirmation and server acknowledgement, then clears the local session',()=>{
 const u=ui();u.listeners.state(u.state);u.node('#exit-game').onclick();
 assert.equal(u.emits.length,0);u.node('#cancel-exit').onclick();assert.equal(u.node('#dialog').open,false);assert.equal(u.socket.connected,true);
 u.node('#exit-game').onclick();u.node('#confirm-exit').onclick();assert.equal(u.emits[0].event,'leaveRoom');assert.equal(u.socket.connected,true);
 u.socket.ack(null,{ok:true});assert.equal(u.socket.connected,false);assert.ok(u.removed.includes('yazboz-king-online-v1'));
 assert.equal(u.messages.at(-1).data.type,'yazboz:exit');assert.equal(u.messages.at(-1).origin,'https://yazbozhaysag.vercel.app');
});
