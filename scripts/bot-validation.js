'use strict';
const fs=require('node:fs');const path=require('node:path');const {performance}=require('node:perf_hooks');const {match}=require('./bot-arena');const {interval,placement}=require('./bot-statistics');
const PLAN={source:'fbcd904e53d4760f83a3857898d1fef4c3ce2ef0',seed:48001,matches:200,settings:{samples:24,budgetMs:35,fixedSamples:false},scenarios:['legacy/medium','easy/medium','medium/medium','hard/medium','mixed:hard-medium-easy-legacy'],metrics:['mean score','nonnegative >=0','first place shared on tie','sole first','average rank'],note:'No bot policy tuning on these seeds. Production sample/time settings; wall-clock timing can change sample count. Each independent seed rotates seats. Bootstrap resamples complete matches.'};
function summarize(rows,level,onlyCandidate){const values=rows.map(r=>{const seat=onlyCandidate?r.seat:r.levels.indexOf(level);return {score:r.scores[seat],...placement(r.scores,seat)};});return Object.fromEntries(['score','nonnegative','firstShare','soleFirst','rank'].map(k=>[k,interval(values.map(v=>v[k]))]));}
function run(directory='reports/validation'){
 fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'plan.json'),JSON.stringify(PLAN,null,2)+'\n');const results={};
 for(const scenario of PLAN.scenarios){const file=path.join(directory,scenario.replace(/[^a-z-]/g,'-')+'.json');if(fs.existsSync(file)){results[scenario]=JSON.parse(fs.readFileSync(file));console.log('Existing '+scenario);continue;}
  const mixed=scenario.startsWith('mixed:'),candidate=scenario.split('/')[0],rows=[];const start=performance.now();
  for(let i=0;i<PLAN.matches;i++){const r=match(PLAN.seed+i,mixed?'hard':candidate,'medium',{...PLAN.settings,...(mixed?{lineup:['hard','medium','easy','legacy']}:{})});rows.push({seed:PLAN.seed+i,seat:r.seat,levels:r.levels,scores:r.scores,illegal:r.illegal});if((i+1)%20===0)console.log(JSON.stringify({scenario,completed:i+1,total:PLAN.matches,elapsedSeconds:Math.round((performance.now()-start)/1000)}));}
  const result={scenario,plan:PLAN,elapsedSeconds:(performance.now()-start)/1000,illegal:rows.reduce((n,r)=>n+r.illegal,0),summary:mixed?Object.fromEntries(['hard','medium','easy','legacy'].map(level=>[level,summarize(rows,level,false)])):{[candidate]:summarize(rows,candidate,true)},rows};
  fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');results[scenario]=result;console.log(JSON.stringify({scenario,summary:result.summary,illegal:result.illegal}));
 }
 const hard=results['hard/medium'].rows,medium=results['medium/medium'].rows;
 const hardGain=interval(hard.map((r,i)=>r.scores[r.seat]-medium[i].scores[medium[i].seat]));
 const mixed=results[PLAN.scenarios.at(-1)].rows;const mixedGap=interval(mixed.map(r=>r.scores[r.levels.indexOf('hard')]-r.scores[r.levels.indexOf('medium')]));
 const summary={plan:PLAN,pairedHardVsMedium:hardGain,sameTableHardMinusMedium:mixedGap,scenarios:Object.fromEntries(Object.entries(results).map(([s,r])=>[s,{summary:r.summary,illegal:r.illegal}]))};fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');return summary;
}
if(require.main===module)run(process.argv[2]);module.exports={PLAN,run,summarize};
