'use strict';
const fs=require('node:fs');const path=require('node:path');
const current=require('./bot-arena');const {interval,placement}=require('./bot-statistics');
function compare(baselineRoot,{matches=200,seed=63001,opponent='legacy',difficulty='medium',settings={}}={}){
 const baseline=require(path.resolve(baselineRoot,'scripts/bot-arena.js')),before=[],after=[];
 for(let i=0;i<matches;i++){before.push(baseline.match(seed+i,difficulty,opponent,settings));after.push(current.match(seed+i,difficulty,opponent,settings));}
 const paired=key=>interval(after.map((r,i)=>key(r)-key(before[i])));
 const first=r=>placement(r.scores,r.seat).firstShare;
 return {seed,matches,roundsPerVersion:matches*20,difficulty,opponent,settings,before:current.summarize(before),after:current.summarize(after),firstPlaceShare:{before:before.reduce((n,r)=>n+first(r),0)/matches,after:after.reduce((n,r)=>n+first(r),0)/matches},pairedScoreGain:paired(r=>r.score),pairedPenaltyReduction:paired(r=>-r.penalty),byContract:Object.fromEntries(Object.keys(before[0].byContract).map(type=>[type,paired(r=>r.byContract[type].sum/r.byContract[type].n)])),note:'Paired seeds and rotating candidate seat. Bootstrap resamples whole matches. winRate is score >=0; firstPlaceShare splits tied first places. Timing is measured locally, not a mobile or production benchmark.'};
}
if(require.main===module){const root=process.argv[2];if(!root)throw Error('Usage: node scripts/bot-tactics-validation.js BASELINE_ROOT [OUT] [SEED] [MATCHES]');const report=compare(root,{seed:Number(process.argv[4]||63001),matches:Number(process.argv[5]||200)}),text=JSON.stringify(report,null,2)+'\n';if(process.argv[3])fs.writeFileSync(process.argv[3],text);process.stdout.write(text);}
module.exports={compare};
