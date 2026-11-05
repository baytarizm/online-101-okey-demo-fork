'use strict';
const {performance}=require('node:perf_hooks');const fs=require('node:fs');const K=require('../server/king');const Legacy=require('../server/bots/legacy');const Bots=require('../server/bots');const {fromGame}=require('../server/bots/view');
function rng(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function seededHands(seed){const random=rng(seed),cards=K.deck();for(let i=51;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}return Array.from({length:4},(_,p)=>cards.slice(p*13,p*13+13));}
const singleton=g=>g.hands.some(h=>{const hs=h.filter(c=>c[0]==='H');return hs.length===1&&['H13','H14'].includes(hs[0]);});
function setDeal(g,seed){g.hands=seededHands(seed);}
function policy(name){if(name==='legacy')return Legacy;if(name==='random')return {chooseCard:(v,o)=>v.legal[Math.floor(o.random()*v.legal.length)],chooseContract:(v,o)=>({type:v.options[Math.floor(o.random()*v.options.length)],trump:K.SUITS[Math.floor(o.random()*4)]})};return {chooseCard:(v,o)=>Bots.chooseCard(v,{...o,difficulty:name}),chooseContract:(v,o)=>Bots.chooseContract(v,{...o,difficulty:name})};}
function match(seed,candidate='medium',opponent='legacy',settings={}){
 const g=K.create(),seat=seed%4,random=rng(seed^0xabcdef),timings=[],policies=Array.from({length:4},(_,i)=>policy(i===seat?candidate:opponent));let moves=0,illegal=0;
 setDeal(g,seed*100003);
 while(g.phase!=='finished'){
  if(g.phase==='choosing'){
   const p=g.current,v=fromGame(g,p),choice=policies[p].chooseContract(v,{...settings,random});
   if(choice.type==='rifki'){let attempt=0;while(singleton(g))setDeal(g,seed*100003+g.round*997+(++attempt)*31);}
   K.choose(g,p,choice.type,choice.trump);
  }else if(g.phase==='playing'){
   const p=g.current,v=fromGame(g,p),t=performance.now();const id=policies[p].chooseCard(v,{...settings,random});if(p===seat)timings.push(performance.now()-t);
   if(!v.legal.includes(id)){illegal++;throw Error('Illegal policy move: '+id);}K.play(g,p,id);moves++;
  }else if(g.phase==='trick')K.advance(g);
  else{K.next(g);setDeal(g,seed*100003+g.round*997);}
 }
 return {score:g.scores[seat],penalty:-g.history.filter(r=>r.type!=='koz').reduce((n,r)=>n+r.points[seat],0),win:g.scores[seat]>=0,illegal,moves,timings,byContract:Object.fromEntries(Object.keys(K.TYPES).map(t=>{const rs=g.history.filter(r=>r.type===t);return [t,{sum:rs.reduce((n,r)=>n+r.points[seat],0),n:rs.length}];}))};
}
function summarize(rows){const times=rows.flatMap(r=>r.timings).sort((a,b)=>a-b);const n=rows.length,mean=a=>a.reduce((x,y)=>x+y,0)/a.length;return {matches:n,rounds:n*20,averageScore:mean(rows.map(r=>r.score)),averagePenaltyPerMatch:mean(rows.map(r=>r.penalty)),winRate:mean(rows.map(r=>Number(r.win))),illegal:rows.reduce((n,r)=>n+r.illegal,0),decisionMs:{p50:times[Math.floor(times.length*.5)]||0,p95:times[Math.floor(times.length*.95)]||0,max:times.at(-1)||0},byContract:Object.fromEntries(Object.keys(K.TYPES).map(t=>[t,rows.reduce((n,r)=>n+r.byContract[t].sum,0)/rows.reduce((n,r)=>n+r.byContract[t].n,0)]))};}
function compare({matches=50,seed=701,candidate='medium',opponent='legacy',settings={}}={}){const before=[],after=[];for(let i=0;i<matches;i++){before.push(match(seed+i,'legacy',opponent,settings));after.push(match(seed+i,candidate,opponent,settings));}const delta=after.map((r,i)=>r.score-before[i].score),avg=delta.reduce((a,b)=>a+b,0)/matches,se=Math.sqrt(delta.reduce((n,x)=>n+(x-avg)**2,0)/Math.max(1,matches-1)/matches);return {seed,candidate,opponent,settings,before:summarize(before),after:summarize(after),pairedScoreGain:{mean:avg,ci95:[avg-1.96*se,avg+1.96*se]}};}
if(require.main===module){const args=process.argv.slice(2),get=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};const report=compare({matches:Number(get('matches',50)),seed:Number(get('seed',701)),candidate:get('candidate','medium'),opponent:get('opponent','legacy'),settings:{samples:Number(get('samples',16)),budgetMs:Number(get('budget-ms',20))}});const text=JSON.stringify(report,null,2)+'\n';if(get('out'))fs.writeFileSync(get('out'),text);process.stdout.write(text);}
module.exports={rng,seededHands,match,compare};
