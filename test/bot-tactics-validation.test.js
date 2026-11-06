'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const {compare}=require('../scripts/bot-tactics-validation');
test('paired tactics report reproduces zero change for identical policies and includes contract intervals',()=>{
 const r=compare(path.resolve(__dirname,'..'),{matches:2,seed:70001});
 assert.equal(r.pairedScoreGain.mean,0);assert.deepEqual(r.pairedScoreGain.ci,[0,0]);assert.equal(r.before.illegal+r.after.illegal,0);
 assert.ok(Number.isFinite(r.firstPlaceShare.after));for(const x of Object.values(r.byContract))assert.deepEqual(x.ci,[0,0]);
});
