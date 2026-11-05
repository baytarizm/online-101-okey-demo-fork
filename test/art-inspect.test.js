'use strict';
const {test}=require('node:test');const {execFileSync}=require('node:child_process');const assert=require('node:assert/strict');
test('inspect existing avatar reference artwork',{skip:process.env.CI!=='true'},()=>{
 execFileSync('python',['-m','pip','install','--quiet','Pillow'],{stdio:'inherit'});
 const result=execFileSync('python',['-c',"from PIL import Image; import io,base64; im=Image.open('public/assets/lounge.avif').convert('RGB'); im.thumbnail((1000,1000)); out=io.BytesIO(); im.save(out,format='PNG'); print('ART_PREVIEW_BEGIN'+base64.b64encode(out.getvalue()).decode()+'ART_PREVIEW_END')"],{encoding:'utf8'});
 assert.ok(result.includes('ART_PREVIEW_BEGIN'));console.log(result);
});
