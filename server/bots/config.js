'use strict';
const LEVELS={easy:{samples:0,budgetMs:0,mistakeRate:.35},medium:{samples:0,budgetMs:0,mistakeRate:0},hard:{samples:24,budgetMs:35,mistakeRate:0}};
function number(value,fallback,min,max){const n=Number(value);return value!==undefined&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function settings(options={}){const difficulty=Object.hasOwn(LEVELS,options.difficulty)?options.difficulty:'medium',preset=LEVELS[difficulty];return {...preset,difficulty,samples:Math.floor(number(options.samples,preset.samples,0,256)),budgetMs:number(options.budgetMs,preset.budgetMs,0,100),random:typeof options.random==='function'?options.random:Math.random};}
module.exports={LEVELS,settings};
